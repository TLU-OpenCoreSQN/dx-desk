// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  generatePassword, importMain, openPasswordFile, parseCsv, planImport, readEmployees, ROOT, rosterBatches, splitName,
} from '../scripts/import-nhan-vien.mjs';

const HEADER = 'tai_khoan,ho_ten,email,vai_tro,nhom_xu_ly';
const TEAMS = [
  { id: '30000000-0000-4000-8000-000000000001', name: 'Network Team', active: true, members: ['u-old'] },
  { id: '30000000-0000-4000-8000-000000000002', name: 'Identity Team', active: true, members: [] },
  { id: '30000000-0000-4000-8000-000000000009', name: 'Nhóm cũ', active: false, members: [] },
];
const errorsOf = (rows, line) => rows.find(row => row.line === line).errors.join(' | ');

test('CSV parser handles BOM, CRLF, quoted commas, escaped quotes and blank lines', () => {
  const records = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n"multi\nline",z\n');
  assert.deepEqual(records, [
    { line: 1, cells: ['a', 'b'] }, { line: 2, cells: ['x, y', 'say "hi"'] }, { line: 4, cells: ['multi\nline', 'z'] },
  ]);
  assert.throws(() => parseCsv('a,"b\n'), /ngoặc kép/);
});

test('header must contain exactly the supported columns', () => {
  assert.throws(() => readEmployees('tai_khoan,email,vai_tro\nx,x@a.vn,Employee\n'), /Thiếu cột: ho_ten, nhom_xu_ly/);
  assert.throws(() => readEmployees(HEADER + ',luong\n'), /không được hỗ trợ: luong/);
  assert.throws(() => readEmployees(HEADER + '\n'), /chỉ có dòng tiêu đề/);
  assert.throws(() => readEmployees(''), /rỗng/);
});

test('row validation reports every problem with its line number', () => {
  const rows = readEmployees([
    HEADER + ',don_vi',
    ' An.Nguyen , Nguyễn   Văn An ,AN@Example.VN,agent,Network Team; Identity Team,phong-cntt',
    'binh,Trần Bình,binh@example.vn,Admin,,',
    'an.nguyen,Bản sao,khac@example.vn,Employee,,',
    'chi,Lê Chi,an@example.vn,Employee,,',
    'dung,Phạm Dũng,dung@example.vn,Employee,IT Support,',
    'Đức,Hồ Đức,khong-phai-email,Manager,,Phòng IT',
    'giang,Vũ Giang,giang@example.vn,Employee',
  ].join('\n'));
  const first = rows[0];
  assert.deepEqual({ username: first.username, fullName: first.fullName, email: first.email, role: first.role, teams: first.teams },
    { username: 'an.nguyen', fullName: 'Nguyễn Văn An', email: 'an@example.vn', role: 'Agent', teams: ['Network Team', 'Identity Team'] });
  assert.deepEqual(first.errors, []);
  assert.match(errorsOf(rows, 3), /vai trò "Admin" không hợp lệ/);
  assert.match(errorsOf(rows, 4), /tài khoản trùng với dòng 2/);
  assert.match(errorsOf(rows, 5), /email trùng với dòng 2/);
  assert.match(errorsOf(rows, 6), /Employee không được đưa vào nhóm/);
  assert.match(errorsOf(rows, 7), /tài khoản "đức"/);
  assert.match(errorsOf(rows, 7), /email "khong-phai-email" không hợp lệ/);
  assert.match(errorsOf(rows, 7), /mã đơn vị "Phòng IT"/);
  assert.match(errorsOf(rows, 8), /có 4 cột, tiêu đề có 6 cột/);
  assert.deepEqual(splitName('Nguyễn Văn An'), { lastName: 'Nguyễn', firstName: 'Văn An' });
  assert.deepEqual(splitName('Madonna'), { lastName: 'Madonna', firstName: 'Madonna' });
});

function fakeDirectory(users) {
  return {
    findByUsername: async username => users.find(user => user.username === username),
    findByEmail: async email => users.find(user => user.email === email),
    realmRoles: async id => (users.find(user => user.id === id)?.roles ?? []).map(name => ({ name })),
  };
}

