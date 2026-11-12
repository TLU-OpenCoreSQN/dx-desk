// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { generate, applyDataset } from '../../scripts/seed-synthetic.mjs';
import { configureMetabaseReader, provisionMetabase } from '../../scripts/setup-metabase.mjs';
import { dashboardName, questions } from '../../infra/metabase/dashboard.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { Client } = createRequire(resolve(root, 'apps/api/package.json'))('pg');

export async function verifyDashboard(url, databaseUrl, env, { reportingLoginReady = false } = {}) {
  const setup = new Client({ connectionString: databaseUrl });
  await setup.connect();
  let teams;
  try {
    if (!reportingLoginReady) {
      const password = await setup.query("SELECT format('ALTER ROLE dxdesk_metabase LOGIN PASSWORD %L', $1::text) AS command", [env.METABASE_REPORTING_PASSWORD]);
      await setup.query(password.rows[0].command);
    }
    teams = (await setup.query('SELECT id, name FROM public.teams WHERE active ORDER BY name')).rows;
  } finally { await setup.end(); }
  const user = 'f0000000-0000-4000-8000-000000000001';
  const agent = 'f0000000-0000-4000-8000-000000000002';
  const system = 'f0000000-0000-4000-8000-000000000003';
  const dataset = generate('dxdesk-ci-metabase', '2026-11-02T00:00:00Z', {
    users: [{ sub: user, roles: ['Employee'] }, { sub: agent, roles: ['Agent'] }],
    teams: teams.map(team => ({ ...team, members: [agent] })), system,
  }, 500, { scenario: 'vpn-4.2' });
  assert.equal((await applyDataset(dataset, databaseUrl, { apply: true, confirmDemo: true })).inserted, 500);
  const owner = new Client({ connectionString: databaseUrl });
  await owner.connect();
  let handCount;
  try {
    handCount = (await owner.query(`SELECT count(*)::int AS steps, count(*) FILTER (WHERE actor_type = 'user')::int AS human,
      count(*) FILTER (WHERE actor_type = 'system')::int AS system, count(*) FILTER (WHERE actor_type = 'ai')::int AS ai
      FROM public.ticket_events WHERE event_type = 'status_changed'`)).rows[0];
  } finally { await owner.end(); }
  assert.ok(handCount.human > 0 && handCount.system > 0, 'Dữ liệu giả lập có cả bước của người và hệ thống');
  const readerUrl = new URL(databaseUrl);
  readerUrl.username = 'dxdesk_metabase';
  readerUrl.password = env.METABASE_REPORTING_PASSWORD;
  const reader = new Client({ connectionString: readerUrl.href });
  await reader.connect();
  try {
    await assert.rejects(reader.query('SELECT description FROM public.tickets LIMIT 1'), { code: '42501' });
    await assert.rejects(reader.query('SELECT actor_id FROM public.ticket_events LIMIT 1'), { code: '42501' });
    const weekly = await reader.query('SELECT manual_percent FROM reporting.ticket_operations_weekly');
    assert.ok(weekly.rows.length >= 6 && weekly.rows.every(row => Number(row.manual_percent) > 0));
    // W5-10: view H-P-D-I khớp số đếm tay của vai trò chủ sở hữu và không lộ bảng gốc.
    const automation = await reader.query('SELECT sum(steps)::int AS steps, sum(human_steps)::int AS human, sum(system_steps)::int AS system, sum(ai_steps)::int AS ai FROM reporting.automation_weekly');
    assert.deepEqual(automation.rows[0], handCount);
  } finally { await reader.end(); }

  const id = await provisionMetabase(url, env);
  assert.equal(await provisionMetabase(url, env), id, 'bootstrap keeps dashboard ID across runs');
  let session;
  async function call(path, body) {
    const response = await fetch(url + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(session && { 'X-Metabase-Session': session }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(25_000),
    });
    assert.ok(response.ok, `Metabase ${path.replace(/\/eyJ[^/]+/, '/[token]')} returned HTTP ${response.status}`);
    return response.json();
  }
  session = (await call('/api/session', { username: 'metabase-admin@dxdesk.local', password: env.METABASE_ADMIN_PASSWORD })).id;
  const dashboard = await call('/api/dashboard/' + id);
  assert.equal(dashboard.name, dashboardName);
  assert.equal(dashboard.enable_embedding, true);
  assert.equal(dashboard.dashcards.length, questions.length);
  const kpi = dashboard.dashcards.find(card => card.card?.name === 'VPN client 4.2 · kịch bản giả lập');
  assert.ok(kpi);
  const results = await call('/api/card/' + kpi.card_id + '/query', {});
  assert.deepEqual(results.data.rows[0].map(Number), [100, 137, 37, 2.4, 4.1, 72]);
  session = undefined;
  const claims = { resource: { dashboard: id }, params: {}, exp: Math.floor(Date.now() / 1_000) + 300 };
  const tokenBody = [JSON.stringify({ alg: 'HS256', typ: 'JWT' }), JSON.stringify(claims)]
    .map(value => Buffer.from(value).toString('base64url')).join('.');
  const token = tokenBody + '.' + createHmac('sha256', env.METABASE_EMBED_SECRET).update(tokenBody).digest('base64url');
  const embedded = await call('/api/embed/dashboard/' + token);
  assert.equal(embedded.name, dashboardName);
  assert.equal(embedded.dashcards.length, questions.length);
  console.log(`Metabase OSS: ${questions.length} cards, Manager embed, read-only role, VPN KPI 100/137, 37%, 2.4/4.1h and 72%.`);
}

