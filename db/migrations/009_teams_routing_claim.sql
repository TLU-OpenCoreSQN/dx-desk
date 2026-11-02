-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
CREATE TABLE public.teams (
  id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO public.teams(id,code,name) VALUES
 ('30000000-0000-4000-8000-000000000001','network','Network Team'),
 ('30000000-0000-4000-8000-000000000002','identity','Identity Team'),
 ('30000000-0000-4000-8000-000000000003','support','IT Support');
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams FORCE ROW LEVEL SECURITY;
CREATE POLICY teams_read ON public.teams FOR SELECT TO authenticated USING(private.is_staff());
GRANT SELECT ON public.teams TO authenticated;
CREATE TABLE private.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id),user_id uuid NOT NULL,
  display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 1 AND 255),
  active boolean NOT NULL DEFAULT true,PRIMARY KEY(team_id,user_id)
);
ALTER TABLE public.routing_rules ADD COLUMN team_id uuid REFERENCES public.teams(id);
UPDATE public.routing_rules r SET team_id=t.id FROM public.teams t WHERE r.team=t.name;
ALTER TABLE public.tickets ADD COLUMN assigned_team_id uuid REFERENCES public.teams(id);
-- Restore the team's identity for work already underway on a week-3 volume.
-- This precedes the new assignment audit trigger; no historical action is fabricated.
UPDATE public.tickets t SET assigned_team_id=r.team_id FROM public.routing_rules r
WHERE t.category_id=r.category_id AND r.active AND t.status IN ('assigned','in_progress','waiting_user','resolved','closed');
CREATE INDEX tickets_team_queue_idx ON public.tickets(assigned_team_id,status,created_at DESC);

CREATE FUNCTION private.sync_roster(p_members jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE member jsonb; changed integer:=0;
BEGIN
 PERFORM private.require_automation();
 IF jsonb_typeof(p_members) IS DISTINCT FROM 'array' OR jsonb_array_length(p_members)>100
 THEN RAISE sqlstate '22023' USING MESSAGE='Invalid roster batch'; END IF;
 FOR member IN SELECT value FROM jsonb_array_elements(p_members) LOOP
   IF jsonb_typeof(member) IS DISTINCT FROM 'object' OR NOT EXISTS(
     SELECT 1 FROM public.teams WHERE id=(member->>'team_id')::uuid AND active)
     OR coalesce(length(btrim(member->>'display_name')),0) NOT BETWEEN 1 AND 255
     OR jsonb_typeof(member->'active') IS DISTINCT FROM 'boolean'
   THEN RAISE sqlstate '22023' USING MESSAGE='Invalid roster member'; END IF;
   INSERT INTO private.team_members(team_id,user_id,display_name,active)
   VALUES((member->>'team_id')::uuid,(member->>'user_id')::uuid,btrim(member->>'display_name'),(member->>'active')::boolean)
   ON CONFLICT(team_id,user_id) DO UPDATE SET display_name=excluded.display_name,active=excluded.active;
   changed:=changed+1;
 END LOOP;
 RETURN changed;
END $$;
CREATE FUNCTION private.staff_teams() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR NOT private.is_staff()
 THEN RAISE sqlstate '42501' USING MESSAGE='Staff role required'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'active',t.active,
 'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',m.display_name,'active',m.active)
 ORDER BY m.display_name,m.user_id),'[]'::jsonb) FROM private.team_members m WHERE m.team_id=t.id)) ORDER BY t.name),'[]'::jsonb)
 FROM public.teams t);
END $$;
CREATE FUNCTION private.automation_teams() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM private.require_automation();
 RETURN(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'active',active) ORDER BY name),'[]'::jsonb) FROM public.teams);
