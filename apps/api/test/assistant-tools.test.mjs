// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AssistantToolsController, defaultRequiredFields } from '../dist/assistant-tools.js';
import { checkRequirementFields } from '../dist/rules.js';
import { DecideAiSuggestion, TicketAiSuggestionController } from '../dist/ticket-ai-suggestion.js';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = (type, value) => pipe.transform(value, { type: 'body', metatype: type });

const UUID_1 = '10000000-0000-4000-8000-000000000001';
const UUID_2 = '20000000-0000-4000-8000-000000000002';
const UUID_3 = '30000000-0000-4000-8000-000000000003';

test('defaultRequiredFields satisfies checkRequirementFields for all seeded category shapes', () => {
  const categories = {
    vpn: [
      { key: 'client_version', label: 'Phiên bản client VPN', required: true },
      { key: 'error_message', label: 'Dòng lỗi hiển thị', required: true },
      { key: 'device_os', label: 'Hệ điều hành', required: false },
    ],
    account: [
      { key: 'account_name', label: 'Tên tài khoản', required: true },
      { key: 'issue_type', label: 'Loại sự cố tài khoản', required: true },
    ],
    software: [
      { key: 'software_name', label: 'Tên phần mềm', required: true },
      { key: 'error_message', label: 'Dòng lỗi hiển thị', required: false },
    ],
    hardware: [
      { key: 'device_code', label: 'Mã thiết bị', required: true },
      { key: 'location', label: 'Vị trí làm việc', required: true },
    ],
    access: [
      { key: 'system_name', label: 'Tên hệ thống', required: true },
      { key: 'permission_level', label: 'Cấp quyền yêu cầu', required: true },
      { key: 'valid_until', label: 'Thời hạn sử dụng quyền', required: true },
    ],
    'system-error': [
      { key: 'system_name', label: 'Tên hệ thống', required: true },
      { key: 'error_message', label: 'Dòng lỗi hiển thị', required: true },
      { key: 'occurred_at', label: 'Thời điểm xảy ra', required: false },
    ],
  };
  const description = 'Mô tả sự cố chi tiết từ người dùng qua trợ lý.';
  for (const [code, specs] of Object.entries(categories)) {
    const fields = defaultRequiredFields(specs, description);
    const check = checkRequirementFields(specs, fields);
    assert.equal(check.ok, true, `category ${code} must pass checkRequirementFields`);
  }
});

test('AssistantToolsController.write creates tickets for non-vpn categories with required fields', async t => {
  const prevKey = process.env.ASSISTANT_ACTION_KEY;
  process.env.ASSISTANT_ACTION_KEY = '0123456789abcdef0123456789abcdef';
  t.after(() => {
    if (prevKey === undefined) delete process.env.ASSISTANT_ACTION_KEY;
    else process.env.ASSISTANT_ACTION_KEY = prevKey;
  });

  const args = { category: 'account', title: 'Không đăng nhập được', description: 'Tài khoản bị khóa sau khi đổi mật khẩu.' };
  const canonical = Object.fromEntries(Object.entries(args).sort(([a], [b]) => a.localeCompare(b)));
  const proof = createHmac('sha256', process.env.ASSISTANT_ACTION_KEY)
    .update(JSON.stringify([UUID_1, 'create_ticket', UUID_2, canonical]))
    .digest('hex');

  const queries = [];
  const reqFields = [
    { key: 'account_name', label: 'Tên tài khoản', required: true },
    { key: 'issue_type', label: 'Loại sự cố tài khoản', required: true },
  ];
  const fakeDb = {
    asUser: async (_claims, op) => op({
      query: async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('INSERT INTO private.assistant_actions')) return { rowCount: 1, rows: [{ id: UUID_2 }] };
        if (sql.includes('FROM public.categories WHERE code=$1')) return { rows: [{ id: UUID_3, requirement_fields: reqFields }] };
        if (sql.includes('FROM public.categories WHERE id = $1')) return { rows: [{ code: 'account', requirement_fields: reqFields }] };
        if (sql.includes('INSERT INTO public.tickets')) return { rows: [{ id: UUID_3 }] };
        if (sql.includes('FROM public.tickets t WHERE t.id=$1')) return { rows: [{ id: UUID_3, status: 'new' }] };
        return { rowCount: 1, rows: [] };
      },
    }),
  };

  const controller = new AssistantToolsController(fakeDb);
  const res = await controller.write(
    { claims: { sub: UUID_1, role: 'authenticated', realm_access: { roles: ['Employee'] } } },
    'create_ticket',
    UUID_2,
    proof,
    args,
  );
  assert.deepEqual(res, { id: UUID_2, ticket_id: UUID_3 });
  const insertTicket = queries.find(q => q.sql.includes('INSERT INTO public.tickets'));
  assert.ok(insertTicket);
  assert.deepEqual(JSON.parse(insertTicket.params[5]), {
    account_name: 'Chưa cung cấp',
    issue_type: 'Chưa cung cấp',
  });
});

test('AssistantToolsController.statistics filters active categories and returns week_start in fallback', async () => {
  const queries = [];
  const fakeDb = {
    asUser: async (_claims, op) => op({
      query: async (sql, params) => {
        queries.push({ sql, params });
        return { rows: [] };
      },
    }),
  };
  const controller = new AssistantToolsController(fakeDb);
  const res = await controller.statistics(
    { claims: { sub: UUID_1, role: 'authenticated', realm_access: { roles: ['Agent'] } } },
    { category: 'vpn' },
  );
  assert.match(queries[0].sql, /WHERE c\.code=\$1 AND c\.active\b/);
  assert.deepEqual(res, { category: 'vpn', week_start: null, current_week: 0, previous_week: 0 });
});

test('DecideAiSuggestion DTO and controller validate accept and ignore payloads', async () => {
  const accepted = await validate(DecideAiSuggestion, {
    id: UUID_1,
    action: 'accept',
    values: { category_id: UUID_2, team_id: UUID_3, priority: 'high', summary: '  Tóm tắt đã duyệt  ' },
  });
  assert.equal(accepted.values.summary, 'Tóm tắt đã duyệt');

  const ignored = await validate(DecideAiSuggestion, { id: UUID_1, action: 'ignore' });
  assert.equal(ignored.action, 'ignore');

  await assert.rejects(validate(DecideAiSuggestion, { id: UUID_1, action: 'accept' }));
  await assert.rejects(validate(DecideAiSuggestion, {
    id: UUID_1, action: 'accept',
    values: { category_id: UUID_2, team_id: UUID_3, priority: 'critical', summary: 'ok' },
  }));
  await assert.rejects(validate(DecideAiSuggestion, {
    id: UUID_1, action: 'accept', extra: 1,
    values: { category_id: UUID_2, team_id: UUID_3, priority: 'normal', summary: 'ok' },
  }));
  await assert.rejects(validate(DecideAiSuggestion, {
    id: UUID_1, action: 'accept',
    values: { category_id: UUID_2, team_id: UUID_3, priority: 'normal', summary: '   ' },
  }));

  const controller = new TicketAiSuggestionController({ asUser: async () => {} });
  await assert.rejects(
    controller.decide(
      { claims: { sub: UUID_1, role: 'authenticated', realm_access: { roles: ['Agent'] } } },
      UUID_2,
      { id: UUID_1, action: 'ignore', values: { category_id: UUID_2, team_id: UUID_3, priority: 'normal', summary: 'x' } },
    ),
    BadRequestException,
  );
});
