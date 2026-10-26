-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- Both API and PostgREST execute as authenticated, never as an owner/superuser.
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sla_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.device_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY categories_read ON public.categories FOR SELECT TO authenticated
USING (private.user_id() IS NOT NULL AND (active OR private.is_staff()));
CREATE POLICY sla_read ON public.sla_policies FOR SELECT TO authenticated
USING (private.user_id() IS NOT NULL);
CREATE POLICY routing_read ON public.routing_rules FOR SELECT TO authenticated
USING (private.is_staff());
CREATE POLICY tickets_read ON public.tickets FOR SELECT TO authenticated
USING (requester_id = private.user_id() OR private.is_staff());
CREATE POLICY tickets_create ON public.tickets FOR INSERT TO authenticated WITH CHECK (
  requester_id = private.user_id()
  AND (private.has_role('Employee') OR private.is_staff())
  AND status = 'new' AND assigned_to IS NULL
  AND (priority <> 'critical' OR private.has_role('Manager'))
  AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.active)
);
CREATE POLICY events_read ON public.ticket_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id)
);
CREATE POLICY attachments_read ON public.attachments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id)
);
CREATE POLICY devices_read ON public.device_requests FOR SELECT TO authenticated
USING (requester_id = private.user_id() OR private.is_staff());
CREATE POLICY devices_create ON public.device_requests FOR INSERT TO authenticated WITH CHECK (
  requester_id = private.user_id() AND status = 'pending'
  AND (private.has_role('Employee') OR private.is_staff())
);
GRANT SELECT ON public.categories, public.sla_policies, public.routing_rules,
  public.tickets, public.ticket_events, public.attachments, public.device_requests TO authenticated;
-- Column grants prevent forged ownership, status, timestamps, assignee and scan results.
GRANT INSERT (category_id, title, description, priority) ON public.tickets TO authenticated;
GRANT INSERT (device_type, reason, quantity) ON public.device_requests TO authenticated;
-- Mutations for transitions, uploads and approvals belong to later milestones.
