// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W5-02: nghiệm thu luồng duyệt đề nghị thiết bị trên stack thật (AUTOMATION_ENABLED=true):
// Keycloak cấp claim đơn vị, PostgREST/RLS qua APISIX bằng token người dùng, outbox -> n8n -> Mattermost.
// Không tắt/khởi động lại dịch vụ nào; chỉ tạo dữ liệu nghiệm thu có nhãn giả lập.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = { ...parseEnv(await readFile(resolve(root, '.env'), 'utf8')), ...process.env };
const base = 'http://localhost:' + env.APISIX_PORT;
const issuer = env.KEYCLOAK_PUBLIC_URL + '/realms/' + env.KEYCLOAK_REALM;
const report = { sha: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim(),
  scope: 'Real Keycloak/APISIX/PostgREST/API/n8n/Mattermost', checks: [], passed: false };
async function check(name, operation) {
  try { await operation(); report.checks.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { report.checks.push({ name, passed: false, error: error.message }); throw error; }
}
async function token(username) {
  const response = await fetch(issuer + '/protocol/openid-connect/token', { method: 'POST', body: new URLSearchParams(username ? {
    grant_type: 'password', client_id: 'dxdesk-web', username, password: env.DEMO_USER_PASSWORD ?? 'DxDesk@2026' } : {
    grant_type: 'client_credentials', client_id: env.AUTOMATION_CLIENT_ID, client_secret: env.AUTOMATION_CLIENT_SECRET }),
  signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, 'Keycloak token acquisition');
  return (await response.json()).access_token;
}
async function call(path, identity, body) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + identity, ...(body === undefined ? {} : { 'Content-Type': 'application/json', Prefer: 'return=representation' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
async function until(operation, description, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const value = await operation(); if (value) return value; await new Promise(done => setTimeout(done, 500)); }
  throw new Error('Timeout ' + description);
}
const claimsOf = value => JSON.parse(Buffer.from(value.split('.')[1], 'base64url'));
const transition = (identity, id, to, note) => call('/rest/rpc/transition_device_request', identity, { p_id: id, p_to: to, ...(note && { p_note: note }) });
const visible = async (identity, id) => (await call('/rest/device_requests?id=eq.' + id, identity)).data.length;
const channels = JSON.parse(env.MATTERMOST_TEAM_CHANNELS || '{}');
async function posted(channel, id, phrase, forbidden) {
  assert.ok(channel, 'Mattermost channel is configured');
  await until(async () => {
    const response = await fetch('http://localhost:' + env.MATTERMOST_PORT + '/api/v4/channels/' + channel + '/posts?per_page=200', {
      headers: { Authorization: 'Bearer ' + env.MATTERMOST_BOT_TOKEN }, signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200);
    const posts = Object.values((await response.json()).posts).filter(post => post.message.includes(id));
    assert.ok(posts.every(post => !post.message.includes(forbidden)), 'Chat message must carry identifiers only');
    return posts.some(post => post.message.includes(phrase));
  }, 'Mattermost notice: ' + phrase);
}

const body = { device_type: 'monitor', reason: '[SYNTHETIC W5 acceptance] Màn hình thứ hai ' + Date.now(), quantity: 1 };
try {
  assert.equal(env.AUTOMATION_ENABLED, 'true', 'Run with AUTOMATION_ENABLED=true (profile demo-light or full)');
  const [employee, other, agent, manager, service] = await Promise.all(['employee.a', 'employee.b', 'agent.1', 'manager.1', null].map(token));
  await check('Keycloak puts the admin-managed department into user access tokens', async () => {
    assert.equal(claimsOf(employee).department, claimsOf(manager).department);
    assert.notEqual(claimsOf(other).department, claimsOf(manager).department);
    assert.match(claimsOf(employee).department, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  const teams = (await call('/api/system/teams', service)).data.data;
  const support = teams.find(team => team.name === 'IT Support');
  assert.ok(support);
  const failedBefore = Number((await call('/api/system/outbox', service)).data.failed);
  await check('Gateway serves app 2 under /thiet-bi/ on the same origin, without its own port', async () => {
    const page = await fetch(base + '/thiet-bi/', { signal: AbortSignal.timeout(15000) });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Xin cấp thiết bị/);
    const bare = await fetch(base + '/thiet-bi', { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    assert.equal(bare.status, 302);
    assert.equal(new URL(bare.headers.get('location'), base).pathname, '/thiet-bi/');
    const deep = await fetch(base + '/thiet-bi/bat-ky', { signal: AbortSignal.timeout(15000) });
    assert.equal(deep.status, 200, 'SPA fallback');
  });
  let id;
  await check('Employee creates a request through PostgREST; unit comes from the token', async () => {
    const created = await call('/rest/device_requests', employee, body);
    assert.equal(created.status, 201, JSON.stringify(created.data));
    id = created.data[0].id; report.request_id = id;
    assert.equal(created.data[0].department, claimsOf(employee).department);
    assert.equal(created.data[0].status, 'pending');
    assert.notEqual((await call('/rest/device_requests', employee, { ...body, department: claimsOf(other).department })).status, 201);
  });
  await check('RLS: only the requester and the direct manager see a pending request', async () => {
    assert.equal(await visible(other, id), 0);
    assert.equal(await visible(agent, id), 0);
    assert.equal(await visible(manager, id), 1);
    assert.equal((await transition(other, id, 'approved')).status, 404);
    assert.equal((await transition(employee, id, 'approved')).data.code, '45012');
    assert.equal((await transition(agent, id, 'preparing')).status, 404);
  });
  await check('New request notifies managers with identifiers only', () =>
    posted(channels.default, id, 'chờ quản lý trực tiếp duyệt', body.reason));
  await check('Direct manager approves; IT is notified in its team channel and now sees the request', async () => {
    const approved = await transition(manager, id, 'approved');
    assert.equal(approved.status, 200, JSON.stringify(approved.data));
    assert.equal(approved.data.status, 'approved');
    assert.equal(approved.data.decided_by, claimsOf(manager).sub);
    assert.equal(await visible(agent, id), 1);
    await posted(channels[support.id], id, 'IT chuẩn bị', body.reason);
  });
  await check('IT prepares and hands over in order; requester is notified', async () => {
    assert.equal((await transition(manager, id, 'preparing')).data.code, '45012');
    assert.equal((await transition(agent, id, 'handed_over')).data.code, '45011');
    assert.equal((await transition(agent, id, 'preparing')).data.status, 'preparing');
    const handed = await transition(agent, id, 'handed_over');
    assert.equal(handed.data.status, 'handed_over');
    assert.equal(handed.data.handed_over_by, claimsOf(agent).sub);
    await posted(channels.default, id, 'Thiết bị đã bàn giao', body.reason);
    const history = (await call('/rest/device_request_events?request_id=eq.' + id + '&order=created_at,id', employee)).data;
    assert.deepEqual(history.map(row => row.to_status), ['pending', 'approved', 'preparing', 'handed_over']);
    assert.ok(history.every(row => row.actor_type === 'user'));
  });
  await check('Hand-over produces a Vietnamese PDF in SeaweedFS, downloadable by parties through a signed URL', async () => {
    const issue = identity => fetch(base + '/api/device-requests/' + id + '/handover-url', { method: 'POST',
      headers: { Authorization: 'Bearer ' + identity, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(20000) });
    // n8n xử lý sự kiện bàn giao rồi API mới ghi khóa tệp.
    await until(async () => (await call('/rest/device_requests?id=eq.' + id + '&select=handover_key', employee)).data[0].handover_key, 'handover key');
    assert.equal((await issue(other)).status, 404);
    assert.equal((await fetch(base + '/api/device-requests/' + id + '/handover-url', { method: 'POST' })).status, 401);
    for (const identity of [employee, manager, agent]) {
      const issued = await issue(identity);
      assert.equal(issued.status, 200);
      const { url } = await issued.json();
      // Đường dẫn nội dung không cần JWT (chữ ký là quyền tải), đi qua APISIX.
      const file = await fetch(base + url, { signal: AbortSignal.timeout(20000) });
      assert.equal(file.status, 200);
      assert.equal(file.headers.get('content-type'), 'application/pdf');
      const bytes = Buffer.from(await file.arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      assert.match(bytes.toString('latin1'), /\+NotoSans-Regular/);
      report.handover_bytes = bytes.length;
      const tampered = await fetch(base + url.replace(/signature=[a-f0-9]{64}/, 'signature=' + 'a'.repeat(64)), { signal: AbortSignal.timeout(20000) });
      assert.equal(tampered.status, 403);
    }
    assert.equal((await fetch(base + '/api/device-handovers/' + id + '/content')).status, 403);
  });
  await check('Device deliveries drain without quarantined events', async () => {
    await until(async () => {
      const status = (await call('/api/system/outbox', service)).data;
      assert.equal(Number(status.failed), failedBefore, 'No new failed outbox deliveries');
      return Number(status.pending) === 0 && Number(status.processing) === 0;
    }, 'outbox drained');
  });
  report.passed = true;
} catch (error) { console.error(error.message); report.error = error.message; process.exitCode = 1; }
finally {
  await mkdir(resolve(root, '.local/reports'), { recursive: true });
  await writeFile(resolve(root, '.local/reports/week5-device.json'), JSON.stringify(report, null, 2) + '\n');
}
