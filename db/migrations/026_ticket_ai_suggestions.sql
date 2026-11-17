-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
CREATE TABLE private.ticket_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES public.tickets(id),
  ticket_version bigint NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  priority text NOT NULL CHECK(priority IN ('low','normal','high')),
  summary text NOT NULL CHECK(length(btrim(summary)) BETWEEN 1 AND 2000),
  decision text CHECK(decision IN ('accept','ignore')),
  decided_by uuid,
  decided_at timestamptz
);
ALTER TABLE private.ticket_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.ticket_ai_suggestions FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_suggestion_staff ON private.ticket_ai_suggestions FOR SELECT TO authenticated
USING (private.is_staff() AND EXISTS (SELECT FROM public.tickets t WHERE t.id=ticket_id));
GRANT SELECT ON private.ticket_ai_suggestions TO authenticated;

ALTER TABLE public.ticket_events DROP CONSTRAINT ticket_events_event_type_check;
ALTER TABLE public.ticket_events ADD CONSTRAINT ticket_events_event_type_check CHECK(event_type IN
 ('created','status_changed','assignment_changed','routing_unresolved','sla_warning','sla_breached','ai_suggestion_applied'));

CREATE FUNCTION private.save_ai_suggestion(p_ticket uuid,p_version bigint,p_category uuid,p_team uuid,p_priority text,p_summary text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE saved private.ticket_ai_suggestions;
BEGIN
  IF session_user <> 'api_login' OR NOT private.is_staff() THEN RAISE sqlstate '42501'; END IF;
  PERFORM 1 FROM public.tickets WHERE id=p_ticket AND ticket_version=p_version AND assigned_to IS NULL
    AND status IN ('new','triaged','assigned') AND priority<>'critical' AND NOT sla_breached FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO private.ticket_ai_suggestions AS existing(ticket_id,ticket_version,category_id,team_id,priority,summary)
  VALUES(p_ticket,p_version,p_category,p_team,p_priority,p_summary)
  ON CONFLICT(ticket_id) DO UPDATE SET id=gen_random_uuid(), ticket_version=excluded.ticket_version,
    category_id=excluded.category_id,team_id=excluded.team_id,priority=excluded.priority,summary=excluded.summary
  WHERE existing.decision IS NULL AND existing.ticket_version<>excluded.ticket_version;
  SELECT * INTO saved FROM private.ticket_ai_suggestions
   WHERE ticket_id=p_ticket AND ticket_version=p_version AND decision IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',saved.id,'category_id',saved.category_id,'team_id',saved.team_id,
    'priority',saved.priority,'summary',saved.summary);
END
$$;

-- Runs after the workflow guard. It adjusts only values that the review operation has validated.
CREATE FUNCTION private.finish_ai_triage_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE minutes integer;
BEGIN
  IF session_user='api_login' AND current_setting('app.ai_triage_team',true) <> '' THEN
    IF NEW.status='assigned' THEN NEW.assigned_team_id := current_setting('app.ai_triage_team')::uuid; END IF;
    IF NEW.priority<>OLD.priority THEN
      SELECT resolution_minutes INTO STRICT minutes FROM public.sla_policies WHERE priority=NEW.priority;
      NEW.sla_due_at:=NEW.created_at+make_interval(mins=>minutes);
    END IF;
    IF ROW(NEW.category_id,NEW.priority,NEW.assigned_team_id) IS DISTINCT FROM ROW(OLD.category_id,OLD.priority,OLD.assigned_team_id)
       AND NEW.ticket_version=OLD.ticket_version THEN NEW.ticket_version:=OLD.ticket_version+1; END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER zz_finish_ai_triage_update BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.finish_ai_triage_update();

