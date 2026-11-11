-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Historical fixtures never emit live automation or chat notifications.

CREATE TABLE private.synthetic_runs (
  id uuid PRIMARY KEY,
  dataset_sha256 text NOT NULL CHECK (dataset_sha256 ~ '^[a-f0-9]{64}$'),
  loaded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.synthetic_vpn_cohorts (
  ticket_id uuid PRIMARY KEY REFERENCES public.tickets(id),
  run_id uuid NOT NULL REFERENCES private.synthetic_runs(id),
  phase text NOT NULL CHECK (phase IN ('before', 'after'))
);
REVOKE ALL ON private.synthetic_runs, private.synthetic_vpn_cohorts FROM PUBLIC;

CREATE FUNCTION private.importing_demo_history() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT current_database() ~ '^dxdesk_(demo|test)[a-z0-9_]*$'
     AND current_setting('app.demo_history', true) = 'on'
     AND current_setting('role', true) = 'none'
     AND pg_has_role(session_user, (SELECT relowner FROM pg_class WHERE oid = 'public.tickets'::regclass), 'USAGE')
$$;
REVOKE ALL ON FUNCTION private.importing_demo_history() FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.audit_ticket_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF private.importing_demo_history() THEN RETURN NEW; END IF;
  INSERT INTO public.ticket_events(ticket_id, actor_id, event_type, payload, actor_type, actor_name)
  VALUES (NEW.id, NEW.requester_id, 'created', jsonb_build_object('status', NEW.status), 'user', private.event_actor_name());
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION private.enqueue_ticket_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE ticket public.tickets; category_code text; destination text;
BEGIN
  IF private.importing_demo_history() THEN RETURN NEW; END IF;
  SELECT * INTO ticket FROM public.tickets WHERE id = NEW.ticket_id;
  SELECT code INTO category_code FROM public.categories WHERE id = ticket.category_id;
  destination := CASE WHEN NEW.event_type = 'created' THEN 'automation' ELSE 'notification' END;
  INSERT INTO private.outbox(event_id, destination, envelope) VALUES (NEW.id, destination, jsonb_build_object(
    'schema_version', 1, 'event_id', NEW.id, 'event_type', 'ticket.' || NEW.event_type,
    'occurred_at', NEW.created_at, 'ticket_id', NEW.ticket_id, 'ticket_version', ticket.ticket_version,
    'actor', jsonb_build_object('type', NEW.actor_type, 'id', NEW.actor_id, 'label', NEW.actor_name),
    'payload', jsonb_build_object('category_code', category_code, 'status', ticket.status, 'priority', ticket.priority,
      'team_id', to_jsonb(ticket)->'assigned_team_id')));
  RETURN NEW;
END
$$;
