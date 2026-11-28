// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import type { Category } from '../types/api';

/**
 * Nhãn tiếng Việt dự phòng cho khóa trường bổ sung, khớp dữ liệu mẫu của migration và
 * config/doanh-nghiep. Danh mục có khai báo `requirement_fields[].label` thì nhãn đó luôn thắng.
 * Không bao giờ hiển thị khóa kỹ thuật snake_case cho người dùng.
 */
const FALLBACK_LABELS: Record<string, string> = {
  account_name: 'Tên tài khoản',
  client_version: 'Phiên bản client VPN',
  device_code: 'Mã thiết bị',
  device_os: 'Hệ điều hành',
  error_message: 'Dòng lỗi hiển thị',
  issue_type: 'Loại sự cố tài khoản',
  location: 'Vị trí làm việc',
  occurred_at: 'Thời điểm xảy ra',
  permission_level: 'Cấp quyền yêu cầu',
  software_name: 'Tên phần mềm',
  system_name: 'Tên hệ thống',
  valid_until: 'Thời hạn sử dụng quyền',
};

export interface RequestFieldEntry {
  key: string;
  label: string;
  value: string;
}

export function requestFieldLabel(key: string, category?: Category | null): string {
  return category?.requirement_fields?.find((field) => field.key === key)?.label
    || FALLBACK_LABELS[key]
    || 'Thông tin bổ sung';
}

/** Các trường văn bản/số của phiếu, theo thứ tự khai báo của danh mục rồi tới phần còn lại. */
export function requestFieldEntries(
  fields: Record<string, unknown> | null | undefined,
  category?: Category | null,
): RequestFieldEntry[] {
  if (!fields) return [];
  const order = new Map((category?.requirement_fields ?? []).map((field, index) => [field.key, index]));
  return Object.entries(fields)
    .filter(([, value]) => (typeof value === 'string' && value.trim() !== '') || typeof value === 'number')
    .sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
    .map(([key, value]) => ({ key, label: requestFieldLabel(key, category), value: String(value) }));
}
