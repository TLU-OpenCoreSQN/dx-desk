-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
CREATE TABLE private.assistant_actions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT private.user_id(),
  kind text NOT NULL CHECK (kind IN ('create_ticket','create_task')),
  args jsonb NOT NULL,
  ticket_id uuid REFERENCES public.tickets(id),
  actor_type text NOT NULL DEFAULT 'ai' CHECK (actor_type = 'ai'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.assistant_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.assistant_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_owner_read ON private.assistant_actions FOR SELECT TO authenticated USING (owner_id = private.user_id());
CREATE POLICY assistant_owner_write ON private.assistant_actions FOR INSERT TO authenticated
  WITH CHECK (owner_id = private.user_id() AND (kind = 'create_ticket' OR private.has_role('Manager')));
CREATE POLICY assistant_owner_link ON private.assistant_actions FOR UPDATE TO authenticated USING (owner_id = private.user_id());
GRANT SELECT, INSERT (id, kind, args), UPDATE (ticket_id) ON private.assistant_actions TO authenticated;

ALTER TABLE private.outbox DROP CONSTRAINT outbox_destination_check;
ALTER TABLE private.outbox ADD CONSTRAINT outbox_destination_check
  CHECK (destination IN ('automation','notification','device_request','assistant_task'));

CREATE FUNCTION private.enqueue_assistant_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  INSERT INTO private.outbox(event_id, destination, envelope)
  VALUES(NEW.id, 'assistant_task', jsonb_build_object('event_id', NEW.id, 'event_type', 'assistant.task_created',
    'schema_version', 1, 'payload', '{}'::jsonb));
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION private.enqueue_assistant_task() FROM PUBLIC;
CREATE TRIGGER assistant_task_created AFTER INSERT ON private.assistant_actions FOR EACH ROW
WHEN (NEW.kind = 'create_task') EXECUTE FUNCTION private.enqueue_assistant_task();

CREATE OR REPLACE FUNCTION private.audit_ticket_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF private.importing_demo_history() THEN RETURN NEW; END IF;
  INSERT INTO public.ticket_events(ticket_id, actor_id, event_type, payload, actor_type, actor_name)
  VALUES (NEW.id, NEW.requester_id, 'created', jsonb_build_object('status', NEW.status),
    CASE WHEN session_user = 'api_login' AND current_setting('app.assistant_action',true) = 'create_ticket' THEN 'ai' ELSE 'user' END,
    private.event_actor_name());
  RETURN NEW;
END
$$;
