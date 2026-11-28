// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  Layers,
  Pause,
  RotateCw,
  Search,
  User,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { Ticket, TicketPriority } from '../../types/api';
import { computeSlaSnapshot, slaGaugeColor } from '../../lib/sla';

export interface TicketKanbanBoardProps {
  tickets: Ticket[];
  onTicketClick?: (ticket: Ticket) => void;
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
    sublabel: 'new / triaged',
    icon: Inbox,
    accentColor: 'text-status-info-solid',
  },
  {
    key: 'team_queue',
    label: 'Hàng đợi nhóm',
    sublabel: 'Chưa nhận',
    icon: UserCheck,
    accentColor: 'text-status-pending-solid',
  },
  {
    key: 'in_progress',
    label: 'Đang xử lý',
    sublabel: 'in_progress',
    icon: Wrench,
    accentColor: 'text-[var(--color-primary-ink)]',
  },
  {
    key: 'waiting',
    label: 'Chờ phản hồi / duyệt',
    sublabel: 'waiting / approval',
    icon: Pause,
    accentColor: 'text-status-warning-solid',
  },
  {
    key: 'resolved',
    label: 'Đã giải quyết',
    sublabel: 'resolved / closed',
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

function formatMinutes(totalMinutes: number): string {
  return totalMinutes >= 60
    ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
    : `${totalMinutes}m`;
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
    remainingText = `Trễ ${formatMinutes(Math.floor(Math.max(0, -sla.remainingMs) / 60000))}`;
  } else if (sla.isPaused) {
    remainingText = '⏸ SLA Tạm dừng';
  } else {
    remainingText = `${formatMinutes(Math.floor(sla.remainingMs / 60000))} còn lại`;
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

export const TicketKanbanBoard: React.FC<TicketKanbanBoardProps> = ({
  tickets,
  onTicketClick,
  onClaimTicket,
  canClaim,
  busyTicketId,
  groupBySwimlanes = true,
  className = '',
}) => {
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [swimlanesEnabled, setSwimlanesEnabled] = useState(groupBySwimlanes);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = ticket.title.toLowerCase().includes(query);
        const idMatch = ticket.id.toLowerCase().includes(query);
        const assigneeMatch = ticket.assignee_name?.toLowerCase().includes(query);
        if (!titleMatch && !idMatch && !assigneeMatch) return false;
      }
      return true;
    });
  }, [tickets, priorityFilter, searchQuery]);

  // Tính SLA một lần cho mỗi phiếu và dùng chung cho phân làn lẫn thẻ.
  const slaById = useMemo(() => {
    const now = Date.now();
    return new Map(filteredTickets.map((t) => [t.id, computeSla(t, now)] as const));
  }, [filteredTickets]);

  const criticalTickets = useMemo(
    () => filteredTickets.filter((t) => isCriticalLane(t, slaById.get(t.id)!)),
    [filteredTickets, slaById]
  );

  const standardTickets = useMemo(
    () => filteredTickets.filter((t) => !isCriticalLane(t, slaById.get(t.id)!)),
    [filteredTickets, slaById]
  );

  const renderKanbanGrid = (subset: Ticket[]) => {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {KANBAN_COLUMNS.map((col) => {
          const colTickets = subset.filter((t) => classifyTicketColumn(t) === col.key);
          const ColIcon = col.icon;

          return (
            <div
              key={col.key}
              className="flex flex-col rounded-lg border border-edge bg-surface-muted/50 p-2.5 sm:p-3"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-edge-subtle">
                <div className="flex items-center gap-1.5">
                  <ColIcon className={`h-4 w-4 ${col.accentColor}`} aria-hidden="true" />
                  <span className="text-xs font-semibold text-content">{col.label}</span>
                </div>
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface px-1.5 tabular-nums text-[11px] font-bold text-content-muted shadow-2xs">
                  {colTickets.length}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto max-h-[720px] pr-0.5">
                {colTickets.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-edge/60 bg-surface/40 p-3 text-center text-xs text-content-subtle">
                    Không có phiếu
                  </div>
                ) : (
                  colTickets.map((ticket) => {
                    const sla = slaById.get(ticket.id)!;
                    const isClaimable =
                      canClaim ? canClaim(ticket) : !ticket.assigned_to && onClaimTicket;
                    const isBusy = busyTicketId === ticket.id;

                    return (
                      <article
                        key={ticket.id}
                        onClick={() => onTicketClick?.(ticket)}
                        className="group relative flex flex-col justify-between rounded-md border border-edge bg-surface p-3 shadow-2xs transition-all hover:border-primary hover:shadow-xs cursor-pointer"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          // Bỏ qua phím từ phần tử con (nút nhận phiếu) để không chặn kích hoạt của nút.
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onTicketClick?.(ticket);
                          }
                        }}
                        aria-label={`Phiếu #${ticket.id.slice(0, 8)}: ${ticket.title}`}
                      >
                        {/* Top: ID & SLA Badge */}
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="tabular-nums font-bold text-[var(--color-primary-ink)]">
                            #{ticket.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span
                            className={`tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded-xs ${
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

                        {/* Title */}
                        <h4 className="mt-1.5 line-clamp-2 text-xs font-semibold text-content group-hover:text-[var(--color-primary-ink)] transition-colors">
                          {ticket.title}
                        </h4>

                        {/* Assignee / Team */}
                        <div className="mt-2 flex items-center justify-between gap-1 text-[11px] text-content-muted">
                          <span className="flex items-center gap-1 truncate max-w-[140px]">
                            <User className="h-3 w-3 shrink-0 text-content-subtle" />
                            <span className="truncate">
                              {ticket.assignee_name || ticket.team_name || 'Chưa gán'}
                            </span>
                          </span>
                          <span
                            className={`rounded-xs px-1.5 py-0.5 font-semibold text-[10px] ${
                              ticket.priority === 'critical'
                                ? 'bg-status-danger-bg text-status-danger'
                                : ticket.priority === 'high'
                                ? 'bg-status-warning-bg text-status-warning'
                                : 'bg-surface-muted text-content-subtle'
                            }`}
                          >
                            {ticket.priority.toUpperCase()}
                          </span>
                        </div>

                        {/* 1-Click Claim Affordance */}
                        {isClaimable && onClaimTicket && (
                          <div className="mt-2.5 pt-2 border-t border-edge-subtle">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onClaimTicket(ticket);
                              }}
                              className="w-full inline-flex min-h-[30px] items-center justify-center gap-1 rounded-sm bg-primary px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 transition-colors"
                            >
                              {isBusy ? (
                                <>
                                  <RotateCw className="h-3 w-3 animate-spin" />
                                  <span>Đang nhận...</span>
                                </>
                              ) : (
                                <>
                                  <span>Nhận xử lý ngay</span>
                                  <ArrowRight className="h-3 w-3" />
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* 4px SLA Progress Gauge Bar */}
                        <div
                          className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-edge-subtle"
                          title={`Tiến độ SLA: ${sla.elapsedPercent}%`}
                          aria-label={`Tiến độ SLA: ${sla.elapsedPercent}%`}
                          role="progressbar"
                          aria-valuenow={sla.elapsedPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className={`h-full transition-all duration-300 ${sla.gaugeColor}`}
                            style={{ width: `${sla.elapsedPercent}%` }}
                          />
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section
      aria-label="Bảng Kanban luồng việc kỹ thuật viên"
      className={`rounded-lg border border-edge bg-surface p-4 shadow-2xs sm:p-5 ${className}`}
    >
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge-subtle pb-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-sm text-content">
            <Layers className="h-4 w-4 text-[var(--color-primary-ink)]" aria-hidden="true" />
            <span>KANBAN VẬN HÀNH IT</span>
          </div>
          <span className="tabular-nums text-xs text-content-subtle">
            ({filteredTickets.length} phiếu)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-content-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề, mã..."
              className="h-[34px] rounded-md border border-edge bg-surface pl-8 pr-3 text-xs text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-52"
            />
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')}
            className="h-[34px] rounded-md border border-edge bg-surface px-2.5 text-xs text-content focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Lọc theo mức ưu tiên"
          >
            <option value="all">Tất cả ưu tiên</option>
            <option value="critical">Khẩn cấp (Critical)</option>
            <option value="high">Cao (High)</option>
            <option value="normal">Bình thường (Normal)</option>
            <option value="low">Thấp (Low)</option>
          </select>

          {/* Swimlane Toggle */}
          <button
            type="button"
            onClick={() => setSwimlanesEnabled(!swimlanesEnabled)}
            className={`inline-flex h-[34px] items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              swimlanesEnabled
                ? 'border-primary bg-primary-tint text-[var(--color-primary-ink)]'
                : 'border-edge bg-surface text-content hover:bg-surface-muted'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Phân làn khẩn cấp</span>
          </button>
        </div>
      </div>

      {/* Grid Content */}
      {swimlanesEnabled ? (
        <div className="space-y-6">
          {/* Swimlane 1: Critical & SLA Breached */}
          {criticalTickets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-status-danger-border bg-status-danger-bg px-3.5 py-2 text-status-danger">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    HÀNG ĐỢI KHẨN CẤP / CRITICAL SWIMLANE (SLA RỦI RO CAO)
                  </span>
                </div>
                <span className="tabular-nums text-xs font-bold">
                  {criticalTickets.length} phiếu đang mở
                </span>
              </div>
              {renderKanbanGrid(criticalTickets)}
            </div>
          )}

          {/* Swimlane 2: Standard (High / Normal / Low) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-edge bg-surface-muted px-3.5 py-2 text-content-muted">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--color-primary-ink)]" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  HÀNG ĐỢI TIÊU CHUẨN / STANDARD SWIMLANE
                </span>
              </div>
              <span className="tabular-nums text-xs font-semibold">
                {standardTickets.length} phiếu
              </span>
            </div>
            {renderKanbanGrid(standardTickets)}
          </div>
        </div>
      ) : (
        renderKanbanGrid(filteredTickets)
      )}
    </section>
  );
};
