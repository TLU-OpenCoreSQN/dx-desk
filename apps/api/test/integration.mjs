// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { generateKeyPair, exportJWK, SignJWT, jwtVerify } from 'jose';
import { createApp } from '../dist/app.js';
import { Database } from '../dist/database.js';
import { downloadSignature } from '../dist/downloads.js';
import { applyDataset, generate } from '../../../scripts/seed-synthetic.mjs';

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl || !new URL(adminUrl).pathname.startsWith('/dxdesk_test')) {
  throw new Error('TEST_DATABASE_ADMIN_URL must reference a disposable dxdesk_test* database.');
}
if (!process.env.TEST_POSTGREST_BIN) throw new Error('A real TEST_POSTGREST_BIN is required for TN-02.');
const admin = new Pool({ connectionString: adminUrl });
const users = {
  a: { sub: '20000000-0000-4000-8000-000000000001', roles: ['Employee'], department: 'phong-hanh-chinh' },
  b: { sub: '20000000-0000-4000-8000-000000000002', roles: ['Employee'], department: 'phong-ke-toan' },
  agent: { sub: '20000000-0000-4000-8000-000000000003', roles: ['Agent'] },
  manager: { sub: '20000000-0000-4000-8000-000000000004', roles: ['Manager'], department: 'phong-hanh-chinh' },
  agent2: { sub: '20000000-0000-4000-8000-000000000006', roles: ['Agent'] },
};
const automationClaims = { sub:'20000000-0000-4000-8000-000000000005',role:'ticket_automation',azp:'dxdesk-automation',
  realm_access:{roles:['ticket-automation']} };
const networkTeam='30000000-0000-4000-8000-000000000001';
const identityTeam='30000000-0000-4000-8000-000000000002';
const category = '10000000-0000-4000-8000-000000000001';
let app, db, jwksServer, restProcess, apiUrl, restUrl, privateKey, publicKey, issuer;
let restLogs = '';
// clamd + SeaweedFS giả cho W3-06 (upload): chứng minh ghép nối API<->TCP clamd<->HTTP filer
// và đường ghi metadata qua migration 004 + RLS, nhưng KHÔNG chạy engine ClamAV thật.
let clamdServer, seaweedServer;
const seaweedPuts = [];
const seaweedDeletes = [];
const tokens = {};
const claims = key => ({
  sub: users[key].sub, role: 'authenticated', realm_access: { roles: users[key].roles },
  // W5-02: đơn vị đi trong JWT (thuộc tính Keycloak), Agent không cần đơn vị.
  ...(users[key].department && { department: users[key].department }),
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
async function patch(base, path, key, body, headers = {}) {
  const response = await fetch(base + path, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokens[key]}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...headers },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}
// Danh mục vpn có requirement_fields từ hợp đồng tuần 3 (migration 003) -> dữ liệu test mặc định phải kèm fields.
const newTicket = (title, extra = {}) => ({
  category_id: category, title, description: 'Chi tiết thử nghiệm quyền truy cập tuần 2.',
  fields: { client_version: 'OpenVPN 4.2', error_message: 'Kết nối bị ngắt sau 30 giây' }, ...extra,
});
async function create(key, title, extra) {
  const result = await call(apiUrl, '/api/tickets', key, newTicket(title, extra));
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}
// Direct REST must satisfy the same category fields as the API.
const restTicket = (title, extra = {}) => {
  const { fields, ...columns } = newTicket(title, extra);
  return { ...columns, request_fields: fields };
};
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
  // clamd giả: parse khung INSTREAM, nếu payload chứa chuỗi "EICAR" thì trả FOUND (mô phỏng
  // đúng ánh xạ mà engine thật sẽ gây ra), ngược lại trả OK. Không chạy libclamav.
  clamdServer = createTcpServer(socket => {
    let buffer = Buffer.alloc(0);
    let done = false;
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (done) return;
      const newline = buffer.indexOf(0x0a);
      if (newline === -1) return;
      let position = newline + 1;
      const body = [];
      for (;;) {
        if (position + 4 > buffer.length) return;
        const length = buffer.readUInt32BE(position);
        position += 4;
        if (length === 0) { done = true; break; }
        if (position + length > buffer.length) return;
        body.push(buffer.subarray(position, position + length));
        position += length;
      }
      const payload = Buffer.concat(body);
      socket.write(payload.includes('EICAR') ? 'stream: Eicar-Signature FOUND\n' : 'stream: OK\n');
    });
    socket.on('error', () => {});
  });
  clamdServer.listen(0, '127.0.0.1'); await once(clamdServer, 'listening');
  seaweedServer = createServer((request, response) => {
    if (request.method === 'GET') {
      const item = seaweedPuts.find(item => item.url === request.url);
      response.statusCode = item ? 200 : 404; response.end(item?.body); return;
    }
    const chunks = [];
    request.on('data', c => chunks.push(c));
    request.on('end', () => {
      (request.method === 'DELETE' ? seaweedDeletes : seaweedPuts)
        .push({ method: request.method, url: request.url, body: Buffer.concat(chunks) });
      response.statusCode = 200; response.end('OK');
    });
  });
  seaweedServer.listen(0, '127.0.0.1'); await once(seaweedServer, 'listening');
  Object.assign(process.env, {
    DATABASE_URL: apiDatabaseUrl.href, OIDC_ISSUER: issuer, OIDC_AUDIENCE: 'dxdesk-api',
    OIDC_JWKS_URL: issuer + '/certs', DB_POOL_MAX: '2',
    CLAMD_ADDR: `127.0.0.1:${clamdServer.address().port}`, CLAMD_TIMEOUT_MS: '2000',
    SEAWEEDFS_ENDPOINT: `http://127.0.0.1:${seaweedServer.address().port}`,
    ATTACHMENT_SIGNING_KEY: 'integration-only-signing-secret-at-least-32-bytes',
    WIKI_PUBLIC_URL: 'http://wiki.test:18030/',
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
  tokens.service = await token('a', automationClaims);
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
  if (clamdServer) await new Promise(resolve => clamdServer.close(resolve));
  if (seaweedServer) await new Promise(resolve => seaweedServer.close(resolve));
  await admin.end();
});

