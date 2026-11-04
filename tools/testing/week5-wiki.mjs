// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W5-08 nghiệm thu trên stack thật: đăng nhập Wiki.js bằng Keycloak (Authorization Code thật,
// không có mật khẩu riêng của Wiki), nhóm theo vai trò, 6 bài, gợi ý qua APISIX và lượt tự phục vụ.
// Chỉ dùng tài khoản demo cục bộ; không in token, cookie hay mật khẩu.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = { ...parseEnv(await readFile(resolve(root, '.env'), 'utf8')), ...process.env };
const gateway = 'http://localhost:' + env.APISIX_PORT;
const wiki = (env.WIKI_PUBLIC_URL || 'http://localhost:18030').replace(/\/+$/, '');
const issuer = env.KEYCLOAK_PUBLIC_URL + '/realms/' + env.KEYCLOAK_REALM;
const password = env.DEMO_USER_PASSWORD ?? 'DxDesk@2026';
const report = { sha: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim(),
  scope: 'Real Keycloak/APISIX/API/PostgreSQL/Wiki.js', checks: [], passed: false };
async function check(name, op) {
  try { await op(); report.checks.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { report.checks.push({ name, passed: false, error: error.message }); throw error; }
}

/** Trình duyệt tối giản: giữ cookie theo host, tự theo redirect, không chạy JavaScript. */
function browser() {
  const jar = new Map();
  const store = (url, response) => {
    const host = new URL(url).host;
    const cookies = jar.get(host) ?? new Map();
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1));
    }
    jar.set(host, cookies);
  };
  const cookieHeader = url => [...(jar.get(new URL(url).host) ?? new Map())].map(([key, value]) => `${key}=${value}`).join('; ');
  return async function go(url, options = {}) {
    let current = url;
    let request = options;
    for (let hop = 0; hop < 12; hop++) {
      const response = await fetch(current, { ...request, redirect: 'manual', signal: AbortSignal.timeout(20000),
        headers: { ...(request.headers ?? {}), Cookie: cookieHeader(current) } });
      store(current, response);
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        current = new URL(location, current).href;
        request = {};
        continue;
      }
      return { url: current, status: response.status, text: await response.text() };
    }
    throw new Error('Too many redirects');
  };
}

async function wikiLogin(username) {
  const go = browser();
  const article = await go(wiki + '/ho-tro/vpn');
  assert.equal(article.status, 403, 'Guests cannot read articles without SSO');
  const form = await go(wiki + '/login');
  assert.ok(form.url.startsWith(issuer + '/protocol/openid-connect/auth'), 'Wiki.js auto-redirects to Keycloak');
  const action = /<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/.exec(form.text)?.[1];
  assert.ok(action, 'Keycloak login form is rendered');
  const signedIn = await go(action.replaceAll('&amp;', '&'), { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password }) });
  assert.ok(signedIn.url.startsWith(wiki), 'Keycloak returns to Wiki.js callback');
  assert.ok(signedIn.url.endsWith('/ho-tro/vpn'), 'Login returns to the article that was requested');
  return go;
}

async function token(username) {
  const response = await fetch(issuer + '/protocol/openid-connect/token', { method: 'POST', signal: AbortSignal.timeout(20000),
    body: new URLSearchParams({ grant_type: 'password', client_id: 'dxdesk-web', username, password }) });
  assert.equal(response.status, 200, 'Keycloak token acquisition');
  return (await response.json()).access_token;
}
async function api(path, identity, body) {
  const response = await fetch(gateway + '/api' + path, { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + identity, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}

try {
  let employeeBrowser;
  await check('employee signs in to Wiki.js through Keycloak and reads the VPN article', async () => {
    employeeBrowser = await wikiLogin('employee.a');
    const page = await employeeBrowser(wiki + '/ho-tro/vpn');
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('Kết nối VPN của trường từ xa'));
  });
  await check('all six knowledge articles are published', async () => {
    for (const path of ['vpn', 'email', 'wifi', 'lms', 'mat-khau', 'phan-mem-ban-quyen']) {
      assert.equal((await employeeBrowser(wiki + '/ho-tro/' + path)).status, 200, path);
    }
  });
  await check('role mapping: Employee cannot edit, Agent can open the editor', async () => {
    const employeeEdit = await employeeBrowser(wiki + '/e/en/ho-tro/vpn');
    assert.equal(employeeEdit.status, 403);
    const agentBrowser = await wikiLogin('agent.1');
    const agentEdit = await agentBrowser(wiki + '/e/en/ho-tro/vpn');
    assert.equal(agentEdit.status, 200);
  });
  await check('API suggests Wiki articles for VPN and records exactly one self-service resolution', async () => {
    const employee = await token('employee.a');
    const vpn = '10000000-0000-4000-8000-000000000001';
    const suggestions = await api(`/categories/${vpn}/articles`, employee);
    assert.equal(suggestions.status, 200);
    assert.equal(suggestions.data.data[0].slug, 'vpn');
    assert.equal(suggestions.data.data[0].url, wiki + '/ho-tro/vpn');
    const tickets = (await api('/tickets?limit=1', employee)).data.total;
    const recorded = await api('/self-service', employee, { category_id: vpn, article_id: suggestions.data.data[0].id });
    assert.equal(recorded.status, 201);
    assert.equal((await api('/tickets?limit=1', employee)).data.total, tickets, 'No ticket is created');
    const other = await token('employee.b');
    const rest = await fetch(gateway + '/rest/self_service_resolutions?select=id', { headers: { Authorization: 'Bearer ' + other },
      signal: AbortSignal.timeout(15000) });
    const visible = rest.ok ? await rest.json() : [];
    assert.ok(!visible.some(row => row.id === recorded.data.id), 'Another employee cannot read the record');
  });
  report.passed = true;
} finally {
  await mkdir(resolve(root, '.local/reports'), { recursive: true });
  await writeFile(resolve(root, '.local/reports/week5-wiki.json'), JSON.stringify(report, null, 2) + '\n');
}
