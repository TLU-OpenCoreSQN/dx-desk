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
} from 'lucide-react';
import { TicketPriority, UserRole } from '../../types/api';
import {
  isTicketStatus,
  STATUS_ICONS,
  STATUS_LABELS,
  TicketStatus,
} from '../../lib/ticketWorkflow';

interface PriorityBadgeProps {
  priority: TicketPriority | string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  switch (priority) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-semibold bg-status-danger-bg text-status-danger border border-status-danger-border shadow-2xs">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Khẩn cấp
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-status-warning-bg text-status-warning border border-status-warning-border shadow-2xs">
          <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
          Cao
        </span>
      );
    case 'normal':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-status-info-bg text-status-info border border-status-info-border shadow-2xs">
          <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
          Bình thường
        </span>
      );
    case 'low':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-status-neutral-bg text-status-neutral border border-status-neutral-border shadow-2xs">
          <ArrowDown className="w-3 h-3 shrink-0" aria-hidden="true" />
          Thấp
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-status-neutral-bg text-status-neutral border border-status-neutral-border shadow-2xs">
          {priority}
        </span>
      );
  }
};

interface StatusBadgeProps {
  status: string;
}

const TICKET_STATUS_STYLES: Record<TicketStatus, string> = {
  new: 'bg-status-info-bg text-status-info border-status-info-border',
  triaged: 'bg-status-neutral-bg text-status-neutral border-status-neutral-border',
  assigned: 'bg-status-neutral-bg text-status-neutral border-status-neutral-border',
  in_progress: 'bg-status-info-bg text-status-info border-status-info-border',
  waiting_user: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  pending_approval: 'bg-status-pending-bg text-status-pending border-status-pending-border',
  resolved: 'bg-status-success-bg text-status-success border-status-success-border',
  closed: 'bg-status-neutral-bg text-status-neutral border-status-neutral-border',
  cancelled: 'bg-status-danger-bg text-status-danger border-status-danger-border',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const key = status.toLowerCase();

  if (isTicketStatus(key)) {
    const Icon = STATUS_ICONS[key];
    const styleClass = TICKET_STATUS_STYLES[key] || 'bg-status-neutral-bg text-status-neutral border-status-neutral-border';

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-semibold border shadow-2xs ${styleClass}`}
      >
        {Icon && <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
        {STATUS_LABELS[key]}
      </span>
    );
  }

  // Device request statuses and fallback
  switch (key) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-status-warning-bg text-status-warning border border-status-warning-border shadow-2xs">
          <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
          Chờ xử lý
        </span>
      );
    case 'open':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-status-info-bg text-status-info border border-status-info-border shadow-2xs">
          <Wrench className="w-3 h-3 shrink-0" aria-hidden="true" />
          Đang xử lý
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-status-success-bg text-status-success border border-status-success-border shadow-2xs">
          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          Đã duyệt
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-status-danger-bg text-status-danger border border-status-danger-border shadow-2xs">
          <XCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
          Từ chối
        </span>
      );
    case 'preparing':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-status-info-bg text-status-info border border-status-info-border shadow-2xs">
          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          IT đang chuẩn bị
        </span>
      );
    case 'handed_over':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-status-success-bg text-status-success border border-status-success-border shadow-2xs">
          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          Đã bàn giao
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-medium bg-status-neutral-bg text-status-neutral border border-status-neutral-border shadow-2xs">
          {status}
        </span>
      );
  }
};

interface RoleBadgeProps {
  role: UserRole | string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  switch (role) {
    case 'Manager':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-status-pending-bg text-status-pending border border-status-pending-border shadow-2xs">
          <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
          Quản lý (Manager)
        </span>
      );
    case 'Agent':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-status-info-bg text-status-info border border-status-info-border shadow-2xs">
          <Wrench className="w-3 h-3 shrink-0" aria-hidden="true" />
          Kỹ thuật viên (Agent)
        </span>
      );
    case 'Employee':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-status-neutral-bg text-status-neutral border border-status-neutral-border shadow-2xs">
          <User className="w-3 h-3 shrink-0" aria-hidden="true" />
          Nhân viên (Employee)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-status-neutral-bg text-status-neutral border border-status-neutral-border shadow-2xs">
          {role}
        </span>
      );
  }
};
