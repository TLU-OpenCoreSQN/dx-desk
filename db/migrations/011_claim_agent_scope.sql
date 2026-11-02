-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Claim is an Agent capability; team membership alone must not grant it to a
-- Manager-only account. Keep the published 009 checksum and existing status rights.
CREATE OR REPLACE FUNCTION private.claim_ticket(p_ticket_id uuid) RETURNS public.tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ticket public.tickets;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR NOT private.has_role('Agent')
 THEN RAISE sqlstate '42501' USING MESSAGE='Agent role required'; END IF;
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
REVOKE ALL ON FUNCTION private.claim_ticket(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.claim_ticket(uuid) TO authenticated;
