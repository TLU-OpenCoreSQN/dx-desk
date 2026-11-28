-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- #88: requester may reopen within seven days, with a reason; no assignment/SLA reset.
UPDATE private.ticket_transitions SET requester_allowed=true
WHERE from_status='resolved' AND to_status='in_progress';

CREATE FUNCTION private.guard_requester_reopen() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE resolved_at timestamptz;
BEGIN
  IF OLD.status='resolved' AND NEW.status='in_progress'
     AND private.user_id()=OLD.requester_id AND NOT private.is_staff() THEN
    SELECT max(e.created_at) INTO resolved_at FROM public.ticket_events e
    WHERE e.ticket_id=OLD.id AND e.event_type='status_changed'
      AND coalesce(e.payload->>'to',e.payload->>'to_status')='resolved';
    IF resolved_at IS NULL OR now()>resolved_at+interval '7 days' THEN
      RAISE sqlstate '45007' USING MESSAGE='Requester reopen window expired';
    END IF;
    IF length(private.status_note()) NOT BETWEEN 5 AND 2000 THEN
      RAISE sqlstate '45006' USING MESSAGE='Requester reopen reason required';
    END IF;
    IF ROW(NEW.assigned_to,NEW.assigned_team_id,NEW.sla_due_at,NEW.sla_paused_ms)
       IS DISTINCT FROM ROW(OLD.assigned_to,OLD.assigned_team_id,OLD.sla_due_at,OLD.sla_paused_ms) THEN
      RAISE sqlstate '42501' USING MESSAGE='Reopening preserves assignment and SLA';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ticket_requester_reopen_guard BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.guard_requester_reopen();
