// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';
import EmbeddedPostgres from 'embedded-postgres';
import { applyConfig, loadConfig } from '../../scripts/enterprise-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { Client } = createRequire(resolve(root, 'apps/api/package.json'))('pg');
const directory = await fs.mkdtemp(resolve(tmpdir(), 'dxdesk-config-pg-'));
const probe = createServer();
await new Promise((done, reject) => probe.listen(0, '127.0.0.1', done).on('error', reject));
const port = probe.address().port;
await new Promise(done => probe.close(done));
const pg = new EmbeddedPostgres({ databaseDir: resolve(directory, 'pg'), user: 'postgres',
  password: 'enterprise_config_test_only', port, persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {} });
const projectionPath = resolve(directory, 'modules.json');
let started = false, client, passed = false;
const checks = [];
const check = name => { checks.push(name); console.log(`PASS ${name}`); };
try {
  await pg.initialise(); await pg.start(); started = true;
  await pg.createDatabase('dxdesk_test_enterprise_config');
  client = new Client({ host: '127.0.0.1', port, user: 'postgres',
    password: 'enterprise_config_test_only', database: 'dxdesk_test_enterprise_config' });
  await client.connect();
  await client.query(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE api_login NOLOGIN NOINHERIT NOBYPASSRLS;
    CREATE ROLE authenticator NOLOGIN NOINHERIT NOBYPASSRLS;
    GRANT authenticated TO api_login; GRANT anon, authenticated TO authenticator;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;`);
  for (const folder of ['migrations', 'policies']) {
    for (const file of (await fs.readdir(resolve(root, 'db', folder))).filter(file => file.endsWith('.sql')).sort()) {
      await client.query(await fs.readFile(resolve(root, 'db', folder, file), 'utf8'));
    }
  }
  const sample = await loadConfig();
  const apply = (config, options = {}) => applyConfig(config, { client, projectionPath, ...options });
  const snapshot = async () => {
    const state = {};
    for (const table of ['teams', 'categories', 'routing_rules', 'sla_policies', 'tickets', 'ticket_events']) {
      state[table] = (await client.query(`SELECT to_jsonb(t) AS row, xmin::text AS version FROM public.${table} t ORDER BY id`)).rows;
    }
    return state;
  };
  const initial = await snapshot();
  await apply(sample);
  assert.deepEqual(await snapshot(), initial);
  await apply(sample);
  assert.deepEqual(await snapshot(), initial);
  assert.deepEqual(JSON.parse(await fs.readFile(projectionPath, 'utf8')), sample.modules);
  check('Seed example matches all current migrations; first and second apply preserve rows, IDs and xmin');

  const requester = '20000000-0000-4000-8000-000000000001';
  const oldTicket = (await client.query(`INSERT INTO public.tickets(requester_id,category_id,title,description)
    VALUES($1,'10000000-0000-4000-8000-000000000003','Historical SLA ticket','Must keep its original SLA after config apply') RETURNING *`, [requester])).rows[0];
  const expanded = structuredClone(sample);
  expanded.teams.push({ code: 'peripheral', name: 'Peripheral Team', active: true });
  expanded.categories.push({ code: 'peripheral', name: 'Cấp thiết bị ngoại vi', description: 'TN-07 fixture', active: true,
    requirement_fields: [{ key: 'asset_code', label: 'Mã thiết bị', required: true }] });
  expanded.routing.push({ category: 'peripheral', team: 'peripheral', active: true });
  expanded.sla_policies.normal = { response_minutes: 30, resolution_minutes: 60 };
  await apply(expanded);
  const category = (await client.query("SELECT id FROM public.categories WHERE code='peripheral'")).rows[0].id;
  const team = (await client.query("SELECT id FROM public.teams WHERE code='peripheral'")).rows[0].id;
  assert.deepEqual((await client.query('SELECT * FROM public.tickets WHERE id=$1', [oldTicket.id])).rows[0], oldTicket);
  const userTransaction = async operation => {
    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: requester,
        role: 'authenticated', realm_access: { roles: ['Employee'] } })]);
      const result = await operation();
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  };
  const create = fields => userTransaction(async () => (await client.query(`INSERT INTO public.tickets(category_id,title,description,request_fields)
    VALUES($1,'Peripheral config fixture','Created against the configured category fields',$2::jsonb) RETURNING *`, [category, JSON.stringify(fields)])).rows[0]);
  await assert.rejects(create({}), /Thiếu trường bắt buộc/);
  await assert.rejects(create({ asset_code: 'PC-01', unknown: 'not allowed' }), /không thuộc danh mục/);
  const ticket = await create({ asset_code: 'PC-01' });
  assert.equal(ticket.sla_due_at.getTime() - ticket.created_at.getTime(), 60 * 60 * 1000);
  const event = (await client.query("SELECT id FROM public.ticket_events WHERE ticket_id=$1 AND event_type='created'", [ticket.id])).rows[0].id;
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE ticket_automation');
  await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: '20000000-0000-4000-8000-000000000005',
    role: 'ticket_automation', azp: 'dxdesk-automation', realm_access: { roles: ['ticket-automation'] } })]);
  const routed = (await client.query('SELECT private.process_event($1) AS result', [event])).rows[0].result;
  await client.query('COMMIT');
  assert.equal(routed.result, 'routed'); assert.equal(routed.team_id, team);
  assert.equal((await client.query('SELECT assigned_team_id FROM public.tickets WHERE id=$1', [ticket.id])).rows[0].assigned_team_id, team);
  const expandedState = await snapshot();
  await apply(expanded);
  assert.deepEqual(await snapshot(), expandedState);
  check('New category/required string field, live RLS insert validation, active routing, and new-ticket SLA work without altering old clocks');

  const failure = structuredClone(expanded);
  failure.teams[0].name = 'Rollback Network';
  failure.categories[0].description = 'Rollback description';
  failure.routing[0].team = 'support';
  failure.sla_policies.normal.resolution_minutes = 61;
  await client.query(`CREATE FUNCTION public.config_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected final SLA failure'; END $$;
    CREATE TRIGGER config_fixture_failure BEFORE UPDATE ON public.sla_policies
    FOR EACH ROW EXECUTE FUNCTION public.config_fixture_failure();`);
  const beforeFailure = await snapshot();
  const beforeProjection = await fs.readFile(projectionPath, 'utf8');
  await assert.rejects(apply(failure), /injected final SLA failure/);
  assert.deepEqual(await snapshot(), beforeFailure);
  assert.equal(await fs.readFile(projectionPath, 'utf8'), beforeProjection);
  await client.query('DROP TRIGGER config_fixture_failure ON public.sla_policies; DROP FUNCTION public.config_fixture_failure()');
  check('Failure after team/category/routing writes rolls back every table and does not publish');

  const partial = { schema_version: 1, modules: { enabled: ['core'] }, teams: [], categories: [], routing: [], sla_policies: {} };
  for (const route of [
    { category: 'missing-category', team: 'support', active: true },
    { category: 'peripheral', team: 'missing-team', active: true },
  ]) {
    const before = await snapshot();
    await assert.rejects(apply({ ...partial, routing: [route] }), /existing category and active team/);
    assert.deepEqual(await snapshot(), before);
  }
  await client.query("UPDATE public.teams SET active=false WHERE code='network'");
  const inactiveState = await snapshot();
  await assert.rejects(apply({ ...partial, routing: [{ category: 'vpn', team: 'network', active: true }] }), /active team/);
  assert.deepEqual(await snapshot(), inactiveState);
  await client.query("UPDATE public.teams SET active=true WHERE code='network'");
  await assert.rejects(apply({ ...partial, teams: [{ code: 'network', name: 'Network Team', active: false }] }), /disabling its team/);
  await assert.rejects(apply({ ...partial, teams: [{ code: 'different-code', name: 'Network Team', active: true }] }), /another business code/);
  check('Database preflight rejects missing references, existing inactive teams, omitted active routes and conflicting team names');

  const beforeOmission = await snapshot();
  await apply(partial);
  assert.deepEqual(await snapshot(), beforeOmission);
  await apply({ ...partial, teams: [{ code: 'support', name: 'Renamed Support', active: true }] });
  assert.equal((await client.query(`SELECT count(*)::int AS count FROM public.routing_rules r
    JOIN public.teams t ON t.id=r.team_id WHERE t.code='support' AND r.team<>t.name`)).rows[0].count, 0);
  const renamed = await snapshot();
  await apply({ ...partial, teams: [{ code: 'support', name: 'Renamed Support', active: true }] });
  assert.deepEqual(await snapshot(), renamed);
  check('Omission never deletes or deactivates; explicit team rename keeps omitted routing names/IDs consistent and is a genuine no-op on retry');

  const dangerous = structuredClone(expanded);
  dangerous.teams.find(t => t.code === 'support').name = 'Renamed Support';
  dangerous.categories[0].description = "'; END; $$; DROP TABLE public.tickets; --\n\\! echo injected\nTiếng Việt";
  await apply(dangerous);
  assert.equal((await client.query("SELECT description FROM public.categories WHERE code='vpn'")).rows[0].description, dangerous.categories[0].description);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM public.tickets')).rows[0].count >= 2, true);
  check('SQL quotes, dollar delimiters and psql meta-commands are stored strictly as UTF-8 data');

  const projected = structuredClone(dangerous);
  projected.modules.enabled = ['core', 'desk'];
  projected.categories[0].description += ' projection retry';
  const oldProjection = await fs.readFile(projectionPath, 'utf8');
  await assert.rejects(apply(projected, { io: { ...fs, rename: async () => { throw new Error('fixture rename denied'); } } }),
    error => error.databaseApplied === true && error.code === 'CONFIG_PROJECTION_FAILED');
  assert.equal(await fs.readFile(projectionPath, 'utf8'), oldProjection);
  const committed = await snapshot();
  await apply(projected);
  assert.deepEqual(await snapshot(), committed);
  assert.deepEqual(JSON.parse(await fs.readFile(projectionPath, 'utf8')), projected.modules);
  check('Post-commit publish failure preserves old projection; retry repairs the file without any row-version changes');

  const readonlyState = await snapshot();
  await client.query('SET ROLE authenticated');
  await assert.rejects(apply(projected), /permission denied/);
  await client.query('RESET ROLE');
  assert.deepEqual(await snapshot(), readonlyState);
  check('Normal application role cannot apply configuration; existing RLS is not bypassed by a new endpoint');
  passed = true;
  console.log(`Enterprise config: ${checks.length} isolated PostgreSQL checks passed.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
  if (started) await pg.stop();
  await fs.rm(directory, { recursive: true, force: true });
}
if (!passed) process.exit(1);