CREATE FUNCTION private.decide_ai_suggestion(p_ticket uuid,p_id uuid,p_decision text,p_values jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ticket public.tickets; suggestion private.ticket_ai_suggestions; category public.categories;
  team uuid; new_priority text; summary_text text;
BEGIN
  IF session_user <> 'api_login' OR NOT private.is_staff() THEN RAISE sqlstate '42501'; END IF;
  SELECT * INTO ticket FROM public.tickets WHERE id=p_ticket FOR UPDATE;
  IF NOT FOUND THEN RAISE sqlstate 'PT404'; END IF;
  SELECT * INTO suggestion FROM private.ticket_ai_suggestions WHERE ticket_id=p_ticket AND id=p_id FOR UPDATE;
  IF NOT FOUND OR suggestion.decision IS NOT NULL OR suggestion.ticket_version<>ticket.ticket_version
    OR ticket.assigned_to IS NOT NULL OR ticket.status NOT IN ('new','triaged','assigned')
    OR ticket.priority='critical' OR ticket.sla_breached THEN RAISE sqlstate 'PT409'; END IF;
  IF p_decision='accept' THEN
    SELECT c.* INTO category FROM public.categories c WHERE c.id=(p_values->>'category_id')::uuid AND c.active;
    SELECT id INTO team FROM public.teams WHERE id=(p_values->>'team_id')::uuid AND active;
    new_priority := p_values->>'priority';
    summary_text := btrim(p_values->>'summary');
    IF category.id IS NULL OR team IS NULL OR new_priority IS NULL OR new_priority NOT IN ('low','normal','high')
      OR summary_text IS NULL OR length(summary_text) NOT BETWEEN 1 AND 2000 THEN RAISE sqlstate 'PT400'; END IF;
    -- Never bypass access approval or discard fields already supplied by the requester.
    IF category.id<>ticket.category_id AND (
      category.code='access' OR EXISTS (SELECT FROM public.categories c WHERE c.id=ticket.category_id AND c.code='access')
      OR EXISTS (SELECT FROM jsonb_object_keys(ticket.request_fields) AS f(key)
        WHERE NOT EXISTS (SELECT FROM jsonb_array_elements(category.requirement_fields) r WHERE r->>'key'=f.key))
      OR EXISTS (SELECT FROM jsonb_array_elements(category.requirement_fields) r
        WHERE r->'required'='true'::jsonb AND NOT ticket.request_fields ? (r->>'key'))
    ) THEN RAISE sqlstate 'PT422'; END IF;
    PERFORM set_config('app.ticket_operation','route',true);
    PERFORM set_config('app.ai_triage_team',team::text,true);
    IF ticket.status='new' THEN UPDATE public.tickets SET status='triaged' WHERE id=p_ticket; END IF;
    UPDATE public.tickets SET category_id=category.id,priority=new_priority,assigned_team_id=team,status='assigned' WHERE id=p_ticket;
    PERFORM set_config('app.ai_triage_team','',true);
    PERFORM set_config('app.ticket_operation','',true);
    UPDATE private.ticket_ai_suggestions SET category_id=category.id,team_id=team,priority=new_priority,summary=summary_text WHERE id=p_id;
    INSERT INTO public.ticket_events(ticket_id,actor_id,event_type,payload,actor_type,actor_name)
      VALUES(p_ticket,private.user_id(),'ai_suggestion_applied',jsonb_build_object(
        'suggestion_id',p_id,'category_id',category.id,'team_id',team,'priority',new_priority,'note',summary_text),
        'ai',private.event_actor_name());
  ELSIF p_decision IS DISTINCT FROM 'ignore' THEN RAISE sqlstate 'PT400'; END IF;
  UPDATE private.ticket_ai_suggestions SET decision=p_decision,decided_by=private.user_id(),decided_at=clock_timestamp() WHERE id=p_id;
  RETURN true;
END
$$;
REVOKE ALL ON FUNCTION private.save_ai_suggestion(uuid,bigint,uuid,uuid,text,text),
  private.finish_ai_triage_update(), private.decide_ai_suggestion(uuid,uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.save_ai_suggestion(uuid,bigint,uuid,uuid,text,text),
  private.decide_ai_suggestion(uuid,uuid,text,jsonb) TO authenticated;