test('TN-02: real database has twelve protected domain tables and reference data', async () => {
  const result = await admin.query(`SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`);
  // W5-08 (migration 012): +knowledge_articles, category_articles, self_service_resolutions.
  // W5-02 (migration 018): +device_request_events.
  assert.equal(result.rowCount, 12);
  assert.ok(result.rows.every(row => row.relrowsecurity && row.relforcerowsecurity));
  // Hợp đồng tuần 3 (migration 003): thêm danh mục access + system-error -> 6 loại active.
  assert.equal((await call(apiUrl, '/api/categories')).body.data.length, 6);
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
    assert.equal((await call(restUrl, '/tickets', key, restTicket('Critical REST bị chặn', { priority: 'critical' }))).status, 403);
  }
  assert.equal((await create('manager', 'Critical hợp lệ', { priority: 'critical' })).priority, 'critical');
  assert.equal((await call(restUrl, '/tickets', 'manager', restTicket('Manager REST tạo', { priority: 'critical' }))).status, 201);
});
test('ownership/status spoofing, invalid FK and malformed input fail without partial audit rows', async () => {
  const before = Number((await admin.query('SELECT count(*) FROM public.ticket_events')).rows[0].count);
  assert.equal((await call(apiUrl, '/api/tickets', 'a', newTicket('Mạo danh chủ sở hữu', { requester_id: users.b.sub }))).status, 400);
  assert.equal((await call(restUrl, '/tickets', 'a', restTicket('REST giả trạng thái', { status: 'closed' }))).status, 403);
  assert.equal((await call(apiUrl, '/api/tickets', 'a', newTicket('Sai danh mục', { category_id: users.b.sub }))).status, 403);
  assert.equal((await call(apiUrl, '/api/tickets', 'a', newTicket('Tiêu đề hợp lệ', { description: '  ' }))).status, 400);
  assert.equal((await call(apiUrl, '/api/tickets?limit=1000')).status, 400);
  assert.equal((await call(apiUrl, '/api/tickets/not-a-uuid')).status, 400);
  assert.equal(Number((await admin.query('SELECT count(*) FROM public.ticket_events')).rows[0].count), before);
});
test('rollback and concurrent pooled requests never leak identity', async () => {
  const marker = 'Ticket cần rollback';
  await assert.rejects(db.asUser(claims('a'), async client => {
    await client.query('INSERT INTO public.tickets(category_id,title,description,request_fields) VALUES ($1,$2,$3,$4)',
      [category, marker, 'Transaction sẽ bị rollback', JSON.stringify(newTicket(marker).fields)]);
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
test('direct REST enforces access approval on omitted and explicit initial status', async () => {
  const body = restTicket('REST yêu cầu cấp quyền', {
    category_id: '10000000-0000-4000-8000-000000000005',
    fields: { system_name: 'CRM', permission_level: 'ReadOnly', valid_until: '2026-12-31' },
  });
  for (const key of ['a', 'b']) {
    assert.equal((await call(restUrl, '/tickets', key, body)).status, 403);
    assert.equal((await call(restUrl, '/tickets', key, { ...body, status: 'new' })).status, 403);
    const approvedPath = await call(restUrl, '/tickets', key, { ...body, status: 'pending_approval' });
    assert.equal(approvedPath.status, 201, JSON.stringify(approvedPath.body));
    assert.equal(approvedPath.body[0].status, 'pending_approval');
  }
  for (const key of ['agent', 'manager']) {
    assert.equal((await call(restUrl, '/tickets', key, body)).status, 201);
    assert.equal((await call(restUrl, '/tickets', key, { ...body, status: 'pending_approval' })).status, 403);
  }
});
test('direct REST validates and normalizes category fields before creating audit', async () => {
  const before = Number((await admin.query('SELECT count(*) FROM public.ticket_events')).rows[0].count);
  const body = restTicket('REST kiểm tra trường động');
  const cases = [
    [{}, 422],
    [{ client_version: '4.2', error_message: '\u00a0\t ' }, 422],
    [{ ...body.request_fields, rogue: 'value' }, 400],
    [{ ...body.request_fields, error_message: { nested: true } }, 400],
    [{ ...body.request_fields, error_message: null }, 400],
    [{ ...body.request_fields, error_message: 'x'.repeat(501) }, 400],
  ];
  for (const [fields, status] of cases) {
    const result = await call(restUrl, '/tickets', 'a', { ...body, request_fields: fields });
    assert.equal(result.status, status, JSON.stringify(result.body));
  }
  const { request_fields, ...missing } = body;
  assert.equal((await call(restUrl, '/tickets', 'a', missing)).status, 422);
  assert.equal(Number((await admin.query('SELECT count(*) FROM public.ticket_events')).rows[0].count), before);
  const normalized = await call(restUrl, '/tickets', 'a', {
    ...body, request_fields: { client_version: '  4.2  ', error_message: '  Connection failed  ', device_os: '  ' },
  });
  assert.equal(normalized.status, 201, JSON.stringify(normalized.body));
  assert.deepEqual(normalized.body[0].request_fields, { client_version: '4.2', error_message: 'Connection failed' });
});
test('SLA columns and resolution notes cannot be forged without a valid transition', async () => {
  const ticket = await create('a', 'Bảo vệ số liệu SLA');
  for (const key of ['a', 'agent', 'manager']) {
    for (const body of [
      { sla_paused_ms: 315360000000 }, { waiting_since: '2000-01-01T00:00:00Z' },
      { updated_at: '2000-01-01T00:00:00Z' }, { resolution_note: 'Giả kết quả xử lý' },
    ]) {
      const result = await patch(restUrl, `/tickets?id=eq.${ticket.id}`, key, body);
      assert.equal(result.status, 403, JSON.stringify(result.body));
    }
  }
  const actual = (await call(apiUrl, `/api/tickets/${ticket.id}`)).body;
  assert.equal(Number(actual.sla_paused_ms), 0);
  assert.equal(actual.waiting_since, null);
  assert.equal(actual.resolution_note, null);
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}/events`)).body.data.length, 1);
});
test('reopen clears the previous result and closed tickets preserve resolution history', async () => {
  const ticket = await create('a', 'Bảo vệ kết quả xử lý');
  for (const to of ['triaged', 'assigned', 'in_progress']) {
    assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', { to })).status, 200);
  }
  const firstNote = 'Cài lại client VPN và kiểm tra kết nối';
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent',
    { to: 'resolved', resolution_note: firstNote })).status, 200);
  const reopened = await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', { to: 'in_progress' });
  assert.equal(reopened.body.resolution_note, null);
  const stale = await patch(restUrl, `/tickets?id=eq.${ticket.id}`, 'agent', { status: 'resolved' });
  assert.equal(stale.status, 400);
  assert.equal(stale.body.code, '45003');
  const secondNote = 'Thay bộ định tuyến, kiểm tra lần hai';
  assert.equal((await patch(restUrl, `/tickets?id=eq.${ticket.id}`, 'agent',
    { status: 'resolved', resolution_note: secondNote })).status, 200);
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'a', { to: 'closed' })).status, 200);
  const before = (await call(apiUrl, `/api/tickets/${ticket.id}/events`)).body.data;
  assert.deepEqual(before.filter(event => event.payload.to === 'resolved').map(event => event.payload.resolution_note),
    [firstNote, secondNote]);
  assert.equal((await patch(restUrl, `/tickets?id=eq.${ticket.id}`, 'a',
    { resolution_note: 'Sửa kết quả sau khi đóng' })).status, 403);
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}`)).body.resolution_note, secondNote);
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}/events`)).body.data.length, before.length);
});
test('W3: state machine, poka-yoke and SLA bookkeeping over real PostgreSQL', async () => {
  const ticket = await create('a', 'Luồng tuần 3 VPN');
  const due = new Date(ticket.sla_due_at).getTime() - new Date(ticket.created_at).getTime();
  assert.equal(due, 1440 * 60_000, 'normal = 1440 phút theo sla_policies.resolution_minutes');
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}`, 'b')).status, 404);
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'a', { to: 'triaged' })).status, 403);
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', { to: 'closed' })).status, 422);
  const steps = [
    ['agent', { to: 'triaged' }], ['agent', { to: 'assigned' }], ['agent', { to: 'in_progress' }],
    ['agent', { to: 'waiting_user', note: 'Cần ảnh chụp lỗi' }],
  ];
  for (const [key, body] of steps) {
    const r = await patch(apiUrl, `/api/tickets/${ticket.id}/status`, key, body);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', { to: 'resolved' })).status, 422);
  await new Promise(r => setTimeout(r, 1200));
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'a', { to: 'in_progress' })).status, 200);
  const resumed = (await call(apiUrl, `/api/tickets/${ticket.id}`, 'a')).body;
  assert.ok(resumed.sla_paused_ms >= 1000, `sla_paused_ms=${resumed.sla_paused_ms} phải cộng dồn thời gian chờ`);
  assert.equal(resumed.waiting_since ?? null, null);
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', { to: 'resolved' })).status, 422);
  const resolved = (await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent',
    { to: 'resolved', resolution_note: 'Cài lại VPN client 4.3, kết nối ổn định' })).body;
  assert.equal(resolved.status, 'resolved');
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', { to: 'closed' })).status, 403);
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'a', { to: 'closed' })).body.status, 'closed');
  const events = (await call(apiUrl, `/api/tickets/${ticket.id}/events`, 'a')).body.data;
  assert.equal(events.length, 9, 'created + 7 status transitions + team assignment');
  assert.deepEqual(events[1].payload, { from: 'new', to: 'triaged', note: '' });
  assert.equal(events.find(e => e.payload.to === 'waiting_user').payload.note, 'Cần ảnh chụp lỗi');
  // PostgREST ghi trực tiếp vẫn bị guard trigger chặn. SQLSTATE tự định nghĩa (45xxx) không có
  // ánh xạ HTTP riêng nên cổng PostgREST trả 400; API đường chính map 45xxx → 403/422 theo contract.md.
  const blocked = await patch(restUrl, `/tickets?id=eq.${ticket.id}`, 'agent', { status: 'new' });
  assert.equal(blocked.status, 400, JSON.stringify(blocked.body));
  assert.equal(blocked.body.code, '45001');
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}`, 'a')).body.status, 'closed');
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}/events`, 'a')).body.data.length, 9,
    'guard từ chối không được ghi thêm ticket_events');
  // Trạng thái cuối là 409; đường reopen resolved→in_progress phải có note mới mỗi lần xử lý.
  assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'a', { to: 'cancelled' })).status, 409);
  const reopen = await create('a', 'Ticket reopen VPN');
  for (const [key, body] of [['agent', { to: 'triaged' }], ['agent', { to: 'assigned' }],
    ['agent', { to: 'in_progress' }], ['agent', { to: 'resolved', resolution_note: 'Đổi DNS cục bộ' }]]) {
    assert.equal((await patch(apiUrl, `/api/tickets/${reopen.id}/status`, key, body)).status, 200);
  }
  assert.equal((await patch(apiUrl, `/api/tickets/${reopen.id}/status`, 'agent', { to: 'in_progress' })).status, 200);
  assert.equal((await patch(apiUrl, `/api/tickets/${reopen.id}/status`, 'agent', { to: 'resolved' })).status, 422,
    'note cũ không được tái sử dụng cho lần xử lý mới');
  assert.equal((await patch(apiUrl, `/api/tickets/${reopen.id}/status`, 'agent',
    { to: 'resolved', resolution_note: 'Nâng driver card mạng, kiểm tra lại' })).body.status, 'resolved');
  // Employee tạo yêu cầu 'access' tự vào hàng chờ phê duyệt; Agent/Manager duyệt, chỉ Manager từ chối.
  const access = await create('a', 'Xin quyền truy cập CRM', {
    category_id: '10000000-0000-4000-8000-000000000005',
    fields: { system_name: 'CRM', permission_level: 'ReadOnly', valid_until: '2026-12-31' },
  });
  assert.equal(access.status, 'pending_approval');
  assert.equal((await patch(apiUrl, `/api/tickets/${access.id}/status`, 'a', { to: 'assigned' })).status, 403);
  assert.equal((await patch(apiUrl, `/api/tickets/${access.id}/status`, 'agent', { to: 'assigned' })).body.status, 'assigned');
  const denied = await create('a', 'Xin quyền Admin file server', {
    category_id: '10000000-0000-4000-8000-000000000005',
    fields: { system_name: 'File Server', permission_level: 'Admin', valid_until: '2026-12-31' },
  });
  assert.equal((await patch(apiUrl, `/api/tickets/${denied.id}/status`, 'manager',
    { to: 'new', note: 'Thiếu căn cứ cấp quyền' })).body.status, 'new');
  // Bị từ chối thì phải đi lại từ đầu: từ 'new' không được nhảy thẳng tới 'assigned'.
  assert.equal((await patch(apiUrl, `/api/tickets/${denied.id}/status`, 'manager', { to: 'assigned' })).status, 422);
});

async function seedState(status, owner = 'a') {
  return (await admin.query(`INSERT INTO public.tickets(requester_id,category_id,title,description,status,resolution_note,waiting_since)
    VALUES($1,$2,'Isolated workflow matrix','State prepared by migration owner for transition acceptance',$3,
      CASE WHEN $3='resolved' THEN 'Historical result' END,
      CASE WHEN $3='waiting_user' THEN now()-interval '1 second' END) RETURNING *`,
    [users[owner].sub, category, status])).rows[0];
}

