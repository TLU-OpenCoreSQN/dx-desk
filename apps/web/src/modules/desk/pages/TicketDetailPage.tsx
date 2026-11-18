// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileText, Info } from 'lucide-react';
import { getTicketById, getTicketEvents, getCategories } from '../../../services/api';
import { Ticket, TicketEvent, Category } from '../../../types/api';
import { ErrorMessage } from '../../../components/common/ErrorMessage';
import { TicketDetailHeader } from '../../../components/ticket-detail/TicketDetailHeader';
import { TicketTimeline } from '../../../components/ticket-detail/TicketTimeline';
import { TicketWorkflowActions } from '../../../components/ticket-detail/TicketWorkflowActions';
import { TicketAttachmentSection } from '../../../components/ticket-detail/TicketAttachmentSection';
import { TicketStageTracker, SlaPauseBanner } from '../../../components/workflow';
import { TicketAiSuggestion } from '../TicketAiSuggestion';
import { useAuth } from '../../../contexts/AuthContext';
import {
  RESOLUTION_NOTE_MAX,
  RESOLUTION_NOTE_MIN,
  statusLabel,
} from '../../../lib/ticketWorkflow';

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, roles } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [hasActiveEdge, setHasActiveEdge] = useState<boolean>(false);

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
      setCategories(categoriesData.data);

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

  if (isLoading) {
    return (
      <div
        className="mx-auto w-full max-w-6xl space-y-5"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Đang tải thông tin chi tiết phiếu yêu cầu...</span>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-edge-subtle)] pb-2">
          <div className="h-9 w-44 animate-pulse rounded-[4px] bg-[var(--color-surface-warm)]" />
          <div className="h-9 w-24 animate-pulse rounded-[4px] bg-[var(--color-surface-warm)]" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <div className="rounded-[4px] border border-[var(--color-edge-subtle)] p-5">
              <div className="flex flex-wrap gap-2">
                <div className="h-5 w-20 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
                <div className="h-5 w-16 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
              </div>
              <div className="mt-4 h-7 w-3/4 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
              <div className="mt-3 h-4 w-1/2 animate-pulse rounded-[4px] bg-[var(--color-surface-warm)]" />
              <div className="mt-6 h-24 w-full animate-pulse rounded-[4px] bg-[var(--color-surface-warm)]" />
            </div>
            <div className="rounded-[4px] border border-[var(--color-edge-subtle)] p-5">
              <div className="h-4 w-36 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full animate-pulse rounded-[4px] bg-[var(--color-surface-warm)]" />
                <div className="h-3 w-11/12 animate-pulse rounded-[4px] bg-[var(--color-surface-warm)]" />
                <div className="h-3 w-2/3 animate-pulse rounded-[4px] bg-[var(--color-surface-warm)]" />
              </div>
            </div>
          </div>
          <div className="rounded-[4px] border border-[var(--color-edge-subtle)] p-4 max-lg:hidden">
            <div className="h-4 w-24 animate-pulse rounded-[4px] bg-[var(--color-surface-muted)]" />
            <div className="mt-4 space-y-2">
              <div className="h-10 w-full animate-pulse rounded-[4px] bg-[var(--color-surface-warm)]" />
              <div className="h-10 w-full animate-pulse rounded-[4px] bg-[var(--color-surface-warm)]" />
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

  return (
    <div
      className={`w-full space-y-5 lg:space-y-6 lg:pb-6 ${
        hasActiveEdge ? 'max-lg:pb-[75vh]' : 'max-lg:pb-40 pb-6'
      }`}
    >
      <TicketDetailHeader
        ticket={ticket}
        category={category}
        isRefreshing={isRefreshing}
        onRefresh={() => void loadTicketData(true)}
        onBack={() => navigate('/tickets')}
      />

      <SlaPauseBanner ticket={ticket} />

      <TicketStageTracker ticket={ticket} events={events} />

      {profile?.assistant_enabled && roles.some(role => role === 'Agent' || role === 'Manager') && (
        <TicketAiSuggestion key={ticket.id} ticketId={ticket.id} ticket={ticket} categories={categories} refresh={() => loadTicketData(true)} />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        {/* Left column: content */}
        <div className="min-w-0 space-y-5">
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
                        <dd className="whitespace-pre-wrap break-words text-xs font-semibold text-[var(--color-content)]">
                          {val}
                        </dd>
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

          <TicketAttachmentSection ticketId={ticket.id} />

          <TicketTimeline events={events} />

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

        {/* Right column: workflow actions */}
        <TicketWorkflowActions
          ticket={ticket}
          onTransitionSuccess={async () => {
            await loadTicketData(true);
          }}
          onActiveEdgeChange={setHasActiveEdge}
        />
      </div>
    </div>
  );
};
