// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Quy tắc hiển thị của ứng dụng 2. PostgreSQL (migration 018) vẫn là nơi quyết định duy nhất:
// các hàm ở đây chỉ chọn nút nào nên hiện, không thay cho RLS hay hàm chuyển trạng thái.

export type DeviceType = 'laptop' | 'monitor' | 'keyboard' | 'mouse' | 'other';
export type DeviceStatus = 'pending' | 'approved' | 'rejected' | 'preparing' | 'handed_over';

export interface DeviceRequest {
  id: string;
  requester_id: string;
  device_type: DeviceType;
  reason: string;
  quantity: number;
  status: DeviceStatus;
  department: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  prepared_at: string | null;
  handed_over_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface DeviceRequestEvent {
  id: string;
  request_id: string;
  actor_id: string;
  actor_type: 'user' | 'system' | 'ai';
  actor_name: string;
  from_status: DeviceStatus | null;
  to_status: DeviceStatus;
  note: string | null;
  created_at: string;
}
export interface CurrentUser {
  id: string;
  name: string;
  department: string | null;
  roles: string[];
}
export interface NewRequest {
  device_type: DeviceType;
  reason: string;
  quantity: number;
}

export const DEVICE_LABELS: Record<DeviceType, string> = {
  laptop: 'Máy tính xách tay', monitor: 'Màn hình', keyboard: 'Bàn phím', mouse: 'Chuột', other: 'Thiết bị khác',
};
export const STATUS_LABELS: Record<DeviceStatus, string> = {
  pending: 'Chờ quản lý duyệt', approved: 'Đã duyệt, chờ IT', rejected: 'Không được duyệt',
  preparing: 'IT đang chuẩn bị', handed_over: 'Đã bàn giao',
};
/** Thứ tự bước trên thanh tiến trình; `rejected` rẽ nhánh sau bước đầu. */
export const STEPS: DeviceStatus[] = ['pending', 'approved', 'preparing', 'handed_over'];

export type Action = { to: DeviceStatus; label: string; needsNote?: boolean };

/** Nút thao tác cho một đề nghị, theo đúng bảng chuyển trạng thái của migration 018. */
export function actionsFor(request: DeviceRequest, user: CurrentUser): Action[] {
  if (request.status === 'pending') {
    const directManager = user.roles.includes('Manager') && !!user.department
      && user.department === request.department && request.requester_id !== user.id;
    return directManager ? [{ to: 'approved', label: 'Duyệt' }, { to: 'rejected', label: 'Từ chối', needsNote: true }] : [];
  }
  if (!user.roles.includes('Agent')) return [];
  if (request.status === 'approved') return [{ to: 'preparing', label: 'Bắt đầu chuẩn bị' }];
  if (request.status === 'preparing') return [{ to: 'handed_over', label: 'Xác nhận đã bàn giao' }];
  return [];
}

/** Trùng ràng buộc CHECK của bảng: lý do 10–2000 ký tự sau khi cắt khoảng trắng, số lượng 1–10. */
export function validateRequest(input: { device_type: string; reason: string; quantity: number }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!(input.device_type in DEVICE_LABELS)) errors.device_type = 'Chọn loại thiết bị.';
  const reason = input.reason.trim();
  if (reason.length < 10) errors.reason = 'Lý do cần ít nhất 10 ký tự.';
  else if (reason.length > 2000) errors.reason = 'Lý do tối đa 2000 ký tự.';
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) errors.quantity = 'Số lượng từ 1 đến 10.';
  return errors;
}
export function validateNote(note: string): string | null {
  const length = note.trim().length;
  return length < 5 ? 'Lý do từ chối cần ít nhất 5 ký tự.' : length > 2000 ? 'Lý do tối đa 2000 ký tự.' : null;
}

const ERRORS: Record<string, string> = {
  '45011': 'Đề nghị đã chuyển sang bước khác. Tải lại danh sách để xem trạng thái mới.',
  '45012': 'Chỉ quản lý trực tiếp hoặc bộ phận IT được thực hiện bước này.',
  '45013': 'Cần ghi lý do từ chối (5–2000 ký tự).',
  '45014': 'Tài khoản chưa được gán đơn vị nên chưa gửi được đề nghị. Liên hệ quản trị hệ thống.',
  '42501': 'Bạn không có quyền thực hiện thao tác này.',
};
/** Thông báo cố định theo mã lỗi; không hiển thị nội dung lỗi thô của PostgREST/PostgreSQL. */
export function errorMessage(status: number, code?: string): string {
  if (code && ERRORS[code]) return ERRORS[code];
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return ERRORS['42501'];
  if (status === 404) return 'Không tìm thấy đề nghị hoặc bạn không còn quyền xem.';
  if (status === 429) return 'Thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
  if (status >= 400 && status < 500) return 'Dữ liệu không hợp lệ. Kiểm tra lại các trường.';
  return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
}

export function formatTime(value: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
/** W5-03: API trả 409 (chưa bàn giao) hoặc 503 (kho tệp chưa sẵn sàng) khi chưa có biên bản. */
export const HANDOVER_UNAVAILABLE = 'Chưa tạo được biên bản bàn giao. Vui lòng thử lại sau ít phút.';
