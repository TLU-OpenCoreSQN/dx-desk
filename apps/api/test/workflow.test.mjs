// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W3-01/W3-02/W3-03 unit tests: ma trận chuyển trạng thái đầy đủ, vai trò từng cạnh,
// quy tắc Poka-yoke khi tạo ticket và công thức SLA thuần TS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRANSITIONS, ROLE_EDGES, TICKET_STATUSES, TERMINAL_STATUSES,
  edgeKey, legalEdges, validateTransition,
} from '../dist/state-machine.js';
import {
  activeRoles, checkRequirementFields, computeSlaDueAt, criticalViolation,
  effectiveSlaDeadline, initialStatusFor, isSlaBreached, parseRequirementFields,
} from '../dist/rules.js';
import { workflowExceptionForCode } from '../dist/controllers.js';
import { UpdateTicketStatus, CreateTicket } from '../dist/dto.js';
import { ValidationPipe } from '@nestjs/common';

const STAFF = ['Agent', 'Manager'];
const REQUESTER_ONLY_EDGE_KEYS = [
  'new->cancelled', 'triaged->cancelled', 'assigned->cancelled',
  'waiting_user->in_progress', 'waiting_user->cancelled', 'resolved->closed',
];

test('TRANSITIONS covers the 8-state contract graph exactly', () => {
  assert.deepEqual(TRANSITIONS, {
    new: ['triaged', 'cancelled', 'pending_approval'],
    triaged: ['assigned', 'cancelled'],
    assigned: ['in_progress', 'pending_approval', 'cancelled'],
    in_progress: ['waiting_user', 'resolved', 'pending_approval'],
    waiting_user: ['in_progress', 'cancelled'],
    pending_approval: ['assigned', 'new'],
    resolved: ['closed', 'in_progress'],
    closed: [],
    cancelled: [],
  });
  assert.deepEqual([...TERMINAL_STATUSES].sort(), ['cancelled', 'closed']);
});

test('every legal edge has a role rule and every role rule maps back to a legal edge', () => {
  const edges = new Set(legalEdges().map(([from, to]) => edgeKey(from, to)));
  assert.equal(edges.size, 17);
  for (const key of edges) assert.ok(ROLE_EDGES[key], `missing ROLE_EDGES entry for ${key}`);
  for (const key of Object.keys(ROLE_EDGES)) assert.ok(edges.has(key), `orphan ROLE_EDGES entry ${key}`);
  // Đồng bộ với bảng private.ticket_transitions trong migration 003 (17 cạnh).
  for (const [from, to] of legalEdges()) {
    const rule = ROLE_EDGES[edgeKey(from, to)];
    assert.ok(Array.isArray(rule.roles) && typeof rule.requesterAllowed === 'boolean');
    if (rule.roles.length === 0) assert.equal(rule.requesterAllowed, true, edgeKey(from, to));
  }
});

/** Cạnh trong DB là nguồn sự thật của Poka-yoke mức DB — so trực tiếp với máy trạng thái TS. */
function sqlEdges() {
  const sql = readFileSync(
    new URL('../../../db/migrations/003_ticket_workflow.sql', import.meta.url), 'utf8',
  );
  const start = sql.indexOf('INSERT INTO private.ticket_transitions');
  assert.notEqual(start, -1, 'migration 003 phải có khối INSERT INTO private.ticket_transitions');
  const block = sql.slice(start).split(/;\s*$/m)[0];
  return [...block.matchAll(/\('([a-z_]+)', '([a-z_]+)', (?:ARRAY\[([^\]]*)\]|'\{\}'), (true|false)\)/g)]
    .map(([, from, to, roles, requester]) => ({
      from, to,
      roles: roles ? [...roles.matchAll(/'([A-Za-z]+)'/g)].map(match => match[1]) : [],
      requesterAllowed: requester === 'true',
    }));
}