test('plan creates, skips, completes existing users and rejects conflicts without writing', async () => {
  const rows = readEmployees([
    HEADER + ',don_vi',
    'moi,Người Mới,moi@example.vn,Agent,Network Team,phong-cntt',
    'cu,Người Cũ,cu@example.vn,Agent,network team,',
    'thieu,Thiếu Vai Trò,thieu@example.vn,Manager,30000000-0000-4000-8000-000000000002,phong-ke-toan',
    'doivaitro,Đổi Vai Trò,doivaitro@example.vn,Manager,,',
    'trungmail,Trùng Mail,khac.kc@example.vn,Employee,,',
    'khongnhom,Không Nhóm,khongnhom@example.vn,Agent,Nhóm Ma,',
    'ngung,Nhóm Ngừng,ngung@example.vn,Agent,Nhóm cũ,',
  ].join('\n'));
  const users = [
    { id: 'u-old', username: 'cu', email: 'cu@example.vn', roles: ['Agent', 'default-roles-dxdesk'] },
    { id: 'u-thieu', username: 'thieu', email: 'khac@example.vn', roles: [], attributes: { department: ['phong-khac'] } },
    { id: 'u-doi', username: 'doivaitro', email: 'doivaitro@example.vn', roles: ['Employee'] },
    { id: 'u-khac', username: 'khac', email: 'khac.kc@example.vn', roles: ['Employee'] },
  ];
  await planImport(rows, fakeDirectory(users), TEAMS);
  const byName = Object.fromEntries(rows.map(row => [row.username, row]));
  assert.equal(byName.moi.action, 'create');
  assert.deepEqual(byName.moi.addTeams.map(team => team.name), ['Network Team']);
  assert.equal(byName.cu.action, 'skip', 'Đã có vai trò và đã ở nhóm thì bỏ qua');
  assert.equal(byName.thieu.action, 'update');
  assert.equal(byName.thieu.addRole, true);
  assert.equal(byName.thieu.setDepartment, false, 'Không ghi đè đơn vị đã gán');
  assert.deepEqual(byName.thieu.addTeams.map(team => team.name), ['Identity Team']);
  assert.match(byName.thieu.warnings.join(), /email khác/);
  assert.match(byName.thieu.warnings.join(), /đơn vị đang là "phong-khac"/);
  assert.equal(byName.doivaitro.action, 'error');
  assert.match(byName.doivaitro.errors.join(), /đã có vai trò Employee/);
  assert.match(byName.trungmail.errors.join(), /email đã dùng cho tài khoản Keycloak khác "khac"/);
  assert.match(byName.khongnhom.errors.join(), /nhóm "Nhóm Ma" không tồn tại/);
  assert.match(byName.ngung.errors.join(), /ngừng hoạt động/);
});

test('roster batches stay within the API limit of 100 members', () => {
  const team = TEAMS[0];
  const rows = Array.from({ length: 101 }, (_, index) => ({ userId: 'u' + index, fullName: 'Người ' + index, action: 'create', addTeams: [team] }));
  rows.push({ userId: 'x', fullName: 'Lỗi', action: 'error', addTeams: [team] });
  const batches = rosterBatches(rows);
  assert.deepEqual(batches.map(batch => batch.length), [100, 1]);
  assert.deepEqual(batches[0][0], { team_id: team.id, user_id: 'u0', display_name: 'Người 0', active: true });
});

