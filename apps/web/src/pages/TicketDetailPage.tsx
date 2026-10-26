// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  GitBranch,
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
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { Alert } from '../components/common/Alert';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllowedTransitions,
  isTicketStatus,
  RESOLUTION_NOTE_MAX,
  RESOLUTION_NOTE_MIN,
  STATUS_ICONS,
  STATUS_TONES,
  statusLabel,
  TransitionEdge,
  validateResolutionNote,
} from '../lib/ticketWorkflow';

function eventSummary(evt: TicketEvent): { heading: string; from: string | null; to: string | null; note: string | null } {
  const payload = evt.payload || {};
  const from = typeof payload.from === 'string' ? payload.from : null;
  const to = typeof payload.to === 'string' ? payload.to : typeof payload.status === 'string' ? payload.status : null;
  const note =
    typeof payload.note === 'string' && payload.note.trim()
      ? payload.note
      : typeof payload.resolution_note === 'string' && payload.resolution_note.trim()
        ? payload.resolution_note
        : null;

  let heading = evt.event_type;
  if (evt.event_type === 'created') heading = 'Đã tiếp nhận phiếu';
  else if (evt.event_type === 'status_changed') {
    heading =
      from && to
        ? `Chuyển từ ${statusLabel(from)} sang ${statusLabel(to)}`
        : 'Cập nhật trạng thái';
  }
  return { heading, from, to, note };
}

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, profile } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  const [activeEdge, setActiveEdge] = useState<TransitionEdge | null>(null);
  const [note, setNote] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionError, setTransitionError] = useState<unknown>(null);

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

  const allowedTransitions = useMemo(
    () =>
      ticket
        ? getAllowedTransitions(ticket.status, roles, {
            isRequester: Boolean(profile && ticket.requester_id === profile.id),
          })
        : [],
    [ticket, roles, profile]
  );

  const resolutionNoteError = activeEdge?.resolutionNoteRequired
    ? validateResolutionNote(resolutionNote)
    : null;
  const canConfirmTransition = !isTransitioning && !resolutionNoteError;

  const openTransitionForm = (edge: TransitionEdge) => {
    setActiveEdge(edge);
    setNote('');
    setResolutionNote('');
    setTransitionError(null);
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
    setTransitionError(null);
    try {
      setIsTransitioning(true);
      const body: UpdateTicketStatusPayload = { to: activeEdge.to };
      if (note.trim()) body.note = note.trim();
      if (activeEdge.resolutionNoteRequired) body.resolution_note = resolutionNote.trim();
      await updateTicketStatus(id, body);
      closeTransitionForm();
      await loadTicketData();
    } catch (err) {
      setTransitionError(err);
    } finally {
      setIsTransitioning(false);
    }
  };

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

      {/* Status Transition Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <GitBranch className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-900">Thao tác chuyển trạng thái</h2>
        </div>

        {transitionError !== null && (
          <Alert type="error" title="Không thể chuyển trạng thái">
            {transitionError instanceof ApiClientError
              ? transitionError.message
              : 'Đã xảy ra lỗi khi cập nhật trạng thái phiếu. Vui lòng thử lại.'}
          </Alert>
        )}

        {activeEdge ? (
          <form
            onSubmit={confirmTransition}
            role="dialog"
            aria-labelledby="transition-dialog-title"
            className="space-y-4 p-4 rounded-lg border border-teal-200 bg-teal-50/40"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="transition-dialog-title" className="text-sm font-bold text-slate-900">
                Chuyển phiếu sang “{statusLabel(activeEdge.to)}”
              </h3>
              <button
                type="button"
                onClick={closeTransitionForm}
                aria-label="Đóng form chuyển trạng thái"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeEdge.hint && <p className="text-xs text-slate-600">{activeEdge.hint}</p>}

            {activeEdge.resolutionNoteRequired && (
              <div>
                <label
                  htmlFor="transition-resolution-note"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Mô tả cách giải quyết <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="transition-resolution-note"
                  rows={4}
                  required
                  aria-required="true"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  maxLength={2100}
                  placeholder="Mô tả nguyên nhân gốc, cách khắc phục và kết quả kiểm tra..."
                  className={`w-full text-xs border rounded-lg p-2.5 focus:outline-none focus:ring-2 leading-relaxed ${
                    resolutionNote && resolutionNoteError
                      ? 'border-rose-400 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-teal-500'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Bắt buộc khi chuyển sang “{statusLabel(activeEdge.to)}”, từ {RESOLUTION_NOTE_MIN}{' '}
                  đến {RESOLUTION_NOTE_MAX} ký tự.
                </p>
                {resolutionNoteError && (
                  <p className="text-xs text-rose-600 mt-1">{resolutionNoteError}</p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="transition-note"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Ghi chú chuyển trạng thái (không bắt buộc)
              </label>
              <textarea
                id="transition-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                placeholder="VD: Đã gọi điện hướng dẫn người dùng khởi động lại modem."
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeTransitionForm}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={!canConfirmTransition}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTransitioning ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <span>Xác nhận chuyển trạng thái</span>
                )}
              </button>
            </div>
          </form>
        ) : allowedTransitions.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {allowedTransitions.map((edge) => {
              const destructive = edge.to === 'cancelled' || (edge.from === 'pending_approval' && edge.to === 'new');
              const positive = edge.to === 'resolved' || edge.to === 'closed';
              return (
                <button
                  key={`${edge.from}-${edge.to}-${edge.label}`}
                  type="button"
                  onClick={() => openTransitionForm(edge)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                    destructive
                      ? 'bg-white border-rose-300 text-rose-700 hover:bg-rose-50 focus:ring-rose-500'
                      : positive
                        ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500'
                        : 'bg-teal-600 border-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500'
                  }`}
                >
                  {edge.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Hiện không có thao tác chuyển trạng thái nào khả dụng cho bạn với phiếu ở trạng thái «
            {statusLabel(ticket.status)}».
          </p>
        )}
      </div>

      {/* Events Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Dòng thời gian xử lý
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
            {events.map((evt, idx) => {
              const summary = eventSummary(evt);
              const toneStatus = summary.to && isTicketStatus(summary.to) ? summary.to : null;
              const Icon = toneStatus ? STATUS_ICONS[toneStatus] : null;
              return (
                <div
                  key={evt.id || idx}
                  className="relative pl-10 pb-4 border-l-2 border-teal-200 last:border-transparent last:pb-0"
                >
                  <div
                    className={`absolute -left-4 top-0 w-7 h-7 rounded-full ring-4 ring-white flex items-center justify-center ${
                      toneStatus ? STATUS_TONES[toneStatus].timeline : 'bg-teal-100 text-teal-700'
                    }`}
                    aria-hidden="true"
                  >
                    {Icon ? <Icon className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-slate-900">{summary.heading}</span>
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
                    {summary.to && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        {summary.from && <StatusBadge status={summary.from} />}
                        {summary.from && (
                          <span className="text-slate-400" aria-hidden="true">→</span>
                        )}
                        <StatusBadge status={summary.to} />
                      </div>
                    )}
                    {summary.note && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 whitespace-pre-wrap break-words">
                        <span className="font-semibold text-slate-500">
                          {typeof evt.payload?.resolution_note === 'string'
                            ? 'Cách giải quyết: '
                            : 'Ghi chú: '}
                        </span>
                        {summary.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role-aware guidance */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <GitBranch className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-800">Lưu ý:</span>{' '}
          Các nút chuyển trạng thái hiển thị theo vai trò của bạn và máy trạng thái của phiếu.
          Chuyển sang “{statusLabel('resolved')}” bắt buộc mô tả cách giải quyết (từ{' '}
          {RESOLUTION_NOTE_MIN} đến {RESOLUTION_NOTE_MAX} ký tự).
        </div>
      </div>
    </div>
  );
};
