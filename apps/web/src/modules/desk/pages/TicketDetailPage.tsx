// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileText, Info } from 'lucide-react';
import { getTicketById, getTicketEvents, getCategories } from '../../../services/api';
import { Ticket, TicketEvent, Category } from '../../../types/api';
import { ErrorMessage } from '../../../components/common/ErrorMessage';
import { Skeleton, SkeletonText } from '../../../components/common/Skeleton';
import { requestFieldEntries } from '../../../lib/requestFields';
import { TicketDetailHeader, TicketDetailNav } from '../../../components/ticket-detail/TicketDetailHeader';
import { TicketTimeline } from '../../../components/ticket-detail/TicketTimeline';
import {
  BottomBarSize,
  TicketWorkflowActions,
} from '../../../components/ticket-detail/TicketWorkflowActions';
import { TicketAttachmentSection } from '../../../components/ticket-detail/TicketAttachmentSection';
import { TicketStageTracker, SlaPauseBanner } from '../../../components/workflow';
import { TicketAiSuggestion } from '../TicketAiSuggestion';
import { useAuth } from '../../../contexts/AuthContext';

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile, roles } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [bottomBar, setBottomBar] = useState<BottomBarSize>('none');
  const requestRevision = useRef(0);

  const loadTicketData = useCallback(async (silent = false) => {
    if (!id) return;
    const revision = ++requestRevision.current;
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const [ticketData, eventsData, categoriesData] = await Promise.all([
        getTicketById(id),
        getTicketEvents(id),
        getCategories().catch(() => ({ data: [] })),
      ]);

      if (revision !== requestRevision.current) return;

      setTicket(ticketData);
      setEvents(eventsData.data || []);
      setCategories(categoriesData.data);

      if (ticketData && categoriesData.data) {
        const foundCategory = categoriesData.data.find((c) => c.id === ticketData.category_id);
        setCategory(foundCategory || null);
      }
    } catch (err) {
      if (revision !== requestRevision.current) return;
      setError(err);
    } finally {
      if (revision === requestRevision.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [id]);

  useEffect(() => {
    void loadTicketData();
    return () => {
      requestRevision.current += 1;
    };
  }, [loadTicketData]);

  if (isLoading) {
    return (
      <div className="w-full space-y-5" role="status" aria-busy="true">
        <span className="sr-only">Đang tải thông tin chi tiết phiếu yêu cầu...</span>
        <div className="flex items-center justify-between gap-2 border-b border-edge pb-2">
          <Skeleton decorative className="h-8 w-44" />
          <Skeleton decorative className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_288px] xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <div className="rounded-lg border border-edge p-5">
              <div className="flex flex-wrap gap-2">
                <Skeleton decorative className="h-5 w-20" />
                <Skeleton decorative className="h-5 w-16" />
              </div>
              <Skeleton decorative className="mt-4 h-7 w-3/4" />
              <Skeleton decorative className="mt-3 h-4 w-1/2" />
              <Skeleton decorative className="mt-6 h-24 w-full" />
            </div>
            <div className="rounded-lg border border-edge p-5">
              <Skeleton decorative className="h-4 w-36" />
              <SkeletonText decorative className="mt-4" lineHeight="h-3" lines={3} />
            </div>
          </div>
          <div className="rounded-lg border border-edge p-4 max-lg:hidden">
            <Skeleton decorative className="h-4 w-24" />
            <div className="mt-4 space-y-2">
              <Skeleton decorative className="h-10 w-full" />
              <Skeleton decorative className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="w-full space-y-4">
        <Link
          to="/tickets"
          className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-sm px-1 text-[0.8125rem] font-medium text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:min-h-8"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Về danh sách phiếu
        </Link>
        <ErrorMessage
          error={error || new Error('Không tìm thấy thông tin phiếu yêu cầu.')}
          onRetry={() => void loadTicketData()}
          title="Không thể tải chi tiết phiếu"
        />
      </div>
    );
  }

  const isStaff = roles.some((role) => role === 'Agent' || role === 'Manager');
  // Nhãn tiếng Việt theo danh mục (hoặc nhãn dự phòng); không bao giờ hiện khóa kỹ thuật.
  const fieldEntries = requestFieldEntries(ticket.request_fields, category);

  return (
    <div
      className={`w-full space-y-5 pb-6 lg:space-y-6 ${
        bottomBar === 'tall' ? 'max-lg:pb-[calc(55dvh+1rem)]' : bottomBar === 'compact' ? 'max-lg:pb-40' : ''
      }`}
    >
      <TicketDetailNav isRefreshing={isRefreshing} onRefresh={() => void loadTicketData(true)} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_288px] xl:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        {/* Cột trái là một container: tiêu đề, banner và tiến trình co theo bề rộng cột,
            nên cột thao tác bên phải bắt đầu ngang hàng với tiêu đề phiếu. */}
        <div className="@container min-w-0 space-y-5">
          <TicketDetailHeader ticket={ticket} category={category} />

          <SlaPauseBanner ticket={ticket} audience={isStaff ? 'staff' : 'requester'} />

          <TicketStageTracker ticket={ticket} events={events} />

          {profile?.assistant_enabled && isStaff && (
            <TicketAiSuggestion
              key={ticket.id}
              ticketId={ticket.id}
              ticket={ticket}
              ticketStatus={ticket.status}
              assignedTo={ticket.assigned_to}
              categories={categories}
              refresh={() => loadTicketData(true)}
            />
          )}

          <section className="overflow-hidden rounded-lg border border-edge bg-surface">
            <div className="flex items-center gap-2 border-b border-edge px-5 py-3">
              <FileText className="h-4 w-4 shrink-0 text-[var(--color-primary-ink)]" aria-hidden="true" />
              <h2 className="dx-section-title">
                Mô tả sự cố
              </h2>
            </div>
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-content)]">
                {ticket.description}
              </p>
            </div>

            {fieldEntries.length > 0 && (
              <div className="border-t border-edge px-5 py-4">
                <h3 className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-content">
                  <ClipboardList className="h-3.5 w-3.5 text-[var(--color-primary-ink)]" aria-hidden="true" />
                  <span>Thông tin bổ sung theo danh mục</span>
                </h3>
                <dl className="mt-2.5 grid grid-cols-1 gap-2 @md:grid-cols-2">
                  {fieldEntries.map((field) => (
                    <div key={field.key} className="min-w-0 rounded-md border border-edge bg-surface-muted p-3">
                      <dt className="mb-0.5 text-xs text-content-muted">{field.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-[0.8125rem] font-medium text-content">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {ticket.resolution_note && (
              <section aria-label="Kết quả xử lý" className="border-t border-edge px-5 py-4">
                <h3 className="text-[0.8125rem] font-semibold text-content">
                  Kết quả xử lý
                </h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-content">
                  {ticket.resolution_note}
                </p>
              </section>
            )}
          </section>

          <TicketAttachmentSection ticketId={ticket.id} />

          <TicketTimeline events={events} />

          {/* Người tạo phiếu: cho biết khi nào trang này cần họ. Quy tắc ghi chú giải quyết
              chỉ nằm ở form "Đánh dấu đã giải quyết", nơi nó có tác dụng. */}
          {!isStaff && (
            <div className="flex items-start gap-3 rounded-lg border border-edge bg-surface-muted p-4 text-[0.8125rem] text-content-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary-ink)]" aria-hidden="true" />
              <p className="leading-relaxed">
                <span className="font-semibold text-[var(--color-content)]">Lưu ý:</span> Khi phiếu cần
                bạn, thao tác sẽ xuất hiện tại đây: trả lời khi kỹ thuật viên hỏi thêm, hoặc xác nhận
                đóng phiếu khi sự cố đã được giải quyết.
              </p>
            </div>
          )}
        </div>

        {/* Right column: workflow actions */}
        <TicketWorkflowActions
          ticket={ticket}
          events={events}
          onTransitionSuccess={async () => {
            await loadTicketData(true);
          }}
          onBottomBarChange={setBottomBar}
        />
      </div>
    </div>
  );
};
