// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useMemo, useState } from 'react';
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
    ai_suggestion_applied: 'Đã xác nhận đề xuất AI',
  };
  // Loại sự kiện chưa có nhãn: câu chung, không hiện mã kỹ thuật.
  let heading = headings[evt.event_type] || 'Cập nhật phiếu';
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

type TimelineOrder = 'oldest' | 'newest';

export const TicketTimeline: React.FC<TicketTimelineProps> = ({ events }) => {
  const [order, setOrder] = useState<TimelineOrder>('oldest');
  const eventGroups = useMemo<EventGroup[]>(() => {
    const groups: EventGroup[] = [];
    const ordered = order === 'newest' ? [...events].reverse() : events;
    for (const evt of ordered) {
      const key = dayKey(evt.created_at);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(evt);
      else groups.push({ key, label: formatDayLabel(evt.created_at), items: [evt] });
    }
    return groups;
  }, [events, order]);

  return (
    <section className="overflow-hidden rounded-lg border border-edge bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-5 py-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="dx-section-title flex items-center gap-2">
            <History className="h-4 w-4 shrink-0 self-center text-[var(--color-primary-ink)]" aria-hidden="true" />
            Dòng thời gian xử lý
          </h2>
          <span data-numeric className="text-xs text-content-muted">{events.length} sự kiện</span>
        </div>
        {events.length > 1 && (
          <div role="group" aria-label="Thứ tự sự kiện" className="inline-flex rounded-md border border-edge bg-surface p-0.5">
            {([['oldest', 'Cũ nhất trước'], ['newest', 'Mới nhất trước']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={order === key}
                onClick={() => setOrder(key)}
                className={`inline-flex min-h-[44px] items-center rounded-sm px-2.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:min-h-8 ${
                  order === key ? 'bg-primary text-white' : 'text-content-muted hover:bg-state-hover hover:text-content'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-5">
        {events.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="Chưa có sự kiện nào"
            description="Phiếu này chưa ghi nhận thêm sự kiện xử lý nào trên hệ thống."
            icon={<History className="h-6 w-6 text-[var(--color-content-muted)]" aria-hidden="true" />}
          />
        ) : (
          <div className="space-y-5">
            {eventGroups.map((group) => (
              <section key={group.key} aria-label={`Sự kiện ngày ${group.label}`}>
                <h3 className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-content-muted">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  <span>{group.label}</span>
                  <span data-numeric className="font-normal">· {group.items.length} sự kiện</span>
                </h3>

                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 left-3.5 top-3 w-px bg-edge"
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
                            className="absolute left-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] text-[var(--color-primary-text)] ring-4 ring-surface"
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
                                className="shrink-0 tabular-nums text-xs text-content-muted"
                              >
                                {formatTimeOnly(evt.created_at)}
                              </time>
                            </div>

                            <p className="mt-0.5 text-xs text-content-muted">
                              Thực hiện bởi{' '}
                              <span className="break-words font-medium text-content">
                                {evt.actor_type === 'system' || evt.actor_type === 'ai'
                                  ? `${evt.actor_type === 'ai' ? 'AI' : 'Hệ thống'}${evt.actor_name ? ` (${evt.actor_name})` : ''}`
                                  : evt.actor_name || 'người dùng chưa có tên hiển thị'}
                              </span>
                            </p>

                            {summary.to && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {summary.from && <StatusBadge status={summary.from} />}
                                {summary.from && (
                                  <ArrowRight
                                    className="h-3 w-3 shrink-0 text-content-subtle"
                                    aria-hidden="true"
                                  />
                                )}
                                <StatusBadge status={summary.to} />
                              </div>
                            )}

                            {summary.note && (
                              <div className="mt-2 rounded-md border border-edge bg-surface-muted px-3 py-2">
                                <p className="text-xs font-semibold text-content-muted">
                                  Ghi chú
                                </p>
                                <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed text-content">
                                  {summary.note}
                                </p>
                              </div>
                            )}
                            {summary.resolutionNote && (
                              <div className="mt-2 rounded-md border border-status-success-border bg-status-success-bg px-3 py-2">
                                <p className="text-xs font-semibold text-status-success">
                                  Cách giải quyết
                                </p>
                                <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed text-content">
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