test('W3-09: bảng cạnh private.ticket_transitions trùng khớp máy trạng thái API 1:1', () => {
  const edges = sqlEdges();
  assert.equal(edges.length, 17, 'migration 003 khai báo đúng 17 cạnh');
  const byKey = new Map(edges.map(edge => [`${edge.from}->${edge.to}`, edge]));
  assert.equal(byKey.size, edges.length, 'không được khai báo trùng cạnh');
  const apiKeys = new Set(legalEdges().map(([from, to]) => edgeKey(from, to)));
  for (const [key, edge] of byKey) {
    assert.ok(apiKeys.has(key), `DB có cạnh ${key} nhưng API không có`);
    assert.deepEqual([...edge.roles].sort(), [...ROLE_EDGES[key].roles].sort(), `vai trò cạnh ${key}`);
    assert.equal(edge.requesterAllowed, ROLE_EDGES[key].requesterAllowed, `requester_allowed cạnh ${key}`);
  }
  for (const key of apiKeys) assert.ok(byKey.has(key), `API có cạnh ${key} nhưng DB thiếu`);
  for (const terminal of TERMINAL_STATUSES) {
    assert.equal([...byKey.keys()].filter(key => key.startsWith(`${terminal}->`)).length, 0,
      `${terminal} là trạng thái khép lại, DB không được mở cạnh ra`);
  }
});

test('full 9x9 transition matrix: legal edges pass with an authorized role, everything else is rejected', () => {
  for (const from of TICKET_STATUSES) {
    for (const to of TICKET_STATUSES) {
      const legal = TRANSITIONS[from].includes(to);
      const result = validateTransition(from, to, {
        roles: ['Manager'], isRequester: true, resolutionNote: 'Đã xử lý xong, kiểm tra lại hoạt động.',
      });
      if (legal) {
        // Manager + requester đi được mọi cạnh của đồ thị (pending_approval->new cần Manager).
        assert.equal(result.ok, true, `${from}->${to} should be legal`);
      } else {
        assert.equal(result.ok, false, `${from}->${to} should be illegal`);
        assert.ok(['terminal', 'already', 'no_edge', 'role', 'resolution_note', 'unknown_state'].includes(result.kind));
        assert.match(result.message, /[a-zà-ỹ]/i); // chuỗi tiếng Việt, không lộ SQL
        assert.doesNotMatch(result.message, /select|insert|update|constraint|ticket_/i);
      }
    }
  }
});

test('representative illegal transitions return 422 (outside machine) or 409 (terminal/already)', () => {
  const staff = { roles: ['Agent'], isRequester: false };
  const cases = [
    ['new', 'resolved', staff, 422, 'no_edge'],
    ['new', 'in_progress', staff, 422, 'no_edge'],
    ['new', 'closed', staff, 422, 'no_edge'],
    ['triaged', 'in_progress', staff, 422, 'no_edge'],
    ['triaged', 'resolved', staff, 422, 'no_edge'],
    ['in_progress', 'cancelled', staff, 422, 'no_edge'],
    ['in_progress', 'closed', staff, 422, 'no_edge'],
    ['waiting_user', 'resolved', staff, 422, 'no_edge'],
    ['pending_approval', 'resolved', staff, 422, 'no_edge'],
    ['resolved', 'cancelled', staff, 422, 'no_edge'],
    ['closed', 'new', staff, 409, 'terminal'],
    ['cancelled', 'new', staff, 409, 'terminal'],
    ['closed', 'in_progress', staff, 409, 'terminal'],
    ['new', 'new', staff, 409, 'already'],
    ['in_progress', 'in_progress', staff, 409, 'already'],
    ['bogus', 'new', staff, 422, 'unknown_state'],
    ['new', 'bogus', staff, 422, 'unknown_state'],
  ];
  for (const [from, to, ctx, status, kind] of cases) {
    const result = validateTransition(from, to, ctx);
    assert.equal(result.ok, false, `${from}->${to}`);
    assert.equal(result.status, status, `${from}->${to} status`);
    assert.equal(result.kind, kind, `${from}->${to} kind`);
  }
});

