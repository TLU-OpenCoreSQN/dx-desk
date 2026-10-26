// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W3-01: máy trạng thái ticket 8 trạng thái (9 giá trị chữ thường, cancelled là trạng
// thái cuối). Đồng bộ 1:1 với bảng private.ticket_transitions trong migration 003;
// thêm cạnh ở một bên mà không bên kia sẽ làm integration test hỏng có chủ đích.

export const TICKET_STATUSES = [
  'new', 'triaged', 'assigned', 'in_progress', 'waiting_user',
  'pending_approval', 'resolved', 'closed', 'cancelled',
] as const;
export type TicketStatus = typeof TICKET_STATUSES[number];

export const TICKET_ROLES = ['Employee', 'Agent', 'Manager'] as const;
export type TicketRole = typeof TICKET_ROLES[number];

/** Các trạng thái khép lại: không đi tiếp cạnh nào. */
export const TERMINAL_STATUSES: readonly TicketStatus[] = ['closed', 'cancelled'];

/** Đồ thị chuyển tiếp hợp lệ (không tính vai trò/điều kiện cạnh). */
export const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ['triaged', 'cancelled', 'pending_approval'],
  triaged: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'pending_approval', 'cancelled'],
  in_progress: ['waiting_user', 'resolved', 'pending_approval'],
  waiting_user: ['in_progress', 'cancelled'],
  pending_approval: ['assigned', 'new'],
  resolved: ['closed', 'in_progress'],
  closed: [],
  cancelled: [],
};

/**
 * Điều kiện vai trò từng cạnh — encode tường minh theo hợp đồng tuần 3:
 *  - Employee (người tạo, requester_allowed): new→cancelled (tự ticket của mình),
 *    waiting_user→in_progress (trả lời), resolved→closed (xác nhận đóng),
 *    các nhánh cancelled nói chung; KHÔNG có cạnh nào từ pending_approval.
 *  - Agent: new→triaged, triaged→assigned, assigned→in_progress,
 *    in_progress→waiting_user/resolved, waiting_user→in_progress,
 *    pending_approval→assigned (duyệt).
 *  - Manager: mọi thứ Agent có + pending_approval→new (từ chối) + quyền priority critical.
 *  - pending_approval→assigned cho cả Agent và Manager; escalation →pending_approval
 *    là thao tác nghiệp vụ nên dành cho staff (Agent/Manager).
 */
export interface EdgeRule {
  /** Vai trò realm được phép chuyển (bất kể là requester). */
  roles: readonly TicketRole[];
  /** Người tạo ticket (requester_id = claims.sub) cũng được phép đi cạnh này. */
  requesterAllowed: boolean;
}
export const edgeKey = (from: TicketStatus, to: TicketStatus): string => `${from}->${to}`;

