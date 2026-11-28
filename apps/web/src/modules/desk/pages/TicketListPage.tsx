// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Inbox, Kanban, LayoutList, PlusCircle, RefreshCw, Search, SearchX } from 'lucide-react';
import { getTickets, getCategories, claimTicket, ApiClientError } from '../../../services/api';
import { Category, Ticket, TicketFilters, TicketPriority } from '../../../types/api';
import { PriorityBadge, StatusBadge } from '../../../components/common/Badge';
import { Button, buttonClass } from '../../../components/common/Button';
import { fieldClass } from '../../../components/common/FormField';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../../components/common/ErrorMessage';
import { EmptyState } from '../../../components/common/EmptyState';
import { SlaRemaining } from '../../../components/common/SlaRemaining';
import {
  cellClass,
  DataTable,
  DataTableBody,
  DataTableHead,
  rowClass,
  TicketCode,
  Th,
} from '../../../components/common/DataTable';
import { TicketKanbanBoard } from '../../../components/workflow';
import { computeSlaSnapshot, slaRisk } from '../../../lib/sla';
import { useAuth } from '../../../contexts/AuthContext';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const PRIORITY_OPTIONS: { value: TicketPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả ưu tiên' },
  { value: 'critical', label: 'Khẩn cấp' },
  { value: 'high', label: 'Cao' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'low', label: 'Thấp' },
];
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'new', label: 'Mới tạo' },
  { value: 'triaged', label: 'Đã phân loại' },
  { value: 'assigned', label: 'Đã phân công' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'waiting_user', label: 'Chờ phản hồi' },
  { value: 'pending_approval', label: 'Chờ phê duyệt' },
  { value: 'resolved', label: 'Đã giải quyết' },
  { value: 'closed', label: 'Đã đóng' },
  { value: 'cancelled', label: 'Đã hủy' },
];
const VALID_PRIORITIES = PRIORITY_OPTIONS.map((o) => o.value as string);
const VALID_STATUSES = STATUS_OPTIONS.map((o) => o.value);

function formatUpdated(isoString: string): { date: string; time: string; full: string } {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return { date: isoString, time: '', full: isoString };
  return {
    date: parsed.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: parsed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    full: parsed.toLocaleString('vi-VN'),
  };
}

