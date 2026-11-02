-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Durable domain events and a narrowly scoped service database role. Forward only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ticket_automation') THEN
    CREATE ROLE ticket_automation NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT ticket_automation TO api_login;
GRANT USAGE ON SCHEMA private TO ticket_automation;

CREATE FUNCTION private.require_automation() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'ticket_automation'
    OR private.claims()->>'role' IS DISTINCT FROM 'ticket_automation'
    OR private.claims()->>'azp' IS DISTINCT FROM 'dxdesk-automation'
    OR NOT coalesce(private.claims()->'realm_access'->'roles' ? 'ticket-automation',false)
    OR coalesce(private.claims()->>'sub','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN RAISE sqlstate '42501' USING MESSAGE='Automation identity required'; END IF;
END $$;

ALTER TABLE public.tickets ADD COLUMN ticket_version bigint NOT NULL DEFAULT 1 CHECK(ticket_version>0);
ALTER TABLE public.ticket_events ADD COLUMN actor_type text NOT NULL DEFAULT 'user' CHECK(actor_type IN ('user','system'));
ALTER TABLE public.ticket_events ADD COLUMN actor_name text NOT NULL DEFAULT '';
ALTER TABLE public.ticket_events DROP CONSTRAINT ticket_events_event_type_check;
ALTER TABLE public.ticket_events ADD CONSTRAINT ticket_events_event_type_check CHECK(event_type IN
  ('created','status_changed','assignment_changed','routing_unresolved','sla_warning','sla_breached'));

CREATE TABLE private.outbox (
  event_id uuid PRIMARY KEY REFERENCES public.ticket_events(id),
  destination text NOT NULL CHECK(destination IN ('automation','notification')),
  envelope jsonb NOT NULL CHECK(jsonb_typeof(envelope)='object'),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','delivered','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  locked_until timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending_idx ON private.outbox(available_at,created_at) WHERE status IN ('pending','processing');
CREATE TABLE private.inbox (
  event_id uuid PRIMARY KEY REFERENCES private.outbox(event_id),
  operation text NOT NULL CHECK(operation='process'),
  result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION private.event_actor_name() RETURNS text
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN current_setting('role',true)='ticket_automation' THEN 'DX-Desk automation'
 ELSE left(coalesce(private.claims()->>'preferred_username',private.claims()->>'sub','Migration'),255) END
$$;
CREATE FUNCTION private.status_note() RETURNS text
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT private.trim_form_value(coalesce(nullif(current_setting('app.status_note',true),''),
   nullif(current_setting('request.headers',true),'')::jsonb->>'x-status-note',''))
$$;

CREATE OR REPLACE FUNCTION private.audit_ticket_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  INSERT INTO public.ticket_events(ticket_id,actor_id,event_type,payload,actor_type,actor_name)
  VALUES(NEW.id,NEW.requester_id,'created',jsonb_build_object('status',NEW.status),'user',private.event_actor_name());
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.audit_ticket_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  INSERT INTO public.ticket_events(ticket_id,actor_id,event_type,payload,actor_type,actor_name)
  VALUES(NEW.id,private.user_id(),'status_changed',
    jsonb_build_object('from',OLD.status,'to',NEW.status,'note',private.status_note())
    || CASE WHEN NEW.status='resolved' THEN jsonb_build_object('resolution_note',NEW.resolution_note) ELSE '{}'::jsonb END,
    CASE WHEN current_setting('role',true)='ticket_automation' THEN 'system' ELSE 'user' END,
    private.event_actor_name());
  RETURN NEW;
END $$;
CREATE FUNCTION private.enqueue_ticket_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ticket public.tickets; category_code text; destination text;
BEGIN
  SELECT * INTO ticket FROM public.tickets WHERE id=NEW.ticket_id;
  SELECT code INTO category_code FROM public.categories WHERE id=ticket.category_id;
  destination:=CASE WHEN NEW.event_type='created' THEN 'automation' ELSE 'notification' END;
  INSERT INTO private.outbox(event_id,destination,envelope) VALUES(NEW.id,destination,jsonb_build_object(
    'schema_version',1,'event_id',NEW.id,'event_type','ticket.'||NEW.event_type,
    'occurred_at',NEW.created_at,'ticket_id',NEW.ticket_id,'ticket_version',ticket.ticket_version,
    'actor',jsonb_build_object('type',NEW.actor_type,'id',NEW.actor_id,'label',NEW.actor_name),
    'payload',jsonb_build_object('category_code',category_code,'status',ticket.status,'priority',ticket.priority,
      'team_id',to_jsonb(ticket)->'assigned_team_id')));
  RETURN NEW;
END $$;
CREATE TRIGGER ticket_event_outbox AFTER INSERT ON public.ticket_events
FOR EACH ROW EXECUTE FUNCTION private.enqueue_ticket_event();
-- Upgrade an existing volume without inventing new historical audit rows.
INSERT INTO private.outbox(event_id,destination,envelope)
SELECT e.id,'automation',jsonb_build_object('schema_version',1,'event_id',e.id,'event_type','ticket.created',
 'occurred_at',e.created_at,'ticket_id',t.id,'ticket_version',t.ticket_version,
 'actor',jsonb_build_object('type',e.actor_type,'id',e.actor_id,'label',e.actor_name),
 'payload',jsonb_build_object('category_code',c.code,'status',t.status,'priority',t.priority,'team_id',NULL))
FROM public.tickets t JOIN public.ticket_events e ON e.ticket_id=t.id AND e.event_type='created'
JOIN public.categories c ON c.id=t.category_id WHERE t.status='new';

CREATE FUNCTION private.claim_outbox(p_batch integer DEFAULT 20,p_lease_seconds integer DEFAULT 30)
RETURNS TABLE(event_id uuid,destination text,envelope jsonb,lease_token uuid,attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM private.require_automation();
  IF p_batch IS NULL OR p_batch NOT BETWEEN 1 AND 100 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 5 AND 300
  THEN RAISE sqlstate '22023' USING MESSAGE='Invalid outbox claim limits'; END IF;
  -- A worker that repeatedly dies before recording a failure must also hit the retry bound.
  UPDATE private.outbox o SET status='failed',locked_until=NULL,last_error='lease_attempts_exhausted'
    WHERE o.status='processing' AND o.locked_until<=clock_timestamp() AND o.attempts>=8;
  RETURN QUERY WITH candidates AS (
    SELECT o.event_id FROM private.outbox o
    WHERE o.attempts<8 AND ((o.status='pending' AND o.available_at<=clock_timestamp())
       OR (o.status='processing' AND o.locked_until<=clock_timestamp()))
    ORDER BY o.created_at,o.event_id FOR UPDATE SKIP LOCKED LIMIT p_batch
  ) UPDATE private.outbox o SET status='processing',attempts=o.attempts+1,
    lease_token=gen_random_uuid(),locked_until=clock_timestamp()+make_interval(secs=>p_lease_seconds)
    FROM candidates c WHERE o.event_id=c.event_id
    RETURNING o.event_id,o.destination,o.envelope,o.lease_token,o.attempts;
END $$;
CREATE FUNCTION private.complete_outbox(p_event_id uuid,p_lease_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM private.require_automation();
  UPDATE private.outbox SET status='delivered',delivered_at=clock_timestamp(),locked_until=NULL,last_error=NULL
    WHERE event_id=p_event_id AND status='processing' AND lease_token=p_lease_token AND locked_until>clock_timestamp()
      AND EXISTS(SELECT 1 FROM private.inbox i WHERE i.event_id=p_event_id);
  RETURN FOUND;
END $$;
CREATE FUNCTION private.fail_outbox(p_event_id uuid,p_lease_token uuid,p_error_code text,p_retry_seconds integer DEFAULT 5,p_terminal boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM private.require_automation();
  IF p_error_code IS NULL OR p_error_code !~ '^[a-zA-Z0-9_.:-]{1,64}$' OR p_retry_seconds IS NULL OR p_retry_seconds NOT BETWEEN 1 AND 3600
  THEN RAISE sqlstate '22023' USING MESSAGE='Invalid retry metadata'; END IF;
  UPDATE private.outbox SET status=CASE WHEN p_terminal OR attempts>=8 THEN 'failed' ELSE 'pending' END,
    available_at=clock_timestamp()+make_interval(secs=>p_retry_seconds),locked_until=NULL,last_error=p_error_code
    WHERE event_id=p_event_id AND status='processing' AND lease_token=p_lease_token AND locked_until>clock_timestamp();
  RETURN FOUND;
END $$;
CREATE FUNCTION private.outbox_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM private.require_automation();
 RETURN(SELECT jsonb_build_object('pending',count(*) FILTER(WHERE status='pending'),
  'processing',count(*) FILTER(WHERE status='processing'),'failed',count(*) FILTER(WHERE status='failed'),
  'oldest_pending_at',min(created_at) FILTER(WHERE status='pending')) FROM private.outbox);
END $$;
CREATE FUNCTION private.replay_outbox(p_event_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM private.require_automation();
 UPDATE private.outbox SET status='pending',attempts=0,available_at=clock_timestamp(),
  lease_token=NULL,locked_until=NULL,last_error=NULL WHERE event_id=p_event_id AND status='failed';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION private.require_automation(),private.event_actor_name(),private.status_note(),private.enqueue_ticket_event(),
  private.claim_outbox(integer,integer),private.complete_outbox(uuid,uuid),private.fail_outbox(uuid,uuid,text,integer,boolean),
  private.outbox_status(),private.replay_outbox(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.require_automation(),private.claim_outbox(integer,integer),
  private.complete_outbox(uuid,uuid),private.fail_outbox(uuid,uuid,text,integer,boolean),private.outbox_status(),private.replay_outbox(uuid) TO ticket_automation;
