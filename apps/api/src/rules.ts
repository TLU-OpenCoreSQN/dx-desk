// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W3-02/W3-03: quy tắc Poka-yoke phía API khi tạo ticket + hàm SLA thuần TS.
// Phần lớn thông báo tiếng Việt; không lộ tên cột/SQL ra message.

import type { TicketRole, TicketStatus } from './state-machine';

export const ACCESS_CATEGORY_CODE = 'access';
export const STAFF_ROLES: readonly TicketRole[] = ['Agent', 'Manager'];

export const CRITICAL_ONLY_MANAGER_MESSAGE = 'Chỉ Manager mới được đặt độ ưu tiên Critical.';

/** Lọc realm_access.roles về các vai trò nghiệp vụ đã biết. */
export function activeRoles(roles: readonly string[]): TicketRole[] {
  return roles.filter(r => (['Employee', 'Agent', 'Manager'] as readonly string[]).includes(r)) as TicketRole[];
}

export function isStaff(roles: readonly string[]): boolean {
  return activeRoles(roles).some(r => STAFF_ROLES.includes(r));
}

/** Rule 2 (W3-02): priority=critical chỉ Manager. Trả về message lỗi hoặc null. */
export function criticalViolation(roles: readonly string[], priority?: string): string | null {
  return priority === 'critical' && !activeRoles(roles).includes('Manager')
    ? CRITICAL_ONLY_MANAGER_MESSAGE : null;
}

/** Rule 3 (W3-02): Employee tạo ticket loại 'access' phải vào hàng chờ phê duyệt. */
export function initialStatusFor(categoryCode: string, roles: readonly string[]): TicketStatus {
  if (categoryCode === ACCESS_CATEGORY_CODE && !isStaff(roles)) return 'pending_approval';
  return 'new';
}

export interface RequirementField {
  key: string;
  label: string;
  required: boolean;
}

/** Parse categories.requirement_fields (jsonb mảng {key,label,required}); phần tử hỏng bị bỏ qua an toàn. */
export function parseRequirementFields(value: unknown): RequirementField[] {
  if (!Array.isArray(value)) return [];
  const fields: RequirementField[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { key, label, required } = item as Record<string, unknown>;
    if (typeof key !== 'string' || !key) continue;
    fields.push({
      key,
      label: typeof label === 'string' && label ? label : key,
      required: required === true,
    });
  }
  return fields;
}

export type FieldCheck =
  | { ok: true; values: Record<string, string> }
  | { ok: false; kind: 'missing'; labels: string[] }
  | { ok: false; kind: 'unknown'; keys: string[] }
  | { ok: false; kind: 'invalid' };

/**
 * Rule 5 (W3-02): kiểm tra object `fields` gửi lên so với requirement_fields của danh mục.
 *  - Mọi entry required phải có giá trị chuỗi khác rỗng (sau trim, tối đa 500 ký tự).
 *  - Không nhận key ngoài danh mục khai báo.
 * Trả về values đã trim để lưu vào tickets.request_fields.
 */
export function checkRequirementFields(
  requirementFields: unknown,
  fields: Record<string, unknown> | undefined,
): FieldCheck {
  const specs = parseRequirementFields(requirementFields);
  const declared = new Map(specs.map(spec => [spec.key, spec]));
  const provided = fields ?? {};
  const unknownKeys = Object.keys(provided).filter(key => !declared.has(key));
  if (unknownKeys.length) return { ok: false, kind: 'unknown', keys: unknownKeys };
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(provided)) {
    if (typeof raw !== 'string' || Array.from(raw.trim()).length > 500) return { ok: false, kind: 'invalid' };
    const trimmed = raw.trim();
    if (trimmed) values[key] = trimmed; // giá trị rỗng được coi như "chưa điền"
  }
  const missingLabels = specs
    .filter(spec => spec.required && !(spec.key in values))
    .map(spec => spec.label);
  if (missingLabels.length) return { ok: false, kind: 'missing', labels: missingLabels };
  return { ok: true, values };
}

/**
 * W3-03 (phần thuần TS dùng cho client tính ngưỡng SLA; nguồn thật là trigger
 * private.compute_ticket_sla_due trong DB — cùng công thức created_at + resolution_minutes).
 */
export function computeSlaDueAt(createdAt: Date, resolutionMinutes: number): Date {
  return new Date(createdAt.getTime() + resolutionMinutes * 60_000);
}

/** Ngưỡng vi phạm SLA = sla_due_at + sla_paused_ms (milis). */
export function effectiveSlaDeadline(slaDueAt: Date, slaPausedMs: number): Date {
  return new Date(slaDueAt.getTime() + slaPausedMs);
}

/** Cờ vi phạm (W4-03 sẽ hiển thị; tuần 3 chỉ tính đúng công thức). */
export function isSlaBreached(
  slaDueAt: Date, slaPausedMs: number, now: Date = new Date(),
): boolean {
  return now.getTime() > effectiveSlaDeadline(slaDueAt, slaPausedMs).getTime();
}
