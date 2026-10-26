// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { ComponentType } from 'react';
import {
  Archive,
  CheckCircle2,
  Inbox,
  MessageSquare,
  ShieldQuestion,
  Tags,
  UserCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import { TicketPriority, UserRole } from '../types/api';

export type StatusIcon = ComponentType<{ className?: string }>;

export type TicketStatus =
  | 'new'
  | 'triaged'
  | 'assigned'
  | 'in_progress'
  | 'waiting_user'
  | 'pending_approval'
  | 'resolved'
  | 'closed'
  | 'cancelled';

export const TICKET_STATUSES: TicketStatus[] = [
  'new',
  'triaged',
  'assigned',
  'in_progress',
  'waiting_user',
  'pending_approval',
  'resolved',
  'closed',
  'cancelled',
];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'Mới tạo',
  triaged: 'Đã phân loại',
  assigned: 'Đã phân công',
  in_progress: 'Đang xử lý',
  waiting_user: 'Chờ phản hồi',
  pending_approval: 'Chờ phê duyệt',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
};

export const STATUS_ICONS: Record<TicketStatus, StatusIcon> = {
  new: Inbox,
  triaged: Tags,
  assigned: UserCheck,
  in_progress: Wrench,
  waiting_user: MessageSquare,
  pending_approval: ShieldQuestion,
  resolved: CheckCircle2,
  closed: Archive,
  cancelled: XCircle,
};

export const STATUS_TONES: Record<TicketStatus, { badge: string; timeline: string }> = {
  new: { badge: 'bg-cyan-100 text-cyan-800 border-cyan-200', timeline: 'bg-cyan-100 text-cyan-700' },
  triaged: { badge: 'bg-slate-100 text-slate-700 border-slate-200', timeline: 'bg-slate-100 text-slate-600' },
  assigned: { badge: 'bg-slate-100 text-slate-700 border-slate-200', timeline: 'bg-slate-100 text-slate-600' },
  in_progress: { badge: 'bg-blue-100 text-blue-800 border-blue-200', timeline: 'bg-blue-100 text-blue-700' },
  waiting_user: { badge: 'bg-amber-100 text-amber-800 border-amber-200', timeline: 'bg-amber-100 text-amber-700' },
  pending_approval: { badge: 'bg-violet-100 text-violet-800 border-violet-200', timeline: 'bg-violet-100 text-violet-700' },
  resolved: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', timeline: 'bg-emerald-100 text-emerald-700' },
  closed: { badge: 'bg-slate-100 text-slate-700 border-slate-200', timeline: 'bg-slate-200 text-slate-600' },
  cancelled: { badge: 'bg-slate-100 text-slate-700 border-slate-200', timeline: 'bg-rose-100 text-rose-700' },
};

/** Đồ thị chuyển tiếp hợp lệ (máy trạng thái), độc lập với vai trò. */
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
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

export interface TransitionEdge {
  from: TicketStatus;
  to: TicketStatus;
  label: string;
  roles: UserRole[];
  requesterOnly?: boolean;
  resolutionNoteRequired?: boolean;
  hint?: string;
}

/** Cạnh được hiển thị theo vai trò — tập con của STATUS_TRANSITIONS (hợp đồng tuần 3). */
export const TRANSITION_EDGES: TransitionEdge[] = [
  { from: 'new', to: 'triaged', label: 'Phân loại phiếu', roles: ['Agent', 'Manager'] },
  { from: 'new', to: 'cancelled', label: 'Hủy phiếu', roles: ['Employee'], requesterOnly: true },
  { from: 'triaged', to: 'assigned', label: 'Phân công xử lý', roles: ['Agent', 'Manager'] },
  { from: 'assigned', to: 'in_progress', label: 'Bắt đầu xử lý', roles: ['Agent', 'Manager'] },
  { from: 'assigned', to: 'cancelled', label: 'Hủy phiếu', roles: ['Employee'], requesterOnly: true },
  {
    from: 'in_progress',
    to: 'waiting_user',
    label: 'Chờ người dùng phản hồi',
    roles: ['Agent', 'Manager'],
    hint: 'Ghi rõ bạn cần người tạo phiếu bổ sung thông tin gì.',
  },
  {
    from: 'in_progress',
    to: 'resolved',
    label: 'Đánh dấu đã giải quyết',
    roles: ['Agent', 'Manager'],
    resolutionNoteRequired: true,
  },
  {
    from: 'waiting_user',
    to: 'in_progress',
    label: 'Phản hồi, tiếp tục xử lý',
    roles: ['Employee'],
    requesterOnly: true,
  },
  { from: 'waiting_user', to: 'in_progress', label: 'Tiếp tục xử lý', roles: ['Agent', 'Manager'] },
  {
    from: 'pending_approval',
    to: 'assigned',
    label: 'Duyệt và chuyển vào xử lý',
    roles: ['Agent', 'Manager'],
  },
  {
    from: 'pending_approval',
    to: 'new',
    label: 'Từ chối yêu cầu',
    roles: ['Manager'],
    hint: 'Nêu lý do từ chối để người tạo phiếu nắm rõ.',
  },
  {
    from: 'resolved',
    to: 'closed',
    label: 'Xác nhận đã hài lòng, đóng phiếu',
    roles: ['Employee'],
    requesterOnly: true,
  },
];

export const RESOLUTION_NOTE_MIN = 5;
export const RESOLUTION_NOTE_MAX = 2000;

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as string[]).includes(value);
}

export function statusLabel(status: string): string {
  return isTicketStatus(status) ? STATUS_LABELS[status] : status;
}

export function isTransitionAllowed(from: string, to: string): boolean {
  return isTicketStatus(from) && isTicketStatus(to) && STATUS_TRANSITIONS[from].includes(to);
}

export function getAllowedTransitions(
  status: string,
  roles: UserRole[],
  context: { isRequester?: boolean } = {}
): TransitionEdge[] {
  if (!isTicketStatus(status)) return [];
  const actions: TransitionEdge[] = [];
  for (const edge of TRANSITION_EDGES) {
    if (edge.from !== status) continue;
    if (!edge.roles.some((role) => roles.includes(role))) continue;
    if (edge.requesterOnly && context.isRequester !== true) continue;
    if (actions.some((a) => a.to === edge.to)) continue;
    actions.push(edge);
  }
  return actions;
}

export function canChoosePriority(priority: TicketPriority, roles: UserRole[]): boolean {
  return priority !== 'critical' || roles.includes('Manager');
}

export function validateResolutionNote(value: string): string | null {
  const length = value.trim().length;
  if (length < RESOLUTION_NOTE_MIN) {
    return `Mô tả cách giải quyết quá ngắn (tối thiểu ${RESOLUTION_NOTE_MIN} ký tự, hiện tại: ${length}).`;
  }
  if (length > RESOLUTION_NOTE_MAX) {
    return `Mô tả cách giải quyết quá dài (tối đa ${RESOLUTION_NOTE_MAX} ký tự, hiện tại: ${length}).`;
  }
  return null;
}
