// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useMemo } from 'react';
import { ArrowRight, Calendar, History } from 'lucide-react';
import { TicketEvent } from '../../types/api';
import { StatusBadge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { isTicketStatus, STATUS_ICONS, statusLabel } from '../../lib/ticketWorkflow';

export interface TicketTimelineProps {
  events: TicketEvent[];
}

interface EventGroup {
  key: string;
  label: string;
  items: TicketEvent[];
}

function eventSummary(evt: TicketEvent): {
  heading: string;
  from: string | null;
  to: string | null;
  note: string | null;
  resolutionNote: string | null;
} {
  const payload = evt.payload || {};
  const from = typeof payload.from === 'string' ? payload.from : null;
  const to =
    typeof payload.to === 'string'
      ? payload.to
      : typeof payload.status === 'string'
        ? payload.status
        : null;
  const note =
    typeof payload.note === 'string' && payload.note.trim()
      ? payload.note
      : null;
  const resolutionNote =
    typeof payload.resolution_note === 'string' && payload.resolution_note.trim()
      ? payload.resolution_note
      : null;

  const headings: Record<string, string> = {
    assignment_changed: 'Đã cập nhật phân công',
    routing_unresolved: 'Chưa xác định được nhóm xử lý',
    sla_warning: 'SLA đã sử dụng 80%',
    sla_breached: 'Đã vi phạm SLA',
  };
  let heading = headings[evt.event_type] || evt.event_type;
  if (evt.event_type === 'created') heading = 'Đã tiếp nhận phiếu';
  else if (evt.event_type === 'status_changed') {
    heading =
      from && to
        ? `Chuyển từ ${statusLabel(from)} sang ${statusLabel(to)}`
        : 'Cập nhật trạng thái';
  }
  return { heading, from, to, note, resolutionNote };
}

const formatTimeOnly = (isoString: string): string => {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const dayKey = (isoString: string): string => {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const formatDayLabel = (isoString: string): string => {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const TicketTimeline: React.FC<TicketTimelineProps> = ({ events }) => {
  const eventGroups = useMemo<EventGroup[]>(() => {
    const groups: EventGroup[] = [];
    for (const evt of events) {
      const key = dayKey(evt.created_at);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(evt);
      else groups.push({ key, label: formatDayLabel(evt.created_at), items: [evt] });
    }
    return groups;
  }, [events]);

  return (
    <section className="overflow-hidden rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-edge-subtle)] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
          <h2 className="text-sm font-bold tracking-tight text-[var(--color-content)]">
            Dòng thời gian xử lý
          </h2>
        </div>
        <span className="rounded-[4px] border border-[var(--color-edge-subtle)] bg-[var(--color-surface-muted)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-content-muted)]">
          {events.length} sự kiện
        </span>
      </div>

      <div className="px-5 py-5">
        {events.length === 0 ? (
          <EmptyState
            title="Chưa có sự kiện nào"
            description="Phiếu này chưa ghi nhận thêm sự kiện xử lý nào trên hệ thống."
            icon={<History className="h-6 w-6 text-[var(--color-content-muted)]" aria-hidden="true" />}
          />
        ) : (
          <div className="space-y-5">
            {eventGroups.map((group) => (
              <section key={group.key} aria-label={`Sự kiện ngày ${group.label}`}>
                <h3 className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8c8a85]">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  <span>{group.label}</span>
                  <span className="rounded-[4px] bg-[var(--color-surface-warm)] px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-[var(--color-content-muted)]">
                    {group.items.length} sự kiện
                  </span>
                </h3>

                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 left-3.5 top-3 w-px bg-[var(--color-edge-subtle)]"
                  />
                  <ol className="space-y-3">
                    {group.items.map((evt, idx) => {
                      const summary = eventSummary(evt);
                      const toneStatus =
                        summary.to && isTicketStatus(summary.to) ? summary.to : null;
                      const Icon = toneStatus ? STATUS_ICONS[toneStatus] : null;

                      return (
                        <li key={evt.id || idx} className="relative pl-10">
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] text-[var(--color-primary)] shadow-2xs ring-4 ring-surface"
                          >
                            {Icon ? (
                              <Icon className="h-3.5 w-3.5" />
                            ) : (
                              <History className="h-3.5 w-3.5 text-[var(--color-content-muted)]" />
                            )}
                          </span>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
                              <p className="min-w-0 break-words text-sm font-semibold leading-snug text-[var(--color-content)]">
                                {summary.heading}
                              </p>
                              <time
                                dateTime={evt.created_at}
                                className="shrink-0 font-mono text-[11px] text-[#8c8a85]"
                              >
                                {formatTimeOnly(evt.created_at)}
                              </time>
                            </div>

                            <p className="mt-0.5 text-[11px] text-[var(--color-content-muted)]">
                              Thực hiện bởi{' '}
                              <span className="break-all font-mono font-semibold text-[var(--color-content)]">
                                {evt.actor_type === 'system'
                                  ? `Hệ thống${evt.actor_name ? ` (${evt.actor_name})` : ''}`
                                  : evt.actor_name || evt.actor_id || 'Không có thông tin tác nhân'}
                              </span>
                            </p>

                            {summary.to && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {summary.from && <StatusBadge status={summary.from} />}
                                {summary.from && (
                                  <ArrowRight
                                    className="h-3 w-3 shrink-0 text-[#8c8a85]"
                                    aria-hidden="true"
                                  />
                                )}
                                <StatusBadge status={summary.to} />
                              </div>
                            )}

                            {summary.note && (
                              <div className="mt-2 rounded-[4px] border border-[var(--color-edge-subtle)] bg-[var(--color-surface-warm)]/80 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8c8a85]">
                                  Ghi chú
                                </p>
                                <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--color-content)]">
                                  {summary.note}
                                </p>
                              </div>
                            )}
                            {summary.resolutionNote && (
                              <div className="mt-2 rounded-[4px] border border-[#b8dcce] bg-[#e8f3ed] px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#27553c]">
                                  Cách giải quyết
                                </p>
                                <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-[#27553c]">
                                  {summary.resolutionNote}
                                </p>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
