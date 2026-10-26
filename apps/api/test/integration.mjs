// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createApp } from '../dist/app.js';
import { Database } from '../dist/database.js';

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl || !new URL(adminUrl).pathname.startsWith('/dxdesk_test')) {
  throw new Error('TEST_DATABASE_ADMIN_URL must reference a disposable dxdesk_test* database.');
}
if (!process.env.TEST_POSTGREST_BIN) throw new Error('A real TEST_POSTGREST_BIN is required for TN-02.');
const admin = new Pool({ connectionString: adminUrl });
const users = {
  a: { sub: '20000000-0000-4000-8000-000000000001', roles: ['Employee'] },
  b: { sub: '20000000-0000-4000-8000-000000000002', roles: ['Employee'] },
  agent: { sub: '20000000-0000-4000-8000-000000000003', roles: ['Agent'] },
  manager: { sub: '20000000-0000-4000-8000-000000000004', roles: ['Manager'] },
};
const category = '10000000-0000-4000-8000-000000000001';
let app, db, jwksServer, restProcess, apiUrl, restUrl, privateKey, publicKey, issuer;
let restLogs = '';
const tokens = {};
const claims = key => ({
  sub: users[key].sub, role: 'authenticated', realm_access: { roles: users[key].roles },
});
async function token(key = 'a', overrides = {}, options = {}) {
  return new SignJWT({ ...claims(key), preferred_username: `test.${key}`, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'tn02-fixture' })
    .setIssuer(options.issuer ?? issuer).setAudience(options.audience ?? 'dxdesk-api')
    .setIssuedAt().setExpirationTime(options.exp ?? '5m').sign(options.key ?? privateKey);
}
async function call(base, path, key = 'a', body, customToken) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(key ? { Authorization: `Bearer ${customToken ?? tokens[key]}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}
const newTicket = (title, extra = {}) => ({
  category_id: category, title, description: 'Chi tiết thử nghiệm quyền truy cập tuần 2.', ...extra,
});
async function create(key, title, extra) {
  const result = await call(apiUrl, '/api/tickets', key, newTicket(title, extra));
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}
async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
before(async () => {
  await admin.query(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE api_login LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'api_test';
    CREATE ROLE authenticator LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'rest_test';
    GRANT authenticated TO api_login;
    GRANT anon, authenticated TO authenticator;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
  `);
  for (const folder of ['migrations', 'policies']) {
    const directory = resolve('../../db', folder);
    for (const filename of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
      const client = await admin.connect();
      try {
        await client.query('BEGIN');
        await client.query(await readFile(resolve(directory, filename), 'utf8'));
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
  }
  ({ privateKey, publicKey } = await generateKeyPair('RS256'));
  const jwk = { ...await exportJWK(publicKey), kid: 'tn02-fixture', alg: 'RS256', use: 'sig' };
  jwksServer = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  jwksServer.listen(0, '127.0.0.1'); await once(jwksServer, 'listening');
  issuer = `http://127.0.0.1:${jwksServer.address().port}/realms/test`;
  const apiDatabaseUrl = new URL(adminUrl);
  apiDatabaseUrl.username = 'api_login'; apiDatabaseUrl.password = 'api_test';
  Object.assign(process.env, {
    DATABASE_URL: apiDatabaseUrl.href, OIDC_ISSUER: issuer, OIDC_AUDIENCE: 'dxdesk-api',
    OIDC_JWKS_URL: issuer + '/certs', DB_POOL_MAX: '2',
  });
  app = await createApp(); await app.listen(0, '127.0.0.1');
  apiUrl = await app.getUrl(); db = app.get(Database);
  const restDatabaseUrl = new URL(adminUrl);
  restDatabaseUrl.username = 'authenticator'; restDatabaseUrl.password = 'rest_test';
  const restPort = await freePort();
  restUrl = `http://127.0.0.1:${restPort}`;
  restProcess = spawn(process.env.TEST_POSTGREST_BIN, [], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PGRST_DB_URI: restDatabaseUrl.href, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: JSON.stringify({ keys: [jwk] }), PGRST_JWT_AUD: 'dxdesk-api',
      PGRST_DB_PRE_REQUEST: 'private.check_request', PGRST_APP_SETTINGS_JWT_ISSUER: issuer,
      PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(restPort),
    },
  });
  restProcess.on('error', error => { restLogs += error.message; });
  restProcess.on('exit', code => { restLogs += `\nPostgREST exit=${code}`; });
  restProcess.stdout.on('data', chunk => { restLogs += chunk.toString(); });
  restProcess.stderr.on('data', chunk => { restLogs += chunk.toString(); });
  for (const key of Object.keys(users)) tokens[key] = await token(key);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const result = await call(restUrl, '/categories', 'a');
      if (result.status === 200) return;
    } catch { /* wait for schema cache */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`PostgREST startup failed: ${restLogs.slice(-4000)}`);
}, { timeout: 30000 });
after(async () => {
  if (restProcess && restProcess.exitCode === null) {
    const exited = once(restProcess, 'exit');
    restProcess.kill(); await exited;
  }
  if (app) await app.close();
  if (jwksServer) await new Promise(resolve => jwksServer.close(resolve));
  await admin.end();
});