test('temporary passwords are random and mix every character class', () => {
  const passwords = new Set(Array.from({ length: 200 }, () => generatePassword()));
  assert.equal(passwords.size, 200);
  for (const password of passwords) {
    assert.equal(password.length, 20);
    for (const pattern of [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/]) assert.match(password, pattern);
    assert.doesNotMatch(password, /[",\s]/);
  }
});

test('password file must live outside the repository and is never overwritten', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dxdesk-mk-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(openPasswordFile(resolve(ROOT, 'mat-khau.csv')), /ngoài thư mục kho/);
  const existing = join(directory, 'co-san.csv');
  await writeFile(existing, 'cũ');
  await assert.rejects(openPasswordFile(existing), /đã tồn tại/);
  assert.equal(await readFile(existing, 'utf8'), 'cũ');
});

/** Keycloak Admin API + cổng DX-Desk giả lập, đủ cho một lần nhập. */
async function mockStack(t) {
  const state = {
    users: [{ id: 'u-agent1', username: 'agent.1', email: 'agent.1@dxdesk.local', roles: ['Agent'], attributes: {} }],
    teams: TEAMS.map(team => ({ ...team, members: [...team.members] })),
    writes: [], rosterCalls: [], created: [],
  };
  let sequence = 0;
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const url = new URL(request.url, 'http://localhost');
    const send = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(value === undefined ? '' : JSON.stringify(value)); };
    if (url.pathname === '/realms/master/protocol/openid-connect/token') return send({ access_token: 'admin-token' });
    if (url.pathname === '/realms/dxdesk/protocol/openid-connect/token') {
      return new URLSearchParams(body).get('client_secret') === 'svc-secret' ? send({ access_token: 'svc-token' }) : send({}, 401);
    }
    if (url.pathname.startsWith('/api/system/')) {
      if (request.headers.authorization !== 'Bearer svc-token') return send({}, 401);
      if (url.pathname === '/api/system/teams') return send({ data: state.teams });
      const { members } = JSON.parse(body);
      state.rosterCalls.push(members);
      for (const member of members) {
        const team = state.teams.find(item => item.id === member.team_id);
        if (!team.members.includes(member.user_id)) team.members.push(member.user_id);
      }
      return send({ updated: members.length });
    }
    if (request.headers.authorization !== 'Bearer admin-token') return send({}, 401);
    const path = url.pathname.replace('/admin/realms/dxdesk', '');
    if (request.method !== 'GET') state.writes.push(request.method + ' ' + path);
    if (path === '/users' && request.method === 'GET') {
      const username = url.searchParams.get('username'), email = url.searchParams.get('email');
      return send(state.users.filter(user => (username && user.username === username) || (email && user.email === email)));
    }
    if (path === '/users' && request.method === 'POST') {
      const user = JSON.parse(body);
      if (state.users.some(item => item.username === user.username || item.email === user.email)) return send({}, 409);
      state.created.push(user);
      state.users.push({ ...user, id: 'u-new-' + ++sequence, roles: [], credentials: undefined });
      return send(undefined, 201);
    }
    const roleMatch = path.match(/^\/roles\/(\w+)$/);
    if (roleMatch) return send({ id: 'r-' + roleMatch[1], name: roleMatch[1] });
    const mapping = path.match(/^\/users\/([\w-]+)\/role-mappings\/realm$/);
    if (mapping) {
      const user = state.users.find(item => item.id === mapping[1]);
      if (request.method === 'POST') { user.roles.push(...JSON.parse(body).map(role => role.name)); return send(undefined, 204); }
      return send(user.roles.map(name => ({ name })));
    }
    return send({}, 404);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port;
  const env = { KEYCLOAK_PUBLIC_URL: base, KEYCLOAK_REALM: 'dxdesk', KEYCLOAK_ADMIN: 'admin', KEYCLOAK_ADMIN_PASSWORD: 'fixture-only',
    AUTOMATION_CLIENT_SECRET: 'svc-secret', DXDESK_GATEWAY_URL: base };
  return { state, env };
}