/** Chuỗi tìm kiếm trên URL đổi ngay khi gõ; lời gọi máy chủ đợi người dùng ngừng gõ. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export const TicketListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState<number | undefined>();
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);
  // Trạng thái thao tác "Nhận xử lý" trên Kanban.
  const [claimBusyId, setClaimBusyId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<unknown>(null);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);
  const claimInFlight = useRef(false);

  // Bộ lọc nằm trên URL để chia sẻ, tải lại và nút Back đều giữ đúng ngữ cảnh.
  const qParam = searchParams.get('q') ?? '';
  const rawPriority = searchParams.get('priority') ?? 'all';
  const filterPriority = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : 'all';
  const rawStatus = searchParams.get('status') ?? 'all';
  const filterStatus = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'all';
  const sortParam = searchParams.get('sort') === 'sla' ? 'sla' : 'newest';
  const pageParam = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const offset = (pageParam - 1) * PAGE_SIZE;
  const viewMode = searchParams.get('view') === 'kanban' ? 'kanban' : 'table';

  const [searchInput, setSearchInput] = useState<string>(qParam);
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);
  const debouncedQ = useDebounced(qParam.trim(), SEARCH_DEBOUNCE_MS);

  const filters = useMemo<TicketFilters>(() => {
    const next: TicketFilters = {};
    if (debouncedQ) next.q = debouncedQ;
    if (filterPriority !== 'all') next.priority = filterPriority as TicketPriority;
    if (filterStatus !== 'all') next.status = filterStatus;
    if (sortParam === 'sla') next.sort = 'sla_due';
    return next;
  }, [debouncedQ, filterPriority, filterStatus, sortParam]);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | number | undefined | null>, replace = true) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (
              value === undefined ||
              value === null ||
              value === '' ||
              value === 'all' ||
              (key === 'page' && Number(value) <= 1) ||
              (key === 'view' && value === 'table') ||
              (key === 'sort' && value === 'newest')
            ) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  const isStaff = roles.includes('Agent') || roles.includes('Manager');
  const requestRevision = useRef(0);

  const loadData = useCallback(async (currentOffset: number, currentFilters: TicketFilters) => {
    const revision = ++requestRevision.current;
    setIsLoading(true);
    setError(null);
    try {
      const [ticketRes, categoryRes] = await Promise.allSettled([
        getTickets(PAGE_SIZE, currentOffset, currentFilters),
        getCategories(),
      ]);

      if (revision !== requestRevision.current) return;

      if (ticketRes.status === 'rejected') throw ticketRes.reason;
      setTickets(ticketRes.value.data || []);
      setTotal(ticketRes.value.total);

      if (categoryRes.status === 'fulfilled' && categoryRes.value.data) {
        setCategories(Object.fromEntries(categoryRes.value.data.map((cat) => [cat.id, cat])));
      }
    } catch (err) {
      if (revision !== requestRevision.current) return;
      setTickets([]);
      setTotal(undefined);
      setError(err);
    } finally {
      if (revision === requestRevision.current) setIsLoading(false);
    }
  }, []);

  const reload = useCallback(() => loadData(offset, filters), [loadData, offset, filters]);

  useEffect(() => {
    void reload();
    return () => {
      requestRevision.current += 1;
    };
  }, [reload]);

  const handleClaim = async (ticket: Ticket) => {
    if (claimInFlight.current) return;
    claimInFlight.current = true;
    setClaimBusyId(ticket.id);
    setClaimError(null);
    setClaimNotice(null);
    try {
      await claimTicket(ticket.id);
      setClaimNotice('Đã nhận phiếu. Phiếu có trong hàng đợi Đang phụ trách.');
      await reload();
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setClaimNotice('Phiếu vừa được người khác cập nhật. Danh sách đã được tải lại; hãy kiểm tra trước khi thao tác tiếp.');
        await reload();
      } else {
        setClaimError(err);
      }
    } finally {
      claimInFlight.current = false;
      setClaimBusyId(null);
    }
  };

  const hasActiveFilters = qParam.trim() !== '' || filterPriority !== 'all' || filterStatus !== 'all';

  // Đổi bộ lọc thì kết quả khác hẳn, nên luôn quay về trang 1.
  const resetFilters = () => {
    setSearchInput('');
    updateSearchParams({ q: undefined, priority: undefined, status: undefined, page: undefined });
  };

  const pageCount = total !== undefined ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : undefined;
  const hasNext = total === undefined ? tickets.length === PAGE_SIZE : offset + PAGE_SIZE < total;
  const canPaginate = !error && (offset > 0 || hasNext);
  const pageLabel = pageCount ? `Trang ${pageParam}/${pageCount}` : `Trang ${pageParam}`;

  const goToPage = (page: number) => {
    if (!isLoading) updateSearchParams({ page: page > 1 ? page : undefined }, false);
  };

  const resultSummary = isLoading
    ? 'Đang tải dữ liệu...'
    : error
      ? 'Không thể tải danh sách phiếu.'
      : total !== undefined
        ? `${total} phiếu${hasActiveFilters ? ' khớp bộ lọc' : ''} · ${pageLabel}`
        : `${tickets.length} phiếu trên trang này · ${pageLabel}`;

  const rows = useMemo(() => {
    const now = Date.now();
    return tickets.map((ticket) => {
      const sla = computeSlaSnapshot(ticket, now);
      return { ticket, sla, risk: slaRisk(sla) };
    });
  }, [tickets]);

  const viewToggle = (
    <div role="group" aria-label="Chế độ xem" className="inline-flex rounded-md border border-edge bg-surface p-0.5">
      {([['table', 'Bảng danh sách', LayoutList], ['kanban', 'Kanban luồng việc', Kanban]] as const).map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          aria-pressed={viewMode === key}
          onClick={() => updateSearchParams({ view: key })}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:min-h-9 ${
            viewMode === key ? 'bg-primary text-white' : 'text-content-muted hover:bg-state-hover hover:text-content'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );

  const table = (
    <DataTable label="Danh sách phiếu yêu cầu">
      <DataTableHead>
        <Th width="w-24">Mã</Th>
        <Th>Tiêu đề</Th>
        <Th width="w-32">Ưu tiên</Th>
        <Th width="w-40">Trạng thái</Th>
        <Th width="w-40">Phụ trách</Th>
        <Th width="w-48">Hạn SLA</Th>
        <Th width="w-28" align="right">Cập nhật</Th>
      </DataTableHead>
      <DataTableBody>
        {rows.map(({ ticket, sla, risk }) => {
          const categoryName = categories[ticket.category_id]?.name;
          const updated = formatUpdated(ticket.updated_at || ticket.created_at);
          return (
            <tr key={ticket.id} className={rowClass()}>
              <td className={`${cellClass()} order-2 @3xl:order-none`}>
                <TicketCode id={ticket.id} />
              </td>
              <td className={`${cellClass({ span: true })} order-1 @3xl:order-none`}>
                <Link
                  to={`/tickets/${encodeURIComponent(ticket.id)}`}
                  className="block max-w-full rounded-sm text-sm font-semibold text-content hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="line-clamp-2 break-words">{ticket.title}</span>
                </Link>
                {categoryName && <p className="mt-0.5 truncate text-xs text-content-muted">{categoryName}</p>}
              </td>
              <td className={`${cellClass()} order-3 @3xl:order-none`}>
                <PriorityBadge priority={ticket.priority} />
              </td>
              <td className={`${cellClass()} order-4 @3xl:order-none`}>
                <StatusBadge status={ticket.status} />
              </td>
              <td className={`${cellClass()} order-5 @3xl:order-none`}>
                {ticket.assigned_to ? (
                  <p className="truncate text-[0.8125rem] font-medium text-content" title={ticket.assignee_name || undefined}>
                    {ticket.assignee_name || 'Kỹ thuật viên đã nhận'}
                  </p>
                ) : (
                  <p className="truncate text-[0.8125rem] text-content-muted">Chưa phân công</p>
                )}
                {ticket.team_name && <p className="truncate text-xs text-content-muted">{ticket.team_name}</p>}
              </td>
              <td className={`${cellClass()} order-6 @3xl:order-none`}>
                <SlaRemaining snapshot={sla} risk={risk} />
              </td>
              <td className={`${cellClass({ align: 'right' })} order-7 @3xl:order-none`}>
                <time dateTime={ticket.updated_at || ticket.created_at} title={updated.full} className="block tabular-nums text-xs text-content-muted">
                  <span className="block whitespace-nowrap">{updated.date}</span>
                  <span className="block whitespace-nowrap">{updated.time}</span>
                </time>
              </td>
            </tr>
          );
        })}
      </DataTableBody>
    </DataTable>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingSpinner label="Đang tải danh sách phiếu từ máy chủ..." />;
  } else if (error) {
    body = <ErrorMessage error={error} onRetry={() => void reload()} title="Không thể tải danh sách phiếu yêu cầu" />;
  } else if (tickets.length === 0) {
    body = offset > 0 ? (
      <EmptyState
        title="Trang này không còn phiếu"
        description="Hãy quay lại trang trước để xem các phiếu còn lại."
        actionText="Quay lại trang trước"
        onAction={() => goToPage(pageParam - 1)}
        icon={<Inbox className="h-6 w-6 text-content-muted" aria-hidden="true" />}
      />
    ) : hasActiveFilters ? (
      <EmptyState
        title="Không tìm thấy kết quả phù hợp"
        description="Không có phiếu nào khớp với từ khóa hoặc bộ lọc hiện tại."
        actionText="Xóa bộ lọc"
        onAction={resetFilters}
        icon={<SearchX className="h-6 w-6 text-content-muted" aria-hidden="true" />}
      />
    ) : (
      <EmptyState
        title="Chưa có phiếu yêu cầu nào"
        description="Hệ thống chưa ghi nhận phiếu hỗ trợ IT nào. Bạn có thể tạo phiếu mới để gửi sự cố tới bộ phận hỗ trợ."
        actionText="Tạo phiếu hỗ trợ ngay"
        onAction={() => navigate('/tickets/new')}
        icon={<Inbox className="h-6 w-6 text-content-muted" aria-hidden="true" />}
      />
    );
  } else if (viewMode === 'kanban') {
    body = (
      <div className="space-y-3">
        {claimNotice && (
          <p role="status" className="rounded-lg border border-status-success-border bg-status-success-bg p-3 text-sm text-status-success">
            {claimNotice}
          </p>
        )}
        {claimError != null && <ErrorMessage error={claimError} title="Không nhận được phiếu" />}
        <TicketKanbanBoard
          tickets={tickets}
          canClaim={(t) => isStaff && t.status === 'assigned' && !t.assigned_to}
          busyTicketId={claimBusyId}
          onClaimTicket={handleClaim}
        />
      </div>
    );
  } else {
    body = table;
  }

  return (
    <div className="w-full space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="dx-page-title">Danh sách phiếu yêu cầu IT</h1>
          <p className="mt-1 text-sm text-content-muted">
            {isStaff ? 'Toàn bộ phiếu bạn có quyền xem.' : 'Các phiếu bạn đã gửi.'} Tìm kiếm và bộ lọc áp dụng cho mọi trang.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewToggle}
          <Button
            variant="secondary"
            onClick={() => void reload()}
            disabled={isLoading}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Làm mới
          </Button>
          <Link to="/tickets/new" className={`${buttonClass('primary')} gap-2`}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Tạo phiếu mới
          </Link>
        </div>
      </header>

      <section aria-label="Tìm kiếm và lọc phiếu" className="flex flex-wrap items-end gap-3">
        <label htmlFor="ticket-search" className="min-w-0 flex-1 basis-64 text-[0.8125rem] font-medium text-content">
          Tìm phiếu
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
            <input
              id="ticket-search"
              type="search"
              aria-label="Tìm phiếu"
              placeholder="Tiêu đề, mô tả, mã phiếu, người phụ trách…"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                updateSearchParams({ q: e.target.value || undefined, page: undefined });
              }}
              className={`${fieldClass(false)} pl-9`}
            />
          </span>
        </label>
        <label htmlFor="ticket-filter-priority" className="w-[calc(50%-6px)] text-[0.8125rem] font-medium text-content sm:w-44">
          Mức ưu tiên
          <select
            id="ticket-filter-priority"
            aria-label="Mức ưu tiên"
            value={filterPriority}
            onChange={(e) => updateSearchParams({ priority: e.target.value, page: undefined })}
            className={`${fieldClass(false)} mt-1 block`}
          >
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label htmlFor="ticket-filter-status" className="w-[calc(50%-6px)] text-[0.8125rem] font-medium text-content sm:w-48">
          Trạng thái
          <select
            id="ticket-filter-status"
            aria-label="Trạng thái"
            value={filterStatus}
            onChange={(e) => updateSearchParams({ status: e.target.value, page: undefined })}
            className={`${fieldClass(false)} mt-1 block`}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label htmlFor="ticket-sort" className="w-[calc(50%-6px)] text-[0.8125rem] font-medium text-content sm:w-48">
          Sắp xếp
          <select
            id="ticket-sort"
            value={sortParam}
            onChange={(e) => updateSearchParams({ sort: e.target.value, page: undefined })}
            className={`${fieldClass(false)} mt-1 block`}
          >
            <option value="newest">Mới tạo trước</option>
            <option value="sla">Hạn SLA gần nhất</option>
          </select>
        </label>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={resetFilters}>
            Bỏ lọc
          </Button>
        )}
      </section>

      <p aria-live="polite" className="text-[0.8125rem] text-content-muted">{resultSummary}</p>

      {body}

      {canPaginate && !isLoading && (
        <nav aria-label="Phân trang danh sách phiếu" className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" disabled={offset === 0 || isLoading} onClick={() => goToPage(pageParam - 1)}>
            Trang trước
          </Button>
          <span data-numeric className="text-[0.8125rem] text-content-muted">{pageLabel}</span>
          <Button variant="secondary" disabled={!hasNext || isLoading} onClick={() => goToPage(pageParam + 1)}>
            Trang sau
          </Button>
        </nav>
      )}

      {Boolean(error) && offset > 0 && (
        <Button variant="secondary" onClick={() => goToPage(pageParam - 1)}>
          Trang trước
        </Button>
      )}
    </div>
  );
};