test('role enforcement per edge: Employee limited, Agent per contract, Manager = Agent + reject', () => {
  const employee = { roles: ['Employee'], isRequester: true };
  const stranger = { roles: ['Employee'], isRequester: false };
  const agent = { roles: ['Agent'], isRequester: false };
  const manager = { roles: ['Manager'], isRequester: false };
  const note = { resolutionNote: 'Hướng dẫn và kết quả xử lý đã gửi user.' };

  // Employee chỉ đi cạnh của mình (trên ticket của chính mình).
  for (const [from, to] of [
    ['new', 'cancelled'], ['waiting_user', 'in_progress'], ['waiting_user', 'cancelled'],
    ['resolved', 'closed'], ['triaged', 'cancelled'], ['assigned', 'cancelled'],
  ]) assert.equal(validateTransition(from, to, employee).ok, true, `Employee ${from}->${to}`);
  for (const [from, to] of [
    ['new', 'triaged'], ['triaged', 'assigned'], ['assigned', 'in_progress'],
    ['in_progress', 'waiting_user'], ['in_progress', 'resolved'], ['in_progress', 'pending_approval'],
    ['pending_approval', 'assigned'], ['pending_approval', 'new'], ['resolved', 'in_progress'],
  ]) {
    const result = validateTransition(from, to, { ...employee });
    assert.equal(result.ok, false, `Employee ${from}->${to} must fail`);
    assert.equal(result.status, 403, `Employee ${from}->${to} status`);
    assert.equal(result.kind, 'role');
  }
  // pending_approval: Employee không có cạnh nào — mọi lượt chuyển đều bị chặn (403 role,
  // vì cạnh tồn tại trong đồ thị nhưng không thuộc quyền của Employee).
  for (const to of ['assigned', 'new']) {
    const result = validateTransition('pending_approval', to, employee);
    assert.equal(result.ok, false);
    assert.equal(result.status, 403, `Employee pending_approval->${to} is a role violation`);
    assert.equal(result.kind, 'role');
  }
  // Requester Employee không được coi là staff cho cạnh staff-only.
  assert.equal(validateTransition('new', 'triaged', stranger).status, 403);

  // Agent đúng các cạnh được giao.
  for (const [from, to] of [
    ['new', 'triaged'], ['triaged', 'assigned'], ['assigned', 'in_progress'],
    ['in_progress', 'waiting_user'], ['in_progress', 'pending_approval'],
    ['waiting_user', 'in_progress'], ['pending_approval', 'assigned'],
    ['resolved', 'in_progress'],
  ]) assert.equal(validateTransition(from, to, { ...agent, resolutionNote: note.resolutionNote }).ok, true, `Agent ${from}->${to}`);
  // Agent KHÔNG được từ chối (pending_approval->new) — chỉ Manager.
  const reject = validateTransition('pending_approval', 'new', agent);
  assert.equal(reject.ok, false);
  assert.equal(reject.status, 403);
  assert.equal(reject.kind, 'role');

  // Manager = Agent + pending_approval->new.
  for (const key of legalEdges().map(([f, t]) => edgeKey(f, t))) {
    const [from, to] = key.split('->');
    const result = validateTransition(from, to, {
      roles: ['Manager'], isRequester: true, resolutionNote: 'Kết quả xử lý hoàn tất, đã xác nhận.',
    });
    assert.equal(result.ok, true, `Manager ${key}`);
  }
  assert.equal(validateTransition('pending_approval', 'new', manager).ok, true);
});

test('resolved->closed is requester-confirm only; staff non-requester cannot close', () => {
  const note = 'Đã xử lý xong, người dùng xác nhận hoạt động.';
  assert.equal(validateTransition('resolved', 'closed', { roles: ['Employee'], isRequester: true, resolutionNote: note }).ok, true);
  for (const roles of [['Agent'], ['Manager'], ['Agent', 'Manager']]) {
    const result = validateTransition('resolved', 'closed', { roles, isRequester: false });
    assert.equal(result.ok, false, `${roles} non-requester close`);
    assert.equal(result.status, 403);
    assert.equal(result.kind, 'role');
  }
  // Staff mà lại là requester của ticket thì xác nhận đóng được.
  assert.equal(validateTransition('resolved', 'closed', { roles: ['Agent'], isRequester: true }).ok, true);
});

test('transition to resolved requires resolution_note of 5..2000 characters (422 otherwise)', () => {
  const staff = { roles: ['Agent'], isRequester: false };
  for (const bad of [undefined, null, '', '    ', 'abcd', 'x'.repeat(2001)]) {
    const result = validateTransition('in_progress', 'resolved', { ...staff, resolutionNote: bad });
    assert.equal(result.ok, false, `note=${JSON.stringify(bad?.slice?.(0, 10))}`);
    assert.equal(result.status, 422);
    assert.equal(result.kind, 'resolution_note');
  }
  for (const good of ['xxxxx', 'ab'.repeat(500)]) {
    assert.equal(validateTransition('in_progress', 'resolved', { ...staff, resolutionNote: good }).ok, true);
  }
  // Các cạnh khác không cần note.
  assert.equal(validateTransition('in_progress', 'waiting_user', staff).ok, true);
});

