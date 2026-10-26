// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// UI acceptance with explicit HTTP/auth fixtures. This is NOT Keycloak/stack acceptance.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportDir = resolve(root, '.local/reports');
await mkdir(reportDir, { recursive: true });
const probe = createServer();
await new Promise(r => probe.listen(0, '127.0.0.1', r));
const port = probe.address().port;
await new Promise(r => probe.close(r));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve(root, 'apps/web/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: resolve(root, 'apps/web'), windowsHide: true, stdio: 'ignore',
});
const report = { started_at: new Date().toISOString(), mode: 'browser UI with explicit fixtures; no real SSO', checks: [], passed: false };
let browser;
async function check(name, operation) {
  try { await operation(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, error: error.message }); throw error; }
}
try {
  for (let n = 0; ; n++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* server starting */ }
    if (n > 50) throw new Error('Vite did not start');
    await new Promise(r => setTimeout(r, 200));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('http://localhost:8080/**', route => route.abort());
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { message: 'Offline fixture' } }));
  await check('Desktop offline: honest status, disabled login, no horizontal overflow', async () => {
    await page.goto(origin);
    await page.getByText('Dịch vụ đăng nhập hiện không thể kết nối.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Đăng nhập hệ thống (SSO)', exact: true }).isDisabled(), true);
    await page.getByText('Dịch vụ hỗ trợ hiện chưa kết nối').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(reportDir, 'web-desktop-offline.png'), fullPage: true });
  });
  await check('Mobile menu: open, Escape closes and restores focus', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const trigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
    await trigger.click();
    await page.getByRole('dialog', { name: 'Menu điều hướng' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(reportDir, 'web-mobile-offline.png'), fullPage: true });
    await trigger.click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.setViewportSize({ width: 390, height: 844 });
  });

  // Replace only the development module at the browser boundary; no fixture ships in the app.
  await page.route('**/src/services/keycloak.ts*', route => route.fulfill({ contentType: 'text/javascript', body: `
    let token = 'browser-fixture'; const listeners = new Set();
    export const initKeycloak = async () => true;
    export const isIdentityServerOffline = () => false;
    export const getAccessToken = () => token;
    export const ensureFreshToken = async () => !!token;
    export const onSessionLost = f => { listeners.add(f); return () => listeners.delete(f); };
    export const expireSession = () => { token = null; listeners.forEach(f => f()); };
    export const login = async () => {};
    export const logout = async () => expireSession();
    export const parseTokenRoles = () => ['Employee'];
    export const getParsedUsername = () => 'employee.fixture';
    export const getParsedSubject = () => '00000000-0000-4000-8000-000000000001';
  ` }));
  await page.unroute('**/api/**');
  // requirement_fields khớp với danh mục 'vpn' trong db/migrations/003_ticket_workflow.sql.
  const category = {
    id: '10000000-0000-4000-8000-000000000001', code: 'vpn', name: 'Mạng và VPN',
    requirement_fields: [
      { key: 'client_version', label: 'Phiên bản client VPN', required: true },
      { key: 'error_message', label: 'Dòng lỗi hiển thị', required: true },
      { key: 'device_os', label: 'Hệ điều hành', required: false },
    ],
  };
  const tickets = [], devices = [], writes = [];
  let rejectSession = false;
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    let json, status = 200;
    if (rejectSession && path !== '/api/health') { status = 401; json = { message: 'Expired fixture' }; }
    else if (path === '/api/health') json = { status: 'ok', service: 'dx-desk-api', version: '0.1.0' };
    else if (path === '/api/me') json = { id: '00000000-0000-4000-8000-000000000001', username: 'employee.fixture', roles: ['Employee'] };
    else if (path === '/api/categories') json = { data: [category] };
    else if (request.method() === 'POST') {
      const body = request.postDataJSON(); writes.push({ path, body }); status = 201;
      json = { ...body, id: `00000000-0000-4000-8000-00000000000${writes.length + 1}`, requester_id: '00000000-0000-4000-8000-000000000001', assigned_to: null,
        status: path === '/api/tickets' ? 'new' : 'pending', created_at: '2026-10-21T02:00:00Z', updated_at: '2026-10-21T02:00:00Z' };
      (path === '/api/tickets' ? tickets : devices).push(json);
    } else if (path.endsWith('/events')) json = { data: [{ id: 'event-fixture', ticket_id: tickets[0].id, event_type: 'created', actor_id: tickets[0].requester_id, payload: {}, created_at: tickets[0].created_at }] };
    else if (path.startsWith('/api/tickets/')) json = tickets.find(row => path.endsWith(row.id));
    else json = { data: path === '/api/tickets' ? tickets : devices, limit: 25, offset: 0 };
    await route.fulfill({ status, json: json ?? {} });
  });
  await check('Employee ticket form: Poka-yoke theo danh mục, no Critical, exact create payload', async () => {
    await page.goto(origin + '/tickets/new');
    await page.getByLabel(/Danh mục/).selectOption(category.id);
    const submit = page.getByRole('button', { name: /Gửi phiếu/ });
    await page.getByText('Thông tin bắt buộc theo danh mục').waitFor();
    assert.equal(await page.getByRole('button', { name: /Khẩn cấp/ }).isDisabled(), true);
    assert.equal(await submit.getAttribute('aria-disabled'), 'true', 'nút Gửi phải khóa khi còn thiếu trường');
    await page.getByText(/Chưa thể gửi phiếu/).waitFor();
    await page.getByLabel(/Tiêu đề/).fill('VPN');
    // aria-disabled vẫn cho click để lộ từng lỗi trường — Playwright phải bỏ qua bước kiểm tra enabled.
    await submit.click({ force: true });
    await page.getByText(/Tiêu đề.*quá ngắn/i).waitFor();
    assert.equal(writes.length, 0);
    await page.getByLabel(/Tiêu đề/).fill('Lỗi VPN tại phòng làm việc');
    await page.getByLabel(/Mô tả/).fill('VPN bị ngắt khi đăng nhập vào mạng nội bộ.');
    assert.equal(await submit.getAttribute('aria-disabled'), 'true', 'thiếu trường bắt buộc của danh mục');
    await page.getByLabel(/Phiên bản client VPN/).fill('OpenVPN 4.2');
    await page.getByLabel(/Dòng lỗi hiển thị/).fill('Kết nối bị ngắt sau 30 giây');
    assert.equal(await submit.getAttribute('aria-disabled'), 'false');
    await page.screenshot({ path: resolve(reportDir, 'web-mobile-ticket-form.png'), fullPage: true });
    await submit.click();
    await page.getByText(/Tạo phiếu.*thành công|gửi phiếu.*thành công/i).first().waitFor();
    assert.deepEqual(Object.keys(writes[0].body).sort(), ['category_id', 'description', 'fields', 'priority', 'title']);
    assert.deepEqual(writes[0].body.fields, {
      client_version: 'OpenVPN 4.2', error_message: 'Kết nối bị ngắt sau 30 giây',
    }, 'chỉ gửi trường đã điền, trường tùy chọn bỏ trống không gửi');
    assert.equal(writes[0].body.title, 'Lỗi VPN tại phòng làm việc');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(reportDir, 'web-mobile-ticket-created.png'), fullPage: true });
  });
  await check('Ticket detail and event history render from HTTP response', async () => {
    await page.getByRole('button', { name: /Xem chi tiết/ }).click();
    await page.getByRole('heading', { name: tickets[0].title }).waitFor();
    assert.equal(await page.getByText('Mới tạo', { exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(reportDir, 'web-mobile-ticket-detail.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: resolve(reportDir, 'web-desktop-ticket.png'), fullPage: true });
  });
  await check('Device form submits only allowed fields', async () => {
    await page.getByRole('link', { name: 'Yêu cầu cấp thiết bị', exact: true }).click();
    await page.getByRole('button', { name: 'Gửi yêu cầu mới' }).click();
    await page.getByLabel(/Loại thiết bị/).selectOption('monitor');
    await page.getByLabel(/Số lượng/).fill('2');
    await page.getByLabel(/Lý do đề xuất/).fill('Cần màn hình để đọc bản thiết kế và tài liệu.');
    await page.getByRole('button', { name: 'Gửi yêu cầu thiết bị' }).click();
    await page.getByText(/Đã gửi yêu cầu cấp thiết bị thành công/).waitFor();
    assert.deepEqual(Object.keys(writes[1].body).sort(), ['device_type', 'quantity', 'reason']);
    assert.equal(writes[1].body.quantity, 2);
  });
  await check('HTTP 401 clears visible protected data and identity', async () => {
    rejectSession = true;
    await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await page.getByText('Yêu cầu đăng nhập xác thực').waitFor();
    assert.equal(await page.getByText('employee.fixture', { exact: true }).count(), 0);
    assert.equal(await page.getByText(devices[0].reason, { exact: true }).count(), 0);
  });
  await check('No uncaught browser errors', async () => assert.deepEqual(pageErrors, []));
  report.passed = true;
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  await browser?.close(); server.kill();
  report.finished_at = new Date().toISOString();
  await writeFile(resolve(reportDir, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Evidence: .local/reports/browser.json and web-*.png');
}
