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
    accentColor: 'text-blue-500',
  },
  {
    key: 'team_queue',
    label: 'Hàng đợi nhóm',
    sublabel: 'Chưa nhận',
    icon: UserCheck,
    accentColor: 'text-violet-500',
  },
  {
    key: 'in_progress',
    label: 'Đang xử lý',
    sublabel: 'in_progress',
    icon: Wrench,
    accentColor: 'text-primary',
  },
  {
    key: 'waiting',
    label: 'Chờ phản hồi / duyệt',
    sublabel: 'waiting / approval',
    icon: Pause,
    accentColor: 'text-amber-500',
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
  gaugeColor: string;
}

function computeSla(ticket: Ticket): SlaStatus {
  if (!ticket.sla_due_at) {
    return {
      elapsedPercent: 0,
      remainingText: 'Không có SLA',
      isBreached: false,
      isPaused: false,
      gaugeColor: 'bg-edge',
    };
  }

  const now = Date.now();
  const created = new Date(ticket.created_at).getTime();
  const originalDue = new Date(ticket.sla_due_at).getTime();
  const pausedMs = Number(ticket.sla_paused_ms || 0);

  let activePausedExtra = 0;
  if (ticket.status === 'waiting_user' && ticket.waiting_since) {
    activePausedExtra = Math.max(0, now - new Date(ticket.waiting_since).getTime());
  }

  const effectiveDue = originalDue + pausedMs + activePausedExtra;
  const remainingMs = effectiveDue - now;
  const totalWindow = Math.max(1, originalDue - created);
  const isBreached = ticket.sla_breached === true || remainingMs <= 0;
  const isPaused = ticket.status === 'waiting_user';

  const elapsedPercent = Math.min(
    100,
    Math.max(0, Math.round(((now - created - pausedMs - activePausedExtra) / totalWindow) * 100))
  );

  let remainingText = '';
  if (isBreached) {
    const overdueMinutes = Math.floor(Math.abs(remainingMs) / 60000);
    remainingText = overdueMinutes >= 60
      ? `Trễ ${Math.floor(overdueMinutes / 60)}h ${overdueMinutes % 60}m`
      : `Trễ ${overdueMinutes}m`;
  } else if (isPaused) {
    remainingText = '⏸ SLA Tạm dừng';
  } else {
    const remainingMinutes = Math.floor(remainingMs / 60000);
    remainingText = remainingMinutes >= 60
      ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m còn lại`
      : `${remainingMinutes}m còn lại`;
  }

  let gaugeColor = 'bg-emerald-500';
  if (isBreached) {
    gaugeColor = 'bg-rose-600';
  } else if (elapsedPercent >= 80) {
    gaugeColor = 'bg-orange-500 animate-pulse';
  } else if (elapsedPercent >= 60) {
    gaugeColor = 'bg-amber-500';
  }

  return {
    elapsedPercent: isBreached ? 100 : elapsedPercent,
    remainingText,
    isBreached,
    isPaused,
    gaugeColor,
  };
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

  // Swimlanes partitioning:
  // Critical swimlane: tickets with priority === 'critical' or sla_breached or critical SLA elapsed
  const criticalTickets = useMemo(() => {
    return filteredTickets.filter(
      (t) => t.priority === 'critical' || t.sla_breached || computeSla(t).isBreached
    );
  }, [filteredTickets]);

  const standardTickets = useMemo(() => {
    return filteredTickets.filter(
      (t) => !(t.priority === 'critical' || t.sla_breached || computeSla(t).isBreached)
    );
  }, [filteredTickets]);

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
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface px-1.5 font-mono text-[11px] font-bold text-content-muted shadow-2xs">
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
                    const sla = computeSla(ticket);
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
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onTicketClick?.(ticket);
                          }
                        }}
                        aria-label={`Phiếu #${ticket.id.slice(0, 8)}: ${ticket.title}`}
                      >
                        {/* Top: ID & SLA Badge */}
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="font-mono font-bold text-primary tabular-nums">
                            #{ticket.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span
                            className={`font-mono text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-xs ${
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
                        <h4 className="mt-1.5 line-clamp-2 text-xs font-semibold text-content group-hover:text-primary transition-colors">
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
                            className={`rounded-xs px-1.5 py-0.2 font-semibold text-[10px] ${
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
            <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>KANBAN VẬN HÀNH IT</span>
          </div>
          <span className="font-mono text-xs text-content-subtle tabular-nums">
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
                ? 'border-primary bg-primary-tint text-primary'
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
                <span className="font-mono text-xs font-bold tabular-nums">
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
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  HÀNG ĐỢI TIÊU CHUẨN / STANDARD SWIMLANE
                </span>
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums">
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