async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => server.listen(0, '127.0.0.1', ok).once('error', fail));
  const port = server.address().port;
  await new Promise(ok => server.close(ok));
  return port;
}

async function dockerCheck() {
  const directory = await mkdtemp(join(tmpdir(), 'dxdesk-w5-metabase-'));
  const postgresPort = await freePort();
  const metabasePort = await freePort();
  const overlay = join(directory, 'compose.yml');
  await writeFile(overlay, `services:\n  postgres:\n    ports: ["127.0.0.1:${postgresPort}:5432"]\n`);
  const example = parseEnv(await readFile(resolve(root, '.env.example'), 'utf8'));
  const env = { ...process.env, COMPOSE_PROFILES: 'full', POSTGRES_DB: 'dxdesk_demo_metabase',
    METABASE_PORT: String(metabasePort), METABASE_PUBLIC_URL: `http://localhost:${metabasePort}`,
    METABASE_DB_PASSWORD: 'dxdesk_ci_metabase_db', METABASE_REPORTING_PASSWORD: 'dxdesk_ci_reporting_reader',
    METABASE_ADMIN_PASSWORD: 'DxDesk_CI_Analytics123!', METABASE_EMBED_SECRET: 'ab'.repeat(32) };
  const project = `dxdesk-w5-${process.pid}`;
  const base = ['compose', '-p', project, '--env-file', '.env.example', '-f', 'infra/compose/docker-compose.yml', '-f', overlay];
  const compose = (...args) => {
    const result = spawnSync('docker', [...base, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    if (result.status !== 0) throw new Error(`docker compose ${args[0]} failed.`);
  };
  try {
    compose('up', '-d', '--wait', '--wait-timeout', '330', 'postgres', 'metabase');
    configureMetabaseReader(base, root, env);
    const db = `postgresql://${example.POSTGRES_USER}:${example.POSTGRES_PASSWORD}@127.0.0.1:${postgresPort}/${env.POSTGRES_DB}`;
    await verifyDashboard(env.METABASE_PUBLIC_URL, db, env, { reportingLoginReady: true });
  } catch (error) {
    compose('logs', '--tail=80', 'metabase', 'postgres');
    throw error;
  } finally {
    compose('down', '-v');
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  dockerCheck().catch(error => { console.error(error.message); process.exitCode = 1; });
}
