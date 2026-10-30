// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Real APISIX, isolated signing fixtures and HTTP upstream; no application data.
import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { renderGateway } from '../../scripts/render-gateway.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = resolve(root, '.local/gateway-test');
await mkdir(dir, { recursive: true });
await mkdir(resolve(root,'.local/reports'), {recursive:true});
const name = `dxdesk-gateway-test-${process.pid}`;
const issuer = 'https://test.invalid/realms/fixture';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'gateway-fixture', alg: 'RS256', use: 'sig' };
const upstream = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json'); response.end('{"upstream":true}');
});
upstream.listen(0, '0.0.0.0'); await once(upstream, 'listening');
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port; await new Promise(r => probe.close(r));
const template = (await readFile(resolve(root, 'infra/apisix/apisix.yaml'), 'utf8'))
  .replace(/"(?:api:3000|postgrest:3000|web:80)"/g, `"host.docker.internal:${upstream.address().port}"`);
const routes = resolve(dir, 'apisix.yaml');
await writeFile(routes, renderGateway(template, { keys: [jwk] }, issuer, 'dxdesk-api'));
const version = /^APISIX_VERSION=(.+)$/m.exec(await readFile(resolve(root, '.env.example'), 'utf8'))[1].trim();
function docker(args, mustPass = true) {
  const result = spawnSync('docker', args, { windowsHide: true, encoding: 'utf8', timeout: 60000 });
  if (mustPass) assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}
function jwt(overrides = {}, key = privateKey) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = encode({ alg: 'RS256', kid: jwk.kid }) + '.' + encode({
    iss: issuer, aud: 'dxdesk-api', sub: 'test', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+300, ...overrides,
  });
  return input + '.' + sign('RSA-SHA256', Buffer.from(input), key).toString('base64url');
}
const checks = [];
async function check(name, operation) { await operation(); checks.push(name); console.log('PASS ' + name); }
const base = `http://127.0.0.1:${port}`;
async function call(path, token, options = {}) {
  return fetch(base + path, { ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    signal: AbortSignal.timeout(20000) });
}
try {
  docker(['run', '-d', '--name', name, '--add-host=host.docker.internal:host-gateway', '-p', `127.0.0.1:${port}:9080`,
    '-v', `${resolve(root, 'infra/apisix/config.yaml')}:/usr/local/apisix/conf/config.yaml:ro`,
    '-v', `${routes}:/usr/local/apisix/conf/apisix.yaml:ro`, `apache/apisix:${version}`]);
  let ready = false;
  for (let n = 0; n < 40; n++) {
    try { if ((await call('/healthz')).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(ready, docker(['logs', '--tail', '30', name], false));
  await check('public health works without JWT', async () => assert.equal((await call('/api/health')).status, 200));
  for (const path of ['/api/me', '/rest/categories']) {
    await check(`${path}: valid JWT reaches upstream; invalid claims/signature rejected at gateway`, async () => {
      assert.equal((await call(path, jwt())).status, 200);
      const alien = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
      for (const [token, expected] of [[undefined,401], [jwt({}, alien),401], [jwt({ exp: 1 }),401],
        [jwt({ iss: 'https://wrong.invalid' }),401], [jwt({ aud: 'wrong' }),403]]) {
        assert.equal((await call(path, token)).status, expected);
      }
    });
  }
  await new Promise(r => setTimeout(r, 1200));
  await check('API and REST have runtime rate limits', async () => {
    for (const path of ['/api/me', '/rest/categories']) {
      const statuses = await Promise.all(Array.from({ length: 70 }, async () => (await call(path, jwt())).status));
      assert.ok(statuses.includes(429), `${path} must reject burst traffic`);
      assert.ok(statuses.every(code => [200,429].includes(code)));
      await new Promise(r => setTimeout(r, 1200));
    }
  });
  await check('gateway accepts 14 MiB JSON envelope and rejects bodies over 20 MiB', async () => {
    for (const [size, expected] of [[14,200], [21,413]]) {
      const result = await call('/api/probe', jwt(), { method: 'POST', body: 'x'.repeat(size*1024*1024) });
      assert.equal(result.status, expected); await result.body?.cancel();
    }
  });
  await check('only content route bypasses JWT for signed capabilities', async () => {
    assert.equal((await call('/api/attachments/10000000-0000-4000-8000-000000000001/content')).status, 200);
    assert.equal((await call('/api/attachments/10000000-0000-4000-8000-000000000001/download-url')).status, 401);
  });
  const logs = docker(['logs', name], false);
  assert.doesNotMatch(logs, /failed to (check|parse|read).*schema/);
  await writeFile(resolve(root, '.local/reports/gateway.json'), JSON.stringify({ passed: true, checks, version }, null, 2));
} finally {
  docker(['rm', '-f', name], false);
  await new Promise(r => upstream.close(r));
}