END $$;
CREATE FUNCTION private.assignee_name(p_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT m.display_name FROM private.team_members m WHERE m.user_id=p_id ORDER BY m.active DESC,m.team_id LIMIT 1
$$;
CREATE FUNCTION private.team_name(p_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT name FROM public.teams WHERE id=p_id
$$;
CREATE FUNCTION private.is_team_member(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT private.is_staff() AND EXISTS(SELECT 1 FROM private.team_members m JOIN public.teams t ON t.id=m.team_id
 WHERE m.team_id=p_id AND m.user_id=private.user_id() AND m.active AND t.active)
$$;

CREATE OR REPLACE FUNCTION private.guard_ticket_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE rule record; actor_roles text[]; actor_id uuid; target_team uuid; service boolean;
BEGIN
 service:=current_setting('role',true)='ticket_automation';
 IF ROW(NEW.sla_due_at,NEW.sla_paused_ms,NEW.waiting_since) IS DISTINCT FROM ROW(OLD.sla_due_at,OLD.sla_paused_ms,OLD.waiting_since)
 THEN RAISE sqlstate '42501' USING MESSAGE='SLA clock is maintained by the system'; END IF;
 IF NEW.resolution_note IS DISTINCT FROM OLD.resolution_note AND NOT(NEW.status IS DISTINCT FROM OLD.status AND NEW.status='resolved')
 THEN RAISE sqlstate '42501' USING MESSAGE='Resolution may only change when resolving'; END IF;
 IF current_setting('role',true) IN ('authenticated','ticket_automation')
   AND ROW(NEW.assigned_to,NEW.assigned_team_id) IS DISTINCT FROM ROW(OLD.assigned_to,OLD.assigned_team_id)
   AND coalesce(current_setting('app.ticket_operation',true),'') NOT IN ('route','claim')
 THEN RAISE sqlstate '42501' USING MESSAGE='Assignment must use its dedicated operation'; END IF;
 NEW.updated_at:=now();
 NEW.ticket_version:=OLD.ticket_version+CASE WHEN
   ROW(NEW.status,NEW.assigned_to,NEW.assigned_team_id,NEW.resolution_note)
   IS DISTINCT FROM ROW(OLD.status,OLD.assigned_to,OLD.assigned_team_id,OLD.resolution_note) THEN 1 ELSE 0 END;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
   SELECT * INTO rule FROM private.ticket_transitions WHERE from_status=OLD.status AND to_status=NEW.status;
   IF NOT FOUND THEN RAISE sqlstate '45001' USING MESSAGE='Ticket transition is not allowed'; END IF;
   IF NEW.status='resolved' AND(NEW.resolution_note IS NULL OR length(btrim(NEW.resolution_note)) NOT BETWEEN 5 AND 2000)
   THEN RAISE sqlstate '45003' USING MESSAGE='Resolution note required'; END IF;
   IF service THEN
     PERFORM private.require_automation();
     IF current_setting('app.ticket_operation',true) IS DISTINCT FROM 'route'
       OR (OLD.status,NEW.status) NOT IN (('new','triaged'),('triaged','assigned'))
     THEN RAISE sqlstate '45002' USING MESSAGE='Service transition is not allowed'; END IF;
   ELSE
     actor_id:=private.user_id();
     SELECT coalesce(array_agg(role_value),'{}'::text[]) INTO actor_roles
       FROM jsonb_array_elements_text(coalesce(private.claims()->'realm_access'->'roles','[]'::jsonb)) AS role_value;
     IF rule.requester_allowed AND actor_id IS NOT NULL AND actor_id=NEW.requester_id THEN NULL;
     ELSIF NOT(actor_roles && rule.allowed_roles) THEN RAISE sqlstate '45002' USING MESSAGE='Role transition is not allowed'; END IF;
   END IF;
   IF OLD.status='pending_approval' AND NEW.status='new'
     AND length(private.status_note()) NOT BETWEEN 5 AND 2000
   THEN RAISE sqlstate '45004' USING MESSAGE='Rejection reason required'; END IF;
   IF NEW.status='assigned' AND OLD.status IN ('triaged','pending_approval') THEN
     SELECT r.team_id INTO target_team FROM public.routing_rules r JOIN public.teams t ON t.id=r.team_id
       WHERE r.category_id=NEW.category_id AND r.active AND t.active;
     IF target_team IS NULL THEN RAISE sqlstate '45005' USING MESSAGE='Active routing team required'; END IF;
     NEW.assigned_team_id:=target_team;
   END IF;
   IF OLD.status='resolved' AND NEW.status='in_progress' THEN NEW.resolution_note:=NULL; END IF;
   IF NEW.status='waiting_user' THEN NEW.waiting_since:=now();
   ELSIF OLD.status='waiting_user' THEN
     IF OLD.waiting_since IS NOT NULL THEN
       NEW.sla_paused_ms:=OLD.sla_paused_ms+greatest(0,floor(extract(epoch FROM(now()-OLD.waiting_since))*1000)::bigint);
     END IF;
     NEW.waiting_since:=NULL;
   END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION private.audit_ticket_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO public.ticket_events(ticket_id,actor_id,event_type,payload,actor_type,actor_name)
 VALUES(NEW.id,private.user_id(),'assignment_changed',
 jsonb_build_object('team_id',NEW.assigned_team_id,'assigned_to',NEW.assigned_to),
 CASE WHEN current_setting('role',true)='ticket_automation' THEN 'system' ELSE 'user' END,private.event_actor_name());
 RETURN NEW;
END $$;
CREATE TRIGGER ticket_assignment_changed AFTER UPDATE ON public.tickets FOR EACH ROW
WHEN(ROW(OLD.assigned_team_id,OLD.assigned_to) IS DISTINCT FROM ROW(NEW.assigned_team_id,NEW.assigned_to))
EXECUTE FUNCTION private.audit_ticket_assignment();

CREATE FUNCTION private.claim_ticket(p_ticket_id uuid) RETURNS public.tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ticket public.tickets;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR NOT private.is_staff()
 THEN RAISE sqlstate '42501' USING MESSAGE='Staff role required'; END IF;
 SELECT * INTO ticket FROM public.tickets WHERE id=p_ticket_id FOR UPDATE;
 IF NOT FOUND THEN RAISE sqlstate 'PT404' USING MESSAGE='Ticket not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.team_members m JOIN public.teams t ON t.id=m.team_id
   WHERE m.team_id=ticket.assigned_team_id AND m.user_id=private.user_id() AND m.active AND t.active)
 THEN RAISE sqlstate '42501' USING MESSAGE='Active membership in the ticket team required'; END IF;
 IF ticket.assigned_to=private.user_id() THEN RETURN ticket; END IF;
 IF ticket.assigned_to IS NOT NULL THEN RAISE sqlstate 'PT409' USING MESSAGE='Already claimed by another agent'; END IF;
 IF ticket.status<>'assigned' THEN RAISE sqlstate 'PT409' USING MESSAGE='Ticket is not available for claim'; END IF;
 PERFORM set_config('app.ticket_operation','claim',true);
 UPDATE public.tickets SET assigned_to=private.user_id() WHERE id=p_ticket_id RETURNING * INTO ticket;
 RETURN ticket;
END $$;

CREATE FUNCTION private.route_ticket(p_ticket_id uuid,p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ticket public.tickets; event private.outbox; target_team uuid; outcome text:='skipped';
BEGIN
 PERFORM private.require_automation();
 SELECT * INTO event FROM private.outbox WHERE event_id=p_event_id;
 IF NOT FOUND OR event.envelope->>'ticket_id' IS DISTINCT FROM p_ticket_id::text OR event.envelope->>'event_type'<>'ticket.created'
 THEN RAISE sqlstate '22023' USING MESSAGE='Event does not identify a created ticket'; END IF;
 SELECT * INTO ticket FROM public.tickets WHERE id=p_ticket_id FOR UPDATE;
 IF NOT FOUND THEN RAISE sqlstate 'PT404' USING MESSAGE='Ticket not found'; END IF;
 IF ticket.status='new' AND ticket.ticket_version=(event.envelope->>'ticket_version')::bigint THEN
   SELECT r.team_id INTO target_team FROM public.routing_rules r JOIN public.teams t ON t.id=r.team_id
     WHERE r.category_id=ticket.category_id AND r.active AND t.active;
   IF target_team IS NULL THEN
     outcome:='unresolved';
     IF NOT EXISTS(SELECT 1 FROM public.ticket_events e WHERE e.ticket_id=ticket.id
       AND e.event_type='routing_unresolved' AND e.payload->>'source_event_id'=p_event_id::text) THEN
       INSERT INTO public.ticket_events(ticket_id,actor_id,event_type,payload,actor_type,actor_name)
         VALUES(ticket.id,private.user_id(),'routing_unresolved',jsonb_build_object('source_event_id',p_event_id),'system',private.event_actor_name());
     END IF;
   ELSE
     PERFORM set_config('app.ticket_operation','route',true);
     UPDATE public.tickets SET status='triaged' WHERE id=p_ticket_id;
     UPDATE public.tickets SET status='assigned' WHERE id=p_ticket_id RETURNING * INTO ticket;
     outcome:='routed';
   END IF;
 END IF;
 RETURN jsonb_build_object('event_id',p_event_id,'result',outcome,'ticket_id',ticket.id,'status',ticket.status,'team_id',ticket.assigned_team_id);
END $$;
CREATE FUNCTION private.process_event(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE event private.outbox; result jsonb; ticket public.tickets; kind text;
BEGIN
 PERFORM private.require_automation();
 SELECT * INTO event FROM private.outbox WHERE event_id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE sqlstate 'PT404' USING MESSAGE='Event not found'; END IF;
 SELECT i.result INTO result FROM private.inbox i WHERE event_id=p_event_id;
 IF FOUND THEN RETURN result; END IF;
 IF event.destination='automation' THEN
   result:=private.route_ticket((event.envelope->>'ticket_id')::uuid,p_event_id);
 ELSE
   SELECT * INTO ticket FROM public.tickets WHERE id=(event.envelope->>'ticket_id')::uuid;
   kind:=CASE event.envelope->>'event_type' WHEN 'ticket.assignment_changed' THEN 'assignment'
     WHEN 'ticket.sla_warning' THEN 'sla_warning' WHEN 'ticket.sla_breached' THEN 'sla_breached' ELSE 'status' END;
   result:=jsonb_build_object('event_id',p_event_id,'result','notification','ticket_id',ticket.id,'status',ticket.status,
     'team_id',ticket.assigned_team_id,'notification',jsonb_build_object('kind',kind,'team_id',ticket.assigned_team_id));
 END IF;
 IF result->>'result'<>'unresolved' THEN
   INSERT INTO private.inbox(event_id,operation,result) VALUES(p_event_id,'process',result);
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.sync_roster(jsonb),private.staff_teams(),private.automation_teams(),private.assignee_name(uuid),
 private.team_name(uuid),private.is_team_member(uuid),private.audit_ticket_assignment(),private.claim_ticket(uuid),private.route_ticket(uuid,uuid),private.process_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.staff_teams(),private.assignee_name(uuid),private.team_name(uuid),private.is_team_member(uuid),private.claim_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.sync_roster(jsonb),private.automation_teams(),private.process_event(uuid) TO ticket_automation;
