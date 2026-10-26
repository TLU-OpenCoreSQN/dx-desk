// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Calendar,
} from 'lucide-react';
import { getTickets, getCategories } from '../services/api';
import { Ticket, Category } from '../types/api';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 25;

export const TicketListPage: React.FC = () => {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [offset, setOffset] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  // Search & filter states
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
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(offset);
  }, [loadData, offset]);

  // Client-side filtering of the active page results
  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority =
      filterPriority === 'all' || ticket.priority === filterPriority;
    const matchesStatus =
      filterStatus === 'all' || ticket.status === filterStatus;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const handlePrevPage = () => {
    if (offset >= PAGE_SIZE) {
      setOffset(offset - PAGE_SIZE);
    }
  };

  const handleNextPage = () => {
    if (tickets.length === PAGE_SIZE) {
      setOffset(offset + PAGE_SIZE);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Danh sách phiếu yêu cầu IT
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
              {isStaff ? 'Toàn bộ phiếu' : 'Phiếu của tôi'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mỗi trang hiển thị tối đa {PAGE_SIZE} phiếu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData(offset)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <Link
            to="/tickets/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo phiếu mới</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Tìm trong trang hiện tại" placeholder="Tìm trong trang hiện tại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Ưu tiên:</span>
              <select
                aria-label="Mức ưu tiên" value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="text-xs border border-slate-300 rounded-md py-1 px-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
              >
                <option value="all">Tất cả</option>
                <option value="critical">Khẩn cấp</option>
                <option value="high">Cao</option>
                <option value="normal">Bình thường</option>
                <option value="low">Thấp</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Trạng thái:</span>
              <select
                aria-label="Trạng thái" value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs border border-slate-300 rounded-md py-1 px-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
              >
                <option value="all">Tất cả</option>
                <option value="new">Mới tạo</option>
                <option value="triaged">Đã phân loại</option><option value="assigned">Đã phân công</option><option value="cancelled">Đã hủy</option>
                <option value="in_progress">Đang xử lý</option>
                <option value="waiting_user">Chờ phản hồi</option>
                <option value="pending_approval">Chờ phê duyệt</option>
                <option value="resolved">Đã giải quyết</option>
                <option value="closed">Đã đóng</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">Tìm kiếm và bộ lọc áp dụng cho trang đang xem.</p>
      {/* Ticket List Content */}
      {isLoading ? (
        <LoadingSpinner label="Đang tải danh sách phiếu từ máy chủ..." />
      ) : error ? (
        <ErrorMessage
          error={error}
          onRetry={() => void loadData(offset)}
          title="Không thể tải danh sách phiếu yêu cầu"
        />
      ) : filteredTickets.length === 0 ? (
        tickets.length === 0 ? (
          <EmptyState
            title="Chưa có phiếu yêu cầu nào"
            description="Hiện tại hệ thống chưa ghi nhận phiếu hỗ trợ IT nào trong danh mục này. Bạn có thể tạo phiếu mới để gửi sự cố."
            actionText="Tạo phiếu hỗ trợ ngay"
            onAction={() => navigate('/tickets/new')}
          />
        ) : (
          <EmptyState
            title="Không tìm thấy kết quả phù hợp"
            description="Không có phiếu yêu cầu nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại."
            actionText="Xóa bộ lọc"
            onAction={() => {
              setSearchQuery('');
              setFilterPriority('all');
              setFilterStatus('all');
            }}
          />
        )
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th scope="col" className="px-4 py-3">Mã phiếu / Tiêu đề</th>
                  <th scope="col" className="px-4 py-3">Danh mục</th>
                  <th scope="col" className="px-4 py-3">Mức ưu tiên</th>
                  <th scope="col" className="px-4 py-3">Trạng thái</th>
                  <th scope="col" className="px-4 py-3">Người xử lý</th>
                  <th scope="col" className="px-4 py-3">Thời gian tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => {
                  const category = categories[ticket.category_id];
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="hover:bg-teal-50/30 cursor-pointer transition-colors focus-within:bg-teal-50/40"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/tickets/${ticket.id}`);
                      }}
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 line-clamp-1 hover:text-teal-700">
                          {ticket.title}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          ID: {ticket.id}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {category ? (
                          <span className="font-medium text-slate-800">{category.name}</span>
                        ) : (
                          <span className="font-mono text-slate-400 text-[11px]">
                            {ticket.category_id.substring(0, 8)}...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {ticket.assigned_to ? (
                          <span className="font-medium text-slate-800">{ticket.assigned_to}</span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa phân công</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(ticket.created_at)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}
      {!isLoading && !error && <div>
          {/* Pagination Controls */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Đang xem từ vị trí <span className="font-semibold text-slate-800">{tickets.length ? offset + 1 : offset}</span>{' '}
              đến{' '}
              <span className="font-semibold text-slate-800">
                {offset + tickets.length}
              </span>{' '}
              (Trang {Math.floor(offset / PAGE_SIZE) + 1})
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={offset === 0 || isLoading}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                  offset === 0 || isLoading
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                    : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trang trước</span>
              </button>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={tickets.length < PAGE_SIZE || isLoading}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                  tickets.length < PAGE_SIZE || isLoading
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                    : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100'
                }`}
              >
                <span>Trang sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  );
};