test('TN-02: real database has seven protected domain tables and reference data', async () => {
  const result = await admin.query(`SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`);
  assert.equal(result.rowCount, 7);
  assert.ok(result.rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
  assert.equal((await call(apiUrl, '/api/categories')).body.data.length, 4);
  assert.equal((await call(apiUrl, '/api/health', null)).status, 200);
  assert.equal((await call(apiUrl, '/api/me')).body.id, users.a.sub);
});
test('JWT signature/time/issuer/audience/role validation agrees on API and PostgREST', async () => {
  const other = await generateKeyPair('RS256');
  const invalid = [
    await token('a', {}, { key: other.privateKey }),
    await token('a', {}, { exp: '1 second ago' }),
    await token('a', {}, { issuer: 'https://wrong.example/realms/test' }),
    await token('a', {}, { audience: 'wrong-api' }),
    await token('a', { role: 'anon' }),
    await token('a', { realm_access: { roles: { Manager: true } } }),
    await token('a', { realm_access: { roles: ['Employee', 42] } }),
    await token('a', { nbf: Math.floor(Date.now() / 1000) + 5 }),
    await token('a', { nbf: 'invalid' }),
  ];
  assert.equal((await call(apiUrl, '/api/me', null)).status, 401);
  assert.equal((await call(restUrl, '/tickets', null)).status, 401);
  for (const bad of invalid) {
    assert.equal((await call(apiUrl, '/api/me', 'a', undefined, bad)).status, 401);
    assert.equal((await call(restUrl, '/tickets', 'a', undefined, bad)).status, 401);
  }
});
test('TN-02: API write and PostgREST read apply the same ownership policy', async () => {
  const a = await create('a', 'VPN của nhân viên A');
  const b = await create('b', 'VPN của nhân viên B');
  for (const key of Object.keys(users)) {
    const api = (await call(apiUrl, '/api/tickets?limit=100', key)).body.data.map(row => row.id).sort();
    const rest = (await call(restUrl, '/tickets?select=id', key)).body.map(row => row.id).sort();
    assert.deepEqual(api, rest, `API/PostgREST mismatch for ${key}`);
  }
  assert.equal((await call(apiUrl, `/api/tickets/${b.id}`, 'a')).status, 404);
  assert.equal((await call(apiUrl, `/api/tickets/${a.id}/events`, 'b')).status, 404);
  assert.deepEqual((await call(restUrl, `/tickets?id=eq.${a.id}`, 'b')).body, []);
  const events = (await call(apiUrl, `/api/tickets/${a.id}/events`, 'a')).body.data;
  assert.equal(events.length, 1);
  assert.equal(events[0].actor_id, users.a.sub);
  assert.equal(events[0].event_type, 'created');
});
test('TN-02: Critical denied for Employee and Agent on both paths; Manager succeeds', async () => {
  for (const key of ['a', 'agent']) {
    assert.equal((await call(apiUrl, '/api/tickets', key, newTicket('Critical bị chặn', { priority: 'critical' }))).status, 403);
    assert.equal((await call(restUrl, '/tickets', key, newTicket('Critical REST bị chặn', { priority: 'critical' }))).status, 403);
  }
  assert.equal((await create('manager', 'Critical hợp lệ', { priority: 'critical' })).priority, 'critical');
  assert.equal((await call(restUrl, '/tickets', 'manager', newTicket('Manager REST tạo', { priority: 'critical' }))).status, 201);
});
test('ownership/status spoofing, invalid FK and malformed input fail without partial audit rows', async () => {
  const before = Number((await admin.query('SELECT count(*) FROM public.ticket_events')).rows[0].count);
  assert.equal((await call(apiUrl, '/api/tickets', 'a', newTicket('Mạo danh chủ sở hữu', { requester_id: users.b.sub }))).status, 400);
  assert.equal((await call(restUrl, '/tickets', 'a', newTicket('REST giả trạng thái', { status: 'closed' }))).status, 403);
  assert.equal((await call(apiUrl, '/api/tickets', 'a', newTicket('Sai danh mục', { category_id: users.b.sub }))).status, 403);
  assert.equal((await call(apiUrl, '/api/tickets', 'a', newTicket('Tiêu đề hợp lệ', { description: '  ' }))).status, 400);
  assert.equal((await call(apiUrl, '/api/tickets?limit=1000')).status, 400);
  assert.equal((await call(apiUrl, '/api/tickets/not-a-uuid')).status, 400);
  assert.equal(Number((await admin.query('SELECT count(*) FROM public.ticket_events')).rows[0].count), before);
});
test('rollback and concurrent pooled requests never leak identity', async () => {
  const marker = 'Ticket cần rollback';
  await assert.rejects(db.asUser(claims('a'), async client => {
    await client.query('INSERT INTO public.tickets(category_id,title,description) VALUES ($1,$2,$3)',
      [category, marker, 'Transaction sẽ bị rollback']);
    throw new Error('forced rollback');
  }), /forced rollback/);
  assert.equal((await admin.query('SELECT id FROM public.tickets WHERE title=$1', [marker])).rowCount, 0);
  await Promise.all(Array.from({ length: 24 }, async (_, index) => {
    const key = index % 2 ? 'a' : 'b';
    const rows = (await call(apiUrl, '/api/tickets?limit=100', key)).body.data;
    assert.ok(rows.every(row => row.requester_id === users[key].sub));
  }));
  const idle = await db.pool.query("SELECT current_user, nullif(current_setting('request.jwt.claims',true),'') AS claims");
  assert.equal(idle.rows[0].current_user, 'api_login');
  assert.equal(idle.rows[0].claims, null);
});
test('device requests share ownership RLS and reject approval/quantity injection', async () => {
  const body = { device_type: 'laptop', reason: 'Cần máy để làm việc từ xa', quantity: 1 };
  const made = await call(apiUrl, '/api/device-requests', 'a', body);
  assert.equal(made.status, 201);
  assert.equal(made.body.requester_id, users.a.sub);
  assert.equal((await call(apiUrl, '/api/device-requests', 'b')).body.data.length, 0);
  assert.equal((await call(restUrl, '/device_requests', 'b')).body.length, 0);
  assert.equal((await call(apiUrl, '/api/device-requests', 'manager')).body.data.length, 1);
  assert.equal((await call(apiUrl, '/api/device-requests', 'a', { ...body, quantity: 0 })).status, 400);
  assert.equal((await call(restUrl, '/device_requests', 'a', { ...body, status: 'approved' })).status, 403);
});
test('audit and attachments cannot be forged; other employee cannot read related metadata', async () => {
  const ticket = await create('a', 'Ticket có tệp đính kèm');
  await admin.query(`INSERT INTO public.attachments(ticket_id,uploaded_by,file_name,object_key,content_type,size_bytes)
    VALUES ($1,$2,'test.txt','test/metadata-only','text/plain',10)`, [ticket.id, users.a.sub]);
  assert.equal((await call(restUrl, `/attachments?ticket_id=eq.${ticket.id}`, 'a')).body.length, 1);
  assert.equal((await call(restUrl, `/attachments?ticket_id=eq.${ticket.id}`, 'b')).body.length, 0);
  assert.equal((await call(restUrl, '/ticket_events', 'a', {
    ticket_id: ticket.id, actor_id: users.b.sub, event_type: 'created',
  })).status, 403);
});
