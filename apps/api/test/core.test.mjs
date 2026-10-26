// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClaims } from '../dist/auth.js';
import { Database } from '../dist/database.js';
import { ValidationPipe } from '@nestjs/common';
import { CreateTicket, CreateDeviceRequest, ListQuery } from '../dist/dto.js';

const claims = {
  sub: '20000000-0000-4000-8000-000000000001', role: 'authenticated',
  realm_access: { roles: ['Employee'] },
};
test('claims reject invalid sub, missing role, database role escalation and malformed roles', () => {
  assert.equal(validateClaims(claims).sub, claims.sub);
  for (const invalid of [
    { ...claims, sub: 'sql-injection' }, { ...claims, role: 'postgres' },
    { ...claims, realm_access: { roles: ['unknown'] } },
    { ...claims, realm_access: { roles: 'Manager' } }, {},
  ]) assert.throws(() => validateClaims(invalid));
});
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = (type, value, kind = 'body') => pipe.transform(value, { type: kind, metatype: type });
test('ticket validation trims and rejects ownership injection / blank body / invalid enum', async () => {
  const valid = { category_id: claims.sub, title: '  VPN không kết nối  ', description: 'Chi tiết sự cố kết nối VPN' };
  assert.equal((await validate(CreateTicket, valid)).title, 'VPN không kết nối');
  await assert.rejects(validate(CreateTicket, { ...valid, requester_id: claims.sub }));
  await assert.rejects(validate(CreateTicket, { ...valid, description: '          ' }));
  await assert.rejects(validate(CreateTicket, { ...valid, priority: 'urgent' }));
});
test('device quantity and query limits are bounded', async () => {
  await assert.rejects(validate(CreateDeviceRequest, { device_type: 'laptop', reason: 'Phục vụ công việc', quantity: 1000 }));
  await assert.rejects(validate(ListQuery, { limit: '101' }, 'query'));
  await assert.rejects(validate(ListQuery, { offset: '-1' }, 'query'));
  assert.equal((await validate(ListQuery, { limit: '10' }, 'query')).limit, 10);
});
function fakeDatabase({ failOperation = false, failRollback = false } = {}) {
  const calls = [];
  const db = Object.create(Database.prototype);
  db.pool = {
    connect: async () => ({
      query: async (sql, values) => {
        calls.push([sql, values]);
        if (sql === 'ROLLBACK' && failRollback) throw new Error('connection lost');
      },
      release: discard => calls.push(['release', discard]),
    }),
  };
  const operation = async () => {
    if (failOperation) throw new Error('operation failed');
    return 42;
  };
  return { db, calls, operation };
}
test('claims are parameterized and transaction commits before releasing client', async () => {
  const { db, calls, operation } = fakeDatabase();
  assert.equal(await db.asUser(claims, operation), 42);
  assert.equal(calls[0][0], 'BEGIN');
  assert.equal(calls[1][0], 'SET LOCAL ROLE authenticated');
  assert.deepEqual(calls[2][1], [JSON.stringify(claims)]);
  assert.deepEqual(calls.slice(-2), [['COMMIT', undefined], ['release', false]]);
});
test('failure rolls back and connection is released', async () => {
  const { db, calls, operation } = fakeDatabase({ failOperation: true });
  await assert.rejects(db.asUser(claims, operation), /operation failed/);
  assert.deepEqual(calls.slice(-2), [['ROLLBACK', undefined], ['release', false]]);
});
test('failed rollback discards unsafe connection and preserves original error', async () => {
  const { db, calls, operation } = fakeDatabase({ failOperation: true, failRollback: true });
  await assert.rejects(db.asUser(claims, operation), /operation failed/);
  assert.deepEqual(calls.at(-1), ['release', true]);
});