test('multi-role tokens get the union of edge permissions and unknown roles are ignored', () => {
  const dual = { roles: ['Employee', 'Manager'], isRequester: false };
  assert.equal(validateTransition('pending_approval', 'new', dual).ok, true);
  assert.equal(validateTransition('new', 'triaged', { roles: ['Employee', 'hacker', 'Agent'], isRequester: false }).ok, true);
  const onlyUnknown = { roles: ['hacker'], isRequester: true };
  assert.equal(validateTransition('new', 'cancelled', onlyUnknown).ok, true); // requester path
  assert.equal(validateTransition('new', 'triaged', onlyUnknown).status, 403);
});

test('W3-02: critical priority is Manager-only with the contract Vietnamese message', () => {
  assert.equal(criticalViolation(['Manager'], 'critical'), null);
  assert.equal(criticalViolation(['Employee'], 'normal'), null);
  assert.equal(criticalViolation(['Employee'], 'critical'), 'Chỉ Manager mới được đặt độ ưu tiên Critical.');
  assert.equal(criticalViolation(['Agent'], 'critical'), 'Chỉ Manager mới được đặt độ ưu tiên Critical.');
  assert.equal(criticalViolation(['Agent', 'Manager'], 'critical'), null);
});

test('W3-02: access category by Employee starts pending_approval; staff and other categories start new', () => {
  assert.equal(initialStatusFor('access', ['Employee']), 'pending_approval');
  assert.equal(initialStatusFor('access', ['Agent']), 'new');
  assert.equal(initialStatusFor('access', ['Manager']), 'new');
  for (const code of ['vpn', 'account', 'software', 'hardware', 'system-error']) {
    assert.equal(initialStatusFor(code, ['Employee']), 'new');
  }
});

const accessFields = [
  { key: 'system_name', label: 'Tên hệ thống', required: true },
  { key: 'permission_level', label: 'Cấp quyền yêu cầu', required: true },
  { key: 'valid_until', label: 'Thời hạn sử dụng quyền', required: true },
];

