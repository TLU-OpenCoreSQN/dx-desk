// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { readFile, readdir } from 'node:fs/promises';
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
for (const clientId of ['dxdesk-web', 'appsmith']) {
  const client = realm.clients.find(client => client.clientId === clientId);
  assert.ok(client.protocolMappers.some(mapper => mapper.config['included.client.audience'] === 'dxdesk-api'));
  assert.ok(client.protocolMappers.some(mapper => mapper.config['claim.value'] === 'authenticated'));
}
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
