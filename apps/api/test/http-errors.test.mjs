// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Real Nest/Express HTTP parser and filter; database startup is stubbed, no stack services.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../dist/app.js';
import { Database } from '../dist/database.js';
import { JwtGuard } from '../dist/auth.js';

test('HTTP JSON errors retain client status, hide parser details and stop before guards/database', async t => {
  const previous = {};
  for (const [name, value] of Object.entries({
    DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unused',
    OIDC_ISSUER: 'http://127.0.0.1:1/realms/unused',
    OIDC_AUDIENCE: 'dxdesk-api',
    OIDC_JWKS_URL: 'http://127.0.0.1:1/jwks',
  })) {
    previous[name] = process.env[name];
    process.env[name] = value;
  }
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  t.mock.method(Database.prototype, 'onModuleInit', async () => {});
  const guard = t.mock.method(JwtGuard.prototype, 'canActivate');
  const app = await createApp();
  t.after(() => app.close());
  const db = app.get(Database);
  t.mock.method(db.pool, 'query', () => assert.fail('Invalid JSON must not query the database'));
  t.mock.method(db, 'asUser', () => assert.fail('Invalid JSON must not start a user transaction'));
  await app.listen(0, '127.0.0.1');
  const endpoint = `${await app.getUrl()}/api/tickets`;

  for (const body of ['{"private":"parser-input-must-not-appear",', '"parser-input-must-not-appear"']) {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      message: 'Nội dung JSON không hợp lệ.', error: 'Bad Request', statusCode: 400,
    });
  }
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_base64: 'x'.repeat(16 * 1024 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    message: 'Nội dung yêu cầu vượt quá giới hạn 16 MiB.', error: 'Payload Too Large', statusCode: 413,
  });
  assert.equal(guard.mock.calls.length, 0, 'Parser errors must stop before authentication/controller work');

  const unauthorized = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(unauthorized.status, 401, 'A valid JSON body still follows the usual JWT guard');
  assert.equal(guard.mock.calls.length, 1);
});