test('W3-02: requirement_fields validation lists missing labels in Vietnamese and trims values', () => {
  const missing = checkRequirementFields(accessFields, { system_name: 'D-Office' });
  assert.equal(missing.ok, false);
  assert.equal(missing.kind, 'missing');
  assert.deepEqual(missing.labels, ['Cấp quyền yêu cầu', 'Thời hạn sử dụng quyền']);
  const none = checkRequirementFields(accessFields, undefined);
  assert.equal(none.ok, false);
  assert.deepEqual(none.labels, ['Tên hệ thống', 'Cấp quyền yêu cầu', 'Thời hạn sử dụng quyền']);
  const ok = checkRequirementFields(accessFields, {
    system_name: ' D-Office ', permission_level: 'Reader ', valid_until: '31/12/2026',
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.values, {
    system_name: 'D-Office', permission_level: 'Reader', valid_until: '31/12/2026',
  });
  assert.equal(checkRequirementFields(accessFields, {
    system_name: 'A', permission_level: 'B', valid_until: 'C', sneaky: 'D',
  }).kind, 'unknown');
  assert.equal(checkRequirementFields(accessFields, { system_name: '   ', permission_level: 'B', valid_until: 'C' }).kind, 'missing');
  assert.equal(checkRequirementFields(accessFields, { system_name: 42, permission_level: 'B', valid_until: 'C' }).kind, 'invalid');
  assert.equal(checkRequirementFields([], { other: 'x' }).kind, 'unknown');
  assert.equal(checkRequirementFields([], undefined).ok, true);
});

test('W3-02: malformed requirement_fields jsonb degrades safely (no crash, nothing required)', () => {
  assert.deepEqual(parseRequirementFields(null), []);
  assert.deepEqual(parseRequirementFields('string'), []);
  assert.deepEqual(parseRequirementFields([{ key: 'a', label: 42, required: 'yes' }]),
    [{ key: 'a', label: 'a', required: false }]);
  assert.equal(checkRequirementFields({ broken: true }, undefined).ok, true);
});

test('W3-03: SLA due date and paused-millisecond deadline math', () => {
  const created = new Date('2026-10-26T07:00:00Z');
  const policies = { low: 2880, normal: 1440, high: 480, critical: 120 };
  assert.deepEqual(Object.entries(policies).map(([p, m]) => computeSlaDueAt(created, m).toISOString()), [
    '2026-10-28T07:00:00.000Z', '2026-10-27T07:00:00.000Z',
    '2026-10-26T15:00:00.000Z', '2026-10-26T09:00:00.000Z',
  ]);
  const due = computeSlaDueAt(created, 480);
  assert.equal(effectiveSlaDeadline(due, 90_000).getTime(), due.getTime() + 90_000);
  assert.equal(isSlaBreached(due, 0, new Date('2026-10-26T14:59:59Z')), false);
  assert.equal(isSlaBreached(due, 0, new Date('2026-10-26T15:00:01Z')), true);
  // 2 phút chờ user (120000 ms tạm dừng) -> lùi ngưỡng vi phạm từ 15:00 sang 15:02.
  assert.equal(isSlaBreached(due, 120_000, new Date('2026-10-26T15:01:00Z')), false);
  assert.equal(isSlaBreached(due, 120_000, new Date('2026-10-26T15:02:00Z')), false);
  assert.equal(isSlaBreached(due, 120_000, new Date('2026-10-26T15:02:01Z')), true);
  const waiting = new Date('2026-10-26T14:59:00Z');
  const later = new Date('2026-10-26T16:00:00Z');
  assert.equal(isSlaBreached(due, 0, later, waiting), false, 'open waiting interval freezes remaining SLA');
  assert.equal(isSlaBreached(due, 0, later, new Date('2026-10-26T15:01:00Z')), true,
    'waiting after the deadline must not erase an existing breach');
});

test('workflow SQLSTATE 4500x from DB guard maps to curated Vietnamese errors, never raw SQL', () => {
  for (const [code, status] of [['45001', 422], ['45002', 403], ['45003', 422]]) {
    const mapped = workflowExceptionForCode(code);
    assert.equal(mapped.status, status);
    assert.ok(mapped.message.length >= 5);
    assert.doesNotMatch(mapped.message, /select|insert|update|constraint|private\.|ticket_/i);
  }
  assert.equal(workflowExceptionForCode('23505'), null);
  assert.equal(workflowExceptionForCode(undefined), null);
});

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = (type, value, kind = 'body') => pipe.transform(value, { type: kind, metatype: type });

test('DTO whitelist: PATCH status body accepts only to/note/resolution_note', async () => {
  const ok = await validate(UpdateTicketStatus, {
    to: 'resolved', note: ' Đã xác nhận ', resolution_note: '  Đã vá xong lỗi VPN trên client 5.0  ',
  });
  assert.equal(ok.to, 'resolved');
  assert.equal(ok.note, 'Đã xác nhận');
  assert.equal(ok.resolution_note, 'Đã vá xong lỗi VPN trên client 5.0');
  await assert.rejects(validate(UpdateTicketStatus, { to: 'resolved', status: 'closed' }));
  await assert.rejects(validate(UpdateTicketStatus, { to: 'done' }));
  await assert.rejects(validate(UpdateTicketStatus, {}));
  await assert.rejects(validate(UpdateTicketStatus, { to: 'new', resolution_note: 'abc' }));
  assert.equal((await validate(UpdateTicketStatus, { to: 'triaged' })).note, undefined);
  // CreateTicket vẫn chặn spoof các cột do hệ thống kiểm soát.
  const base = { category_id: '20000000-0000-4000-8000-000000000001', title: 'VPN lỗi', description: 'Chi tiết sự cố VPN dài đủ chuẩn.' };
  await assert.rejects(validate(CreateTicket, { ...base, requester_id: base.category_id }));
  await assert.rejects(validate(CreateTicket, { ...base, status: 'closed' }));
  const withFields = await validate(CreateTicket, { ...base, fields: { client_version: '5.0.7' } });
  assert.deepEqual(withFields.fields, { client_version: '5.0.7' });
});
