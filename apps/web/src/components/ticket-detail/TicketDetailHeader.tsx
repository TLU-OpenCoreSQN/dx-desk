// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { ArrowLeft, Calendar, Clock, RefreshCw, Tag, User, UserCheck } from 'lucide-react';
import { Ticket, Category } from '../../types/api';
import { PriorityBadge, StatusBadge } from '../common/Badge';
import { TicketSlaInfo } from '../common/TicketSlaInfo';

export interface TicketDetailHeaderProps {
  ticket: Ticket;
  category: Category | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
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

export const TicketDetailHeader: React.FC<TicketDetailHeaderProps> = ({
  ticket,
  category,
  isRefreshing = false,
  onRefresh,
  onBack,
}) => {
  return (
    <>
      {/* Top navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-edge)] pb-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[4px] px-2 text-xs font-semibold text-[var(--color-content-muted)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] lg:min-h-9"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Quay lại danh sách phiếu</span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[4px] border border-[var(--color-edge)] bg-surface px-3 text-xs font-semibold text-[var(--color-content)] shadow-xs transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-9"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{isRefreshing ? 'Đang làm mới...' : 'Làm mới'}</span>
        </button>
      </div>

      {/* Status header + meta */}
      <header className="overflow-hidden rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface shadow-2xs">
        <div className="border-b border-[var(--color-edge-subtle)] bg-gradient-to-b from-[var(--color-surface-sidebar)] to-surface px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-[4px] border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--color-primary-text)]">
              <span className="text-[var(--color-content-muted)]">ID</span>
              <span className="break-all font-bold">{ticket.id}</span>
            </span>
          </div>

          <h1 className="mt-3 break-words text-lg font-bold leading-snug tracking-tight text-[var(--color-content)] sm:text-2xl">
            {ticket.title}
          </h1>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
            <div className="flex min-w-0 items-start gap-1.5">
              <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-content-subtle)]" aria-hidden="true" />
              <dt className="shrink-0 text-[var(--color-content-muted)]">Người tạo:</dt>
              <dd className="min-w-0 break-all font-mono font-semibold text-[var(--color-content)]">
                {ticket.requester_name || ticket.requester_id}
              </dd>
            </div>

            <div className="flex min-w-0 items-start gap-1.5">
              <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-content-subtle)]" aria-hidden="true" />
              <dt className="shrink-0 text-[var(--color-content-muted)]">Danh mục:</dt>
              <dd className="min-w-0 break-words font-semibold text-[var(--color-content)]">
                {category ? `${category.name} (${category.code})` : ticket.category_id}
              </dd>
            </div>

            <div className="flex min-w-0 items-start gap-1.5">
              <UserCheck
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-content-subtle)]"
                aria-hidden="true"
              />
              <dt className="shrink-0 text-[var(--color-content-muted)]">Phụ trách:</dt>
              <dd className="min-w-0 break-all font-semibold text-[var(--color-content)]">
                {ticket.assigned_to ? (
                  <span className="text-[var(--color-primary)]">{ticket.assignee_name || ticket.assigned_to}</span>
                ) : (
                  <span className="font-normal italic text-[var(--color-content-subtle)]">Chưa phân công</span>
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
          <div className="mt-4 space-y-2 border-t border-edge-subtle pt-3">
            <p className="break-words text-xs text-content-muted">
              Nhóm xử lý:{' '}
              <span className="font-semibold text-content">
                {ticket.team_name || (ticket.assigned_team_id ? `Chưa có tên nhóm (${ticket.assigned_team_id})` : 'Chưa gán nhóm')}
              </span>
            </p>
            <TicketSlaInfo ticket={ticket} />
          </div>
        </div>
      </header>
    </>
  );
};
