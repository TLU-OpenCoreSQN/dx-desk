// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Inbox, Pause, UserCheck, Wrench } from 'lucide-react';
import { Ticket } from '../../types/api';
import { computeSlaSnapshot, formatSlaDuration, slaGaugeColor } from '../../lib/sla';
import { CountBadge, PriorityBadge } from '../common/Badge';
import { Button } from '../common/Button';

export interface TicketKanbanBoardProps {
  /** Phiếu của trang đang xem; tìm kiếm và lọc do trang chứa bảng thực hiện phía máy chủ. */
  tickets: Ticket[];
  /** Đường dẫn chi tiết phiếu; tiêu đề thẻ là liên kết thật (mở được tab mới). */
  ticketHref?: (ticket: Ticket) => string;
  onClaimTicket?: (ticket: Ticket) => Promise<void> | void;
  canClaim?: (ticket: Ticket) => boolean;
  busyTicketId?: string | null;
  groupBySwimlanes?: boolean;
  className?: string;
}

export type KanbanColumnKey =
  | 'new'
  | 'team_queue'
  | 'in_progress'
  | 'waiting'
  | 'resolved';

export interface KanbanColumnDef {
  key: KanbanColumnKey;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    key: 'new',
    label: 'Mới tiếp nhận',
    sublabel: 'Mới tạo, đã phân loại',
    icon: Inbox,
    accentColor: 'text-status-info-solid',
  },
  {
    key: 'team_queue',
    label: 'Hàng đợi nhóm',
    sublabel: 'Chưa có người nhận',
    icon: UserCheck,
    accentColor: 'text-status-pending-solid',
  },
  {
    key: 'in_progress',
    label: 'Đang xử lý',
    sublabel: 'Đã nhận, đang làm',
    icon: Wrench,
    accentColor: 'text-[var(--color-primary-ink)]',
  },
  {
    key: 'waiting',
    label: 'Chờ phản hồi / duyệt',
    sublabel: 'Chờ người yêu cầu hoặc Quản lý',
    icon: Pause,
    accentColor: 'text-status-warning-solid',
  },
  {
    key: 'resolved',
    label: 'Đã giải quyết',
    sublabel: 'Đã giải quyết, đã đóng',
    icon: CheckCircle2,
    accentColor: 'text-status-success',
  },
];

function classifyTicketColumn(ticket: Ticket): KanbanColumnKey {
  const status = ticket.status;
  if (status === 'new' || status === 'triaged') return 'new';
  if (status === 'assigned') {
    return ticket.assigned_to ? 'in_progress' : 'team_queue';
  }
  if (status === 'in_progress') return 'in_progress';
  if (status === 'waiting_user' || status === 'pending_approval') return 'waiting';
  if (status === 'resolved' || status === 'closed') return 'resolved';
  return 'new'; // fallback
}

interface SlaStatus {
  elapsedPercent: number;
  remainingText: string;
  isBreached: boolean;
  isPaused: boolean;
  isFinished: boolean;
  gaugeColor: string;
}

function computeSla(ticket: Ticket, now: number): SlaStatus {
  const sla = computeSlaSnapshot(ticket, now);
  if (!sla.hasSla) {
    return {
      elapsedPercent: 0,
      remainingText: 'Không có SLA',
      isBreached: false,
      isPaused: false,
      isFinished: sla.isFinished,
      gaugeColor: 'bg-edge',
    };
  }

  // Phiếu đã kết thúc: chỉ phản ánh kết quả cuối (cờ sla_breached của máy chủ), không đếm tiếp.
  if (sla.isFinished) {
    return {
      elapsedPercent: 100,
      remainingText: sla.isBreached ? 'Trễ SLA' : 'Đạt SLA',
      isBreached: sla.isBreached,
      isPaused: false,
      isFinished: true,
      gaugeColor: sla.isBreached ? 'bg-status-danger' : 'bg-status-success',
    };
  }

  let remainingText: string;
  if (sla.isBreached) {
    remainingText = sla.remainingMs < 0 ? `Quá hạn ${formatSlaDuration(sla.remainingMs)}` : 'Đã vi phạm SLA';
  } else if (sla.isPaused) {
    remainingText = 'SLA tạm dừng';
  } else {
    remainingText = `Còn ${formatSlaDuration(sla.remainingMs)}`;
  }

  return {
    elapsedPercent: sla.isBreached ? 100 : sla.elapsedPercent,
    remainingText,
    isBreached: sla.isBreached,
    isPaused: sla.isPaused,
    isFinished: false,
    gaugeColor: slaGaugeColor(sla.elapsedPercent, sla.isBreached),
  };
}

/** Làn khẩn cấp chỉ gồm phiếu còn mở: critical hoặc đã vi phạm SLA. */
function isCriticalLane(ticket: Ticket, sla: SlaStatus): boolean {
  return !sla.isFinished && (ticket.priority === 'critical' || sla.isBreached);
}

const defaultHref = (ticket: Ticket) => `/tickets/${encodeURIComponent(ticket.id)}`;

