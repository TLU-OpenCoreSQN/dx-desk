// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W5-08: cấu hình Wiki.js bằng mã (không thao tác tay): client Keycloak, cài đặt lần đầu,
// SSO OIDC với ánh xạ vai trò -> nhóm, chặn khách, nạp 6 bài tri thức và trang chủ (home) từ docs/wiki/*.md.
// Chạy lặp lại an toàn; không in mật khẩu, secret hay token.
import { randomBytes } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const WIKI_STRATEGY_KEY = 'keycloak';
export const WIKI_CLIENT_ID = 'wikijs';
export const WIKI_ROLE_CLAIM = 'dxdesk_roles';
const SECRET_KEYS = ['WIKI_DB_PASSWORD', 'WIKI_ADMIN_PASSWORD', 'WIKI_CLIENT_SECRET'];
// Nhóm Wiki trùng tên vai trò realm; OIDC mapGroups chỉ nối nhóm có tên khớp claim.
const READ = ['read:pages', 'read:assets', 'read:comments', 'write:comments'];
const EDIT = [...READ, 'write:pages', 'manage:pages', 'delete:pages', 'read:source', 'read:history', 'write:assets'];
export const WIKI_GROUPS = { Employee: READ, Agent: EDIT, Manager: EDIT };
// Bài đã bỏ (migration 016 đổi LMS sang phần mềm nghiệp vụ): xoá khỏi Wiki.js của stack cũ.
export const RETIRED_PATHS = ['ho-tro/lms'];
const ATTRIBUTION = '\n\n---\n\n*Nội dung theo giấy phép [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.vi) — TLU-OpenCoreSQN, DX-Desk.*\n';

export function wikiEnabled(env) {
  return String(env.COMPOSE_PROFILES ?? '').split(',').map(value => value.trim())
    .some(profile => profile === 'full' || profile === 'demo-light');
}

/** Bổ sung mặc định và sinh secret còn trống vào .env (đã nằm trong .gitignore). */
export async function prepareWiki(root, env) {
  if (!wikiEnabled(env)) return false;
  env.WIKIJS_VERSION ||= '2.5.315';
  env.WIKI_PORT ||= '18030';
  env.WIKI_PUBLIC_URL ||= `http://localhost:${env.WIKI_PORT}`;
  for (const key of SECRET_KEYS) if (!env[key]) env[key] = randomBytes(24).toString('hex');
  let text = await readFile(resolve(root, '.env'), 'utf8');
  for (const key of ['WIKIJS_VERSION', 'WIKI_PORT', 'WIKI_PUBLIC_URL', ...SECRET_KEYS]) {
    const expression = new RegExp('^' + key + '=.*$', 'm');
    const line = key + '=' + env[key];
    text = expression.test(text) ? text.replace(expression, () => line) : text.trimEnd() + '\n' + line + '\n';
  }
  await writeFile(resolve(root, '.env'), text);
  return true;
}

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Object.assign(new Error(`Wiki setup HTTP ${response.status}`), { status: response.status });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function wikiClient(env) {
  const wiki = env.WIKI_PUBLIC_URL.replace(/\/+$/, '');
  return {
    clientId: WIKI_CLIENT_ID, name: 'Wiki.js tri thức DX-Desk', enabled: true, protocol: 'openid-connect',
    publicClient: false, secret: env.WIKI_CLIENT_SECRET, standardFlowEnabled: true,
    directAccessGrantsEnabled: false, serviceAccountsEnabled: false, implicitFlowEnabled: false,
    redirectUris: [`${wiki}/login/${WIKI_STRATEGY_KEY}/callback`], webOrigins: [wiki],
    attributes: { 'post.logout.redirect.uris': `${wiki}/*` },
    protocolMappers: [{
      name: 'dxdesk-roles', protocol: 'openid-connect', protocolMapper: 'oidc-usermodel-realm-role-mapper',
      config: { 'claim.name': WIKI_ROLE_CLAIM, multivalued: 'true', 'jsonType.label': 'String',
        'id.token.claim': 'true', 'userinfo.token.claim': 'true', 'access.token.claim': 'false' },
    }],
  };
}

