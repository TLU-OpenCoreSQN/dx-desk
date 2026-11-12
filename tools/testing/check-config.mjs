// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => readFile(resolve(root, path), 'utf8');
const compose = parse(await read('infra/compose/docker-compose.yml'));
const routes = parse(await read('infra/apisix/apisix.yaml'));
const realm = JSON.parse(await read('infra/keycloak/realm-dxdesk.json'));
const env = await read('.env.example');
const variables = new Set([...env.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(match => match[1]));
for (const match of (await read('infra/compose/docker-compose.yml')).matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)) {
  assert.ok(variables.has(match[1]), `Missing env example: ${match[1]}`);
}
for (const route of routes.routes) {
  for (const host of Object.keys(route.upstream?.nodes ?? {})) {
    assert.ok(compose.services[host.split(':')[0]], `Route ${route.id} references missing service ${host}`);
  }
}
assert.ok((await read('infra/apisix/apisix.yaml')).trimEnd().endsWith('#END'));
assert.equal(routes.routes.find(route => route.id === 'n8n-webhook').uri, '/webhook/dxdesk-hello',
  'Only the hello fixture may be exposed anonymously to n8n');
assert.ok(routes.routes.find(route => route.id === 'api-health').plugins['limit-req'],
  'The public database probe must be rate limited');
const filerPort = compose.services.seaweedfs.command.find(arg => arg.startsWith('-filer.port='));
assert.ok(filerPort, 'Declare the Filer listener explicitly');
assert.equal(new URL(compose.services.api.environment.SEAWEEDFS_ENDPOINT).port, filerPort.split('=')[1],
  'API must use the deployed Filer listener');
assert.equal(compose.services.api.depends_on.seaweedfs.condition, 'service_healthy');
const otp = parse(await read('infra/keycloak/compose-otp.yml'));
const otpSource = otp.services.keycloak.volumes[0].split(':')[0];
await access(resolve(root, 'infra/compose', otpSource));
assert.equal(resolve(root, 'infra/compose', otpSource), resolve(root, 'infra/keycloak/realm-dxdesk-otp.json'),
  'OTP overlay paths are relative to the first Compose file');
for (const clientId of ['dxdesk-web', 'appsmith']) {
  const client = realm.clients.find(client => client.clientId === clientId);
  assert.ok(client.protocolMappers.some(mapper => mapper.config['included.client.audience'] === 'dxdesk-api'));
  assert.ok(client.protocolMappers.some(mapper => mapper.config['claim.value'] === 'authenticated'));
}
// W5-02: đơn vị (department) đi trong access token của ứng dụng người dùng; chỉ quản trị viên sửa được.
for (const realmPath of ['infra/keycloak/realm-dxdesk.json', 'infra/keycloak/realm-dxdesk-otp.json']) {
  const document = JSON.parse(await read(realmPath));
  const web = document.clients.find(client => client.clientId === 'dxdesk-web');
  const mapper = web.protocolMappers.find(item => item.config['claim.name'] === 'department');
  assert.ok(mapper && mapper.protocolMapper === 'oidc-usermodel-attribute-mapper' && mapper.config['access.token.claim'] === 'true'
    && mapper.config.multivalued === 'false', `${realmPath}: dxdesk-web must carry a single-valued department claim`);
  const profile = JSON.parse(document.components['org.keycloak.userprofile.UserProfileProvider'][0].config['kc.user.profile.config'][0]);
  assert.deepEqual(profile.attributes.find(attribute => attribute.name === 'department').permissions.edit, ['admin'],
    `${realmPath}: users must not edit their own department`);
  for (const user of document.users) {
    assert.match(user.attributes?.department?.[0] ?? '', /^[a-z0-9]+(-[a-z0-9]+)*$/, `${realmPath}: ${user.username} needs a department`);
  }
  const unit = name => document.users.find(user => user.username === name).attributes.department[0];
  assert.equal(unit('manager.1'), unit('employee.a'), `${realmPath}: demo manager approves employee.a`);
  assert.notEqual(unit('manager.1'), unit('employee.b'), `${realmPath}: employee.b shows the manager scope`);
}
// W5-08: Wiki.js chỉ dùng client riêng, không mang audience API, có claim vai trò cho mapGroups.
for (const realmPath of ['infra/keycloak/realm-dxdesk.json', 'infra/keycloak/realm-dxdesk-otp.json']) {
  const wiki = JSON.parse(await read(realmPath)).clients.find(client => client.clientId === 'wikijs');
  assert.ok(wiki && !wiki.publicClient && !wiki.directAccessGrantsEnabled, `${realmPath}: wikijs must be a confidential code-flow client`);
  assert.ok(wiki.redirectUris.every(uri => uri.endsWith('/login/keycloak/callback')), `${realmPath}: wikijs redirect must be the OIDC callback`);
  assert.ok(!wiki.protocolMappers.some(mapper => mapper.config['included.client.audience'] === 'dxdesk-api'),
    `${realmPath}: Wiki.js tokens must never be accepted by the API`);
  assert.ok(wiki.protocolMappers.some(mapper => mapper.config['claim.name'] === 'dxdesk_roles'));
}
for (const service of ['wiki-db', 'wikijs']) {
  assert.deepEqual(compose.services[service].profiles, ['full', 'demo-light'], `${service} belongs to product profiles`);
}
assert.ok(compose.services.wikijs.ports.every(port => port.startsWith('127.0.0.1:')), 'Wiki.js binds to loopback only');
assert.ok(!compose.services['wiki-db'].ports, 'Wiki database is not published');
for (const path of ['infra/compose/docker-compose.yml', '.github/workflows/ci.yml', 'docs/api/openapi.yaml']) {
  parse(await read(path));
}
for (const app of ['web', 'api']) {
  const pkg = JSON.parse(await read(`apps/${app}/package.json`));
  const lock = JSON.parse(await read(`apps/${app}/package-lock.json`));
  assert.ok(pkg.scripts.build && pkg.scripts.test);
  assert.equal(pkg.version, lock.packages[''].version);
  assert.deepEqual(pkg.dependencies, lock.packages[''].dependencies, `${app} dependency lock mismatch`);
  assert.deepEqual(pkg.devDependencies, lock.packages[''].devDependencies, `${app} dev dependency lock mismatch`);
}
console.log('PASS config references, env completeness, Keycloak audiences, YAML and package locks');
