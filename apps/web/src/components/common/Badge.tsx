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
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs font-semibold bg-[#fbe4e4] text-[#d44c47] border border-[#f6c3c1] shadow-2xs">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Khẩn cấp
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-semibold bg-[#fbf3db] text-[#cb912f] border border-[#f5ddb2] shadow-2xs">
          <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
          Cao
        </span>
      );
    case 'normal':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-semibold bg-[#deeef8] text-[#0a5c94] border border-[#b9daf0] shadow-2xs">
          <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
          Bình thường
        </span>
      );
    case 'low':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#f1f1ef] text-[#5f5e5a] border border-[#e4e3e0] shadow-2xs">
          <ArrowDown className="w-3 h-3 shrink-0" aria-hidden="true" />
          Thấp
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#f1f1ef] text-[#5f5e5a] border border-[#e4e3e0] shadow-2xs">
          {priority}
        </span>
      );
  }
};

interface StatusBadgeProps {
  status: string;
}

const TICKET_STATUS_STYLES: Record<TicketStatus, string> = {
  new: 'bg-[#deeef8] text-[#0a5c94] border-[#b9daf0]',
  triaged: 'bg-[#f1f1ef] text-[#5f5e5a] border-[#e4e3e0]',
  assigned: 'bg-[#f1f1ef] text-[#5f5e5a] border-[#e4e3e0]',
  in_progress: 'bg-[#deeef8] text-[#0a5c94] border-[#b9daf0]',
  waiting_user: 'bg-[#fbf3db] text-[#cb912f] border-[#f5ddb2]',
  pending_approval: 'bg-[#f4eeff] text-[#9065b0] border-[#e0cdfc]',
  resolved: 'bg-[#edf3ec] text-[#448361] border-[#b8dcce]',
  closed: 'bg-[#f1f1ef] text-[#5f5e5a] border-[#e4e3e0]',
  cancelled: 'bg-[#fbe4e4] text-[#d44c47] border-[#f6c3c1]',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const key = status.toLowerCase();

  if (isTicketStatus(key)) {
    const Icon = STATUS_ICONS[key];
    const styleClass = TICKET_STATUS_STYLES[key] || 'bg-[#f1f1ef] text-[#5f5e5a] border-[#e4e3e0]';

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-semibold border shadow-2xs ${styleClass}`}
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#fbf3db] text-[#cb912f] border border-[#f5ddb2] shadow-2xs">
          <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
          Chờ xử lý
        </span>
      );
    case 'open':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#deeef8] text-[#0a5c94] border border-[#b9daf0] shadow-2xs">
          <Wrench className="w-3 h-3 shrink-0" aria-hidden="true" />
          Đang xử lý
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#edf3ec] text-[#448361] border border-[#b8dcce] shadow-2xs">
          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          Đã duyệt
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#fbe4e4] text-[#d44c47] border border-[#f6c3c1] shadow-2xs">
          <XCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
          Từ chối
        </span>
      );
    case 'fulfilled':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#edf3ec] text-[#448361] border border-[#b8dcce] shadow-2xs">
          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          Đã cấp thiết bị
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-xs font-medium bg-[#f1f1ef] text-[#5f5e5a] border border-[#e4e3e0] shadow-2xs">
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-semibold bg-[#f4eeff] text-[#9065b0] border border-[#e0cdfc] shadow-2xs">
          <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
          Quản lý (Manager)
        </span>
      );
    case 'Agent':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-semibold bg-[#deeef8] text-[#0a5c94] border border-[#b9daf0] shadow-2xs">
          <Wrench className="w-3 h-3 shrink-0" aria-hidden="true" />
          Kỹ thuật viên (Agent)
        </span>
      );
    case 'Employee':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#f1f1ef] text-[#5f5e5a] border border-[#e4e3e0] shadow-2xs">
          <User className="w-3 h-3 shrink-0" aria-hidden="true" />
          Nhân viên (Employee)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#f1f1ef] text-[#5f5e5a] border border-[#e4e3e0] shadow-2xs">
          {role}
        </span>
      );
  }
};