/** Tạo/cập nhật client `wikijs` trong realm bằng admin API (realm import chỉ chạy lần đầu). */
export async function setupWikiClient(env) {
  if (!wikiEnabled(env)) return;
  const base = env.KEYCLOAK_PUBLIC_URL;
  const token = await json(base + '/realms/master/protocol/openid-connect/token', { method: 'POST', body: new URLSearchParams({
    client_id: 'admin-cli', grant_type: 'password', username: env.KEYCLOAK_ADMIN, password: env.KEYCLOAK_ADMIN_PASSWORD,
  }) });
  const headers = { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' };
  const admin = (path, method = 'GET', body) => json(base + '/admin/realms/' + env.KEYCLOAK_REALM + path,
    { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const client = wikiClient(env);
  const existing = await admin('/clients?clientId=' + WIKI_CLIENT_ID);
  if (!existing.length) { await admin('/clients', 'POST', client); return console.log('Keycloak client wikijs created.'); }
  const { protocolMappers, ...settings } = client;
  await admin('/clients/' + existing[0].id, 'PUT', { ...existing[0], ...settings });
  const mappers = await admin('/clients/' + existing[0].id + '/protocol-mappers/models');
  for (const mapper of protocolMappers) {
    const current = mappers.find(item => item.name === mapper.name);
    if (current) await admin('/clients/' + existing[0].id + '/protocol-mappers/models/' + current.id, 'PUT', { ...current, ...mapper });
    else await admin('/clients/' + existing[0].id + '/protocol-mappers/models', 'POST', mapper);
  }
  console.log('Keycloak client wikijs updated (no secret printed).');
}

/** Đọc front matter tối giản (title, description, path, tags) của bài trong docs/wiki. */
export function parseArticle(text, file = 'article') {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file}: thiếu front matter.`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!field) continue;
    meta[field[1]] = field[2].startsWith('[')
      ? field[2].replace(/^\[|\]$/g, '').split(',').map(value => value.trim()).filter(Boolean)
      : field[2].trim();
  }
  if (!meta.title || !meta.description || !/^[a-z0-9][a-z0-9/-]{0,199}$/.test(meta.path ?? '')) {
    throw new Error(`${file}: cần title, description và path hợp lệ.`);
  }
  return { title: meta.title, description: meta.description, path: meta.path, tags: meta.tags ?? [], content: match[2].trim() + ATTRIBUTION };
}

export async function loadArticles(root) {
  const directory = resolve(root, 'docs/wiki');
  const files = (await readdir(directory)).filter(name => name.endsWith('.md') && name !== 'README.md').sort();
  return Promise.all(files.map(async name => parseArticle(await readFile(resolve(directory, name), 'utf8'), name)));
}

async function waitFor(check, label, attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { if (await check()) return; } catch { /* service still starting */ }
    await new Promise(done => setTimeout(done, 2000));
  }
  throw new Error(`${label} chưa sẵn sàng.`);
}

async function inSetupMode(wiki) {
  const response = await fetch(wiki + '/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{__typename}' }), signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return true;
  if (response.ok) return false;
  throw new Error(`Wiki.js GraphQL HTTP ${response.status}`);
}

export async function setupWiki(root, env) {
  if (!wikiEnabled(env)) return;
  const wiki = `http://localhost:${env.WIKI_PORT}`;
  const publicUrl = env.WIKI_PUBLIC_URL.replace(/\/+$/, '');
  const adminEmail = 'wiki.admin@dxdesk.local';
  await waitFor(async () => (await fetch(wiki + '/healthz', { signal: AbortSignal.timeout(5000) })).ok, 'Wiki.js');
  if (await inSetupMode(wiki)) {
    const result = await json(wiki + '/finalize', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail, adminPassword: env.WIKI_ADMIN_PASSWORD,
        adminPasswordConfirm: env.WIKI_ADMIN_PASSWORD, siteUrl: publicUrl, telemetry: false }) });
    if (!result?.ok) throw new Error('Wiki.js finalize thất bại.');
    await waitFor(async () => !(await inSetupMode(wiki)), 'Wiki.js sau cài đặt');
  }
  let jwt = '';
  async function gql(query, variables = {}) {
    const body = await json(wiki + '/graphql', { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) },
      body: JSON.stringify({ query, variables }) });
    if (body.errors?.length) throw new Error('Wiki.js GraphQL: ' + body.errors.map(error => error.message).join('; '));
    return body.data;
  }
  const ensure = (result, label) => {
    if (!result?.responseResult?.succeeded) throw new Error(`${label}: ${result?.responseResult?.message ?? 'thất bại'}`);
    return result;
  };
  await waitFor(async () => {
    const login = (await gql(`mutation($u:String!,$p:String!){authentication{login(username:$u,password:$p,strategy:"local"){
      responseResult{succeeded message} jwt}}}`, { u: adminEmail, p: env.WIKI_ADMIN_PASSWORD })).authentication.login;
    jwt = ensure(login, 'Đăng nhập quản trị Wiki.js').jwt;
    return Boolean(jwt);
  }, 'Đăng nhập quản trị Wiki.js', 30);

  const groupList = async () => (await gql('{groups{list{id name isSystem}}}')).groups.list;
  let groups = await groupList();
  const allPages = [{ id: 'dxdesk-all', deny: false, match: 'START', roles: ['read:pages', 'read:assets', 'read:comments', 'write:comments',
    'write:pages', 'manage:pages', 'delete:pages', 'read:source', 'read:history', 'write:assets'], path: '', locales: [] }];
  const updateGroup = async (id, name, permissions, pageRules) => ensure((await gql(`mutation($id:Int!,$name:String!,$p:[String]!,$r:[PageRuleInput]!){
    groups{update(id:$id,name:$name,redirectOnLogin:"/",permissions:$p,pageRules:$r){responseResult{succeeded message}}}}`,
  { id, name, p: permissions, r: pageRules })).groups.update, `Nhóm ${name}`);
  for (const [name, permissions] of Object.entries(WIKI_GROUPS)) {
    let group = groups.find(item => item.name === name);
    if (!group) {
      ensure((await gql('mutation($n:String!){groups{create(name:$n){responseResult{succeeded message}}}}', { n: name })).groups.create, `Tạo nhóm ${name}`);
      groups = await groupList();
      group = groups.find(item => item.name === name);
    }
    await updateGroup(group.id, name, permissions,
      allPages.map(rule => ({ ...rule, roles: rule.roles.filter(role => permissions.includes(role)) })));
  }
  // Khách không đọc được gì: truy cập bài chuyển sang /login rồi tự chuyển tới Keycloak.
  const guests = groups.find(item => item.isSystem && item.id === 2);
  if (guests) await updateGroup(guests.id, guests.name, [], []);

  const issuer = `${env.KEYCLOAK_PUBLIC_URL}/realms/${env.KEYCLOAK_REALM}`;
  const internal = `http://keycloak:8080/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect`;
  const config = {
    clientId: WIKI_CLIENT_ID, clientSecret: env.WIKI_CLIENT_SECRET,
    authorizationURL: `${issuer}/protocol/openid-connect/auth`, tokenURL: `${internal}/token`, userInfoURL: `${internal}/userinfo`,
    skipUserProfile: false, issuer, emailClaim: 'email', displayNameClaim: 'name', pictureClaim: 'picture',
    mapGroups: true, groupsClaim: WIKI_ROLE_CLAIM, acrValues: '',
    logoutURL: `${issuer}/protocol/openid-connect/logout?client_id=${WIKI_CLIENT_ID}&post_logout_redirect_uri=${encodeURIComponent(publicUrl)}`,
  };
  const strategy = (key, strategyKey, displayName, order, values, selfRegistration) => ({
    key, strategyKey, displayName, order, isEnabled: true, selfRegistration, domainWhitelist: [], autoEnrollGroups: [],
    config: Object.entries(values).map(([name, value]) => ({ key: name, value: JSON.stringify({ v: value }) })),
  });
  // OIDC đứng đầu để autoLogin chuyển thẳng tới Keycloak; quản trị cục bộ vào bằng /login?all=1.
  ensure((await gql('mutation($s:[AuthenticationStrategyInput]!){authentication{updateStrategies(strategies:$s){responseResult{succeeded message}}}}', {
    s: [strategy(WIKI_STRATEGY_KEY, 'oidc', 'Tài khoản trường (Keycloak)', 0, config, true),
      strategy('local', 'local', 'Quản trị cục bộ', 1, {}, false)],
  })).authentication.updateStrategies, 'Chiến lược đăng nhập');
  ensure((await gql(`mutation($h:String!){site{updateConfig(host:$h,title:"DX-Desk Tri thức",company:"TLU-OpenCoreSQN",
    contentLicense:"ccby",authAutoLogin:true,authHideLocal:false){responseResult{succeeded message}}}}`, { h: publicUrl })).site.updateConfig, 'Cấu hình site');

  const existing = (await gql('{pages{list(limit:500){id path locale}}}')).pages.list;
  let created = 0, updated = 0;
  for (const article of await loadArticles(root)) {
    const page = existing.find(item => item.path === article.path && item.locale === 'en');
    const fields = { content: article.content, description: article.description, path: article.path, tags: article.tags, title: article.title };
    if (!page) {
      ensure((await gql(`mutation($content:String!,$description:String!,$path:String!,$tags:[String]!,$title:String!){pages{create(
        content:$content,description:$description,editor:"markdown",isPublished:true,isPrivate:false,locale:"en",path:$path,tags:$tags,title:$title)
        {responseResult{succeeded message}}}}`, fields)).pages.create, `Tạo bài ${article.path}`);
      created++;
      continue;
    }
    const current = (await gql('query($id:Int!){pages{single(id:$id){content title description}}}', { id: page.id })).pages.single;
    if (current.content === article.content && current.title === article.title && current.description === article.description) continue;
    ensure((await gql(`mutation($id:Int!,$content:String!,$description:String!,$path:String!,$tags:[String]!,$title:String!){pages{update(
      id:$id,content:$content,description:$description,editor:"markdown",isPublished:true,isPrivate:false,locale:"en",path:$path,tags:$tags,title:$title)
      {responseResult{succeeded message}}}}`, { id: page.id, ...fields })).pages.update, `Cập nhật bài ${article.path}`);
    updated++;
  }
  let removed = 0;
  for (const page of existing.filter(item => RETIRED_PATHS.includes(item.path))) {
    ensure((await gql('mutation($id:Int!){pages{delete(id:$id){responseResult{succeeded message}}}}', { id: page.id })).pages.delete,
      `Xoá bài cũ ${page.path}`);
    removed++;
  }
  console.log(`Wiki.js: SSO Keycloak, nhóm theo vai trò; bài mới ${created}, cập nhật ${updated}, xoá ${removed}.`);
}