test('all 17 DB edges enforce role and requester permissions through API and direct REST', async () => {
  const edges = (await admin.query('SELECT * FROM private.ticket_transitions ORDER BY from_status,to_status')).rows;
  assert.equal(edges.length, 17);
  for (const edge of edges) for (const actor of ['a','agent','manager']) for (const owned of [true,false]) {
    const allowed = edge.allowed_roles.some(r => users[actor].roles.includes(r)) || edge.requester_allowed && owned;
    for (const rest of [false,true]) {
      const ticket = await seedState(edge.from_status, owned ? actor : 'b');
      const body = rest ? { status: edge.to_status } : { to: edge.to_status };
      if (edge.to_status === 'resolved') body.resolution_note = 'New resolution for this transition';
      if (!rest && edge.from_status === 'pending_approval' && edge.to_status === 'new') body.note='Rejection reason for role matrix';
      const result = await patch(rest ? restUrl : apiUrl,
        rest ? `/tickets?id=eq.${ticket.id}` : `/api/tickets/${ticket.id}/status`, actor, body,
        rest ? {'X-Status-Note':'Rejection reason for role matrix'} : {});
      const invisible = actor === 'a' && !owned;
      assert.equal(result.status, allowed ? 200 : invisible ? (rest ? 200 : 404) : rest ? 400 : 403,
        `${rest?'REST':'API'} ${edge.from_status}->${edge.to_status} ${actor} owner=${owned}: ${JSON.stringify(result.body)}`);
      const actual = (await admin.query('SELECT status FROM public.tickets WHERE id=$1', [ticket.id])).rows[0];
      assert.equal(actual.status, allowed ? edge.to_status : edge.from_status);
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM public.ticket_events WHERE ticket_id=$1', [ticket.id])).rows[0].n,
        allowed ? (edge.to_status==='assigned' ? 3 : 2) : 1, 'denied writes cannot add audit events');
    }
  }
});

test('conflicting concurrent transitions serialize and an audit failure rolls back the status', async () => {
  const ticket = await create('a', 'Concurrent transition acceptance');
  const results = await Promise.all(['triaged','pending_approval'].map(to =>
    patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', { to })));
  assert.deepEqual(results.map(r => r.status).sort(), [200,422]);
  const events = (await call(apiUrl, `/api/tickets/${ticket.id}/events`, 'a')).body.data;
  assert.equal(events.length, 2);
  const rollback = await create('a', 'Atomic status and audit acceptance');
  await admin.query(`CREATE FUNCTION public.test_fail_status_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.event_type='status_changed' THEN RAISE EXCEPTION 'test audit unavailable'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_status_audit BEFORE INSERT ON public.ticket_events FOR EACH ROW EXECUTE FUNCTION public.test_fail_status_audit()`);
  try {
    assert.equal((await patch(apiUrl, `/api/tickets/${rollback.id}/status`, 'agent', { to:'triaged' })).status, 500);
    assert.equal((await call(apiUrl, `/api/tickets/${rollback.id}`, 'a')).body.status, 'new');
    assert.equal((await call(apiUrl, `/api/tickets/${rollback.id}/events`, 'a')).body.data.length, 1);
  } finally { await admin.query('DROP TRIGGER test_status_audit ON public.ticket_events; DROP FUNCTION public.test_fail_status_audit()'); }
});

test('SLA accumulates repeated waits, cancellation ends an open wait, and reopen keeps the original due date', async () => {
  const ticket = await seedState('in_progress');
  let paused = 0;
  for (let cycle=0; cycle<2; cycle++) {
    assert.equal((await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', {to:'waiting_user'})).status, 200);
    await new Promise(r => setTimeout(r, 150));
    const resumed = await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'a', {to:'in_progress'});
    assert.ok(Number(resumed.body.sla_paused_ms) >= paused+100);
    paused = Number(resumed.body.sla_paused_ms);
  }
  const resolved = await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', {to:'resolved',resolution_note:'Resolution acceptance'});
  assert.equal(resolved.status, 200);
  const reopened = await patch(apiUrl, `/api/tickets/${ticket.id}/status`, 'agent', {to:'in_progress'});
  assert.equal(reopened.body.sla_due_at, ticket.sla_due_at.toISOString());
  assert.equal(Number(reopened.body.sla_paused_ms), paused);
  const waiting = await seedState('waiting_user');
  const cancelled = await patch(apiUrl, `/api/tickets/${waiting.id}/status`, 'a', {to:'cancelled'});
  assert.ok(Number(cancelled.body.sla_paused_ms) >= 1000);
  assert.equal(cancelled.body.waiting_since, null);
});

// W3-06: tải tệp đính kèm — clamd GIẢ (node:net) + SeaweedFS GIẢ (node:http) nhưng
// PostgreSQL/RLS THẬT và hàm private.record_attachment của migration 004 THẬT.
// Chứng minh ghép nối và thứ tự chống orphan; KHÔNG chạy engine ClamAV thật (EICAR chỉ mô phỏng).
const uploadBody = (contentBase64, contentType = 'text/plain', fileName = 'file.txt') =>
  ({ file_name: fileName, content_type: contentType, content_base64: contentBase64 });

test('signed downloads enforce ownership, clean status and short-lived byte-exact access', async () => {
  const ticket = await create('a', 'Tải xuống tệp an toàn');
  const bytes = Buffer.from('Download bytes: tiếng Việt 0123456789');
  const uploaded = await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'a',
    uploadBody(bytes.toString('base64'), 'text/plain', 'ghi chú.txt'));
  assert.equal(uploaded.status, 201);
  const id = uploaded.body.id;
  const list = await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'a');
  assert.equal(list.body.data.length, 1);
  assert.equal('object_key' in list.body.data[0], false);
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'b')).status, 404);
  assert.equal((await call(apiUrl, `/api/attachments/${id}/download-url`, 'b', {})).status, 404);
  assert.equal((await call(apiUrl, `/api/attachments/${id}/download-url`, null, {})).status, 401);
  const issued = await call(apiUrl, `/api/attachments/${id}/download-url`, 'a', {});
  assert.equal(issued.status, 201);
  const url = issued.body.url;
  const download = await fetch(apiUrl + url);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  for (const invalid of [url.replace(/signature=[a-f0-9]+/, 'signature=' + '0'.repeat(64)),
    url.replace(id, ticket.id), `/api/attachments/${id}/content`, url + '&expires=1000000000']) {
    assert.equal((await fetch(apiUrl + invalid)).status, 403);
  }
  const expired = String(Math.floor(Date.now() / 1000) - 1);
  assert.equal((await fetch(`${apiUrl}/api/attachments/${id}/content?expires=${expired}&signature=${downloadSignature(id, expired)}`)).status, 403);
  await admin.query("UPDATE public.attachments SET scan_status='failed' WHERE id=$1", [id]);
  assert.equal((await call(apiUrl, `/api/attachments/${id}/download-url`, 'a', {})).status, 403);
  assert.equal((await fetch(apiUrl + url)).status, 404, 'already issued link cannot read a non-clean object');
  await assert.rejects(db.asUser(claims('a'), c => c.query('SELECT * FROM private.clean_attachment_for_download($1)', [id])),
    error => error.code === '42501');
  assert.equal((await call(restUrl, '/rpc/clean_attachment_for_download', 'a', { p_id: id })).status, 404);
});

test('W3-06: upload quét clamd, lưu SeaweedFS khi sạch, ghi metadata theo RLS trên PostgreSQL thật', async () => {
  const ticket = await create('a', 'Ticket đính kèm W3-06');
  const clean = Buffer.from('DX-DESK benign payload for the upload wiring test').toString('base64');
  const cleanBytes = Buffer.from(clean, 'base64');

  // (1) SẠCH -> 201 + scan_status clean + đúng MỘT PUT mang nguyên thân nhị phân.
  const before = seaweedPuts.length;
  const ok = await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'a', uploadBody(clean, 'text/plain', 'notes.txt'));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.scan_status, 'clean');
  assert.equal(Number(ok.body.size_bytes), cleanBytes.length, 'pg có thể trả bigint dạng chuỗi');
  assert.equal(ok.body.file_name, 'notes.txt');
  assert.match(ok.body.object_key, new RegExp(`^attachments/${ticket.id}/[0-9a-f-]{36}$`));
  assert.doesNotMatch(ok.body.object_key, /notes\.txt/, 'object key do server sinh, không chứa tên client');
  assert.equal(seaweedPuts.length, before + 1);
  assert.equal(seaweedPuts[before].method, 'PUT');
  assert.equal(seaweedPuts[before].url, `/${ok.body.object_key}`);
  assert.ok(seaweedPuts[before].body.equals(cleanBytes), 'byte đưa vào SeaweedFS phải đúng bằng nội dung upload');
  assert.equal((await admin.query('SELECT scan_status FROM public.attachments WHERE id=$1', [ok.body.id])).rows[0].scan_status, 'clean');

  // (2) NHIỄM (payload chứa EICAR -> clamd giả trả FOUND) -> 422, KHÔNG PUT mới, row infected.
  const eicar = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*').toString('base64');
  const beforeInfected = seaweedPuts.length;
  const bad = await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'a', uploadBody(eicar, 'text/plain', 'eicar.txt'));
  assert.equal(bad.status, 422, JSON.stringify(bad.body));
  assert.equal(seaweedPuts.length, beforeInfected, 'tệp nhiễm không được bao giờ chạm SeaweedFS');
  const infectedRows = (await admin.query(
    `SELECT file_name FROM public.attachments WHERE ticket_id=$1 AND scan_status='infected'`, [ticket.id],
  )).rows;
  assert.equal(infectedRows.length, 1);
  assert.equal(infectedRows[0].file_name, 'eicar.txt');

  // (3) clamd không reachable (cổng chết) -> 503 + row failed.
  const deadClamd = process.env.CLAMD_ADDR;
  process.env.CLAMD_ADDR = `127.0.0.1:${await freePort()}`;
  const failed = await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'a', uploadBody(clean));
  process.env.CLAMD_ADDR = deadClamd;
  assert.equal(failed.status, 503, JSON.stringify(failed.body));
  assert.equal((await admin.query(
    `SELECT count(*)::int AS c FROM public.attachments WHERE ticket_id=$1 AND scan_status='failed'`, [ticket.id],
  )).rows[0].c, 1);

  // (4) RLS: Employee khác tải vào ticket của 'a' -> 404 (cổng nhìn thấy chạy TRƯỚC khi quét/lưu).
  const beforeRls = seaweedPuts.length;
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'b', uploadBody(clean))).status, 404);
  assert.equal(seaweedPuts.length, beforeRls);

  // (5) Chặn ở tầng DTO trước khi đụng clamd: content type ngoài allow-list và base64 rác -> 400.
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'a',
    uploadBody(clean, 'application/x-msdownload'))).status, 400);
  assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'a',
    uploadBody('not!!!valid#base64'))).status, 400);
});

