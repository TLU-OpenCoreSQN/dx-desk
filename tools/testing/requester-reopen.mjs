// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Real PKCE/browser + API + n8n. Creates only explicitly synthetic demo records.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = { ...parseEnv(await readFile(resolve(root, '.env'), 'utf8')), ...process.env };
const base = 'http://localhost:' + env.APISIX_PORT;
const issuer = env.KEYCLOAK_PUBLIC_URL + '/realms/' + env.KEYCLOAK_REALM;
const reports = resolve(root, '.local/reports');
const screenshots = process.argv.includes('--screenshots');
const images = resolve(root, 'docs/images');
await mkdir(reports, { recursive: true });
if (screenshots) await mkdir(images, { recursive: true });
const report = { started_at: new Date().toISOString(), scope: 'Real browser + Keycloak + API + PostgreSQL + n8n', checks: [], passed: false };
let browser;
async function token(username) {
  const r = await fetch(issuer + '/protocol/openid-connect/token', { method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: 'dxdesk-web', username, password: env.DEMO_USER_PASSWORD ?? 'DxDesk@2026' }),
    signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, 200, 'Demo login'); return (await r.json()).access_token;
}
async function api(identity, path, body, method = body === undefined ? 'GET' : 'POST') {
  const r = await fetch(base + '/api' + path, { method,
    headers: { Authorization: 'Bearer ' + identity, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    ...(body !== undefined && { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
  const data = await r.json(); return { status: r.status, data };
}
async function login(username) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  await page.goto(base);
  await page.getByRole('button', { name: 'Đăng nhập hệ thống (SSO)', exact: true }).click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(env.DEMO_USER_PASSWORD ?? 'DxDesk@2026');
  await page.locator('#kc-login').click();
  await page.waitForURL(base + '/**');
  await page.getByRole('button', { name: /Đăng xuất/ }).waitFor();
  return page;
}
const pass = name => { report.checks.push({ name, passed: true }); console.log('PASS ' + name); };
async function picture(page, name) {
  if (!screenshots) return;
  await page.screenshot({ path: resolve(images, name + '.png'), fullPage: true,
    mask: [page.getByRole('complementary', { name: 'Lịch sử hội thoại' })] });
}
try {
  const [employee, other, agent] = await Promise.all(['employee.a', 'employee.b', 'agent.1'].map(token));
  const created = await api(employee, '/tickets', {
    category_id: '10000000-0000-4000-8000-000000000001',
    title: '[SYNTHETIC] VPN ngắt kết nối sau khi khắc phục',
    description: 'Phiếu giả lập dùng cho hướng dẫn và nghiệm thu. Máy Windows 11 thử nghiệm, VPN ngắt sau vài phút.',
    fields: { client_version: 'OpenVPN Connect 4.2', error_message: 'Connection timeout' },
  });
  assert.equal(created.status, 201); const id = created.data.id; report.ticket_id = id;
  let ticket;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    ticket = (await api(employee, '/tickets/' + id)).data;
    if (ticket.status === 'assigned') break;
    await new Promise(done => setTimeout(done, 500));
  }
  assert.equal(ticket.status, 'assigned', 'n8n routes the fixture');
  assert.equal((await api(agent, '/tickets/' + id + '/claim', {})).status, 200);
  for (const body of [{ to: 'in_progress' }, { to: 'resolved', resolution_note: 'Đã cài lại VPN và kiểm tra trên máy thử nghiệm.' }]) {
    const changed = await api(agent, '/tickets/' + id + '/status', body, 'PATCH');
    assert.equal(changed.status, 200, JSON.stringify(changed.data)); ticket = changed.data;
  }
  assert.ok(ticket.resolved_at); pass('Real Agent resolves an automatically routed ticket with a recorded resolution timestamp');
  assert.equal((await api(other, '/tickets/' + id + '/status', { to: 'in_progress', note: 'Not my ticket' }, 'PATCH')).status, 404);
  assert.equal((await api(employee, '/tickets/' + id + '/status', { to: 'in_progress' }, 'PATCH')).status, 422);
  pass('Another requester cannot reopen; a missing reason is rejected');
  browser = await chromium.launch(); const page = await login('employee.a');
  await page.goto(base + '/tickets/' + id);
  await page.getByRole('button', { name: 'Chưa khắc phục được', exact: true }).click();
  await page.locator('#transition-note').fill('VPN vẫn ngắt sau vài phút dù đã thử hướng dẫn.');
  await picture(page, 'guide-employee-reopen');
  const changed = page.waitForResponse(r => r.url().endsWith('/tickets/' + id + '/status') && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Gửi lại để xử lý', exact: true }).click();
  assert.equal((await changed).status(), 200);
  const reopened = (await api(employee, '/tickets/' + id)).data;
  assert.equal(reopened.status, 'in_progress');
  for (const key of ['assigned_to', 'assigned_team_id', 'sla_due_at', 'sla_paused_ms']) assert.equal(reopened[key], ticket[key], key);
  const events = (await api(employee, '/tickets/' + id + '/events')).data.data;
  assert.ok(events.some(e => e.payload.to === 'in_progress' && e.payload.note === 'VPN vẫn ngắt sau vài phút dù đã thử hướng dẫn.'));
  pass('Requester reopens through the UI; assignment, SLA and reason audit are retained');
  if (screenshots) {
    const staff = await login('agent.1'); await staff.goto(base + '/tickets/' + id);
    await staff.getByRole('heading', { name: created.data.title, exact: true, level: 1 }).waitFor();
    await picture(staff, 'guide-agent-ticket');
    const access = await api(employee, '/tickets', { category_id: '10000000-0000-4000-8000-000000000005',
      title: '[SYNTHETIC] Xin quyền đọc CRM thử nghiệm', description: 'Yêu cầu giả lập để minh họa phê duyệt theo vai trò.',
      fields: { system_name: 'Demo CRM', permission_level: 'Reader', valid_until: '2026-12-31' } });
    assert.equal(access.status, 201);
    const manager = await login('manager.1'); await manager.goto(base + '/tickets/' + access.data.id);
    await manager.getByRole('heading', { name: access.data.title, exact: true, level: 1 }).waitFor();
    await picture(manager, 'guide-manager-approval');
    await page.goto(base + '/tro-ly');
    await page.getByRole('button', { name: 'Cuộc trò chuyện mới', exact: true }).click();
    await page.getByLabel('Câu hỏi hỗ trợ IT', { exact: true }).waitFor();
    await picture(page, 'guide-assistant-voice');
    pass('Guide screenshots show only the synthetic fixtures; conversation history is masked');
  }
  report.passed = true;
} catch (error) { report.error = error.message; console.error(error.message); process.exitCode = 1; }
finally {
  await browser?.close(); report.finished_at = new Date().toISOString();
  await writeFile(resolve(reports, 'requester-reopen.json'), JSON.stringify(report, null, 2) + '\n');
}
