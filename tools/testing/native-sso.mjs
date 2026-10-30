// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Real Keycloak + PostgreSQL + NestJS + PostgREST + browser. No Docker/APISIX/n8n claim.
import EmbeddedPostgres from 'embedded-postgres';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const requireApi = createRequire(resolve(root, 'apps/api/package.json'));
const { Pool } = requireApi('pg');
const { createApp } = requireApi('./dist/app.js');
const keycloakHome = process.env.TEST_KEYCLOAK_HOME;
const restBinary = process.env.TEST_POSTGREST_BIN;
if (!keycloakHome || !restBinary) throw new Error('Set TEST_KEYCLOAK_HOME and TEST_POSTGREST_BIN to installed official native distributions.');
const java = process.env.TEST_JAVA_HOME ? resolve(process.env.TEST_JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
const reportDir = resolve(root, '.local/reports');
await mkdir(reportDir, { recursive: true });
const testDir = await mkdtemp(resolve(root, '.local/sso-test-'));
const report = { started_at: new Date().toISOString(), scope: 'Native Keycloak/PostgreSQL/API/PostgREST/browser; no APISIX or n8n', checks: [], passed: false };
const processes = [];
let pg, admin, app, browser, pgStarted = false;
async function save() { await writeFile(resolve(reportDir, 'native-sso.json'), JSON.stringify(report, null, 2) + '\n'); }
async function check(name, operation) {
  try { await operation(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, error: error.message }); throw error; }
  finally { await save(); }
}
async function freePort(fixed) {
  const server = createServer();
  await new Promise((r, reject) => server.listen(fixed ?? 0, '127.0.0.1', r).on('error', reject));
  const port = server.address().port;
  await new Promise(r => server.close(r)); return port;
}
function launch(command, args, options = {}) {
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  child.logs = '';
  child.stdout.on('data', chunk => { child.logs += chunk; });
  child.stderr.on('data', chunk => { child.logs += chunk; });
  child.on('error', error => { child.launchError = error; });
  processes.push(child); return child;
}
async function waitReady(url, child, seconds = 180) {
  for (let n = 0; n < seconds; n++) {
    if (child?.launchError) throw child.launchError;
    if (child && child.exitCode !== null) throw new Error(`Process exited ${child.exitCode}: ${child.logs.slice(-2500)}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return; } catch { /* starting */ }
    if (n > 0 && n % 30 === 0) console.log(`Waiting for native service (${n}s)…`);
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Native service readiness timeout: ${child?.logs.slice(-2500) ?? url}`);
}
async function call(base, path, token, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, body: await response.json() };
}
try {
  const pgPort = await freePort(), kcPort = await freePort(), managementPort = await freePort();
  await freePort(5173); // Use the redirect URI already registered in the repository realm.
  pg = new EmbeddedPostgres({ databaseDir: resolve(testDir, 'pg'), user: 'postgres', password: 'sso_test_only',
    port: pgPort, persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {} });
  await pg.initialise(); await pg.start(); pgStarted = true;
  await pg.createDatabase('dxdesk_test_sso');
  admin = new Pool({ connectionString: `postgres://postgres:sso_test_only@127.0.0.1:${pgPort}/dxdesk_test_sso` });
  await admin.query(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE api_login LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'api_test';
    CREATE ROLE authenticator LOGIN NOINHERIT NOBYPASSRLS PASSWORD 'rest_test';
    GRANT authenticated TO api_login; GRANT anon, authenticated TO authenticator;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE ROLE keycloak_test LOGIN PASSWORD 'keycloak_test_only';`);
  await admin.query('CREATE DATABASE keycloak_test OWNER keycloak_test');
  for (const folder of ['migrations', 'policies']) {
    const directory = resolve(root, 'db', folder);
    for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) {
      await admin.query(await readFile(resolve(directory, file), 'utf8'));
    }
  }
  await mkdir(resolve(keycloakHome, 'data/import'), { recursive: true });
  await copyFile(resolve(root, 'infra/keycloak/realm-dxdesk.json'), resolve(keycloakHome, 'data/import/realm-dxdesk.json'));
  const kcUrl = `http://localhost:${kcPort}`, issuer = kcUrl + '/realms/dxdesk';
  const keycloakArgs = ['-Xms128m', '-Xmx768m', '-Dfile.encoding=UTF-8',
    '-Duser.language=en', '-Duser.country=US',
    '--add-opens=java.base/java.util=ALL-UNNAMED', '--add-opens=java.base/java.util.concurrent=ALL-UNNAMED',
    '--add-opens=java.base/java.security=ALL-UNNAMED', '--add-opens=java.base/java.lang=ALL-UNNAMED',
    '--enable-native-access=ALL-UNNAMED',
    '-Djava.util.concurrent.ForkJoinPool.common.threadFactory=io.quarkus.bootstrap.forkjoin.QuarkusForkJoinWorkerThreadFactory',
    `-Dkc.home.dir=${keycloakHome}`, `-Djboss.server.config.dir=${resolve(keycloakHome, 'conf')}`,
    `-Dkeycloak.theme.dir=${resolve(keycloakHome, 'themes')}`,
    '-Djava.util.logging.manager=org.jboss.logmanager.LogManager', '-Dpicocli.disable.closures=true',
    '-cp', resolve(keycloakHome, 'lib/quarkus-run.jar'), 'io.quarkus.bootstrap.runner.QuarkusEntryPoint',
    'start-dev', '--import-realm', '--db=postgres', `--db-url=jdbc:postgresql://127.0.0.1:${pgPort}/keycloak_test`,
    '--db-username=keycloak_test', '--db-password=keycloak_test_only', '--http-host=127.0.0.1',
    `--http-port=${kcPort}`, `--http-management-port=${managementPort}`, `--hostname=${kcUrl}`,
  ];
  let keycloak = launch(java, keycloakArgs, { cwd: keycloakHome });
  await check('Keycloak starts and imports the repository realm', async () => {
    try { await waitReady(issuer + '/.well-known/openid-configuration', keycloak); }
    catch (error) {
      // Same exit-10 reaugmentation protocol as the vendor kc.bat/kc.sh scripts.
      if (keycloak.exitCode !== 10) throw error;
      keycloak = launch(java, ['-Dkc.config.built=true', ...keycloakArgs], { cwd: keycloakHome });
      await waitReady(issuer + '/.well-known/openid-configuration', keycloak);
    }
    report.keycloak = '26.8.1'; report.postgres = '17.10'; report.issuer = issuer;
  });
  Object.assign(process.env, { DATABASE_URL: `postgres://api_login:api_test@127.0.0.1:${pgPort}/dxdesk_test_sso`,
    OIDC_ISSUER: issuer, OIDC_AUDIENCE: 'dxdesk-api', OIDC_JWKS_URL: issuer + '/protocol/openid-connect/certs' });
  app = await createApp(); await app.listen(0, '127.0.0.1'); const apiUrl = await app.getUrl();
  const jwks = await (await fetch(process.env.OIDC_JWKS_URL)).json();
  const restPort = await freePort(), restUrl = `http://127.0.0.1:${restPort}`;
  const postgrest = launch(restBinary, [], { env: { ...process.env,
    ...(process.platform === 'win32' ? { PATH: resolve(root, 'tools/testing/node_modules/@embedded-postgres/windows-x64/native/bin') + ';' + process.env.PATH } : {}),
    PGRST_DB_URI: `postgres://authenticator:rest_test@127.0.0.1:${pgPort}/dxdesk_test_sso`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: JSON.stringify(jwks), PGRST_JWT_AUD: 'dxdesk-api', PGRST_DB_PRE_REQUEST: 'private.check_request',
    PGRST_APP_SETTINGS_JWT_ISSUER: issuer, PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(restPort),
  } });
  const vite = launch(process.execPath, [resolve(root, 'apps/web/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    cwd: resolve(root, 'apps/web'), env: { ...process.env, VITE_KEYCLOAK_URL: kcUrl, VITE_PROXY_TARGET: apiUrl },
  });
  await waitReady('http://localhost:5173', vite, 30);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let tokenA, authRequest, refreshed = false, ticket, device;
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/protocol/openid-connect/auth') && url.searchParams.get('prompt') !== 'none') authRequest = url;
    if (url.pathname.endsWith('/protocol/openid-connect/token') && request.postData()?.includes('grant_type=refresh_token')) refreshed = true;
    if (url.pathname === '/api/me' && request.headers().authorization) tokenA = request.headers().authorization.slice(7);
  });
  await check('Browser login uses real Authorization Code + PKCE S256', async () => {
    await page.goto('http://localhost:5173');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống (SSO)', exact: true }).click();
    await page.locator('#username').fill('employee.a');
    await page.locator('#password').fill('DxDesk@2026');
    await page.locator('#kc-login').click();
    await page.getByText('employee.a', { exact: true }).first().waitFor();
    assert.ok(tokenA);
    assert.equal(authRequest.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(authRequest.searchParams.get('response_type'), 'code');
    assert.ok(authRequest.searchParams.get('code_challenge'));
  });
  await check('Browser creates ticket and reads the database audit through real API', async () => {
    await page.getByRole('link', { name: 'Tạo phiếu hỗ trợ', exact: true }).click();
    await page.getByLabel(/Danh mục/).selectOption('10000000-0000-4000-8000-000000000001');
    await page.getByLabel(/Tiêu đề/).fill('Kiểm thử SSO thật: VPN mất kết nối');
    await page.getByLabel(/Mô tả/).fill('Yêu cầu được gửi từ Chromium qua Keycloak và NestJS vào PostgreSQL kiểm thử.');
    await page.getByLabel(/Phiên bản client VPN/).fill('OpenVPN 4.2');
    await page.getByLabel(/Dòng lỗi hiển thị/).fill('Kết nối bị ngắt sau 30 giây');
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/tickets' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Gửi phiếu hỗ trợ' }).click();
    const created = await response; assert.equal(created.status(), 201); ticket = await created.json();
    await page.getByRole('button', { name: 'Xem chi tiết phiếu' }).click();
    await page.getByText('Đã tiếp nhận phiếu', { exact: true }).waitFor();
    await page.screenshot({ path: resolve(reportDir, 'native-sso-ticket.png'), fullPage: true });
  });
  const tokens = { 'employee.a': tokenA };
  await check('All three business roles authenticate with real realm accounts', async () => {
    for (const username of ['employee.b', 'agent.1', 'manager.1']) {
      const response = await fetch(issuer + '/protocol/openid-connect/token', { method: 'POST',
        body: new URLSearchParams({ grant_type: 'password', client_id: 'dxdesk-web', username, password: 'DxDesk@2026' }) });
      assert.equal(response.status, 200, `Login failed: ${username}`);
      tokens[username] = (await response.json()).access_token;
      assert.equal((await call(apiUrl, '/api/me', tokens[username])).body.username, username);
    }
  });
  await check('Real Keycloak token gives the same RLS on API and PostgREST', async () => {
    for (let n = 0; ; n++) {
      try { if ((await call(restUrl, '/categories', tokenA)).status === 200) break; } catch { /* warming */ }
      if (n > 30) throw new Error('PostgREST did not become ready: ' + postgrest.logs.slice(-1000));
      await new Promise(r => setTimeout(r, 250));
    }
    assert.equal((await call(restUrl, `/tickets?id=eq.${ticket.id}`, tokenA)).body[0].id, ticket.id);
    assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}`, tokens['employee.b'])).status, 404);
    assert.deepEqual((await call(restUrl, `/tickets?id=eq.${ticket.id}`, tokens['employee.b'])).body, []);
    for (const username of ['agent.1', 'manager.1']) assert.equal((await call(apiUrl, `/api/tickets/${ticket.id}`, tokens[username])).status, 200);
  });
  await check('Critical is rejected for Employee/Agent and accepted for Manager', async () => {
    const body = { category_id: ticket.category_id, title: 'Kiểm thử Critical với token Keycloak',
      description: 'Thử quyền trên database kiểm thử riêng.', priority: 'critical',
      fields: { client_version: 'OpenVPN 4.2', error_message: 'Kết nối bị ngắt sau 30 giây' } };
    for (const username of ['employee.a', 'agent.1']) assert.equal((await call(apiUrl, '/api/tickets', tokens[username], body)).status, 403);
    assert.equal((await call(apiUrl, '/api/tickets', tokens['manager.1'], body)).status, 201);
  });
  await check('Browser submits a real device request with ownership RLS on API and PostgREST', async () => {
    await page.getByRole('link', { name: 'Yêu cầu cấp thiết bị', exact: true }).click();
    await page.getByRole('button', { name: 'Gửi yêu cầu mới' }).click();
    await page.getByLabel(/Loại thiết bị/).selectOption('monitor');
    await page.getByLabel(/Số lượng/).fill('2');
    const reason = 'Kiểm thử SSO thật: cần màn hình để đọc tài liệu công việc.';
    await page.getByLabel(/Lý do đề xuất/).fill(reason);
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/device-requests' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Gửi yêu cầu thiết bị' }).click();
    const created = await response;
    assert.equal(created.status(), 201); device = await created.json();
    const me = await call(apiUrl, '/api/me', tokenA);
    assert.equal(me.status, 200); assert.equal(device.requester_id, me.body.id);
    assert.equal(device.device_type, 'monitor'); assert.equal(device.quantity, 2);
    assert.equal(device.reason, reason); assert.equal(device.status, 'pending');
    await page.getByText(`Đã gửi yêu cầu cấp thiết bị thành công (Mã yêu cầu: ${device.id})`, { exact: true }).waitFor();
    await page.getByText(reason, { exact: true }).waitFor();
    for (const username of ['employee.a', 'agent.1', 'manager.1']) {
      const api = await call(apiUrl, '/api/device-requests', tokens[username]);
      const rest = await call(restUrl, `/device_requests?id=eq.${device.id}`, tokens[username]);
      assert.equal(api.status, 200); assert.equal(rest.status, 200);
      assert.ok(api.body.data.some(item => item.id === device.id));
      assert.equal(rest.body[0].id, device.id);
    }
    const apiB = await call(apiUrl, '/api/device-requests', tokens['employee.b']);
    const restB = await call(restUrl, `/device_requests?id=eq.${device.id}`, tokens['employee.b']);
    assert.equal(apiB.status, 200); assert.deepEqual(apiB.body.data, []);
    assert.equal(restB.status, 200); assert.deepEqual(restB.body, []);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(reportDir, 'native-sso-device-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await check('Browser refreshes a real token and does not persist tokens to web storage', async () => {
    const result = await page.evaluate(async () => {
      const module = await import('/src/services/keycloak.ts');
      const ok = await module.ensureFreshToken(-1);
      const token = module.getAccessToken();
      const values = [...Object.values(localStorage), ...Object.values(sessionStorage)];
      return { ok, persisted: values.some(value => token && value.includes(token)) };
    });
    assert.equal(result.ok, true); assert.equal(result.persisted, false); assert.equal(refreshed, true);
  });
  await check('Real Keycloak logout returns home and clears protected UI', async () => {
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await page.getByRole('button', { name: 'Đăng nhập hệ thống (SSO)', exact: true }).waitFor();
    assert.equal(await page.getByText('employee.a', { exact: true }).count(), 0);
    assert.equal(await page.getByText(ticket.title, { exact: true }).count(), 0);
    assert.equal(await page.getByText(device.reason, { exact: true }).count(), 0);
  });
  await check('No uncaught browser errors during real SSO flow', async () => assert.deepEqual(browserErrors, []));
  report.passed = true;
} catch (error) { report.error = error.message; console.error(error.message); process.exitCode = 1; }
finally {
  await browser?.close(); await app?.close(); await admin?.end();
  for (const child of processes.reverse()) {
    if (child.pid && child.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
  }
  if (pgStarted) await pg.stop();
  report.finished_at = new Date().toISOString(); await save();
  console.log('Evidence: .local/reports/native-sso.json (no access tokens)');
}
