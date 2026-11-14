// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { DEMO_DEPARTMENTS, DEPARTMENT_PATTERN, departmentMapper, setupDepartments, withDepartment } from '../scripts/setup-directory.mjs';

test('department is an admin-only single-valued profile attribute and keeps existing attributes', () => {
  const profile = { attributes: [{ name: 'username' }, { name: 'email' }], groups: [{ name: 'user-metadata' }] };
  const next = withDepartment(profile);
  assert.deepEqual(next.attributes.map(attribute => attribute.name), ['username', 'email', 'department']);
  assert.deepEqual(next.groups, profile.groups);
  const department = next.attributes.at(-1);
  assert.deepEqual(department.permissions.edit, ['admin'], 'Người dùng không tự đổi đơn vị để chọn người duyệt');
  assert.equal(department.multivalued, false);
  assert.equal(withDepartment(next), null, 'Chạy lại không ghi thêm');
  // Thuộc tính bị mở quyền sửa cho người dùng được đưa về chỉ quản trị viên.
  const loose = { attributes: [{ name: 'department', permissions: { view: ['user'], edit: ['admin', 'user'] } }] };
  assert.deepEqual(withDepartment(loose).attributes[0].permissions.edit, ['admin']);
  for (const value of Object.values(DEMO_DEPARTMENTS)) assert.match(value, new RegExp(DEPARTMENT_PATTERN));
  assert.equal(DEMO_DEPARTMENTS['manager.1'], DEMO_DEPARTMENTS['employee.a']);
  assert.equal(departmentMapper.config['access.token.claim'], 'true');
  assert.equal(departmentMapper.config.multivalued, 'false');
});

test('setup adds profile, mapper and demo units once and never overwrites an assigned unit', async t => {
  const state = {
    profile: { attributes: [{ name: 'username' }] }, mappers: [],
    users: [{ id: 'u-a', username: 'employee.a', email: 'a@dxdesk.local' },
      { id: 'u-m', username: 'manager.1', attributes: { department: ['phong-khac'], locale: ['vi'] } }],
  };
  const writes = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const url = new URL(request.url, 'http://localhost');
    const send = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(value === undefined ? '' : JSON.stringify(value)); };
    if (url.pathname.endsWith('/openid-connect/token')) return send({ access_token: 'admin-token' });
    if (request.headers.authorization !== 'Bearer admin-token') return send({}, 401);
    const path = url.pathname.replace('/admin/realms/dxdesk', '');
    if (request.method !== 'GET') writes.push(request.method + ' ' + path);
    if (path === '/users/profile') {
      if (request.method === 'PUT') state.profile = JSON.parse(body);
      return send(state.profile);
    }
    if (path === '/clients') return send(url.searchParams.get('clientId') === 'dxdesk-web' ? [{ id: 'c-web' }] : []);
    if (path === '/clients/c-web/protocol-mappers/models') {
      if (request.method === 'POST') { state.mappers.push({ id: 'm-1', ...JSON.parse(body) }); return send(undefined, 201); }
      return send(state.mappers);
    }
    if (path === '/clients/c-web/protocol-mappers/models/m-1') { state.mappers[0] = JSON.parse(body); return send(undefined, 204); }
    if (path === '/users') return send(state.users.filter(user => user.username === url.searchParams.get('username')));
    const user = state.users.find(item => path === '/users/' + item.id);
    if (user && request.method === 'PUT') { Object.assign(user, JSON.parse(body)); return send(undefined, 204); }
    return send({}, 404);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const env = { KEYCLOAK_PUBLIC_URL: 'http://127.0.0.1:' + server.address().port, KEYCLOAK_REALM: 'dxdesk',
    KEYCLOAK_ADMIN: 'admin', KEYCLOAK_ADMIN_PASSWORD: 'fixture-only' };
  t.mock.method(console, 'log', () => {});
  await setupDepartments(env, ['dxdesk-web', 'missing-client']);
  assert.ok(state.profile.attributes.some(attribute => attribute.name === 'department'));
  assert.equal(state.mappers[0].config['claim.name'], 'department');
  assert.deepEqual(state.users[0].attributes, { department: ['phong-hanh-chinh'] });
  assert.equal(state.users[0].email, 'a@dxdesk.local', 'Các trường khác của người dùng được giữ');
  assert.deepEqual(state.users[1].attributes, { department: ['phong-khac'], locale: ['vi'] }, 'Không ghi đè đơn vị đã gán');
  writes.length = 0;
  await setupDepartments(env, ['dxdesk-web']);
  assert.deepEqual(writes, ['PUT /clients/c-web/protocol-mappers/models/m-1'], 'Lần chạy sau chỉ đồng bộ lại mapper');
});
