// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Clock,
  Info,
  ShieldCheck,
  User,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { TicketPriority, UserRole } from '../../types/api';
import {
  isTicketStatus,
  STATUS_ICONS,
  STATUS_LABELS,
  TicketStatus,
} from '../../lib/ticketWorkflow';

/*
 * Lozenge: nhãn định tính (trạng thái, ưu tiên, vai trò). Luôn một dòng, bo 4px,
 * icon 14px + nhãn tiếng Việt trên nền -bg, viền -border (Atlassian Lozenge / Carbon).
 * Số đếm (tab hàng đợi, bộ đếm) dùng CountBadge, không dùng Lozenge.
 */
export type LozengeTone = 'info' | 'success' | 'warning' | 'danger' | 'pending' | 'neutral';

const TONE_STYLES: Record<LozengeTone, string> = {
  info: 'bg-status-info-bg text-status-info border-status-info-border',
  success: 'bg-status-success-bg text-status-success border-status-success-border',
  warning: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  danger: 'bg-status-danger-bg text-status-danger border-status-danger-border',
  pending: 'bg-status-pending-bg text-status-pending border-status-pending-border',
  neutral: 'bg-status-neutral-bg text-status-neutral border-status-neutral-border',
};

interface LozengeProps {
  tone: LozengeTone;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}

export const Lozenge: React.FC<LozengeProps> = ({ tone, icon: Icon, children, className = '' }) => (
  <span
    className={`inline-flex shrink-0 items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded-sm border text-xs font-medium leading-4 ${TONE_STYLES[tone]} ${className}`}
  >
    {Icon && (
      <span aria-hidden="true" className="inline-flex shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </span>
    )}
    {children}
  </span>
);

/** Bộ đếm số thuần: pill trung tính, chữ số cùng độ rộng. */
export const CountBadge: React.FC<{ value: number; active?: boolean; className?: string }> = ({
  value,
  active = false,
  className = '',
}) => (
  <span
    data-numeric
    className={`inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium leading-4 tabular-nums ${
      active ? 'bg-primary-tint text-primary-text' : 'bg-surface-muted text-content-muted'
    } ${className}`}
  >
    {value}
  </span>
);

interface PriorityBadgeProps {
  priority: TicketPriority | string;
}

const PRIORITY: Record<string, { tone: LozengeTone; icon: LucideIcon; label: string }> = {
  critical: { tone: 'danger', icon: AlertOctagon, label: 'Khẩn cấp' },
  high: { tone: 'warning', icon: AlertTriangle, label: 'Cao' },
  normal: { tone: 'info', icon: Info, label: 'Bình thường' },
  low: { tone: 'neutral', icon: ArrowDown, label: 'Thấp' },
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const config = PRIORITY[priority];
  if (!config) return <Lozenge tone="neutral">{priority}</Lozenge>;
  return (
    <Lozenge tone={config.tone} icon={config.icon}>
      {config.label}
    </Lozenge>
  );
};

interface StatusBadgeProps {
  status: string;
}

const TICKET_STATUS_TONES: Record<TicketStatus, LozengeTone> = {
  new: 'info',
  triaged: 'neutral',
  assigned: 'neutral',
  in_progress: 'info',
  waiting_user: 'warning',
  pending_approval: 'pending',
  resolved: 'success',
  closed: 'neutral',
  cancelled: 'neutral',
};

// Trạng thái đề nghị cấp thiết bị (module devices).
const DEVICE_STATUS: Record<string, { tone: LozengeTone; icon: LucideIcon; label: string }> = {
  pending: { tone: 'warning', icon: Clock, label: 'Chờ xử lý' },
  open: { tone: 'info', icon: Wrench, label: 'Đang xử lý' },
  approved: { tone: 'success', icon: CheckCircle2, label: 'Đã duyệt' },
  rejected: { tone: 'danger', icon: XCircle, label: 'Từ chối' },
  preparing: { tone: 'info', icon: Wrench, label: 'IT đang chuẩn bị' },
  handed_over: { tone: 'success', icon: CheckCircle2, label: 'Đã bàn giao' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const key = status.toLowerCase();

  if (isTicketStatus(key)) {
    return (
      <Lozenge tone={TICKET_STATUS_TONES[key]} icon={STATUS_ICONS[key]}>
        {STATUS_LABELS[key]}
      </Lozenge>
    );
  }

  const device = DEVICE_STATUS[key];
  if (device) {
    return (
      <Lozenge tone={device.tone} icon={device.icon}>
        {device.label}
      </Lozenge>
    );
  }
  return <Lozenge tone="neutral">{status}</Lozenge>;
};

interface RoleBadgeProps {
  role: UserRole | string;
}

export const ROLE_LABELS: Record<string, string> = {
  Manager: 'Quản lý',
  Agent: 'Kỹ thuật viên',
  Employee: 'Nhân viên',
};

const ROLE_ICONS: Record<string, LucideIcon> = {
  Manager: ShieldCheck,
  Agent: Wrench,
  Employee: User,
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => (
  <Lozenge tone="neutral" icon={ROLE_ICONS[role]}>
    {ROLE_LABELS[role] ?? role}
  </Lozenge>
);
