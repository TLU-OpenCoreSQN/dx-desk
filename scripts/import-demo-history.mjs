// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { scenarioSummary } from './seed-scenario.mjs';

export async function importDemoHistory(client, dataset) {
  const { namespace, dataset_sha256: hash } = dataset.manifest;
  await client.query("SELECT set_config('app.demo_history', 'on', true)");
  const guard = await client.query('SELECT private.importing_demo_history() AS allowed');
  if (!guard.rows[0].allowed) throw new Error('Demo history import is unavailable in this session.');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [namespace]);
  const existing = await client.query('SELECT dataset_sha256 FROM private.synthetic_runs WHERE id = $1', [namespace]);
  if (existing.rows[0] && existing.rows[0].dataset_sha256 !== hash) throw new Error('Demo namespace already contains a different dataset.');
  if (!existing.rowCount) await client.query('INSERT INTO private.synthetic_runs (id, dataset_sha256) VALUES ($1, $2)', [namespace, hash]);

  let inserted = 0;
  for (let offset = 0; offset < dataset.tickets.length; offset += 500) {
    const batch = dataset.tickets.slice(offset, offset + 500);
    const result = await client.query(`WITH fixture AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(
        id uuid, requester_id uuid, category_code text, title text, description text, priority text, status text,
        assigned_to uuid, assigned_team_id uuid, created_at timestamptz, updated_at timestamptz,
        request_fields jsonb, waiting_since timestamptz, sla_paused_ms bigint, resolution_note text, resolved_at timestamptz)
      ), inserted AS (
        INSERT INTO public.tickets (id, requester_id, category_id, title, description, priority, status,
          assigned_to, assigned_team_id, created_at, updated_at, request_fields, waiting_since, sla_paused_ms,
          resolution_note, sla_breached, sla_breached_at)
        SELECT f.id, f.requester_id, c.id, f.title, f.description, f.priority, f.status,
          f.assigned_to, f.assigned_team_id, f.created_at, f.updated_at, f.request_fields, f.waiting_since,
          f.sla_paused_ms, f.resolution_note,
          coalesce(f.resolved_at > f.created_at + make_interval(mins => s.resolution_minutes), false),
          CASE WHEN f.resolved_at > f.created_at + make_interval(mins => s.resolution_minutes)
            THEN f.created_at + make_interval(mins => s.resolution_minutes) END
        FROM fixture f
        JOIN public.categories c ON c.code = f.category_code AND c.active
        JOIN public.sla_policies s ON s.priority = f.priority
        ON CONFLICT (id) DO NOTHING RETURNING id
      )
      SELECT (SELECT count(*) FROM inserted)::int AS inserted,
        (SELECT count(*) FROM fixture f JOIN public.tickets t ON t.id = f.id AND t.title = f.title)::int AS previous`,
    [JSON.stringify(batch)]);
    const counts = result.rows[0];
    if (counts.inserted + counts.previous !== batch.length) throw new Error('Missing or conflicting historical ticket.');
    inserted += counts.inserted;
  }
  const cohort = dataset.tickets.filter(ticket => ticket.scenario_phase)
    .map(ticket => ({ ticket_id: ticket.id, phase: ticket.scenario_phase }));
  await client.query(`INSERT INTO private.synthetic_vpn_cohorts (ticket_id, run_id, phase)
    SELECT ticket_id, $2, phase FROM jsonb_to_recordset($1::jsonb) AS r(ticket_id uuid, phase text)
    ON CONFLICT (ticket_id) DO NOTHING`, [JSON.stringify(cohort), namespace]);

  for (let offset = 0; offset < dataset.events.length; offset += 2_000) {
    await client.query(`INSERT INTO public.ticket_events (id, ticket_id, actor_id, actor_type, actor_name, event_type, payload, created_at)
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(id uuid, ticket_id uuid, actor_id uuid,
        actor_type text, actor_name text, event_type text, payload jsonb, created_at timestamptz)
      ON CONFLICT (id) DO NOTHING`, [JSON.stringify(dataset.events.slice(offset, offset + 2_000))]);
  }
  const service = await client.query(`WITH articles AS (
      SELECT ca.category_id, ca.article_id,
        row_number() OVER (ORDER BY c.code, ca.sort_order, a.slug) - 1 AS position, count(*) OVER () AS total
      FROM public.category_articles ca
      JOIN public.categories c ON c.id = ca.category_id AND c.active
      JOIN public.knowledge_articles a ON a.id = ca.article_id AND a.active
    ), fixture AS (
      SELECT *, row_number() OVER (ORDER BY id) - 1 AS position
      FROM jsonb_to_recordset($1::jsonb) AS r(id uuid, user_id uuid, created_at timestamptz)
    ), inserted AS (
      INSERT INTO public.self_service_resolutions (id, user_id, category_id, article_id, created_at)
      SELECT f.id, f.user_id, a.category_id, a.article_id, f.created_at FROM fixture f
      JOIN articles a ON a.position = f.position % a.total
      ON CONFLICT (id) DO NOTHING RETURNING id
    )
    SELECT (SELECT count(*) FROM inserted)::int AS inserted,
      (SELECT count(*) FROM fixture f JOIN public.self_service_resolutions r USING (id))::int AS previous`, [JSON.stringify(dataset.self_service)]);
  if (service.rows[0].inserted + service.rows[0].previous !== dataset.self_service.length) throw new Error('Missing active Wiki article mappings.');
  await client.query(`INSERT INTO public.device_requests (id, requester_id, device_type, reason, quantity, created_at)
    SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(id uuid, requester_id uuid, device_type text, reason text, quantity int, created_at timestamptz)
    ON CONFLICT (id) DO NOTHING`, [JSON.stringify(dataset.device_requests)]);

  const stored = await client.query(`SELECT t.id, c.code AS category_code, v.phase AS scenario_phase, t.request_fields, t.created_at,
    e.created_at AS resolved_at FROM private.synthetic_vpn_cohorts v JOIN public.tickets t ON t.id = v.ticket_id
    JOIN public.categories c ON c.id = t.category_id
    JOIN public.ticket_events e ON e.ticket_id = t.id AND e.event_type = 'status_changed' AND e.payload->>'to' = 'resolved'
    WHERE v.run_id = $1`, [namespace]);
  const summary = scenarioSummary(stored.rows, stored.rows.map(row => ({
    ticket_id: row.id, created_at: row.resolved_at, event_type: 'status_changed', payload: { to: 'resolved' },
  })));
  return { inserted, scenario_summary: summary };
}