test('dry-run writes nothing; apply creates users with temporary passwords; rerun is a no-op', async t => {
  const { state, env } = await mockStack(t);
  const directory = await mkdtemp(join(tmpdir(), 'dxdesk-import-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const csv = join(directory, 'nhan-vien.csv');
  await writeFile(csv, [HEADER + ',don_vi',
    'nv.mot,Nguyễn Văn Một,nv.mot@example.vn,Employee,,phong-ke-toan',
    'ktv.hai,Trần Thị Hai,ktv.hai@example.vn,Agent,Network Team;Identity Team,phong-cntt',
    'agent.1,Kỹ thuật viên 1,agent.1@dxdesk.local,Agent,Identity Team,',
  ].join('\n') + '\n');
  const logs = [];
  const log = line => logs.push(line);

  assert.equal(await importMain([csv], env, { log }), 0);
  assert.deepEqual(state.writes, [], 'Chạy thử không ghi Keycloak');
  assert.deepEqual(state.rosterCalls, [], 'Chạy thử không ghi roster');
  assert.match(logs.join('\n'), /tạo mới 2, bổ sung 1, bỏ qua 0, lỗi 0, thêm 3 thành viên nhóm/);

  await assert.rejects(importMain([csv, '--thuc-hien'], env, { log }), /--xuat-mat-khau/);
  assert.deepEqual(state.writes, [], 'Thiếu nơi giao mật khẩu thì không ghi gì');

  logs.length = 0;
  const passwordFile = join(directory, 'mat-khau.csv');
  assert.equal(await importMain([csv, '--thuc-hien', '--xuat-mat-khau', passwordFile], env, { log }), 0);
  assert.equal(state.created.length, 2);
  for (const user of state.created) {
    assert.deepEqual(user.requiredActions, ['UPDATE_PASSWORD']);
    assert.equal(user.credentials[0].temporary, true);
    assert.equal(user.enabled, true);
  }
  assert.deepEqual(state.created[0].attributes, { department: ['phong-ke-toan'] });
  assert.equal(state.created[1].lastName, 'Trần');
  assert.deepEqual(state.users.map(user => [user.username, user.roles]),
    [['agent.1', ['Agent']], ['nv.mot', ['Employee']], ['ktv.hai', ['Agent']]]);
  assert.deepEqual(state.rosterCalls.flat().map(member => [member.user_id, member.display_name]).sort(),
    [['u-agent1', 'Kỹ thuật viên 1'], ['u-new-2', 'Trần Thị Hai'], ['u-new-2', 'Trần Thị Hai']]);
  assert.deepEqual(state.teams[0].members, ['u-old', 'u-new-2'], 'Thành viên cũ của nhóm được giữ');

  const exported = (await readFile(passwordFile, 'utf8')).trim().split('\n');
  assert.equal(exported[0], 'tai_khoan,email,mat_khau_tam');
  assert.equal(exported.length, 3);
  const secrets = state.created.map(user => user.credentials[0].value);
  for (const secret of secrets) assert.ok(exported.some(line => line.includes(secret)));
  for (const secret of secrets) assert.ok(!logs.join('\n').includes(secret), 'Mật khẩu tạm không xuất hiện trong log');
  if (process.platform !== 'win32') assert.equal((await stat(passwordFile)).mode & 0o777, 0o600);

  // Lần hai: không tạo trùng, không gọi roster, không cần tệp mật khẩu.
  state.writes.length = 0; state.rosterCalls.length = 0; logs.length = 0;
  assert.equal(await importMain([csv, '--thuc-hien'], env, { log }), 0);
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.rosterCalls, []);
  assert.match(logs.join('\n'), /tạo mới 0, bổ sung 0, bỏ qua 3, lỗi 0, thêm 0 thành viên nhóm/);
});

test('apply refuses a file with bad rows unless asked to skip them', async t => {
  const { state, env } = await mockStack(t);
  const directory = await mkdtemp(join(tmpdir(), 'dxdesk-import-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const csv = join(directory, 'nhan-vien.csv');
  await writeFile(csv, [HEADER,
    'tot,Người Tốt,tot@example.vn,Employee,,',
    'xau,Người Xấu,agent.1@dxdesk.local,Employee,,',
    'ktv.ma,Kỹ Thuật Ma,ma@example.vn,Agent,Nhóm Ma,',
  ].join('\n') + '\n');
  const logs = [];
  assert.equal(await importMain([csv], env, { log: line => logs.push(line) }), 1, 'Chạy thử có lỗi trả mã 1');
  assert.match(logs.join('\n'), /Dòng 3 xau: LỖI – email đã dùng cho tài khoản Keycloak khác "agent.1"/);
  assert.match(logs.join('\n'), /Dòng 4 ktv.ma: LỖI – nhóm "Nhóm Ma" không tồn tại/);
  await assert.rejects(importMain([csv, '--thuc-hien', '--xuat-mat-khau', join(directory, 'mk.csv')], env, { log() {} }), /dòng lỗi/);
  assert.deepEqual(state.writes, []);
  assert.equal(await importMain([csv, '--thuc-hien', '--bo-qua-dong-loi', '--xuat-mat-khau', join(directory, 'mk2.csv')], env, { log() {} }), 1);
  assert.deepEqual(state.created.map(user => user.username), ['tot']);
});

test('sample and synthetic files are valid and the synthetic file has 50 clearly fake employees', async () => {
  const sample = readEmployees(await readFile(resolve(ROOT, 'config/doanh-nghiep/nhan-vien.mau.csv'), 'utf8'));
  assert.ok(sample.every(row => !row.errors.length));
  const synthetic = readEmployees(await readFile(resolve(ROOT, 'config/doanh-nghiep/nhan-vien.gia-lap-50.csv'), 'utf8'));
  assert.equal(synthetic.length, 50);
  assert.ok(synthetic.every(row => !row.errors.length && row.email.endsWith('@gia-lap.dxdesk.local')));
  const roles = role => synthetic.filter(row => row.role === role).length;
  assert.deepEqual([roles('Employee'), roles('Agent'), roles('Manager')], [40, 7, 3]);
  assert.ok(synthetic.filter(row => row.role === 'Agent').every(row => row.teams.length));
});
