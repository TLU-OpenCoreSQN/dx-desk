// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  GitBranch,
  History,
  Info,
  RefreshCw,
  ShieldCheck,
  Tag,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import {
  getTicketById,
  getTicketEvents,
  getCategories,
  updateTicketStatus,
  ApiClientError,
} from '../services/api';
import { Ticket, TicketEvent, Category, UpdateTicketStatusPayload } from '../types/api';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { Alert } from '../components/common/Alert';
import { AttachmentPanel } from '../components/common/AttachmentPanel';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllowedTransitions,
  isTicketStatus,
  RESOLUTION_NOTE_MAX,
  RESOLUTION_NOTE_MIN,
  STATUS_ICONS,
  statusLabel,
  TransitionEdge,
  validateResolutionNote,
} from '../lib/ticketWorkflow';

const BTN_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] px-3.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-10';
const BTN_PRIMARY = `${BTN_BASE} border border-[var(--color-primary)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-xs hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] focus-visible:ring-[var(--color-primary)]`;
const BTN_SUCCESS = `${BTN_BASE} border border-[#448361] bg-[#448361] text-white shadow-xs hover:bg-[#36694e] focus-visible:ring-[#448361]`;
const BTN_SECONDARY = `${BTN_BASE} border border-[var(--color-edge-subtle)] bg-surface text-[var(--color-content)] hover:bg-[var(--color-surface-muted)] focus-visible:ring-[var(--color-primary)] shadow-2xs`;
const BTN_DANGER = `${BTN_BASE} border border-[#f6c3c1] bg-surface text-[#d44c47] hover:bg-[#fbe4e4] focus-visible:ring-[#d44c47]`;
const BTN_DANGER_SOLID = `${BTN_BASE} border border-[#d44c47] bg-[#d44c47] text-white shadow-xs hover:bg-[#b53c37] focus-visible:ring-[#d44c47]`;

const TEXTAREA_CLASS =
  'w-full rounded-[6px] border border-[var(--color-edge-subtle)] bg-[var(--color-surface-sidebar)] p-3 text-xs leading-relaxed text-[var(--color-content)] focus:bg-surface focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] sm:text-sm transition-all';

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
  const resolutionNote = typeof payload.resolution_note === 'string' && payload.resolution_note.trim()
    ? payload.resolution_note : null;

  let heading = evt.event_type;
  if (evt.event_type === 'created') heading = 'Đã tiếp nhận phiếu';
  else if (evt.event_type === 'status_changed') {
    heading =
      from && to
        ? `Chuyển từ ${statusLabel(from)} sang ${statusLabel(to)}`
        : 'Cập nhật trạng thái';
  }
  return { heading, from, to, note, resolutionNote };
}

const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '—';
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

const edgeKey = (edge: TransitionEdge): string => `${edge.from}-${edge.to}-${edge.label}`;

const isDestructiveEdge = (edge: TransitionEdge): boolean =>
  edge.to === 'cancelled' || (edge.from === 'pending_approval' && edge.to === 'new');