export const TicketKanbanBoard: React.FC<TicketKanbanBoardProps> = ({
  tickets,
  ticketHref = defaultHref,
  onClaimTicket,
  canClaim,
  busyTicketId,
  groupBySwimlanes = true,
  className = '',
}) => {
  const [swimlanesEnabled, setSwimlanesEnabled] = useState(groupBySwimlanes);

  // Tính SLA một lần cho mỗi phiếu và dùng chung cho phân làn lẫn thẻ.
  const slaById = useMemo(() => {
    const now = Date.now();
    return new Map(tickets.map((t) => [t.id, computeSla(t, now)] as const));
  }, [tickets]);

  const criticalTickets = useMemo(
    () => tickets.filter((t) => isCriticalLane(t, slaById.get(t.id)!)),
    [tickets, slaById]
  );

  const standardTickets = useMemo(
    () => tickets.filter((t) => !isCriticalLane(t, slaById.get(t.id)!)),
    [tickets, slaById]
  );

  // h2 = bảng; khi phân làn, tên làn là h3 và tiêu đề thẻ là h4, không nhảy cấp.
  const CardHeading = swimlanesEnabled ? 'h4' : 'h3';

  const renderKanbanGrid = (subset: Ticket[], laneLabel: string) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {KANBAN_COLUMNS.map((col) => {
        const colTickets = subset.filter((t) => classifyTicketColumn(t) === col.key);
        const ColIcon = col.icon;

        return (
          <section
            key={col.key}
            aria-label={`${laneLabel}: ${col.label}, ${colTickets.length} phiếu`}
            className="flex flex-col rounded-lg border border-edge bg-surface-muted p-2.5"
          >
            <div className="mb-2 flex items-start justify-between gap-2 border-b border-edge pb-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-content">
                  <ColIcon className={`h-4 w-4 shrink-0 ${col.accentColor}`} aria-hidden="true" />
                  <span>{col.label}</span>
                </p>
                <p className="mt-0.5 text-xs text-content-muted">{col.sublabel}</p>
              </div>
              <CountBadge value={colTickets.length} />
            </div>

            <ul className="flex max-h-[720px] flex-1 flex-col gap-2 overflow-y-auto">
              {colTickets.length === 0 ? (
                <li className="flex h-20 items-center justify-center rounded-md border border-dashed border-edge p-3 text-center text-xs text-content-muted">
                  Không có phiếu
                </li>
              ) : (
                colTickets.map((ticket) => {
                  const sla = slaById.get(ticket.id)!;
                  const isClaimable = canClaim ? canClaim(ticket) : !ticket.assigned_to && Boolean(onClaimTicket);
                  const isBusy = busyTicketId === ticket.id;

                  return (
                    <li
                      key={ticket.id}
                      className="flex flex-col rounded-md border border-edge bg-surface p-3 transition-colors duration-150 hover:border-edge-strong motion-reduce:transition-none"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span data-numeric title={ticket.id} className="font-mono text-content-muted">
                          #{ticket.id.slice(0, 8)}
                        </span>
                        <span
                          className={`whitespace-nowrap rounded-sm px-1.5 py-0.5 font-medium tabular-nums ${
                            sla.isBreached
                              ? 'bg-status-danger-bg text-status-danger'
                              : sla.isPaused
                                ? 'bg-status-warning-bg text-status-warning'
                                : 'bg-surface-muted text-content-muted'
                          }`}
                        >
                          {sla.remainingText}
                        </span>
                      </div>

                      <CardHeading className="mt-1.5 text-[0.8125rem] font-semibold leading-snug text-content">
                        <Link
                          to={ticketHref(ticket)}
                          className="line-clamp-2 rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {ticket.title}
                        </Link>
                      </CardHeading>

                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-content-muted">
                        <span className="min-w-0 truncate">
                          {ticket.assignee_name || ticket.team_name || 'Chưa phân công'}
                        </span>
                        <PriorityBadge priority={ticket.priority} />
                      </div>

                      {isClaimable && onClaimTicket && (
                        <Button
                          size="sm"
                          className="mt-2.5 w-full"
                          disabled={busyTicketId != null}
                          isLoading={isBusy}
                          rightIcon={isBusy ? undefined : <ArrowRight className="h-3.5 w-3.5" />}
                          onClick={() => void onClaimTicket(ticket)}
                        >
                          {isBusy ? 'Đang nhận...' : 'Nhận xử lý ngay'}
                        </Button>
                      )}

                      <div
                        className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-edge"
                        role="progressbar"
                        aria-label="Tiến độ SLA"
                        aria-valuenow={sla.elapsedPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${sla.gaugeColor}`}
                          style={{ width: `${sla.elapsedPercent}%` }}
                        />
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );

  return (
    <section aria-labelledby="kanban-board-title" className={`rounded-lg border border-edge bg-surface p-4 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 id="kanban-board-title" className="text-sm font-semibold text-content">Kanban luồng việc</h2>
          <span data-numeric className="text-xs text-content-muted">{tickets.length} phiếu trên trang này</span>
        </div>
        <Button variant="secondary" size="sm" aria-pressed={swimlanesEnabled} onClick={() => setSwimlanesEnabled((on) => !on)}>
          Tách làn khẩn cấp
        </Button>
      </div>

      {swimlanesEnabled ? (
        <div className="space-y-6">
          {criticalTickets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-status-danger">
                <h3 className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Khẩn cấp hoặc đã quá hạn SLA
                </h3>
                <span data-numeric className="text-xs font-medium">{criticalTickets.length} phiếu đang mở</span>
              </div>
              {renderKanbanGrid(criticalTickets, 'Làn khẩn cấp')}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-muted px-3 py-2 text-content">
              <h3 className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                <Clock className="h-4 w-4 shrink-0 text-content-muted" aria-hidden="true" />
                Các phiếu còn lại
              </h3>
              <span data-numeric className="text-xs text-content-muted">{standardTickets.length} phiếu</span>
            </div>
            {renderKanbanGrid(standardTickets, 'Làn thường')}
          </div>
        </div>
      ) : (
        renderKanbanGrid(tickets, 'Kanban')
      )}
    </section>
  );
};
