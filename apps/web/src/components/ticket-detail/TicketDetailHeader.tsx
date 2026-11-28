// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, RefreshCw, Tag, User, UserCheck, Users } from 'lucide-react';
import { Ticket, Category } from '../../types/api';
import { PriorityBadge, StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';

export interface TicketDetailNavProps {
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export interface TicketDetailHeaderProps {
  ticket: Ticket;
  category: Category | null;
}

const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Hàng điều hướng trên cùng, trải hết chiều rộng trang (trên lưới nội dung và cột thao tác). */
export const TicketDetailNav: React.FC<TicketDetailNavProps> = ({ isRefreshing = false, onRefresh }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge pb-2">
    {/* Liên kết thật tới danh sách: trang chi tiết thường được mở trực tiếp từ thông báo. */}
    <Link
      to="/tickets"
      className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-sm px-1 text-[0.8125rem] font-medium text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:min-h-8"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Về danh sách phiếu
    </Link>

    <Button
      variant="secondary"
      size="sm"
      onClick={onRefresh}
      disabled={isRefreshing}
      leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />}
    >
      {isRefreshing ? 'Đang làm mới...' : 'Làm mới'}
    </Button>
  </div>
);

/** Thẻ tiêu đề phiếu: trạng thái, ưu tiên, mã, tiêu đề và thông tin chính. */
export const TicketDetailHeader: React.FC<TicketDetailHeaderProps> = ({ ticket, category }) => {
  return (
    <header className="overflow-hidden rounded-lg border border-edge bg-surface">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {/* Mã ngắn giống danh sách phiếu; mã đầy đủ vẫn có trong title và cho trình đọc màn hình. */}
          <span
            title={ticket.id}
            data-numeric
            className="font-mono text-xs text-content-muted"
          >
            {/* Trình đọc màn hình đọc cùng mã ngắn như người nhìn thấy, không đọc 36 ký tự UUID. */}
            <span className="sr-only">Mã phiếu {ticket.id.slice(0, 8)}</span>
            <span aria-hidden="true">#{ticket.id.slice(0, 8)}</span>
          </span>
        </div>

        <h1 className="dx-page-title mt-3 break-words">
          {ticket.title}
        </h1>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 text-[0.8125rem] @md:grid-cols-2">
          <div className="flex min-w-0 items-start gap-1.5">
            <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-content-subtle)]" aria-hidden="true" />
            <dt className="shrink-0 text-[var(--color-content-muted)]">Người tạo:</dt>
            <dd className="min-w-0 break-words font-medium text-content">
              {ticket.requester_name || <span className="font-normal text-content-muted">Chưa có tên hiển thị</span>}
            </dd>
          </div>

          <div className="flex min-w-0 items-start gap-1.5">
            <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-content-subtle)]" aria-hidden="true" />
            <dt className="shrink-0 text-[var(--color-content-muted)]">Danh mục:</dt>
            <dd className="min-w-0 break-words font-medium text-content">
              {category ? category.name : <span className="font-normal text-content-muted">Chưa xác định</span>}
            </dd>
          </div>

          <div className="flex min-w-0 items-start gap-1.5">
            <UserCheck
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-content-subtle)]"
              aria-hidden="true"
            />
            <dt className="shrink-0 text-[var(--color-content-muted)]">Phụ trách:</dt>
            <dd className="min-w-0 break-words font-medium text-content">
              {ticket.assigned_to ? (
                ticket.assignee_name || 'Kỹ thuật viên đã nhận'
              ) : (
                <span className="font-normal text-content-muted">Chưa phân công</span>
              )}
            </dd>
          </div>

          <div className="flex min-w-0 items-start gap-1.5">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-content-subtle)]" aria-hidden="true" />
            <dt className="shrink-0 text-[var(--color-content-muted)]">Nhóm xử lý:</dt>
            <dd className="min-w-0 break-words font-medium text-content">
              {/* Không bao giờ hiện UUID của nhóm cho người dùng. */}
              {ticket.team_name || (
                <span className="font-normal text-content-muted">
                  {ticket.assigned_team_id ? 'Nhóm chưa có tên hiển thị' : 'Chưa gán nhóm'}
                </span>
              )}
            </dd>
          </div>

          <div className="flex min-w-0 flex-wrap items-start gap-x-1.5 gap-y-0.5">
            <Calendar
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-content-subtle)]"
              aria-hidden="true"
            />
            <dt className="shrink-0 text-[var(--color-content-muted)]">Tạo lúc:</dt>
            <dd className="font-medium text-[var(--color-content)]">{formatDateTime(ticket.created_at)}</dd>
          </div>

          <div className="flex min-w-0 flex-wrap items-start gap-x-1.5 gap-y-0.5">
            <Clock
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-content-subtle)]"
              aria-hidden="true"
            />
            <dt className="shrink-0 text-[var(--color-content-muted)]">Cập nhật:</dt>
            <dd className="font-medium text-[var(--color-content)]">{formatDateTime(ticket.updated_at)}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
};