export const ROLE_EDGES: Record<string, EdgeRule> = Object.fromEntries(
  ([
    ['new', 'triaged', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
    ['new', 'cancelled', { roles: ['Agent', 'Manager'], requesterAllowed: true }],
    ['new', 'pending_approval', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
    ['triaged', 'assigned', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
    ['triaged', 'cancelled', { roles: ['Agent', 'Manager'], requesterAllowed: true }],
    ['assigned', 'in_progress', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
    ['assigned', 'pending_approval', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
    ['assigned', 'cancelled', { roles: ['Agent', 'Manager'], requesterAllowed: true }],
    ['in_progress', 'waiting_user', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
    ['in_progress', 'resolved', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
    ['in_progress', 'pending_approval', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
    ['waiting_user', 'in_progress', { roles: ['Agent', 'Manager'], requesterAllowed: true }],
    ['waiting_user', 'cancelled', { roles: ['Agent', 'Manager'], requesterAllowed: true }],
    ['pending_approval', 'assigned', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
    ['pending_approval', 'new', { roles: ['Manager'], requesterAllowed: false }],
    ['resolved', 'closed', { roles: [], requesterAllowed: true }],
    ['resolved', 'in_progress', { roles: ['Agent', 'Manager'], requesterAllowed: false }],
  ] as [TicketStatus, TicketStatus, EdgeRule][]).map(([from, to, rule]) => [edgeKey(from, to), rule]),
);

export interface TransitionContext {
  /** realm_access.roles của token (lọc theo Employee/Agent/Manager ở tầng auth). */
  roles: readonly string[];
  /** true khi claims.sub trùng tickets.requester_id. */
  isRequester: boolean;
  /** resolution_note (đã trim nhờ DTO) khi chuyển sang 'resolved'; bắt buộc 5..2000 ký tự. */
  resolutionNote?: string | null;
}

export type TransitionViolation =
  | { ok: false; kind: 'unknown_state'; status: 422; message: string }
  | { ok: false; kind: 'terminal'; status: 409; message: string }
  | { ok: false; kind: 'already'; status: 409; message: string }
  | { ok: false; kind: 'no_edge'; status: 422; message: string }
  | { ok: false; kind: 'role'; status: 403; message: string }
  | { ok: false; kind: 'resolution_note'; status: 422; message: string };
export type TransitionResult = { ok: true } | TransitionViolation;

export const RESOLUTION_NOTE_MIN = 5;
export const RESOLUTION_NOTE_MAX = 2000;

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value);
}

/**
 * Kiểm tra một lượt chuyển: máy trạng thái → vai trò theo cạnh → điều kiện resolution_note.
 * Thông báo tiếng Việt, không lộ chi tiết nội bộ/SQL.
 */
export function validateTransition(
  from: string,
  to: string,
  ctx: TransitionContext,
): TransitionResult {
  if (!isTicketStatus(from) || !isTicketStatus(to)) {
    return {
      ok: false, kind: 'unknown_state', status: 422,
      message: 'Trạng thái không thuộc quy trình xử lý yêu cầu.',
    };
  }
  if (from === to) {
    return {
      ok: false, kind: 'already', status: 409,
      message: 'Yêu cầu đã ở trạng thái này, không cần chuyển tiếp.',
    };
  }
  if (TERMINAL_STATUSES.includes(from)) {
    return {
      ok: false, kind: 'terminal', status: 409,
      message: 'Yêu cầu đã khép lại và không thể chuyển trạng thái.',
    };
  }
  if (!(TRANSITIONS[from] as readonly string[]).includes(to)) {
    return {
      ok: false, kind: 'no_edge', status: 422,
      message: 'Chuyển trạng thái không hợp lệ với quy trình xử lý yêu cầu.',
    };
  }
  const rule = ROLE_EDGES[edgeKey(from, to)];
  const actorRoles = ctx.roles.filter(r => (TICKET_ROLES as readonly string[]).includes(r)) as TicketRole[];
  const roleAllowed = rule.requesterAllowed && ctx.isRequester
    || actorRoles.some(r => rule.roles.includes(r));
  if (!roleAllowed) {
    return {
      ok: false, kind: 'role', status: 403,
      message: 'Vai trò của bạn không được phép chuyển yêu cầu sang trạng thái này.',
    };
  }
  if (to === 'resolved') {
    const note = (ctx.resolutionNote ?? '').trim();
    if (note.length < RESOLUTION_NOTE_MIN || note.length > RESOLUTION_NOTE_MAX) {
      return {
        ok: false, kind: 'resolution_note', status: 422,
        message: 'Cần ghi chú kết quả xử lý (5–2000 ký tự) trước khi đánh dấu yêu cầu đã xử lý.',
      };
    }
  }
  return { ok: true };
}

/** Máy trạng thái phía DB dùng bảng private.ticket_transitions; hàm này chỉ dùng cho đơn test đồng bộ. */
export function legalEdges(): [TicketStatus, TicketStatus][] {
  const edges: [TicketStatus, TicketStatus][] = [];
  for (const from of TICKET_STATUSES) {
    for (const to of TRANSITIONS[from]) edges.push([from, to]);
  }
  return edges;
}
