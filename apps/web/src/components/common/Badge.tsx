// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { TicketPriority, UserRole } from '../../types/api';
import { isTicketStatus, STATUS_LABELS, STATUS_TONES } from '../../lib/ticketWorkflow';

interface PriorityBadgeProps {
  priority: TicketPriority | string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  switch (priority) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
          Khẩn cấp
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          Cao
        </span>
      );
    case 'normal':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200">
          Bình thường
        </span>
      );
    case 'low':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          Thấp
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {priority}
        </span>
      );
  }
};

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const key = status.toLowerCase();
  if (isTicketStatus(key)) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_TONES[key].badge}`}
      >
        {STATUS_LABELS[key]}
      </span>
    );
  }
  switch (key) {
    case 'pending':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          Chờ xử lý
        </span>
      );
    case 'open':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          Đang xử lý
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          Đã duyệt
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          Từ chối
        </span>
      );
    case 'fulfilled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          Đã cấp thiết bị
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
          Quản lý (Manager)
        </span>
      );
    case 'Agent':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200">
          Kỹ thuật viên (Agent)
        </span>
      );
    case 'Employee':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          Nhân viên (Employee)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {role}
        </span>
      );
  }
};