test('upload reserves metadata before PUT and compensates a failed DB completion', async () => {
  const ticket = await create('a', 'DB failure during upload');
  const body = uploadBody(Buffer.from('benign lifecycle test').toString('base64'));
  await admin.query(`
    CREATE FUNCTION public.test_fail_attachment() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'simulated metadata failure'; END $$;
    CREATE TRIGGER test_attachment_insert BEFORE INSERT ON public.attachments
      FOR EACH ROW EXECUTE FUNCTION public.test_fail_attachment();
  `);
  const puts = seaweedPuts.length, deletes = seaweedDeletes.length;
  try {
    assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'a', body)).status, 500);
    assert.equal(seaweedPuts.length, puts, 'no object before metadata reservation commits');
  } finally { await admin.query('DROP TRIGGER test_attachment_insert ON public.attachments'); }
  await admin.query(`
    CREATE TRIGGER test_attachment_finish BEFORE UPDATE ON public.attachments
      FOR EACH ROW WHEN (NEW.scan_status = 'clean') EXECUTE FUNCTION public.test_fail_attachment();
  `);
  try {
    assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}/attachments`, 'a', body)).status, 500);
    assert.equal(seaweedPuts.length, puts + 1);
    assert.equal(seaweedDeletes.length, deletes + 1);
    assert.equal(seaweedPuts.at(-1).url, seaweedDeletes.at(-1).url);
    const rows = (await admin.query('SELECT * FROM public.attachments WHERE ticket_id=$1', [ticket.id])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].scan_status, 'failed');
    assert.equal('/' + rows[0].object_key, seaweedPuts.at(-1).url);
  } finally {
    await admin.query('DROP TRIGGER test_attachment_finish ON public.attachments; DROP FUNCTION public.test_fail_attachment()');
  }
});

test('W4 service scope is independent and cannot enter user routes or direct REST', async () => {
  assert.equal((await call(apiUrl,'/api/system/sla/evaluate','a',{})).status,403);
  assert.equal((await call(apiUrl,'/api/system/outbox','service')).status,200);
  assert.equal((await call(apiUrl,'/api/system/teams','service')).body.data.length,3);
  assert.equal((await call(apiUrl,'/api/me','service')).status,401);
  assert.equal((await call(restUrl,'/tickets','service')).status,403);
  for(const overrides of [{azp:'other-client'},{role:'authenticated'},
    {realm_access:{roles:['ticket-automation','Agent']}},{realm_access:{roles:[]}}]) {
    const bad=await token('a',{...automationClaims,...overrides});
    assert.equal((await call(apiUrl,'/api/system/sla/evaluate','service',{},bad)).status,403);
  }
  for(const options of [{issuer:'https://wrong.invalid'},{audience:'other-api'},{exp:'1 second ago'}]) {
    const bad=await token('a',automationClaims,options);
    assert.equal((await call(apiUrl,'/api/system/sla/evaluate','service',{},bad)).status,401);
  }
  await assert.rejects(db.asUser(claims('agent'),c=>c.query('SELECT private.claim_outbox()')),e=>e.code==='42501');
});

async function createdEvent(ticketId) {
  return (await admin.query("SELECT event_id,envelope FROM private.outbox WHERE envelope->>'ticket_id'=$1 AND envelope->>'event_type'='ticket.created'",[ticketId])).rows[0];
}
const automation = operation => db.asAutomation(automationClaims,operation);
const processEvent = id => call(apiUrl,`/api/system/events/${id}/process`,'service',{schema_version:1});

test('W4 routing and durable inbox are atomic, repeatable, ordered and keep a real system actor',async()=>{
  const ticket=await create('a','Automatic team routing acceptance');
  const event=await createdEvent(ticket.id);
  assert.equal(event.envelope.schema_version,1);
  assert.equal(event.envelope.ticket_version,1);
  assert.equal(event.envelope.actor.type,'user');
  assert.deepEqual(Object.keys(event.envelope.payload).sort(),['category_code','priority','status','team_id']);
  assert.equal((await call(apiUrl,`/api/system/events/${event.event_id}/process`,'service',{schema_version:2})).status,400);
  assert.equal((await call(apiUrl,`/api/system/events/${event.event_id}/process`,'service',{schema_version:1,payload:{status:'closed'}})).status,400);
  const first=await processEvent(event.event_id);
  assert.equal(first.status,200,JSON.stringify(first.body));
  assert.equal(first.body.result,'routed');
  assert.equal(first.body.status,'assigned');
  assert.equal(first.body.team_id,networkTeam);
  assert.deepEqual((await processEvent(event.event_id)).body,first.body);
  const current=(await call(apiUrl,`/api/tickets/${ticket.id}`)).body;
  assert.equal(current.ticket_version,3);
  assert.equal(current.team_name,'Network Team');
  const audits=(await call(apiUrl,`/api/tickets/${ticket.id}/events`)).body.data;
  assert.equal(audits.length,4);
  assert.ok(audits.slice(1).every(row=>row.actor_type==='system'&&row.actor_id===automationClaims.sub&&row.actor_id!==ticket.requester_id));
  assert.equal((await admin.query('SELECT count(*)::int n FROM private.inbox WHERE event_id=$1',[event.event_id])).rows[0].n,1);
  const stale=await create('a','Delayed event cannot resurrect a cancelled ticket');
  await patch(apiUrl,`/api/tickets/${stale.id}/status`,'a',{to:'cancelled'});
  assert.equal((await processEvent((await createdEvent(stale.id)).event_id)).body.result,'skipped');
  const access=await create('a','Access event must await a human decision',{category_id:'10000000-0000-4000-8000-000000000005',
    fields:{system_name:'CRM',permission_level:'Reader',valid_until:'2026-12-31'}});
  assert.equal((await processEvent((await createdEvent(access.id)).event_id)).body.result,'skipped');
  const unresolved=await create('a','Missing routing team remains unresolved');
  await admin.query('UPDATE public.routing_rules SET active=false WHERE category_id=$1',[category]);
  try {
    const id=(await createdEvent(unresolved.id)).event_id;
    const result=await processEvent(id);
    assert.equal(result.body.result,'unresolved');
    assert.equal(result.body.status,'new');
    assert.deepEqual((await processEvent(id)).body,result.body);
    assert.equal((await admin.query("SELECT count(*)::int n FROM public.ticket_events WHERE ticket_id=$1 AND event_type='routing_unresolved'",[unresolved.id])).rows[0].n,1);
  } finally {await admin.query('UPDATE public.routing_rules SET active=true WHERE category_id=$1',[category]);}
  const recoverable=(await createdEvent(unresolved.id)).event_id;
  assert.equal((await admin.query('SELECT count(*)::int n FROM private.inbox WHERE event_id=$1',[recoverable])).rows[0].n,0);
  await admin.query("UPDATE private.outbox SET status='failed' WHERE event_id=$1",[recoverable]);
  assert.equal((await call(apiUrl,`/api/system/outbox/${recoverable}/replay`,'service',{})).body.replayed,true);
  assert.equal((await processEvent(recoverable)).body.result,'routed','Repairing the routing rule and replaying must recover');
  assert.equal((await processEvent(recoverable)).body.result,'routed');
  assert.equal((await call(apiUrl,`/api/tickets/${unresolved.id}`)).body.ticket_version,3);
  let rolledBack;
  await assert.rejects(db.asUser(claims('a'),async c=>{
    rolledBack=(await c.query(`INSERT INTO public.tickets(category_id,title,description,request_fields)
      VALUES($1,'Rollback outbox acceptance','The domain event must roll back with its mutation',$2) RETURNING id`,
      [category,JSON.stringify({client_version:'OpenVPN',error_message:'Timed out'})])).rows[0].id;
    throw new Error('rollback after event trigger');
  }),/rollback after event trigger/);
  assert.equal((await admin.query('SELECT count(*)::int n FROM public.tickets WHERE id=$1',[rolledBack])).rows[0].n,0);
  assert.equal((await admin.query("SELECT count(*)::int n FROM private.outbox WHERE envelope->>'ticket_id'=$1",[rolledBack])).rows[0].n,0);
});

test('W4 roster authorization, concurrent claim, queue filters and version preconditions',async()=>{
  const roster=await call(apiUrl,'/api/system/roster','service',{members:['agent','agent2'].map(key=>({
    team_id:networkTeam,user_id:users[key].sub,display_name:`Fixture ${key}`,active:true}))});
  assert.equal(roster.status,200,JSON.stringify(roster.body));
  assert.equal(roster.body.updated,2);
  assert.equal((await call(apiUrl,'/api/teams','a')).status,403);
  const teams=(await call(apiUrl,'/api/teams','agent')).body.data;
  assert.equal(teams.find(team=>team.id===networkTeam).members.length,2);
  const ticket=await create('a','Concurrent agents claim only one ticket');
  await processEvent((await createdEvent(ticket.id)).event_id);
  assert.equal((await call(apiUrl,`/api/tickets/${ticket.id}/claim`,'manager',{})).status,403,'Staff outside the team cannot claim');
  assert.equal((await call(apiUrl,'/api/system/roster','service',{members:[{
    team_id:networkTeam,user_id:users.manager.sub,display_name:'Manager member',active:true}]})).status,200);
  assert.equal((await call(apiUrl,`/api/tickets/${ticket.id}/claim`,'manager',{})).status,403,
    'Manager-only team membership must not grant the Agent claim capability');
  await assert.rejects(db.asUser(claims('manager'),c=>c.query('SELECT private.claim_ticket($1)',[ticket.id])),
    e=>e.code==='42501','DB must enforce the same role boundary independently of the API');
  const before=(await call(apiUrl,'/api/tickets?queue=team_unassigned&limit=1','agent')).body;
  assert.ok(before.total>=1);
  assert.equal(before.data.length,1);
  const results=await Promise.all(['agent','agent2'].map(key=>call(apiUrl,`/api/tickets/${ticket.id}/claim`,key,{})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const winner=results[0].status===200?'agent':'agent2';
  const first=results.find(r=>r.status===200).body;
  const repeat=await call(apiUrl,`/api/tickets/${ticket.id}/claim`,winner,{});
  assert.equal(repeat.status,200);
  assert.equal(repeat.body.ticket_version,first.ticket_version);
  assert.equal(repeat.body.assignee_name,`Fixture ${winner}`);
  const ownWork=(await call(apiUrl,'/api/tickets?queue=my_open',winner)).body.data;
  assert.ok(ownWork.some(row=>row.id===ticket.id),'Claimed Employee tickets must appear in the Agent work queue');
  const loser=winner==='agent'?'agent2':'agent';
  assert.equal((await call(apiUrl,'/api/tickets?queue=my_open',loser)).body.data.some(row=>row.id===ticket.id),false);
  assert.ok((await call(apiUrl,'/api/tickets?queue=my_open','a')).body.data.some(row=>row.id===ticket.id),
    'Employee my_open retains requester ownership semantics');
  const assigned=(await call(apiUrl,`/api/tickets?queue=team_assigned&assignee_id=${users[winner].sub}`,winner)).body;
  assert.ok(assigned.data.some(row=>row.id===ticket.id));
  assert.equal((await call(apiUrl,'/api/tickets?queue=pending_approval','a')).status,403);
  assert.equal((await call(apiUrl,'/api/tickets?queue=team_unassigned&assignee=me','agent')).status,400);
  assert.equal((await call(apiUrl,'/api/tickets?queue=unknown','agent')).status,400);
  assert.equal((await patch(apiUrl,`/api/tickets/${ticket.id}/status`,winner,{to:'in_progress',expected_version:first.ticket_version-1})).status,409);
  assert.equal((await patch(apiUrl,`/api/tickets/${ticket.id}/status`,winner,{to:'in_progress',expected_version:first.ticket_version})).status,200);
  for(const injection of [{assigned_to:users.a.sub},{assigned_team_id:identityTeam},{sla_breached:true},{ticket_version:100}]) {
    assert.equal((await patch(restUrl,`/tickets?id=eq.${ticket.id}`,'agent',injection)).status,403);
  }
});

test('W4 approval attaches the active team and rejection reason is enforced on API and REST',async()=>{
  const access=()=>create('a','Approval decision acceptance',{category_id:'10000000-0000-4000-8000-000000000005',
    fields:{system_name:'CRM',permission_level:'Reader',valid_until:'2026-12-31'}});
  const approved=await access();
  const result=await patch(apiUrl,`/api/tickets/${approved.id}/status`,'agent',{to:'assigned',expected_version:approved.ticket_version});
  assert.equal(result.status,200);
  assert.equal(result.body.assigned_team_id,identityTeam);
  const rejected=await access();
  assert.equal((await patch(apiUrl,`/api/tickets/${rejected.id}/status`,'manager',{to:'new'})).status,422);
  assert.equal((await patch(restUrl,`/tickets?id=eq.${rejected.id}`,'manager',{status:'new'})).body.code,'45004');
  assert.equal((await patch(restUrl,`/tickets?id=eq.${rejected.id}`,'a',{status:'new'},{'X-Status-Note':'Employee cannot approve'})).status,400);
  const reason='Insufficient access justification';
  assert.equal((await patch(restUrl,`/tickets?id=eq.${rejected.id}`,'manager',{status:'new'},{'X-Status-Note':reason})).status,200);
  const audits=(await call(apiUrl,`/api/tickets/${rejected.id}/events`)).body.data;
  assert.equal(audits.at(-1).payload.note,reason);
});

test('W4 outbox leases, stale workers, durable ACK requirement and failed-event replay',async()=>{
  // Isolate only the queue timing of this fixture; keep every earlier event and business row.
  await admin.query("UPDATE private.outbox SET available_at=now()+interval '1 day' WHERE status='pending'");
  const ticket=await create('a','Lease recovery acceptance');
  const batches=await Promise.all([1,2].map(()=>automation(async c=>(await c.query('SELECT * FROM private.claim_outbox(1,30)')).rows)));
  assert.equal(batches.flat().length,1);
  const lease=batches.flat()[0];
  assert.equal(lease.event_id,(await createdEvent(ticket.id)).event_id);
  assert.equal((await automation(async c=>(await c.query('SELECT private.complete_outbox($1,$2) AS ok',[lease.event_id,lease.lease_token])).rows[0].ok)),false,'Cannot deliver before durable inbox ACK');
  await admin.query("UPDATE private.outbox SET locked_until=now()-interval '1 second' WHERE event_id=$1",[lease.event_id]);
  const recovered=(await automation(async c=>(await c.query('SELECT * FROM private.claim_outbox(1,30)')).rows))[0];
  assert.equal(recovered.event_id,lease.event_id);
  assert.notEqual(recovered.lease_token,lease.lease_token);
  assert.equal(recovered.attempts,2);
  await processEvent(recovered.event_id);
  assert.equal(await automation(async c=>(await c.query('SELECT private.complete_outbox($1,$2) AS ok',[lease.event_id,lease.lease_token])).rows[0].ok),false);
  assert.equal(await automation(async c=>(await c.query('SELECT private.fail_outbox($1,$2,$3,1,true) AS ok',[recovered.event_id,recovered.lease_token,'fixture_terminal'])).rows[0].ok),true);
  const metrics=await call(apiUrl,'/api/system/outbox','service');
  assert.ok(metrics.body.failed>=1);
  assert.equal((await call(apiUrl,`/api/system/outbox/${recovered.event_id}/replay`,'a',{})).status,403);
  assert.equal((await call(apiUrl,`/api/system/outbox/${recovered.event_id}/replay`,'service',{})).body.replayed,true);
  assert.equal((await call(apiUrl,`/api/system/outbox/${recovered.event_id}/replay`,'service',{})).body.replayed,false);
  const replay=(await automation(async c=>(await c.query('SELECT * FROM private.claim_outbox(1,30)')).rows))[0];
  assert.equal(replay.event_id,recovered.event_id);
  assert.equal(await automation(async c=>(await c.query('SELECT private.complete_outbox($1,$2) AS ok',[replay.event_id,replay.lease_token])).rows[0].ok),true);
  assert.equal((await call(apiUrl,`/api/tickets/${ticket.id}`)).body.ticket_version,3,'Replaying a committed route cannot route twice');
  await admin.query("UPDATE private.outbox SET available_at=now()+interval '1 day' WHERE status='pending'");
  const crashing=await create('a','Eight expired worker leases reach quarantine');
  const crashingId=(await createdEvent(crashing.id)).event_id;
  for(let attempt=1;attempt<=8;attempt++) {
    const claimed=(await automation(async c=>(await c.query('SELECT * FROM private.claim_outbox(1,30)')).rows))[0];
    assert.equal(claimed.event_id,crashingId);
    assert.equal(claimed.attempts,attempt);
    await admin.query("UPDATE private.outbox SET locked_until=now()-interval '1 second' WHERE event_id=$1",[crashingId]);
  }
  assert.equal((await automation(async c=>(await c.query('SELECT * FROM private.claim_outbox(1,30)')).rows)).length,0);
  const quarantined=(await admin.query('SELECT status,attempts,last_error FROM private.outbox WHERE event_id=$1',[crashingId])).rows[0];
  assert.deepEqual(quarantined,{status:'failed',attempts:8,last_error:'lease_attempts_exhausted'});
  assert.equal((await call(apiUrl,`/api/tickets/${crashing.id}`)).body.status,'new','A lease failure cannot mutate the ticket');
  assert.equal((await call(apiUrl,`/api/system/outbox/${crashingId}/replay`,'service',{})).body.replayed,true);
  const restarted=(await automation(async c=>(await c.query('SELECT * FROM private.claim_outbox(1,30)')).rows))[0];
  assert.equal(restarted.event_id,crashingId);
  assert.equal(restarted.attempts,1,'An explicit operator replay opens a new bounded delivery cycle');
});

test('W4 SLA clock boundaries, pause exclusion, persisted breach and superseded notices',async()=>{
  const insert=async(created,status='in_progress',waiting=null)=>(await admin.query(`INSERT INTO public.tickets
    (requester_id,category_id,title,description,status,created_at,waiting_since)
    VALUES($1,$2,'SLA fixture snapshot','Clock-controlled fixture without historical lifecycle claims',$3,$4,$5) RETURNING *`,
    [users.a.sub,category,status,created,waiting])).rows[0];
  const evaluate=now=>automation(async c=>(await c.query('SELECT private.evaluate_sla($1::timestamptz) AS queued',[now])).rows[0].queued);
  const ticket=await insert('2020-01-01T00:00:00Z');
  assert.equal(await evaluate('2020-01-01T19:11:59.999Z'),0);
  assert.equal(await evaluate('2020-01-01T19:12:00Z'),1);
  assert.equal(await evaluate('2020-01-01T19:12:00Z'),0);
  const warning=(await admin.query("SELECT event_id FROM private.sla_notices WHERE ticket_id=$1 AND kind='sla_warning'",[ticket.id])).rows[0];
  assert.equal((await processEvent(warning.event_id)).body.result,'notification','Simulate durable ACK before chat delivery fails');
  await evaluate('2020-01-02T00:00:00Z');
  assert.equal((await call(apiUrl,`/api/tickets/${ticket.id}`)).body.sla_breached,false,'Exactly 100% is not strictly overdue');
  assert.equal(await evaluate('2020-01-02T00:00:00.001Z'),1);
  const breached=(await call(apiUrl,`/api/tickets/${ticket.id}`)).body;
  assert.equal(breached.sla_breached,true);
  assert.equal(breached.sla_breached_at,'2020-01-02T00:00:00.000Z');
  assert.equal(await evaluate('2020-01-02T00:00:00.002Z'),0);
  assert.equal((await processEvent(warning.event_id)).body.result,'skipped','Do not send an obsolete 80% reminder after breach');
  assert.equal((await processEvent(warning.event_id)).body.result,'skipped','The cached ACK must remain durably superseded');
  const paused=await insert('2020-01-03T00:00:00Z','waiting_user','2020-01-03T01:00:00Z');
  await evaluate('2020-01-05T00:00:00Z');
  assert.equal((await call(apiUrl,`/api/tickets/${paused.id}`)).body.sla_breached,false);
  assert.equal((await admin.query('SELECT count(*)::int n FROM private.sla_notices WHERE ticket_id=$1',[paused.id])).rows[0].n,0);
  const beforePause=await insert('2020-01-06T00:00:00Z','waiting_user','2020-01-07T01:00:00Z');
  await evaluate('2020-01-08T00:00:00Z');
  assert.equal((await call(apiUrl,`/api/tickets/${beforePause.id}`)).body.sla_breached,true,'Pausing after breach cannot erase it');
  const overdueNew=await insert('2020-01-10T00:00:00Z','new');
  await evaluate('2020-01-12T00:00:00Z');
  assert.equal((await call(apiUrl,`/api/tickets/${overdueNew.id}`)).body.ticket_version,1,'SLA bookkeeping cannot invalidate a created event');
  assert.equal((await processEvent((await createdEvent(overdueNew.id)).event_id)).body.result,'routed');
  const closedNotice=await insert('2020-01-15T00:00:00Z');
  await evaluate('2020-01-15T19:12:00Z');
  const closingWarning=(await admin.query("SELECT event_id FROM private.sla_notices WHERE ticket_id=$1 AND kind='sla_warning'",[closedNotice.id])).rows[0];
  assert.equal((await processEvent(closingWarning.event_id)).body.result,'notification');
  await patch(apiUrl,`/api/tickets/${closedNotice.id}/status`,'agent',{to:'resolved',resolution_note:'Resolve before delayed chat retry'});
  await patch(apiUrl,`/api/tickets/${closedNotice.id}/status`,'a',{to:'closed'});
  assert.equal((await processEvent(closingWarning.event_id)).body.result,'skipped');
  assert.equal((await patch(apiUrl,`/api/tickets/${ticket.id}/status`,'agent',{to:'resolved',resolution_note:'SLA fixture resolution'})).status,200);
  assert.equal((await patch(apiUrl,`/api/tickets/${ticket.id}/status`,'agent',{to:'in_progress'})).body.sla_breached,true);
  assert.equal((await patch(apiUrl,`/api/tickets/${ticket.id}/status`,'agent',{to:'resolved',resolution_note:'SLA fixture second resolution'})).status,200);
  assert.equal((await patch(apiUrl,`/api/tickets/${ticket.id}/status`,'a',{to:'closed'})).status,200);
  const count=(await admin.query('SELECT count(*)::int n FROM private.sla_notices WHERE ticket_id=$1',[ticket.id])).rows[0].n;
  await evaluate('2030-01-01T00:00:00Z');
  assert.equal((await admin.query('SELECT count(*)::int n FROM private.sla_notices WHERE ticket_id=$1',[ticket.id])).rows[0].n,count);
});

test('W5-08 category suggestions, single self-service record and owner-only reads on API and REST', async () => {
  const vpnArticle = '20000000-0000-4000-8000-000000000001';
  const suggestions = await call(apiUrl, `/api/categories/${category}/articles`);
  assert.equal(suggestions.status, 200);
  assert.deepEqual(suggestions.body.data.map(article => article.slug), ['vpn', 'wifi']);
  assert.equal(suggestions.body.data[0].url, 'http://wiki.test:18030/ho-tro/vpn');
  assert.equal((await call(apiUrl, '/api/categories/10000000-0000-4000-8000-0000000000ff/articles')).status, 404);
  assert.equal((await admin.query('SELECT count(*)::int n FROM public.knowledge_articles')).rows[0].n, 6);
  // Migration 016: bài tri thức theo bối cảnh doanh nghiệp, không còn bài LMS / "của trường".
  assert.equal(suggestions.body.data[0].title, 'Kết nối VPN từ xa vào mạng nội bộ');
  assert.deepEqual((await admin.query(
    `SELECT slug, wiki_path FROM public.knowledge_articles WHERE id='20000000-0000-4000-8000-000000000004'`)).rows,
  [{ slug: 'phan-mem-nghiep-vu', wiki_path: 'ho-tro/phan-mem-nghiep-vu' }]);
  assert.equal((await admin.query(
    `SELECT count(*)::int n FROM public.knowledge_articles WHERE title ~ 'trường|LMS' OR summary ~ 'trường|LMS'`)).rows[0].n, 0);

  const ticketsBefore = (await admin.query('SELECT count(*)::int n FROM public.tickets')).rows[0].n;
  const recorded = await call(apiUrl, '/api/self-service', 'a', { category_id: category, article_id: vpnArticle });
  assert.equal(recorded.status, 201, JSON.stringify(recorded.body));
  const rows = (await admin.query('SELECT user_id, category_id, article_id FROM public.self_service_resolutions WHERE id=$1', [recorded.body.id])).rows;
  assert.deepEqual(rows, [{ user_id: users.a.sub, category_id: category, article_id: vpnArticle }]);
  assert.equal((await admin.query('SELECT count(*)::int n FROM public.tickets')).rows[0].n, ticketsBefore, 'Self-service must not create a ticket');

  // Bài không thuộc gợi ý của danh mục, user_id giả và ghi tay qua REST đều bị chặn.
  const passwordArticle = '20000000-0000-4000-8000-000000000005';
  assert.equal((await call(apiUrl, '/api/self-service', 'a', { category_id: category, article_id: passwordArticle })).status, 422);
  assert.equal((await call(apiUrl, '/api/self-service', 'a', { category_id: category, article_id: vpnArticle, user_id: users.b.sub })).status, 400);
  assert.notEqual((await call(restUrl, '/self_service_resolutions', 'a', { category_id: category, article_id: vpnArticle, user_id: users.b.sub })).status, 201);
  assert.notEqual((await call(restUrl, '/self_service_resolutions', 'a', { category_id: category, article_id: passwordArticle })).status, 201);
  const viaRest = await call(restUrl, '/self_service_resolutions', 'b', { category_id: category, article_id: vpnArticle });
  assert.equal(viaRest.status, 201, JSON.stringify(viaRest.body));
  assert.equal(viaRest.body[0].user_id, users.b.sub);

  const ownA = await call(restUrl, '/self_service_resolutions?select=user_id', 'a');
  assert.ok(ownA.body.length >= 1 && ownA.body.every(row => row.user_id === users.a.sub));
  const managerView = await call(restUrl, '/self_service_resolutions?select=user_id', 'manager');
  assert.equal(managerView.body.length, 0, 'Raw records stay private even for staff');
  assert.notEqual((await patch(restUrl, `/self_service_resolutions?id=eq.${recorded.body.id}`, 'a', { article_id: passwordArticle })).status, 200);

  const weekly = (await admin.query(`SELECT sum(resolutions)::int n, max(distinct_users)::int u FROM reporting.self_service_weekly
    WHERE category_code='vpn' AND article_slug='vpn'`)).rows[0];
  assert.ok(weekly.n >= 2 && weekly.u >= 2);
  const reporting = await call(restUrl, '/self_service_weekly', 'manager');
  assert.notEqual(reporting.status, 200, 'Reporting schema is not exposed through PostgREST');
});

test('W5-05 imports deterministic VPN lifecycle, self-service and devices once, without live outbox work', async () => {
  const teams = (await admin.query('SELECT id, name FROM public.teams ORDER BY name')).rows
    .map(team => ({ ...team, members: [users.agent.sub] }));
  const dataset = generate('db-week5', '2026-11-02T00:00:00Z', {
    users: Object.values(users), teams, system: automationClaims.sub,
  }, 500, { scenario: 'vpn-4.2' });
  const settings = { apply: true, confirmDemo: true };
  const first = await applyDataset(dataset, adminUrl, settings);
  assert.equal(first.inserted, 500);
  assert.deepEqual(first.scenario_summary, dataset.manifest.scenario_summary);
  assert.equal((await applyDataset(dataset, adminUrl, settings)).inserted, 0);
  const ids = dataset.tickets.map(row => row.id);
  const events = await admin.query(`SELECT count(*)::int AS events,
    count(*) FILTER (WHERE e.event_type = 'created')::int AS created, count(o.event_id)::int AS outbox
    FROM public.ticket_events e LEFT JOIN private.outbox o ON o.event_id = e.id WHERE e.ticket_id = ANY($1::uuid[])`, [ids]);
  assert.deepEqual(events.rows[0], { events: dataset.events.length, created: 500, outbox: 0 });
  for (const [table, fixtures] of [['self_service_resolutions', dataset.self_service], ['device_requests', dataset.device_requests]]) {
    assert.equal((await admin.query(`SELECT count(*)::int AS n FROM public.${table} WHERE id = ANY($1::uuid[])`,
      [fixtures.map(row => row.id)])).rows[0].n, fixtures.length);
  }
  // A transaction-local spoof from an app role cannot skip audit/outbox.
  const regular = await db.asUser(claims('a'), async client => {
    await client.query("SELECT set_config('app.demo_history', 'on', true)");
    return (await client.query(`INSERT INTO public.tickets (category_id,title,description,request_fields)
      VALUES ($1,'Regular audited ticket','This ticket still creates live audit and outbox.', '{"client_version":"4.2","error_message":"Fixture"}')
      RETURNING id`, [category])).rows[0];
  });
  assert.equal((await admin.query(`SELECT count(*)::int AS n FROM public.ticket_events e
    JOIN private.outbox o ON o.event_id = e.id WHERE e.ticket_id = $1`, [regular.id])).rows[0].n, 1);
});

test('W5-06 issues a short-lived dashboard token only to Manager', async () => {
  const values = { METABASE_PROFILES: 'full', METABASE_DASHBOARD_ID: '42', METABASE_EMBED_SECRET: 'ba'.repeat(32),
    METABASE_PUBLIC_URL: 'https://reports.example.test' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    const path = '/api/analytics/embed';
    assert.equal((await call(apiUrl, path, null)).status, 401);
    assert.equal((await call(apiUrl, path, 'a')).status, 403);
    assert.equal((await call(apiUrl, path, 'agent')).status, 403);
    const manager = await fetch(apiUrl + path, { headers: { Authorization: `Bearer ${tokens.manager}` } });
    assert.equal(manager.status, 200);
    assert.equal(manager.headers.get('cache-control'), 'no-store');
    const url = new URL((await manager.json()).url);
    assert.equal(url.origin, values.METABASE_PUBLIC_URL);
    const token = url.pathname.split('/').at(-1);
    const { payload } = await jwtVerify(token, new TextEncoder().encode(values.METABASE_EMBED_SECRET), { algorithms: ['HS256'] });
    assert.deepEqual(payload.resource, { dashboard: 42 });
    assert.equal(payload.exp - payload.iat, 300);
    process.env.METABASE_PROFILES = 'demo-light';
    assert.equal((await call(apiUrl, path, 'manager')).status, 503);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('W5-10 automation_weekly matches a hand count per actor type and stays reporting-only', async () => {
  const client = await admin.connect();
  try {
    await client.query('BEGIN');
    // Lịch sử biết trước ở một tuần không dữ liệu nào khác chạm tới; rollback nên không để lại dấu vết.
    await client.query("SET LOCAL app.demo_history = 'on'");
    const ticket = (await client.query('SELECT id FROM public.tickets ORDER BY created_at, id LIMIT 1')).rows[0].id;
    const insert = (type, actor, at) => client.query(
      `INSERT INTO public.ticket_events(ticket_id, actor_id, event_type, payload, actor_type, actor_name, created_at)
       VALUES ($1, $2, $3, '{}'::jsonb, $4, 'W5-10 fixture', $5)`, [ticket, users.agent.sub, type, actor, at]);
    // Tuần 06/01/2020 theo giờ Việt Nam: thứ Hai 00:30 và Chủ nhật 23:59 vẫn thuộc tuần này.
    for (const [type, actor, at] of [
      ['status_changed', 'user', '2020-01-05T17:30:00Z'], ['status_changed', 'user', '2020-01-08T03:00:00Z'],
      ['status_changed', 'user', '2020-01-12T16:59:00Z'], ['status_changed', 'system', '2020-01-06T02:00:00Z'],
      ['status_changed', 'system', '2020-01-07T02:00:00Z'], ['status_changed', 'ai', '2020-01-09T02:00:00Z'],
      // Không phải bước xử lý: audit phân công, cảnh báo SLA, tạo phiếu.
      ['assignment_changed', 'user', '2020-01-08T03:00:00Z'], ['sla_warning', 'system', '2020-01-08T04:00:00Z'],
      ['created', 'user', '2020-01-06T01:00:00Z'],
      // 00:00 thứ Hai giờ Việt Nam thuộc tuần kế tiếp.
      ['status_changed', 'system', '2020-01-12T17:00:00Z'],
    ]) await insert(type, actor, at);
    const rows = (await client.query(`SELECT week_start::text, steps::int, human_steps::int, system_steps::int, ai_steps::int,
      manual_percent::float, system_percent::float, ai_percent::float
      FROM reporting.automation_weekly WHERE week_start < '2020-02-01' ORDER BY week_start`)).rows;
    assert.deepEqual(rows, [
      { week_start: '2020-01-06', steps: 6, human_steps: 3, system_steps: 2, ai_steps: 1,
        manual_percent: 50, system_percent: 33.3, ai_percent: 16.7 },
      { week_start: '2020-01-13', steps: 1, human_steps: 0, system_steps: 1, ai_steps: 0,
        manual_percent: 0, system_percent: 100, ai_percent: 0 },
    ]);
    const totals = (await client.query(`SELECT (SELECT sum(steps)::int FROM reporting.automation_weekly) AS view_steps,
      (SELECT count(*)::int FROM public.ticket_events WHERE event_type = 'status_changed') AS hand_steps`)).rows[0];
    assert.equal(totals.view_steps, totals.hand_steps);
    await client.query('SAVEPOINT unknown_actor');
    await assert.rejects(insert('status_changed', 'robot', '2020-01-09T02:00:00Z'), { code: '23514' });
    await client.query('ROLLBACK TO SAVEPOINT unknown_actor');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  const grants = (await admin.query(`SELECT has_table_privilege('reporting_reader', 'reporting.automation_weekly', 'SELECT') AS view,
    has_table_privilege('reporting_reader', 'public.ticket_events', 'SELECT') AS events,
    has_table_privilege('authenticated', 'reporting.automation_weekly', 'SELECT') AS users`)).rows[0];
  assert.deepEqual(grants, { view: true, events: false, users: false });
  assert.notEqual((await call(restUrl, '/automation_weekly', 'manager')).status, 200, 'Reporting schema is not exposed through PostgREST');
});

test('W5-02 device approval: direct manager approves, IT prepares and hands over, RLS hides other units', async () => {
  const rpc = (key, id, to, note, customToken) => call(restUrl, '/rpc/transition_device_request', key,
    { p_id: id, p_to: to, ...(note === undefined ? {} : { p_note: note }) }, customToken);
  const visible = async (key, id, customToken) => (await call(restUrl, `/device_requests?id=eq.${id}`, key, undefined, customToken)).body.length;
  await admin.query("UPDATE private.outbox SET available_at=now()+interval '1 day' WHERE status='pending'");
  const body = { device_type: 'monitor', reason: 'Màn hình thứ hai cho công việc kế toán', quantity: 2 };
  const made = await call(restUrl, '/device_requests', 'a', body);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const id = made.body[0].id;
  assert.equal(made.body[0].department, 'phong-hanh-chinh', 'Đơn vị lấy từ JWT');
  // Không tự khai đơn vị, không tự duyệt và không sửa trạng thái trực tiếp.
  assert.notEqual((await call(restUrl, '/device_requests', 'a', { ...body, department: 'phong-ke-toan' })).status, 201);
  assert.notEqual((await patch(restUrl, `/device_requests?id=eq.${id}`, 'a', { status: 'approved' })).status, 200);
  assert.equal((await rpc('a', id, 'approved')).body.code, '45012');
  const noUnit = await token('a', { sub: '20000000-0000-4000-8000-000000000009', department: undefined });
  const unstamped = await call(restUrl, '/device_requests', 'a', body, noUnit);
  assert.equal(unstamped.body.code, '45014');
  assert.equal((await call(apiUrl, '/api/device-requests', 'a', body, noUnit)).status, 422);

  // Nhân viên khác, IT (chưa duyệt) và Manager đơn vị khác đều không thấy đề nghị đang chờ.
  const otherManager = await token('manager', { sub: '20000000-0000-4000-8000-000000000007', department: 'phong-ke-toan' });
  assert.equal(await visible('b', id), 0);
  assert.equal(await visible('agent', id), 0);
  assert.equal(await visible('manager', id, otherManager), 0);
  assert.equal(await visible('manager', id), 1);
  for (const [key, custom] of [['b'], ['agent'], ['manager', otherManager]]) {
    const denied = await rpc(key, id, 'approved', undefined, custom);
    assert.equal(denied.status, 404, JSON.stringify(denied.body));
  }
  assert.equal((await call(restUrl, `/device_request_events?request_id=eq.${id}`, 'b')).body.length, 0);

  // Từ chối cần lý do; sai thứ tự bị chặn; Manager đúng đơn vị duyệt được.
  const second = (await call(restUrl, '/device_requests', 'a', { ...body, device_type: 'mouse' })).body[0].id;
  assert.equal((await rpc('manager', second, 'rejected', 'ok')).body.code, '45013');
  const rejected = await rpc('manager', second, 'rejected', 'Đã có chuột dự phòng trong kho đơn vị');
  assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
  assert.equal(rejected.body.status, 'rejected');
  assert.equal(rejected.body.decision_note, 'Đã có chuột dự phòng trong kho đơn vị');
  assert.equal((await rpc('manager', second, 'approved')).body.code, '45011');
  assert.equal((await rpc('manager', id, 'handed_over')).body.code, '45011');
  const approved = await rpc('manager', id, 'approved');
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.decided_by, users.manager.sub);

  // Sau khi duyệt IT mới thấy; Manager không làm thay bước của IT, IT không nhảy cóc.
  assert.equal(await visible('agent', id), 1);
  assert.equal(await visible('agent', second), 0);
  assert.equal((await rpc('manager', id, 'preparing')).body.code, '45012');
  assert.equal((await rpc('agent', id, 'handed_over')).body.code, '45011');
  assert.equal((await rpc('agent', id, 'preparing')).body.prepared_by, users.agent.sub);
  const handed = await rpc('agent', id, 'handed_over');
  assert.equal(handed.body.status, 'handed_over');
  assert.equal(handed.body.handed_over_by, users.agent.sub);
  assert.equal((await rpc('agent', id, 'preparing')).body.code, '45011');

  const history = (await call(restUrl, `/device_request_events?request_id=eq.${id}&order=created_at,id`, 'a')).body;
  assert.deepEqual(history.map(row => [row.from_status, row.to_status, row.actor_id, row.actor_type]), [
    [null, 'pending', users.a.sub, 'user'], ['pending', 'approved', users.manager.sub, 'user'],
    ['approved', 'preparing', users.agent.sub, 'user'], ['preparing', 'handed_over', users.agent.sub, 'user']]);
  assert.notEqual((await call(restUrl, '/device_request_events', 'a', { request_id: id, actor_id: users.a.sub, to_status: 'approved' })).status, 201);
  assert.equal((await call(apiUrl, '/api/device-requests', 'a')).body.data.find(row => row.id === id).status, 'handed_over');

  // Outbox: tạo, duyệt, bàn giao (không có bước chuẩn bị); phong bì chỉ có ID, trạng thái và mã đơn vị.
  const queued = (await admin.query(`SELECT o.event_id, o.destination, o.envelope FROM private.outbox o
    WHERE o.envelope->>'request_id'=$1 ORDER BY o.created_at`, [id])).rows;
  assert.deepEqual(queued.map(row => row.envelope.event_type).sort(),
    ['device_request.approved', 'device_request.created', 'device_request.handed_over']);
  assert.ok(queued.every(row => row.destination === 'device_request' && !JSON.stringify(row.envelope).includes(body.reason)));
  assert.equal(queued.find(row => row.envelope.event_type === 'device_request.approved').envelope.payload.status, 'approved');
  const expected = { 'device_request.created': 'manager', 'device_request.approved': 'it', 'device_request.handed_over': 'requester' };
  const channelKeys = { created: 'device-manager:phong-hanh-chinh', approved: 'device-it', handed_over: `device-requester:${users.a.sub}` };
  const support = (await admin.query("SELECT id FROM public.teams WHERE code='support'")).rows[0].id;
  for (const row of queued) {
    const path = `/api/system/device-events/${row.event_id}/process`;
    assert.equal((await call(apiUrl, path, 'manager', { schema_version: 1 })).status, 403);
    const ack = await call(apiUrl, path, 'service', { schema_version: 1 });
    assert.equal(ack.status, 200, JSON.stringify(ack.body));
    const kind = row.envelope.event_type.split('.')[1];
    assert.deepEqual(ack.body, { event_id: row.event_id, result: 'notification', request_id: id,
      notification: { kind, audience: expected[row.envelope.event_type], team_id: kind === 'approved' ? support : null } });
    assert.deepEqual((await call(apiUrl, path, 'service', { schema_version: 1 })).body, ack.body, 'Gọi lặp trả cùng ACK');
    const lease = '20000000-0000-4000-8000-000000000031';
    const lookup = () => automation(async client =>
      (await client.query('SELECT private.device_notice_channel($1,$2) AS key', [row.event_id, lease])).rows[0].key);
    assert.equal(await lookup(), null);
    await admin.query("UPDATE private.outbox SET status='processing', lease_token=$2, locked_until=now()+interval '1 minute' WHERE event_id=$1", [row.event_id, lease]);
    assert.equal(await lookup(), channelKeys[kind]);
    await admin.query("UPDATE private.outbox SET status='pending', lease_token=NULL, locked_until=NULL WHERE event_id=$1", [row.event_id]);
  }
  // Sự kiện phiếu không đi nhầm sang cổng thiết bị.
  const ticketEvent = (await admin.query("SELECT event_id FROM private.outbox WHERE destination<>'device_request' LIMIT 1")).rows[0].event_id;
  assert.equal((await call(apiUrl, `/api/system/device-events/${ticketEvent}/process`, 'service', { schema_version: 1 })).status, 404);
  const rejectedEvents = (await admin.query("SELECT envelope->>'event_type' AS type FROM private.outbox WHERE envelope->>'request_id'=$1", [second])).rows;
  assert.deepEqual(rejectedEvents.map(row => row.type).sort(), ['device_request.created', 'device_request.rejected']);
  await admin.query("UPDATE private.outbox SET status='delivered', delivered_at=now() WHERE destination='device_request' AND status='pending'");
});

test('W5-03 handover PDF is generated once on hand-over, stored in SeaweedFS and downloadable only by parties via signed URL', async () => {
  const rpc = (key, id, to) => call(restUrl, '/rpc/transition_device_request', key, { p_id: id, p_to: to });
  const link = (key, id, customToken) => call(apiUrl, `/api/device-requests/${id}/handover-url`, key, {}, customToken);
  await admin.query("UPDATE private.outbox SET available_at=now()+interval '1 day' WHERE status='pending'");
  const body = { device_type: 'keyboard', reason: 'Bàn phím liệt phím, cần thay mới', quantity: 1 };
  const id = (await call(restUrl, '/device_requests', 'a', body)).body[0].id;
  const key = `device-handover/${id}.pdf`;

  // Chưa bàn giao thì chưa có biên bản, kể cả với người đề nghị; trình duyệt không tự đặt được khóa tệp.
  assert.equal((await link('a', id)).status, 409);
  assert.equal((await rpc('manager', id, 'approved')).status, 200);
  assert.equal((await rpc('agent', id, 'preparing')).status, 200);
  assert.equal((await link('agent', id)).status, 409);
  assert.notEqual((await call(restUrl, '/rpc/set_device_handover', 'a', { p_id: id, p_key: key, p_size: 10 })).status, 200);
  assert.notEqual((await patch(restUrl, `/device_requests?id=eq.${id}`, 'a', { handover_key: key })).status, 200);
  assert.equal((await rpc('agent', id, 'handed_over')).body.handover_key, null);
  assert.equal(seaweedPuts.filter(item => item.url === '/' + key).length, 0);

  // Sự kiện bàn giao qua n8n -> API sinh PDF, lưu kho tệp, ghi khóa. Gọi lặp không sinh lại.
  const event = (await admin.query(`SELECT event_id FROM private.outbox
    WHERE envelope->>'request_id'=$1 AND envelope->>'event_type'='device_request.handed_over'`, [id])).rows[0].event_id;
  const path = `/api/system/device-events/${event}/process`;
  const ack = await call(apiUrl, path, 'service', { schema_version: 1 });
  assert.equal(ack.status, 200, JSON.stringify(ack.body));
  assert.equal(ack.body.notification.kind, 'handed_over');
  assert.equal((await call(apiUrl, path, 'service', { schema_version: 1 })).status, 200);
  const stored = seaweedPuts.filter(item => item.url === '/' + key);
  assert.equal(stored.length, 1, 'Exactly one PDF object');
  assert.equal(stored[0].body.subarray(0, 5).toString(), '%PDF-');
  const row = (await admin.query('SELECT handover_key, handover_size_bytes::int AS size, handover_generated_at FROM public.device_requests WHERE id=$1', [id])).rows[0];
  assert.equal(row.handover_key, key);
  assert.equal(row.size, stored[0].body.length);
  assert.ok(row.handover_generated_at);
  // Tên trên biên bản lấy từ lịch sử do PostgreSQL ghi.
  const data = (await db.asAutomation(automationClaims, async client =>
    (await client.query('SELECT private.device_handover_data($1) AS data', [id])).rows[0].data));
  assert.deepEqual([data.requester_name, data.approver_name, data.handed_over_by_name], ['test.a', 'test.manager', 'test.agent']);
  assert.equal('reason' in data, false);

  // Người đề nghị, Manager của đơn vị và IT lấy được liên kết; người ngoài và Manager đơn vị khác thì không.
  const otherManager = await token('manager', { sub: '20000000-0000-4000-8000-000000000007', department: 'phong-ke-toan' });
  assert.equal((await link('b', id)).status, 404);
  assert.equal((await link('manager', id, otherManager)).status, 404);
  assert.equal((await call(apiUrl, `/api/device-requests/${id}/handover-url`, null, {})).status, 401);
  for (const who of ['a', 'manager', 'agent']) {
    const issued = await link(who, id);
    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    const response = await fetch(apiUrl + issued.body.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.match(response.headers.get('content-disposition'), /^attachment; filename="bien-ban-ban-giao-DX-TB-[0-9A-F]{8}\.pdf"$/);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), stored[0].body);
  }
  assert.equal(seaweedPuts.filter(item => item.url === '/' + key).length, 1, 'Issuing links never regenerates');
  const issued = (await link('a', id)).body;
  const url = new URL(issued.url, apiUrl);
  assert.ok(new Date(issued.expires_at).getTime() - Date.now() <= 120_000);
  url.searchParams.set('signature', 'a'.repeat(64));
  assert.equal((await fetch(url)).status, 403);
  // Chữ ký của đề nghị này không mở được biên bản của đề nghị khác.
  const elsewhere = new URL(issued.url.replace(id, '20000000-0000-4000-8000-00000000ffff'), apiUrl);
  assert.equal((await fetch(elsewhere)).status, 403);

  // Tự động hóa tắt (sự kiện chưa được xử lý): lần tải đầu tiên của người có quyền tự tạo biên bản.
  const lazy = (await call(restUrl, '/device_requests', 'a', { ...body, device_type: 'mouse' })).body[0].id;
  for (const [who, to] of [['manager', 'approved'], ['agent', 'preparing'], ['agent', 'handed_over']]) await rpc(who, lazy, to);
  assert.equal((await link('b', lazy)).status, 404);
  assert.equal(seaweedPuts.filter(item => item.url === `/device-handover/${lazy}.pdf`).length, 0, 'Outsiders cannot trigger generation');
  const first = await link('a', lazy);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal((await fetch(apiUrl + first.body.url)).status, 200);
  assert.equal((await link('agent', lazy)).status, 200);
  assert.equal(seaweedPuts.filter(item => item.url === `/device-handover/${lazy}.pdf`).length, 1);

  // Kho tệp hỏng: báo 503, không ghi khóa, lần sau thử lại được.
  const broken = (await call(restUrl, '/device_requests', 'a', { ...body, device_type: 'other' })).body[0].id;
  for (const [who, to] of [['manager', 'approved'], ['agent', 'preparing'], ['agent', 'handed_over']]) await rpc(who, broken, to);
  const endpoint = process.env.SEAWEEDFS_ENDPOINT;
  process.env.SEAWEEDFS_ENDPOINT = 'http://127.0.0.1:1';
  try { assert.equal((await link('a', broken)).status, 503); } finally { process.env.SEAWEEDFS_ENDPOINT = endpoint; }
  assert.equal((await admin.query('SELECT handover_key FROM public.device_requests WHERE id=$1', [broken])).rows[0].handover_key, null);
  assert.equal((await link('a', broken)).status, 200);
  await admin.query("UPDATE private.outbox SET status='delivered', delivered_at=now() WHERE destination='device_request' AND status='pending'");
});
