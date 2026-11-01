// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  PlusCircle,
  RefreshCw,
  Search,
  SearchX,
  Tag,
  UserCheck,
  X,
} from 'lucide-react';
import { getTickets, getCategories } from '../services/api';
import { Ticket, Category } from '../types/api';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 25;

/** Desktop column track (minimum md row height comes from the row link classes). */
const TABLE_GRID = 'lg:grid-cols-[84px_minmax(0,1fr)_104px_140px_120px_116px]';
/** Mobile card track: code | flexible middle | right-aligned meta. */
const MOBILE_GRID = 'grid-cols-[auto_minmax(0,1fr)_auto]';

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

interface DateParts {
  date: string;
  time: string;
  full: string;
}

function formatDateParts(isoString: string): DateParts {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return { date: isoString, time: '', full: isoString };
  }
  return {
    date: parsed.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: parsed.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    full: parsed.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

const shortTicketId = (id: string) => id.slice(0, 8);

export const TicketListPage: React.FC = () => {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [offset, setOffset] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  // Search & filter states (client-side, current page only)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const isStaff = roles.includes('Agent') || roles.includes('Manager');

  const loadData = useCallback(async (currentOffset: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const [ticketRes, categoryRes] = await Promise.allSettled([
        getTickets(PAGE_SIZE, currentOffset),
        getCategories(),
      ]);

      if (ticketRes.status === 'fulfilled') {
        setTickets(ticketRes.value.data || []);
      } else {
        throw ticketRes.reason;
      }

      if (categoryRes.status === 'fulfilled' && categoryRes.value.data) {
        const catMap: Record<string, Category> = {};
        for (const cat of categoryRes.value.data) {
          catMap[cat.id] = cat;
        }
        setCategories(catMap);
      }
    } catch (err) {
      setTickets([]);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(offset);
  }, [loadData, offset]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        const matchesSearch =
          normalizedQuery === '' ||
          ticket.title.toLowerCase().includes(normalizedQuery) ||
          ticket.id.toLowerCase().includes(normalizedQuery);
        const matchesPriority =
          filterPriority === 'all' || ticket.priority === filterPriority;
        const matchesStatus =
          filterStatus === 'all' || ticket.status === filterStatus;
        return matchesSearch && matchesPriority && matchesStatus;
      }),
    [tickets, normalizedQuery, filterPriority, filterStatus]
  );

  const hasActiveFilters =
    normalizedQuery !== '' || filterPriority !== 'all' || filterStatus !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setFilterPriority('all');
    setFilterStatus('all');
  };

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const isFirstPage = offset === 0;
  const isLastPage = tickets.length < PAGE_SIZE;
  const canPaginate = tickets.length > 0 || offset > 0;

  const handlePrevPage = () => {
    if (!isLoading && offset >= PAGE_SIZE) {
      setOffset(offset - PAGE_SIZE);
    }
  };

  const handleNextPage = () => {
    if (!isLoading && tickets.length === PAGE_SIZE) {
      setOffset(offset + PAGE_SIZE);
    }
  };

  const resultSummary = hasActiveFilters
    ? `${filteredTickets.length}/${tickets.length} phiếu khớp bộ lọc`
    : `${tickets.length} phiếu trên trang này`;

  return (
    <div className="w-full space-y-5">
      {/* Page title & primary actions */}
      <div className="flex flex-col gap-3 border-b border-[#e4e3e0] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[#211f1b] sm:text-2xl">
              Danh sách phiếu yêu cầu IT
            </h1>
            <span className="inline-flex items-center rounded-[4px] border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-primary-text)] shadow-2xs">
              {isStaff ? 'Toàn bộ phiếu' : 'Phiếu của tôi'}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#5f5e5a]">
            Mỗi trang hiển thị tối đa {PAGE_SIZE} phiếu. Tìm kiếm và bộ lọc chỉ áp dụng cho
            trang đang xem — dùng phân trang để xem các phiếu còn lại.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadData(offset)}
            disabled={isLoading}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[6px] border border-[#e4e3e0] bg-white px-3.5 text-xs font-semibold text-[#211f1b] shadow-2xs transition-all hover:bg-[#f1f1ef] hover:border-[#d6d5d2] disabled:cursor-not-allowed disabled:text-[#8a8884] sm:min-h-[38px] ${FOCUS_RING}`}
            title="Làm mới danh sách"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#5f5e5a] ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Làm mới</span>
          </button>

          <Link
            to="/tickets/new"
            className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[6px] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] px-4 text-xs font-semibold text-white shadow-xs transition-all active:scale-[0.98] sm:min-h-[38px] ${FOCUS_RING}`}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            <span>Tạo phiếu mới</span>
          </Link>
        </div>
      </div>

      {/* Consolidated toolbar: search + filters + clear + result count */}
      <section
        aria-label="Tìm kiếm và lọc phiếu"
        className="rounded-[8px] border border-[#e4e3e0] bg-white p-4 shadow-2xs transition-all"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="ticket-search"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5a]"
            >
              Tìm kiếm
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8884]"
                aria-hidden="true"
              />
              <input
                id="ticket-search"
                type="text"
                aria-label="Tìm trong trang hiện tại"
                placeholder="Tìm theo mã hoặc tiêu đề trong trang này..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-[42px] w-full rounded-[6px] border border-[#e4e3e0] bg-[#fbfaf8] py-2 pl-9 pr-10 text-xs text-[#211f1b] placeholder:text-[#8a8884] focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all sm:min-h-[38px]"
              />
              {searchQuery !== '' && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className={`absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[4px] text-[#8a8884] transition-colors hover:bg-[#f1f1ef] hover:text-[#211f1b] ${FOCUS_RING}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:gap-3">
            <div className="min-w-0">
              <label
                htmlFor="ticket-filter-priority"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5a]"
              >
                Ưu tiên
              </label>
              <select
                id="ticket-filter-priority"
                aria-label="Mức ưu tiên"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="min-h-[42px] w-full rounded-[6px] border border-[#e4e3e0] bg-[#fbfaf8] px-3 py-1.5 text-xs text-[#211f1b] focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all sm:min-h-[38px] sm:w-[168px]"
              >
                <option value="all">Tất cả ưu tiên</option>
                <option value="critical">Khẩn cấp</option>
                <option value="high">Cao</option>
                <option value="normal">Bình thường</option>
                <option value="low">Thấp</option>
              </select>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="ticket-filter-status"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5f5e5a]"
              >
                Trạng thái
              </label>
              <select
                id="ticket-filter-status"
                aria-label="Trạng thái"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="min-h-[42px] w-full rounded-[6px] border border-[#e4e3e0] bg-[#fbfaf8] px-3 py-1.5 text-xs text-[#211f1b] focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all sm:min-h-[38px] sm:w-[176px]"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="new">Mới tạo</option>
                <option value="triaged">Đã phân loại</option>
                <option value="assigned">Đã phân công</option>
                <option value="cancelled">Đã hủy</option>
                <option value="in_progress">Đang xử lý</option>
                <option value="waiting_user">Chờ phản hồi</option>
                <option value="pending_approval">Chờ phê duyệt</option>
                <option value="resolved">Đã giải quyết</option>
                <option value="closed">Đã đóng</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-[6px] border border-[#e4e3e0] bg-[#f7f6f3] px-3 text-xs font-semibold text-[#211f1b] transition-all hover:bg-[#f1f1ef] sm:min-h-[38px] ${FOCUS_RING}`}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Bỏ lọc</span>
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] leading-relaxed border-t border-[#e4e3e0] pt-2.5">
          <p aria-live="polite" className="font-semibold text-[#211f1b]">
            {isLoading
              ? 'Đang tải dữ liệu...'
              : error
                ? 'Không thể tải danh sách phiếu.'
                : tickets.length > 0
                  ? resultSummary
                  : 'Không có phiếu nào trên trang này'}
          </p>
          <p className="text-[#8a8884]">Áp dụng cho trang đang xem.</p>
        </div>
      </section>

      {/* Ticket list */}
      {isLoading ? (
        <LoadingSpinner label="Đang tải danh sách phiếu từ máy chủ..." />
      ) : error ? (
        <ErrorMessage
          error={error}
          onRetry={() => void loadData(offset)}
          title="Không thể tải danh sách phiếu yêu cầu"
        />
      ) : filteredTickets.length === 0 ? (
        tickets.length === 0 && offset > 0 && !hasActiveFilters ? (
          <EmptyState
            title="Trang này không còn phiếu"
            description="Hãy quay lại trang trước để xem các phiếu đã tải."
            actionText="Quay lại trang trước"
            onAction={handlePrevPage}
            icon={<Inbox className="h-6 w-6 text-[#5f5e5a]" aria-hidden="true" />}
          />
        ) : tickets.length === 0 && !hasActiveFilters ? (
          <EmptyState
            title="Chưa có phiếu yêu cầu nào"
            description="Hệ thống chưa ghi nhận phiếu hỗ trợ IT nào trong danh mục này. Bạn có thể tạo phiếu mới để gửi sự cố tới bộ phận hỗ trợ."
            actionText="Tạo phiếu hỗ trợ ngay"
            onAction={() => navigate('/tickets/new')}
            icon={<Inbox className="h-6 w-6 text-[#5f5e5a]" aria-hidden="true" />}
          />
        ) : (
          <EmptyState
            title="Không tìm thấy kết quả phù hợp"
            description={
              tickets.length === 0
                ? 'Trang này không còn phiếu nào. Hãy quay lại trang trước hoặc xóa bộ lọc để xem các phiếu khác.'
                : 'Không có phiếu nào trên trang này khớp với từ khóa hoặc bộ lọc hiện tại. Hãy xóa bộ lọc hoặc chuyển sang trang khác.'
            }
            actionText="Xóa bộ lọc"
            onAction={resetFilters}
            icon={<SearchX className="h-6 w-6 text-[#5f5e5a]" aria-hidden="true" />}
          />
        )
      ) : (
        <div className="rounded-[8px] border border-[#e4e3e0] bg-white shadow-2xs overflow-hidden">
          {/* Sticky column header (desktop only, sticks below the app header) */}
          <div
            aria-hidden="true"
            className={`dx-ticket-list-header sticky top-14 z-20 hidden border-b border-[#e4e3e0] bg-[color-mix(in_srgb,var(--color-primary-tint)_35%,#f7f6f3)] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5f5e5a] lg:grid lg:gap-x-4 ${TABLE_GRID}`}
          >
            <span>Mã phiếu</span>
            <span>Tiêu đề</span>
            <span>Ưu tiên</span>
            <span>Trạng thái</span>
            <span>Người xử lý</span>
            <span>Thời gian</span>
          </div>

          <ul
            aria-label="Danh sách phiếu yêu cầu"
            className="dx-ticket-list divide-y divide-[#e4e3e0] bg-white"
          >
            {filteredTickets.map((ticket) => {
              const categoryName = categories[ticket.category_id]?.name || 'Chưa xác định';
              const created = formatDateParts(ticket.created_at);
              const ticketHref = `/tickets/${ticket.id}`;

              return (
                <li key={ticket.id}>
                  {/* The whole row is a real link: middle-click / Ctrl+click open a new tab. */}
                  <Link
                    to={ticketHref}
                    className={`group grid min-h-[44px] items-start gap-x-3 gap-y-1.5 px-4 py-3.5 transition-all hover:bg-[var(--color-primary-subtle)]/70 hover:shadow-[inset_3px_0_0_0_#0a78be] focus-visible:bg-[var(--color-primary-subtle)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] lg:min-h-[58px] lg:items-center lg:gap-x-4 lg:gap-y-0 lg:py-0 ${MOBILE_GRID} ${TABLE_GRID}`}
                  >
                    {/* Short ticket code */}
                    <div className="col-start-1 row-start-1 lg:col-auto lg:row-auto">
                      <span
                        title={ticket.id}
                        className="inline-flex items-center rounded-[4px] border border-[#e4e3e0] bg-[#f1f1ef] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight text-[#5f5e5a] group-hover:border-[var(--color-primary-border)] group-hover:bg-[var(--color-primary-tint)] group-hover:text-[var(--color-primary-text)] transition-colors"
                      >
                        #{shortTicketId(ticket.id)}
                      </span>
                    </div>

                    {/* Title (2 lines max) + category */}
                    <div className="col-span-3 row-start-2 min-w-0 lg:col-span-1 lg:col-auto lg:row-auto">
                      <p
                        title={ticket.title}
                        className="line-clamp-2 text-sm font-semibold leading-snug text-[#211f1b] transition-colors group-hover:text-[var(--color-primary)]"
                      >
                        {ticket.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#5f5e5a]">
                        <Tag className="h-3 w-3 shrink-0 text-[#8a8884]" aria-hidden="true" />
                        <span className="truncate">{categoryName}</span>
                      </p>
                    </div>

                    {/* Priority */}
                    <div className="col-start-1 row-start-3 justify-self-start lg:col-auto lg:row-auto">
                      <PriorityBadge priority={ticket.priority} />
                    </div>

                    {/* Status */}
                    <div className="col-start-3 row-start-1 justify-self-end lg:col-auto lg:row-auto lg:justify-self-start">
                      <StatusBadge status={ticket.status} />
                    </div>

                    {/* Assignee */}
                    <div className="col-start-2 row-start-3 min-w-0 lg:col-auto lg:row-auto">
                      {ticket.assigned_to ? (
                        <span className="flex items-center gap-1.5 text-[11px] text-[#5f5e5a] lg:text-xs">
                          <UserCheck
                            className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]"
                            aria-hidden="true"
                          />
                          <span
                            className="truncate font-semibold text-[#211f1b]"
                            title={ticket.assigned_to}
                          >
                            {ticket.assigned_to}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] italic text-[#8a8884] lg:text-xs">
                          Chưa phân công
                        </span>
                      )}
                    </div>

                    {/* Created at */}
                    <div className="col-start-3 row-start-3 justify-self-end text-right lg:col-auto lg:row-auto lg:text-left">
                      <p className="whitespace-nowrap font-mono text-[11px] leading-tight text-[#5f5e5a]">
                        {created.date}
                      </p>
                      <p className="whitespace-nowrap font-mono text-[10px] leading-tight text-[#8a8884]">
                        {created.time}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {Boolean(error) && offset > 0 && (
        <button
          type="button"
          onClick={handlePrevPage}
          className={`inline-flex min-h-[44px] items-center gap-1 rounded-[6px] border border-[#e4e3e0] bg-white px-3 text-sm font-semibold text-[#211f1b] ${FOCUS_RING}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Trang trước
        </button>
      )}

      {/* Pagination — hidden when there is nothing to page through */}
      {!isLoading && !error && canPaginate && (
        <nav
          aria-label="Phân trang danh sách phiếu"
          className="flex flex-col gap-3 rounded-[8px] border border-[#e4e3e0] bg-white px-4 py-3 text-xs text-[#5f5e5a] shadow-2xs sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="leading-relaxed">
            {tickets.length > 0 ? (
              <>
                Hiển thị{' '}
                <span className="font-semibold text-[#211f1b]">
                  {offset + 1}–{offset + tickets.length}
                </span>{' '}
                phiếu · Trang{' '}
                <span className="font-semibold text-[#211f1b]">{pageNumber}</span>
              </>
            ) : (
              <>
                Trang <span className="font-semibold text-[#211f1b]">{pageNumber}</span> · Không
                có phiếu nào
              </>
            )}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={isFirstPage || isLoading}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-[6px] border px-3 text-xs font-semibold transition-all sm:min-h-[36px] ${FOCUS_RING} ${
                isFirstPage || isLoading
                  ? 'cursor-not-allowed border-[#e4e3e0] bg-[#f7f6f3] text-[#8a8884]'
                  : 'border-[#e4e3e0] bg-white text-[#211f1b] hover:bg-[#f1f1ef] shadow-2xs'
              }`}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Trang trước</span>
            </button>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={isLastPage || isLoading}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-[6px] border px-3 text-xs font-semibold transition-all sm:min-h-[36px] ${FOCUS_RING} ${
                isLastPage || isLoading
                  ? 'cursor-not-allowed border-[#e4e3e0] bg-[#f7f6f3] text-[#8a8884]'
                  : 'border-[#e4e3e0] bg-white text-[#211f1b] hover:bg-[#f1f1ef] shadow-2xs'
              }`}
            >
              <span>Trang sau</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};