-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- SLA uses the original 24/7 resolution budget minus completed/current user waits.
ALTER TABLE public.tickets ADD COLUMN sla_breached boolean NOT NULL DEFAULT false;
ALTER TABLE public.tickets ADD COLUMN sla_breached_at timestamptz;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_breach_timestamp_check
 CHECK(sla_breached=(sla_breached_at IS NOT NULL));
CREATE TABLE private.sla_notices (
 ticket_id uuid NOT NULL REFERENCES public.tickets(id),
 kind text NOT NULL CHECK(kind IN ('sla_warning','sla_breached')),
 event_id uuid NOT NULL UNIQUE REFERENCES private.outbox(event_id),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed','skipped')),
 created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,
 PRIMARY KEY(ticket_id,kind)
);
CREATE FUNCTION private.fail_sla_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE private.sla_notices SET status='failed' WHERE event_id=NEW.event_id AND status<>'skipped';
 RETURN NEW;
END $$;
CREATE TRIGGER outbox_notice_failed AFTER UPDATE OF status ON private.outbox FOR EACH ROW
WHEN(NEW.status='failed' AND OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION private.fail_sla_notice();
CREATE FUNCTION private.guard_sla_breach() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF ROW(NEW.sla_breached,NEW.sla_breached_at) IS DISTINCT FROM ROW(OLD.sla_breached,OLD.sla_breached_at) THEN
   PERFORM private.require_automation();
   IF current_setting('app.ticket_operation',true) IS DISTINCT FROM 'sla' OR OLD.sla_breached
   THEN RAISE sqlstate '42501' USING MESSAGE='Breach is system maintained and never reset'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ticket_sla_guard BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION private.guard_sla_breach();

CREATE FUNCTION private.evaluate_sla(p_now timestamptz DEFAULT statement_timestamp()) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ticket public.tickets; budget_ms numeric; elapsed_ms numeric; notice_kind text; event uuid; queued integer:=0;
BEGIN
 PERFORM private.require_automation();
 IF p_now IS NULL THEN RAISE sqlstate '22023' USING MESSAGE='SLA time required'; END IF;
 FOR ticket IN SELECT * FROM public.tickets
   WHERE status NOT IN ('closed','cancelled','resolved') ORDER BY created_at,id FOR UPDATE SKIP LOCKED
 LOOP
   budget_ms:=extract(epoch FROM(ticket.sla_due_at-ticket.created_at))*1000;
   elapsed_ms:=greatest(0,extract(epoch FROM(p_now-ticket.created_at))*1000-ticket.sla_paused_ms
     -CASE WHEN ticket.waiting_since IS NOT NULL THEN greatest(0,extract(epoch FROM(p_now-ticket.waiting_since))*1000) ELSE 0 END);
   notice_kind:=NULL;
   IF elapsed_ms>budget_ms THEN
     notice_kind:='sla_breached';
     IF NOT ticket.sla_breached THEN
       PERFORM set_config('app.ticket_operation','sla',true);
       UPDATE public.tickets SET sla_breached=true,sla_breached_at=sla_due_at+sla_paused_ms*interval '1 millisecond'
         WHERE id=ticket.id;
     END IF;
   ELSIF elapsed_ms>=budget_ms*0.8 AND NOT ticket.sla_breached THEN notice_kind:='sla_warning';
   END IF;
   IF notice_kind IS NOT NULL AND NOT EXISTS(SELECT 1 FROM private.sla_notices n WHERE n.ticket_id=ticket.id AND n.kind=notice_kind) THEN
     event:=gen_random_uuid();
     INSERT INTO public.ticket_events(id,ticket_id,actor_id,event_type,payload,actor_type,actor_name)
       VALUES(event,ticket.id,private.user_id(),notice_kind,'{}'::jsonb,'system',private.event_actor_name());
     INSERT INTO private.sla_notices(ticket_id,kind,event_id) VALUES(ticket.id,notice_kind,event);
     queued:=queued+1;
   END IF;
 END LOOP;
 RETURN queued;
END $$;

CREATE OR REPLACE FUNCTION private.process_event(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE event private.outbox; ack_result jsonb; ticket public.tickets; kind text;
BEGIN
 PERFORM private.require_automation();
 SELECT * INTO event FROM private.outbox WHERE event_id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE sqlstate 'PT404' USING MESSAGE='Event not found'; END IF;
 SELECT * INTO ticket FROM public.tickets WHERE id=(event.envelope->>'ticket_id')::uuid;
 SELECT i.result INTO ack_result FROM private.inbox i WHERE event_id=p_event_id;
 IF FOUND THEN
   -- A durable notice ACK can be safely superseded while external delivery is retrying.
   IF ack_result->>'result'='notification' AND event.envelope->>'event_type' IN ('ticket.sla_warning','ticket.sla_breached')
     AND(ticket.status IN ('closed','cancelled','resolved')
       OR(event.envelope->>'event_type'='ticket.sla_warning' AND ticket.sla_breached)) THEN
     ack_result:=jsonb_build_object('event_id',p_event_id,'result','skipped','ticket_id',ticket.id,'status',ticket.status,'team_id',ticket.assigned_team_id);
     UPDATE private.inbox SET result=ack_result WHERE event_id=p_event_id;
     UPDATE private.sla_notices SET status='skipped' WHERE event_id=p_event_id;
   END IF;
   RETURN ack_result;
 END IF;
 IF event.destination='automation' THEN
   ack_result:=private.route_ticket((event.envelope->>'ticket_id')::uuid,p_event_id);
 ELSE
   SELECT * INTO ticket FROM public.tickets WHERE id=(event.envelope->>'ticket_id')::uuid;
   kind:=CASE event.envelope->>'event_type' WHEN 'ticket.assignment_changed' THEN 'assignment'
     WHEN 'ticket.sla_warning' THEN 'sla_warning' WHEN 'ticket.sla_breached' THEN 'sla_breached' ELSE 'status' END;
   IF kind IN ('sla_warning','sla_breached') AND (ticket.status IN ('closed','cancelled','resolved')
     OR(kind='sla_warning' AND ticket.sla_breached)) THEN
     ack_result:=jsonb_build_object('event_id',p_event_id,'result','skipped','ticket_id',ticket.id,'status',ticket.status,'team_id',ticket.assigned_team_id);
     UPDATE private.sla_notices SET status='skipped' WHERE event_id=p_event_id;
   ELSE
     ack_result:=jsonb_build_object('event_id',p_event_id,'result','notification','ticket_id',ticket.id,'status',ticket.status,
       'team_id',ticket.assigned_team_id,'notification',jsonb_build_object('kind',kind,'team_id',ticket.assigned_team_id));
   END IF;
 END IF;
 IF ack_result->>'result'<>'unresolved' THEN
   INSERT INTO private.inbox(event_id,operation,result) VALUES(p_event_id,'process',ack_result);
 END IF;
 RETURN ack_result;
END $$;
CREATE OR REPLACE FUNCTION private.complete_outbox(p_event_id uuid,p_lease_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM private.require_automation();
 UPDATE private.outbox SET status='delivered',delivered_at=clock_timestamp(),locked_until=NULL,last_error=NULL
   WHERE event_id=p_event_id AND status='processing' AND lease_token=p_lease_token AND locked_until>clock_timestamp()
     AND EXISTS(SELECT 1 FROM private.inbox i WHERE i.event_id=p_event_id);
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE private.sla_notices SET status='sent',sent_at=clock_timestamp() WHERE event_id=p_event_id AND status<>'skipped';
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION private.fail_outbox(p_event_id uuid,p_lease_token uuid,p_error_code text,p_retry_seconds integer DEFAULT 5,p_terminal boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE terminal boolean;
BEGIN
 PERFORM private.require_automation();
 IF p_error_code IS NULL OR p_error_code !~ '^[a-zA-Z0-9_.:-]{1,64}$' OR p_retry_seconds IS NULL OR p_retry_seconds NOT BETWEEN 1 AND 3600
 THEN RAISE sqlstate '22023' USING MESSAGE='Invalid retry metadata'; END IF;
 UPDATE private.outbox SET status=CASE WHEN p_terminal OR attempts>=8 THEN 'failed' ELSE 'pending' END,
   available_at=clock_timestamp()+make_interval(secs=>p_retry_seconds),locked_until=NULL,last_error=p_error_code
   WHERE event_id=p_event_id AND status='processing' AND lease_token=p_lease_token AND locked_until>clock_timestamp()
   RETURNING status='failed' INTO terminal;
 IF NOT FOUND THEN RETURN false; END IF;
 IF terminal THEN UPDATE private.sla_notices SET status='failed' WHERE event_id=p_event_id AND status<>'skipped'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.guard_sla_breach(),private.fail_sla_notice(),private.evaluate_sla(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.evaluate_sla(timestamptz) TO ticket_automation;
