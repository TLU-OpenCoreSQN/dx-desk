-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0

CREATE VIEW reporting.ticket_overview AS
WITH resolution AS (
  SELECT ticket_id, min(created_at) AS resolved_at
  FROM public.ticket_events WHERE event_type = 'status_changed' AND payload->>'to' = 'resolved'
  GROUP BY ticket_id
)
SELECT count(*) FILTER (WHERE t.status NOT IN ('resolved','closed','cancelled')) AS open_tickets,
       count(*) FILTER (WHERE t.status IN ('resolved','closed')) AS resolved_tickets,
       round(avg(extract(epoch FROM r.resolved_at - t.created_at) / 3600)
         FILTER (WHERE t.status IN ('resolved','closed')), 1) AS average_resolution_hours,
       count(*) FILTER (WHERE t.sla_breached OR r.resolved_at > t.sla_due_at + t.sla_paused_ms * interval '1 millisecond') AS breached_tickets
FROM public.tickets t LEFT JOIN resolution r ON r.ticket_id = t.id;

CREATE VIEW reporting.ticket_distribution AS
SELECT c.code AS category_code, c.name AS category_name,
       coalesce(g.name, 'Chưa phân nhóm') AS team_name, count(*) AS tickets
FROM public.tickets t JOIN public.categories c ON c.id = t.category_id
LEFT JOIN public.teams g ON g.id = t.assigned_team_id
GROUP BY c.code, c.name, g.name;

CREATE VIEW reporting.ticket_volume_weekly AS
SELECT date_trunc('week', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS week_start, count(*) AS tickets
FROM public.tickets GROUP BY 1;

-- One status transition = one step. A corresponding assignment audit row is not
-- counted again. W5-10 can introduce the shared automation/AI reporting contract.
CREATE VIEW reporting.ticket_operations_weekly AS
SELECT date_trunc('week', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS week_start,
       count(*) AS operations, count(*) FILTER (WHERE actor_type = 'user') AS manual_operations,
       round(100.0 * count(*) FILTER (WHERE actor_type = 'user') / count(*), 1) AS manual_percent
FROM public.ticket_events WHERE event_type = 'status_changed' GROUP BY 1;

CREATE VIEW reporting.device_requests_summary AS
SELECT device_type, status, count(*) AS requests, sum(quantity) AS units
FROM public.device_requests GROUP BY device_type, status;

CREATE VIEW reporting.vpn_demo_scenario AS
WITH recent AS (
  SELECT id FROM private.synthetic_runs ORDER BY loaded_at DESC, id DESC LIMIT 1
), measurements AS (
  SELECT cohort.phase, count(*) AS tickets,
         round(avg(extract(epoch FROM resolution.resolved_at - t.created_at) / 3600), 1) AS hours,
         count(*) FILTER (WHERE t.request_fields->>'client_version' = '4.2') AS client_42
  FROM recent JOIN private.synthetic_vpn_cohorts cohort ON cohort.run_id = recent.id
  JOIN public.tickets t ON t.id = cohort.ticket_id
  CROSS JOIN LATERAL (
    SELECT min(created_at) AS resolved_at FROM public.ticket_events e
    WHERE e.ticket_id = t.id AND e.event_type = 'status_changed' AND e.payload->>'to' = 'resolved'
  ) resolution
  GROUP BY cohort.phase
)
SELECT b.tickets AS tickets_before, a.tickets AS tickets_after,
       round(100.0 * (a.tickets - b.tickets) / nullif(b.tickets, 0)) AS increase_percent,
       b.hours AS hours_before, a.hours AS hours_after,
       round(100.0 * a.client_42 / nullif(a.tickets, 0)) AS client_4_2_percent
FROM measurements b CROSS JOIN measurements a WHERE b.phase = 'before' AND a.phase = 'after';

REVOKE ALL ON reporting.ticket_overview, reporting.ticket_distribution, reporting.ticket_volume_weekly,
  reporting.ticket_operations_weekly, reporting.device_requests_summary, reporting.vpn_demo_scenario FROM PUBLIC;
GRANT SELECT ON reporting.ticket_overview, reporting.ticket_distribution, reporting.ticket_volume_weekly,
  reporting.ticket_operations_weekly, reporting.device_requests_summary, reporting.vpn_demo_scenario TO reporting_reader;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dxdesk_metabase') THEN
    CREATE ROLE dxdesk_metabase NOLOGIN INHERIT NOBYPASSRLS NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION;
  END IF;
END $$;
GRANT reporting_reader TO dxdesk_metabase;
ALTER ROLE dxdesk_metabase SET default_transaction_read_only = on;
ALTER ROLE dxdesk_metabase SET search_path = pg_catalog, reporting;