interface EventGroup {
  key: string;
  label: string;
  items: TicketEvent[];
}

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, profile } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);

  const [activeEdge, setActiveEdge] = useState<TransitionEdge | null>(null);
  const [note, setNote] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionError, setTransitionError] = useState<unknown>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTicketData = useCallback(async (silent = false) => {
    if (!id) return;
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const [ticketData, eventsData, categoriesData] = await Promise.all([
        getTicketById(id),
        getTicketEvents(id),
        getCategories().catch(() => ({ data: [] })),
      ]);

      setTicket(ticketData);
      setEvents(eventsData.data || []);

      if (ticketData && categoriesData.data) {
        const foundCategory = categoriesData.data.find((c) => c.id === ticketData.category_id);
        setCategory(foundCategory || null);
      }
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTicketData();
  }, [loadTicketData]);

  const allowedTransitions = useMemo(
    () =>
      ticket
        ? getAllowedTransitions(ticket.status, roles, {
            isRequester: Boolean(profile && ticket.requester_id === profile.id),
          })
        : [],
    [ticket, roles, profile]
  );

  /** Exactly one primary action: resolving/closing > first forward transition. */
  const primaryEdgeKey = useMemo(() => {
    if (allowedTransitions.length === 0) return null;
    const finish =
      allowedTransitions.find((edge) => edge.to === 'resolved') ??
      allowedTransitions.find((edge) => edge.to === 'closed');
    if (finish) return edgeKey(finish);
    const forward = allowedTransitions.find((edge) => !isDestructiveEdge(edge));
    return forward ? edgeKey(forward) : null;
  }, [allowedTransitions]);

  /** Primary first, irreversible actions last. */
  const orderedTransitions = useMemo(() => {
    const primary = allowedTransitions.find((edge) => edgeKey(edge) === primaryEdgeKey);
    const rest = allowedTransitions.filter((edge) => edge !== primary);
    return [
      ...(primary ? [primary] : []),
      ...rest.filter((edge) => !isDestructiveEdge(edge)),
      ...rest.filter((edge) => isDestructiveEdge(edge)),
    ];
  }, [allowedTransitions, primaryEdgeKey]);

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

  const resolutionNoteError = activeEdge?.resolutionNoteRequired
    ? validateResolutionNote(resolutionNote)
    : null;
  const canConfirmTransition = !isTransitioning && !resolutionNoteError;
  const isDestructiveActive = activeEdge ? isDestructiveEdge(activeEdge) : false;
  const isBottomBar = allowedTransitions.length > 0 || activeEdge !== null;

  const openTransitionForm = (edge: TransitionEdge) => {
    setActiveEdge(edge);
    setNote('');
    setResolutionNote('');
    setTransitionError(null);
    setSuccessMessage(null);
  };

  const closeTransitionForm = () => {
    setActiveEdge(null);
    setNote('');
    setResolutionNote('');
    setTransitionError(null);
  };

  const confirmTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEdge || !id || !canConfirmTransition) return;
    const target = activeEdge.to;
    setTransitionError(null);
    setSuccessMessage(null);
    try {
      setIsTransitioning(true);
      const body: UpdateTicketStatusPayload = { to: activeEdge.to };
      if (note.trim()) body.note = note.trim();
      if (activeEdge.resolutionNoteRequired) body.resolution_note = resolutionNote.trim();
      await updateTicketStatus(id, body);
      closeTransitionForm();
      setSuccessMessage(`Đã chuyển phiếu sang “${statusLabel(target)}”.`);
      await loadTicketData(true);
    } catch (err) {
      setTransitionError(err);
    } finally {
      setIsTransitioning(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="mx-auto w-full max-w-6xl space-y-5"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Đang tải thông tin chi tiết phiếu yêu cầu...</span>
        <div className="flex items-center justify-between gap-2 border-b border-[#e5e5e2] pb-2">
          <div className="h-9 w-44 animate-pulse rounded-[4px] bg-[#f6f5f3]" />
          <div className="h-9 w-24 animate-pulse rounded-[4px] bg-[#f6f5f3]" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <div className="rounded-[4px] border border-[#e5e5e2] p-5">
              <div className="flex flex-wrap gap-2">
                <div className="h-5 w-20 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
                <div className="h-5 w-16 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
              </div>
              <div className="mt-4 h-7 w-3/4 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
              <div className="mt-3 h-4 w-1/2 animate-pulse rounded-[4px] bg-[#f6f5f3]" />
              <div className="mt-6 h-24 w-full animate-pulse rounded-[4px] bg-[#f6f5f3]" />
            </div>
            <div className="rounded-[4px] border border-[#e5e5e2] p-5">
              <div className="h-4 w-36 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full animate-pulse rounded-[4px] bg-[#f6f5f3]" />
                <div className="h-3 w-11/12 animate-pulse rounded-[4px] bg-[#f6f5f3]" />
                <div className="h-3 w-2/3 animate-pulse rounded-[4px] bg-[#f6f5f3]" />
              </div>
            </div>
          </div>
          <div className="rounded-[4px] border border-[#e5e5e2] p-4 max-lg:hidden">
            <div className="h-4 w-24 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
            <div className="mt-4 space-y-2">
              <div className="h-10 w-full animate-pulse rounded-[4px] bg-[#f6f5f3]" />
              <div className="h-10 w-full animate-pulse rounded-[4px] bg-[#f6f5f3]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="w-full space-y-4">
        <button
          type="button"
          onClick={() => navigate('/tickets')}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[4px] px-2 text-xs font-semibold text-[var(--color-content-muted)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] lg:min-h-9"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Quay lại danh sách phiếu</span>
        </button>
        <ErrorMessage
          error={error || new Error('Không tìm thấy thông tin phiếu yêu cầu.')}
          onRetry={() => void loadTicketData()}
          title="Không thể tải chi tiết phiếu"
        />
      </div>
    );
  }

  const ticketFields = ticket.request_fields || {};
  const hasFields = Object.values(ticketFields).some((value) => typeof value === 'string');
  const currentStatus = ticket.status;

  return (
    <div
      className={`w-full space-y-5 lg:space-y-6 lg:pb-6 ${
        activeEdge ? 'max-lg:pb-[75vh]' : isBottomBar ? 'max-lg:pb-40' : 'pb-6'
      }`}
    >
      {/* Top navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-edge)] pb-2">
        <button
          type="button"
          onClick={() => navigate('/tickets')}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[4px] px-2 text-xs font-semibold text-[var(--color-content-muted)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] lg:min-h-9"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Quay lại danh sách phiếu</span>
        </button>

        <button
          type="button"
          onClick={() => void loadTicketData(true)}
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        {/* ===== Left column: content ===== */}
        <div className="min-w-0 space-y-5">
          {/* Status header + meta */}
          <header className="overflow-hidden rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface shadow-2xs">
            <div className="border-b border-[var(--color-edge-subtle)] bg-gradient-to-b from-[var(--color-surface-sidebar)] to-surface px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={currentStatus} />
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
                    {ticket.requester_id}
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
                      <span className="font-mono text-[var(--color-primary)]">{ticket.assigned_to}</span>
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
            </div>
          </header>

          {/* Description + dynamic fields */}
          <section className="overflow-hidden rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface shadow-2xs">
            <div className="flex items-center gap-2 border-b border-[var(--color-edge-subtle)] px-5 py-3.5">
              <FileText className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
              <h2 className="text-sm font-bold tracking-tight text-[var(--color-content)]">
                Mô tả chi tiết nội dung sự cố
              </h2>
            </div>
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-content)]">
                {ticket.description}
              </p>
            </div>

            {hasFields && (
              <div className="border-t border-[var(--color-edge-subtle)] px-5 py-4">
                <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-content)]">
                  <ClipboardList className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                  <span>Thông tin bổ sung theo danh mục</span>
                </h2>
                <dl className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(ticketFields).map(([key, val]) =>
                    typeof val === 'string' ? (
                      <div
                        key={key}
                        className="min-w-0 rounded-[6px] border border-[var(--color-edge-subtle)] bg-[var(--color-surface-sidebar)] p-3"
                      >
                        <dt className="mb-0.5 break-all text-[11px] text-[var(--color-content-muted)]">
                          {category?.requirement_fields?.find((field) => field.key === key)?.label || key}
                        </dt>
                        <dd className="whitespace-pre-wrap break-words text-xs font-semibold text-[var(--color-content)]">{val}</dd>
                      </div>
                    ) : null
                  )}
                </dl>
              </div>
            )}
            {ticket.resolution_note && (
              <section aria-label="Kết quả xử lý" className="border-t border-[var(--color-edge-subtle)] px-5 py-4">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-content)]">
                  Kết quả xử lý
                </h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--color-content)]">
                  {ticket.resolution_note}
                </p>
              </section>
            )}
          </section>

          <AttachmentPanel ticketId={ticket.id} />

          {/* Timeline */}
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
                        <span className="rounded-[4px] bg-[#f6f5f3] px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-[var(--color-content-muted)]">
                          {group.items.length} sự kiện
                        </span>
                      </h3>

                      <div className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute bottom-3 left-3.5 top-3 w-px bg-[#e5e5e2]"
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
                                className="absolute left-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] text-[var(--color-primary)] shadow-2xs ring-4 ring-white"
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
                                    {evt.actor_id || 'Hệ thống'}
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
                                  <div className="mt-2 rounded-[4px] border border-[#e5e5e2] bg-[#f6f5f3]/80 px-3 py-2">
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
                                    <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--color-content)]">
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

          {/* Role-aware guidance */}
          <div className="flex items-start gap-3 rounded-[8px] border border-[var(--color-edge-subtle)] bg-[var(--color-surface-sidebar)] p-4 text-xs text-[var(--color-content-muted)] shadow-2xs">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
            <p className="leading-relaxed">
              <span className="font-bold text-[var(--color-content)]">Lưu ý:</span> Các nút chuyển trạng thái
              hiển thị theo vai trò của bạn và máy trạng thái của phiếu. Chuyển sang “
              {statusLabel('resolved')}” bắt buộc mô tả cách giải quyết (từ {RESOLUTION_NOTE_MIN}{' '}
              đến {RESOLUTION_NOTE_MAX} ký tự).
            </p>
          </div>
        </div>

        {/* ===== Right column: sticky action panel (bottom bar < lg) ===== */}
        <aside
          aria-label="Thao tác chuyển trạng thái"
          className={`z-10 lg:sticky lg:top-20 lg:self-start ${
            isBottomBar
              ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20'
              : ''
          }`}
        >
          <div className="max-lg:max-h-[70vh] max-lg:overflow-y-auto max-lg:border-t max-lg:border-[var(--color-edge-subtle)] max-lg:bg-surface/95 max-lg:px-4 max-lg:pb-3 max-lg:pt-3 max-lg:shadow-[0_-8px_24px_rgba(33,31,27,0.12)] max-lg:backdrop-blur-sm lg:max-h-[calc(100vh_-_6rem)] lg:overflow-y-auto lg:rounded-[8px] lg:border lg:border-[var(--color-edge-subtle)] lg:bg-surface lg:shadow-2xs">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-edge-subtle)] px-4 py-3 max-lg:hidden bg-[var(--color-surface-sidebar)]">
              <div className="flex min-w-0 items-center gap-2">
                <GitBranch className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                <h2 className="truncate text-sm font-bold tracking-tight text-[var(--color-content)]">
                  Thao tác
                </h2>
              </div>
              <StatusBadge status={currentStatus} />
            </div>

            <div className="space-y-3 lg:p-4">
              {/* Announcements */}
              <p className="sr-only" role="status" aria-live="polite">
                {successMessage ?? ''}
              </p>

              {successMessage && (
                <div className="flex items-start gap-2 rounded-[4px] border border-[#b8dcce] bg-[#e8f3ed] px-3 py-2 text-xs text-[#27553c]">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#448361]"
                    aria-hidden="true"
                  />
                  <p className="min-w-0 flex-1 px-1 leading-relaxed">{successMessage}</p>
                  <button
                    type="button"
                    onClick={() => setSuccessMessage(null)}
                    aria-label="Đóng thông báo chuyển trạng thái"
                    className="-mr-1 -mt-0.5 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[4px] text-[var(--color-content-muted)] transition-colors hover:text-[var(--color-content)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] lg:min-h-8 lg:min-w-8"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {transitionError !== null && (
                <div aria-live="assertive">
                  <Alert type="error" title="Không thể chuyển trạng thái">
                    {transitionError instanceof ApiClientError
                      ? transitionError.message
                      : 'Đã xảy ra lỗi khi cập nhật trạng thái phiếu. Vui lòng thử lại.'}
                  </Alert>
                </div>
              )}

              {activeEdge ? (
                <form
                  onSubmit={confirmTransition}
                  role="dialog"
                  aria-labelledby="transition-dialog-title"
                  className="space-y-3 rounded-[4px] border border-[var(--color-primary-border)] bg-[var(--color-primary-subtle)] p-3 sm:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3
                        id="transition-dialog-title"
                        className="break-words text-sm font-bold leading-snug text-[var(--color-content)]"
                      >
                        Chuyển phiếu sang “{statusLabel(activeEdge.to)}”
                      </h3>
                      {activeEdge.hint && (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--color-content-muted)]">
                          {activeEdge.hint}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={closeTransitionForm}
                      aria-label="Đóng form chuyển trạng thái"
                      className="-mr-1 -mt-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[4px] text-[var(--color-content-muted)] transition-colors hover:text-[var(--color-content)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] lg:min-h-8 lg:min-w-8"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={activeEdge.from} />
                    <ArrowRight className="h-3 w-3 shrink-0 text-[#8c8a85]" aria-hidden="true" />
                    <StatusBadge status={activeEdge.to} />
                  </div>

                  {isDestructiveActive && (
                    <div className="flex items-start gap-2 rounded-[4px] border border-[#f6c3c1] bg-[#fcedec] p-3 text-xs leading-relaxed text-[#962824]">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#d44c47]"
                        aria-hidden="true"
                      />
                      <p>
                        <strong className="font-semibold">Cảnh báo:</strong> Thao tác này không thể
                        hoàn tác. Phiếu sẽ chuyển sang “{statusLabel(activeEdge.to)}” và không thể tự
                        đảo ngược.
                      </p>
                    </div>
                  )}

                  {activeEdge.resolutionNoteRequired && (
                    <div className="rounded-[4px] border border-[var(--color-primary-border)] bg-surface p-3">
                      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
                        <label
                          htmlFor="transition-resolution-note"
                          className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-content)]"
                        >
                          Mô tả cách giải quyết{' '}
                          <span className="text-[#d44c47]" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <span className="font-mono text-[10px] text-[var(--color-content-muted)]">
                          {resolutionNote.trim().length} / {RESOLUTION_NOTE_MAX}
                        </span>
                      </div>
                      <textarea
                        id="transition-resolution-note"
                        rows={4}
                        required
                        aria-required="true"
                        aria-invalid={Boolean(resolutionNoteError)}
                        aria-describedby="transition-resolution-note-help"
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        maxLength={2100}
                        placeholder="Mô tả nguyên nhân gốc, cách khắc phục và kết quả kiểm tra..."
                        className={`${TEXTAREA_CLASS} ${
                          resolutionNoteError
                            ? 'border-[#f6c3c1] focus:border-[#d44c47] focus:ring-[#d44c47]'
                            : ''
                        }`}
                      />
                      <p
                        id="transition-resolution-note-help"
                        className="mt-1 text-[11px] leading-relaxed text-[var(--color-content-muted)]"
                      >
                        Bắt buộc khi chuyển sang “{statusLabel(activeEdge.to)}”, từ{' '}
                        {RESOLUTION_NOTE_MIN} đến {RESOLUTION_NOTE_MAX} ký tự.
                      </p>
                      {resolutionNoteError && (
                        <p className="mt-1 text-[11px] font-medium text-[#d44c47]">
                          {resolutionNoteError}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
                      <label
                        htmlFor="transition-note"
                        className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-content)]"
                      >
                        Ghi chú chuyển trạng thái{' '}
                        <span className="font-normal normal-case tracking-normal text-[#8c8a85]">
                          (không bắt buộc)
                        </span>
                      </label>
                      <span className="font-mono text-[10px] text-[var(--color-content-muted)]">
                        {note.trim().length} / 2000 ký tự
                      </span>
                    </div>
                    <textarea
                      id="transition-note"
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={2000}
                      placeholder="VD: Đã gọi điện hướng dẫn người dùng khởi động lại modem."
                      className={TEXTAREA_CLASS}
                    />
                  </div>

                  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeTransitionForm}
                      className={`${BTN_SECONDARY} w-full sm:w-auto`}
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={!canConfirmTransition}
                      className={`${
                        isDestructiveActive
                          ? BTN_DANGER_SOLID
                          : activeEdge.to === 'resolved' || activeEdge.to === 'closed'
                            ? BTN_SUCCESS
                            : BTN_PRIMARY
                      } w-full sm:w-auto`}
                    >
                      {isTransitioning ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          />
                          <span>Đang cập nhật...</span>
                        </>
                      ) : (
                        <span>Xác nhận chuyển trạng thái</span>
                      )}
                    </button>
                  </div>
                </form>
              ) : allowedTransitions.length > 0 ? (
                <>
                  <p className="text-[11px] leading-relaxed text-[var(--color-content-muted)] max-lg:hidden">
                    Chọn thao tác phù hợp với vai trò của bạn.
                  </p>
                  <div className="flex flex-col gap-2">
                    {orderedTransitions.map((edge) => {
                      const destructive = isDestructiveEdge(edge);
                      const isPrimary = edgeKey(edge) === primaryEdgeKey;
                      const isFinish = edge.to === 'resolved' || edge.to === 'closed';
                      const Icon = STATUS_ICONS[edge.to];
                      return (
                        <button
                          key={edgeKey(edge)}
                          type="button"
                          onClick={() => openTransitionForm(edge)}
                          className={`w-full ${
                            destructive
                              ? BTN_DANGER
                              : isPrimary
                                ? isFinish
                                  ? BTN_SUCCESS
                                  : BTN_PRIMARY
                                : BTN_SECONDARY
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{edge.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2 rounded-[4px] border border-[var(--color-edge)] bg-[#f6f5f3]/80 px-3 py-2.5">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8c8a85]" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-[var(--color-content-muted)]">
                    Hiện không có thao tác chuyển trạng thái nào khả dụng cho bạn với phiếu ở trạng
                    thái «{statusLabel(currentStatus)}».
                  </p>
                </div>
              )}

              {!activeEdge && (
                <div className="rounded-[4px] border border-[#e5e5e2] bg-[#f6f5f3]/70 p-3 max-lg:hidden">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-content)]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                    Biên bản giải quyết
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-content-muted)]">
                    Bắt buộc mô tả cách giải quyết từ {RESOLUTION_NOTE_MIN} đến {RESOLUTION_NOTE_MAX}{' '}
                    ký tự khi chuyển phiếu sang “{statusLabel('resolved')}”.
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};