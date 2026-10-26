// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  User,
  Clock,
  History,
  FileText,
  Tag,
  RefreshCw,
  Info,
} from 'lucide-react';
import { getTicketById, getTicketEvents, getCategories } from '../services/api';
import { Ticket, TicketEvent, Category } from '../types/api';
import { PriorityBadge, StatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  const loadTicketData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
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
        const foundCategory = categoriesData.data.find(
          (c) => c.id === ticketData.category_id
        );
        setCategory(foundCategory || null);
      }
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTicketData();
  }, [loadTicketData]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return <LoadingSpinner label="Đang tải thông tin chi tiết phiếu yêu cầu..." />;
  }

  if (error || !ticket) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate('/tickets')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/tickets')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại danh sách phiếu</span>
        </button>

        <button
          type="button"
          onClick={() => void loadTicketData()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Main Ticket Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header summary */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="text-xs text-slate-400 font-mono break-all">ID: {ticket.id}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug break-words">
            {ticket.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Người tạo:</span>
              <span className="font-mono text-slate-700 font-medium break-all">
                {ticket.requester_id}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Tạo lúc:</span>
              <span className="text-slate-700 font-medium">{formatDate(ticket.created_at)}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Cập nhật:</span>
              <span className="text-slate-700 font-medium">{formatDate(ticket.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Danh mục sự cố:</span>
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-teal-600" />
                {category ? `${category.name} (${category.code})` : ticket.category_id}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Kỹ thuật viên phụ trách:</span>
              <div className="font-semibold text-slate-800">
                {ticket.assigned_to ? (
                  <span className="text-teal-700 font-mono">{ticket.assigned_to}</span>
                ) : (
                  <span className="text-slate-400 italic">Chưa phân công</span>
                )}
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div>
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              Mô tả chi tiết nội dung sự cố
            </h2>
            <div className="p-4 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans break-words">
              {ticket.description}
            </div>
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Lịch sử yêu cầu
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {events.length} sự kiện
          </span>
        </div>

        {events.length === 0 ? (
          <EmptyState
            title="Chưa có sự kiện nào"
            description="Phiếu này chưa ghi nhận thêm sự kiện xử lý nào trên hệ thống."
            icon={<History className="w-6 h-6 text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            {events.map((evt, idx) => (
              <div
                key={evt.id || idx}
                className="relative pl-6 pb-4 border-l-2 border-teal-200 last:border-transparent last:pb-0"
              >
                <div className="absolute -left-[7px] top-0 w-3 h-3 rounded-full bg-teal-600 ring-4 ring-white" />
                <div className="text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900">{evt.event_type === 'created' ? 'Đã tiếp nhận phiếu' : evt.event_type === 'status_changed' ? 'Cập nhật trạng thái' : evt.event_type}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatDate(evt.created_at)}
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px] mb-1.5">
                    Thực hiện bởi:{' '}
                    <span className="font-mono text-slate-800 font-medium break-all">
                      {evt.actor_id || 'Hệ thống'}
                    </span>
                  </div>
                  {evt.event_type === 'status_changed' && typeof evt.payload?.status === 'string' && (
                    <StatusBadge status={evt.payload.status} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Week 2 Architecture Roadmap Note */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-800">Thông tin phiếu:</span>{' '}
          Bạn có thể xem nội dung và lịch sử tiếp nhận. Chuyển trạng thái và trao đổi trực tiếp chưa khả dụng trong phiên bản này.
        </div>
      </div>
    </div>
  );
};
