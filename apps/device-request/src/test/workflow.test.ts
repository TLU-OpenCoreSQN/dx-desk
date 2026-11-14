// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { actionsFor, errorMessage, validateNote, validateRequest, type CurrentUser, type DeviceRequest } from '../workflow';

const request = (patch: Partial<DeviceRequest> = {}): DeviceRequest => ({
  id: '11111111-0000-4000-8000-000000000001', requester_id: 'employee', device_type: 'monitor', reason: 'Màn hình bị sọc ngang',
  quantity: 1, status: 'pending', department: 'phong-hanh-chinh', decided_by: null, decided_at: null, decision_note: null,
  prepared_at: null, handed_over_at: null, created_at: '2026-11-12T02:00:00Z', updated_at: '2026-11-12T02:00:00Z', ...patch,
});
const user = (roles: string[], department: string | null = 'phong-hanh-chinh', id = 'someone'): CurrentUser =>
  ({ id, name: id, department, roles });
const targets = (row: DeviceRequest, who: CurrentUser) => actionsFor(row, who).map(action => action.to);

describe('actionsFor mirrors the transition table of migration 018', () => {
  it('offers approve/reject only to a Manager of the same unit who is not the requester', () => {
    expect(targets(request(), user(['Manager']))).toEqual(['approved', 'rejected']);
    expect(actionsFor(request(), user(['Manager']))[1].needsNote).toBe(true);
    expect(targets(request(), user(['Manager'], 'phong-ke-toan'))).toEqual([]);
    expect(targets(request(), user(['Manager'], null))).toEqual([]);
    expect(targets(request({ requester_id: 'boss' }), user(['Manager'], 'phong-hanh-chinh', 'boss'))).toEqual([]);
    expect(targets(request(), user(['Employee']))).toEqual([]);
    expect(targets(request(), user(['Agent']))).toEqual([]);
  });
  it('lets IT prepare then hand over, one step at a time, and nobody act on finished requests', () => {
    expect(targets(request({ status: 'approved' }), user(['Agent'], 'phong-cntt'))).toEqual(['preparing']);
    expect(targets(request({ status: 'preparing' }), user(['Agent'], 'phong-cntt'))).toEqual(['handed_over']);
    expect(targets(request({ status: 'approved' }), user(['Manager']))).toEqual([]);
    for (const status of ['handed_over', 'rejected'] as const) {
      expect(targets(request({ status }), user(['Agent', 'Manager']))).toEqual([]);
    }
  });
});

describe('validation matches the table CHECK constraints', () => {
  it('requires a known device, a 10–2000 character reason and a quantity of 1–10', () => {
    expect(validateRequest({ device_type: 'monitor', reason: 'Màn hình bị sọc ngang', quantity: 2 })).toEqual({});
    expect(validateRequest({ device_type: 'phone', reason: '   ngắn   ', quantity: 0 })).toEqual({
      device_type: 'Chọn loại thiết bị.', reason: 'Lý do cần ít nhất 10 ký tự.', quantity: 'Số lượng từ 1 đến 10.' });
    expect(validateRequest({ device_type: 'mouse', reason: 'x'.repeat(2001), quantity: 11 })).toHaveProperty('reason');
    expect(validateRequest({ device_type: 'mouse', reason: 'Chuột hỏng nút trái', quantity: 1.5 })).toHaveProperty('quantity');
    expect(validateRequest({ device_type: 'mouse', reason: 'Chuột hỏng nút trái', quantity: Number.NaN })).toHaveProperty('quantity');
  });
  it('requires a rejection reason of 5–2000 characters', () => {
    expect(validateNote('  ok ')).toMatch(/ít nhất 5/);
    expect(validateNote('Đã có trong kho')).toBeNull();
    expect(validateNote('x'.repeat(2001))).toMatch(/2000/);
  });
});

describe('errorMessage never shows raw database text', () => {
  it('maps workflow codes and HTTP statuses to fixed Vietnamese messages', () => {
    expect(errorMessage(400, '45012')).toMatch(/quản lý trực tiếp/);
    expect(errorMessage(400, '45014')).toMatch(/chưa được gán đơn vị/);
    expect(errorMessage(400, '45011')).toMatch(/bước khác/);
    expect(errorMessage(404)).toMatch(/Không tìm thấy/);
    expect(errorMessage(401)).toMatch(/đăng nhập lại/);
    expect(errorMessage(400, '23514')).toBe('Dữ liệu không hợp lệ. Kiểm tra lại các trường.');
    expect(errorMessage(0)).toBe('Không thể xử lý yêu cầu. Vui lòng thử lại.');
    expect(errorMessage(500, 'XX000')).toBe('Không thể xử lý yêu cầu. Vui lòng thử lại.');
  });
});
