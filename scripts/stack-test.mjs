// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// End-to-end acceptance against real Keycloak + APISIX + API + PostgREST + n8n.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...parseEnv(await readFile(resolve(root, '.env'), 'utf8')), ...process.env };
const gateway = `http://localhost:${env.APISIX_PORT}`;
const issuer = `${env.KEYCLOAK_PUBLIC_URL}/realms/${env.KEYCLOAK_REALM}`;
const report = { started_at: new Date().toISOString(), gateway, checks: [], passed: false };
let previousTicketId;
if (process.argv.includes('--verify-preserved')) {
  const previous = JSON.parse(await readFile(resolve(root, '.local/reports/stack.json'), 'utf8'));
  assert.equal(previous.passed, true, 'Previous acceptance run must pass before checking preservation');
  assert.ok(previous.created_ticket_id, 'Previous report must contain a ticket ID');
  previousTicketId = previous.created_ticket_id;
}
async function check(name, operation) {
  try { await operation(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, error: error.message }); throw error; }
}
async function request(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(gateway + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.text();
  let json; try { json = JSON.parse(data); } catch { json = data; }
  return { status: response.status, data: json };
}
async function login(username) {
  const response = await fetch(issuer + '/protocol/openid-connect/token', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({
      grant_type: 'password', client_id: 'dxdesk-web', username,
      password: env.DEMO_USER_PASSWORD ?? 'DxDesk@2026',
    }),
  });
  assert.equal(response.status, 200, `Keycloak login failed for ${username}`);
  const payload = await response.json();
  assert.ok(payload.access_token);
  return payload.access_token;
}
let tokenA, tokenB, tokenAgent, tokenManager, created;
try {
  await check('Gateway health', async () => assert.equal((await request('/healthz')).data, 'ok'));
  await check('Web served through APISIX', async () => {
    const response = await request('/');
    assert.equal(response.status, 200);
    assert.match(response.data, /<html/i);
  });
  await check('API ready through APISIX', async () => {
    const response = await request('/api/health');
    assert.equal(response.status, 200); assert.equal(response.data.status, 'ok');
  });
  await check('Anonymous API denied', async () => assert.equal((await request('/api/me')).status, 401));
  await check('Keycloak users authenticate', async () => {
    [tokenA, tokenB, tokenAgent, tokenManager] = await Promise.all(
      ['employee.a', 'employee.b', 'agent.1', 'manager.1'].map(login));
  });
  await check('Token accepted by API and PostgREST', async () => {
    assert.equal((await request('/api/me', tokenA)).data.username, 'employee.a');
    assert.equal((await request('/rest/categories', tokenA)).status, 200);
  });
  if (previousTicketId) await check('Ticket from previous startup is preserved', async () => {
    const response = await request(`/api/tickets/${previousTicketId}`, tokenA);
    assert.equal(response.status, 200);
    assert.equal(response.data.id, previousTicketId);
    assert.equal((await request(`/api/tickets/${previousTicketId}/events`, tokenA)).data.data.length, 1);
  });
  const body = {
    category_id: '10000000-0000-4000-8000-000000000001',
    title: `[W2 smoke] VPN ${new Date().toISOString()}`,
    description: 'Bản ghi kiểm thử nghiệm thu tuần 2, có thể giữ làm dữ liệu minh chứng.',
    // W3-02: migration 003 khai báo client_version + error_message bắt buộc cho danh mục 'vpn'.
    // Mọi lời gọi POST /api/tickets phải gửi đủ, nếu không API trả 422 thay vì 201.
    fields: { client_version: 'OpenVPN Connect 4.2', error_message: 'Kết nối bị ngắt sau 30 giây' },
  };
  await check('API creates a ticket and PostgreSQL audit', async () => {
    const response = await request('/api/tickets', tokenA, body);
    assert.equal(response.status, 201, JSON.stringify(response.data));
    created = response.data;
    report.created_ticket_id = created.id;
    assert.equal((await request(`/api/tickets/${created.id}/events`, tokenA)).data.data.length, 1);
  });
  await check('W3-03 SLA due date stored on creation', async () => {
    assert.ok(created.sla_due_at, 'API phải trả sla_due_at');
    assert.ok(new Date(created.sla_due_at) > new Date(created.created_at),
      'sla_due_at = created_at + sla_policies.resolution_minutes');
    assert.equal(Number(created.sla_paused_ms), 0, 'ticket vừa tạo chưa tạm dừng đếm SLA');
  });
  await check('W3-02 Poka-yoke rejects ticket missing category fields', async () => {
    const { fields, ...withoutFields } = body;
    const response = await request('/api/tickets', tokenA, withoutFields);
    assert.equal(response.status, 422, JSON.stringify(response.data));
    assert.match(String(response.data.message), /Thiếu trường bắt buộc/, 'thông báo tiếng Việt chỉ rõ trường thiếu');
  });
  // Máy trạng thái tuần 3 dùng phiếu riêng để phiếu minh chứng của lần chạy trước
  // vẫn còn đúng 1 bản ghi ticket_events khi chạy --verify-preserved.
  await check('W3-01 state machine over APISIX with ticket_events', async () => {
    const workflow = await request('/api/tickets', tokenA,
      { ...body, title: `[W3 smoke] quy trình ${new Date().toISOString()}` });
    assert.equal(workflow.status, 201, JSON.stringify(workflow.data));
    const id = workflow.data.id;
    const patch = (payload, token) => request(`/api/tickets/${id}/status`, token, payload, 'PATCH');
    assert.equal((await patch({ to: 'resolved', resolution_note: 'Xử lý gọn trong một bước.' }, tokenA)).status, 422,
      'cạnh ngoài máy trạng thái (new -> resolved) phải bị chặn');
    for (const to of ['triaged', 'assigned', 'in_progress']) {
      const response = await patch({ to }, tokenAgent);
      assert.equal(response.status, 200, JSON.stringify(response.data));
      assert.equal(response.data.status, to);
    }
    assert.equal((await patch({ to: 'resolved' }, tokenAgent)).status, 422,
      'chuyển sang resolved mà thiếu resolution_note thì bị chặn');
    assert.equal((await patch({ to: 'resolved', resolution_note: 'Đã cài lại client VPN, kiểm tra kết nối 3 lần ổn định.' }, tokenAgent)).data.status, 'resolved');
    assert.equal((await patch({ to: 'closed' }, tokenAgent)).status, 403,
      'resolved -> closed dành riêng cho người tạo phiếu');
    assert.equal((await patch({ to: 'closed', note: 'Đã dùng lại được kết nối VPN.' }, tokenA)).data.status, 'closed');
    const events = await request(`/api/tickets/${id}/events`, tokenA);
    assert.equal(events.data.data.length, 6, '1 bản ghi tạo + 5 lần chuyển trạng thái hợp lệ, lời gọi bị chặn không ghi thêm');
  });
  await check('TN-02 same identity sees API-written row through PostgREST', async () => {
    const response = await request(`/rest/tickets?id=eq.${created.id}`, tokenA);
    assert.equal(response.status, 200); assert.equal(response.data[0].id, created.id);
  });
  await check('Other employee cannot read ticket on either path', async () => {
    assert.equal((await request(`/api/tickets/${created.id}`, tokenB)).status, 404);
    assert.deepEqual((await request(`/rest/tickets?id=eq.${created.id}`, tokenB)).data, []);
  });
  await check('Critical restricted to Manager', async () => {
    assert.equal((await request('/api/tickets', tokenA, { ...body, priority: 'critical' })).status, 403);
    assert.equal((await request('/api/tickets', tokenManager, { ...body, priority: 'critical' })).status, 201);
  });
  const webhook = async () => {
    const response = await request('/webhook/dxdesk-hello');
    assert.equal(response.status, 200); assert.equal(response.data.status, 'ok');
  };
  await check('n8n imported workflow responds', webhook);
  if (process.argv.includes('--restart-n8n')) {
    await check('n8n workflow survives restart', async () => {
      const result = spawnSync('docker', ['compose', '--env-file', resolve(root, '.env'),
        '-f', resolve(root, 'infra/compose/docker-compose.yml'), 'restart', 'n8n'],
      { stdio: 'inherit', windowsHide: true });
      assert.equal(result.status, 0);
      for (let i = 0; i < 60; i++) {
        try { await webhook(); return; } catch { await new Promise(r => setTimeout(r, 1000)); }
      }
      throw new Error('Webhook did not recover within 60 seconds.');
    });
  }
  report.passed = true;
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  report.finished_at = new Date().toISOString();
  await mkdir(resolve(root, '.local/reports'), { recursive: true });
  await writeFile(resolve(root, '.local/reports/stack.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Evidence: .local/reports/stack.json (contains no access tokens)');
}
