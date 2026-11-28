// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Info,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { ApiClientError, updateTicketStatus } from '../../services/api';
import { Ticket, TicketEvent, UpdateTicketStatusPayload } from '../../types/api';
import { StatusBadge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { Button } from '../common/Button';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAllowedTransitions,
  RESOLUTION_NOTE_MAX,
  RESOLUTION_NOTE_MIN,
  STATUS_ICONS,
  statusLabel,
  TransitionEdge,
  validateResolutionNote,
} from '../../lib/ticketWorkflow';

/** Chiều cao thanh thao tác dính đáy trên màn hình hẹp, để trang chừa đủ khoảng trống. */
export type BottomBarSize = 'none' | 'compact' | 'tall';

export interface TicketWorkflowActionsProps {
  ticket: Ticket;
  events?: TicketEvent[];
  onTransitionSuccess: (message: string) => Promise<void> | void;
  onBottomBarChange?: (size: BottomBarSize) => void;
}

export const REPLY_NOTE_MIN = 5;

/** Ghi chú gần nhất khi phiếu được chuyển sang chờ người dùng: điều kỹ thuật viên cần biết thêm. */
export function findInfoRequest(events: TicketEvent[]): TicketEvent | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const payload = events[i].payload;
    if (payload?.to === 'waiting_user' || payload?.to_status === 'waiting_user') return events[i];
  }
  return null;
}

const eventNote = (event: TicketEvent | null): string | null => {
  const note = event?.payload?.note;
  return typeof note === 'string' && note.trim() ? note.trim() : null;
};

const formatRequestTime = (iso: string): string =>
  new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const TEXTAREA_CLASS =
  'w-full rounded-md border border-edge bg-surface-sidebar p-3 text-xs leading-relaxed text-content focus:bg-surface focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-sm transition-colors';

const edgeKey = (edge: TransitionEdge): string => `${edge.from}-${edge.to}-${edge.label}`;

const isDestructiveEdge = (edge: TransitionEdge): boolean =>
  edge.to === 'cancelled' || (edge.from === 'pending_approval' && edge.to === 'new');

const isRejectEdge = (edge: TransitionEdge): boolean =>
  edge.from === 'pending_approval' && edge.to === 'new';

/** Nút xác nhận gọi đúng tên việc sẽ xảy ra, không dùng "Xác nhận" chung chung. */
export function confirmLabel(edge: TransitionEdge): string {
  if (edge.to === 'cancelled') return 'Hủy phiếu này';
  if (isRejectEdge(edge)) return 'Từ chối yêu cầu';
  if (edge.to === 'waiting_user') return 'Gửi yêu cầu bổ sung';
  if (edge.to === 'closed') return 'Đóng phiếu';
  return edge.label;
}

/** Độ dài tối thiểu của lý do/ghi chú khi thao tác bắt buộc phải giải thích. */
export const TRANSITION_NOTE_MIN = 5;

/**
 * Hủy, từ chối và yêu cầu bổ sung đều phải có lý do: người tạo phiếu đọc lại ghi chú này
 * để biết vì sao phiếu dừng lại hoặc cần trả lời điều gì.
 */
export function noteRequired(edge: TransitionEdge): boolean {
  return isRejectEdge(edge) || edge.to === 'cancelled' || edge.to === 'waiting_user';
}

function noteRequiredMessage(edge: TransitionEdge): string {
  if (isRejectEdge(edge)) return `Lý do từ chối cần ít nhất ${TRANSITION_NOTE_MIN} ký tự.`;
  if (edge.to === 'cancelled') return `Lý do hủy cần ít nhất ${TRANSITION_NOTE_MIN} ký tự.`;
  return `Hãy ghi rõ thông tin cần bổ sung, ít nhất ${TRANSITION_NOTE_MIN} ký tự.`;
}

/** Nhãn ô ghi chú nói rõ ghi chú dùng để làm gì trong từng thao tác. */
function noteLabel(edge: TransitionEdge): string {
  if (isRejectEdge(edge)) return 'Lý do từ chối';
  if (edge.to === 'cancelled') return 'Lý do hủy';
  if (edge.to === 'waiting_user') return 'Thông tin cần người tạo phiếu bổ sung';
  return 'Ghi chú';
}

function notePlaceholder(edge: TransitionEdge): string {
  if (isRejectEdge(edge)) return 'VD: Yêu cầu cấp quyền cần trưởng phòng xác nhận trước.';
  if (edge.to === 'cancelled') return 'VD: Sự cố đã tự hết sau khi khởi động lại máy.';
  if (edge.to === 'waiting_user') return 'VD: Gửi giúp ảnh chụp thông báo lỗi và phiên bản Office đang dùng.';
  return 'VD: Đã gọi điện hướng dẫn người dùng khởi động lại modem.';
}

export const TicketWorkflowActions: React.FC<TicketWorkflowActionsProps> = ({
  ticket,
  events = [],
  onTransitionSuccess,
  onBottomBarChange,
}) => {
  const { roles, profile } = useAuth();

  const [activeEdge, setActiveEdge] = useState<TransitionEdge | null>(null);
  const [note, setNote] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [replyNote, setReplyNote] = useState<string>('');
  const [replyTouched, setReplyTouched] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionError, setTransitionError] = useState<unknown>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  /** Lỗi nhập liệu chỉ hiện sau khi người dùng rời ô hoặc bấm xác nhận, không hiện ngay khi mở form. */
  const [touched, setTouched] = useState({ note: false, resolution: false });
  const formHeadingRef = useRef<HTMLHeadingElement>(null);
  const resolutionFieldRef = useRef<HTMLTextAreaElement>(null);
  const noteFieldRef = useRef<HTMLTextAreaElement>(null);
  /** Nút đã mở form, để trả con trỏ về đó khi người dùng quay lại (Esc, "Quay lại", nút đóng). */
  const returnFocusKey = useRef<string | null>(null);

  useEffect(() => {
    setActiveEdge(null);
    setNote('');
    setResolutionNote('');
    setReplyNote('');
    setReplyTouched(false);
    setTouched({ note: false, resolution: false });
    setTransitionError(null);
  }, [ticket.id, ticket.status]);

  const allowedTransitions = useMemo(
    () =>
      getAllowedTransitions(ticket.status, roles, {
        isRequester: Boolean(profile && ticket.requester_id === profile.id),
      }),
    [ticket.status, ticket.requester_id, roles, profile]
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

  const resolutionNoteError = activeEdge?.resolutionNoteRequired
    ? validateResolutionNote(resolutionNote)
    : null;
  const isNoteRequired = activeEdge ? noteRequired(activeEdge) : false;
  const noteError =
    activeEdge && isNoteRequired && note.trim().length < TRANSITION_NOTE_MIN
      ? noteRequiredMessage(activeEdge)
      : null;
  const showResolutionError = touched.resolution && Boolean(resolutionNoteError);
  const showNoteError = touched.note && Boolean(noteError);
  const isDestructiveActive = activeEdge ? isDestructiveEdge(activeEdge) : false;

  /** Người tạo phiếu đang được hỏi thêm thông tin: trả lời trực tiếp thay vì mở form chuyển trạng thái. */
  const replyEdge = useMemo(
    () =>
      allowedTransitions.find(
        (edge) => edge.from === 'waiting_user' && edge.to === 'in_progress' && edge.requesterOnly
      ) ?? null,
    [allowedTransitions]
  );
  const showReplyComposer = replyEdge !== null && activeEdge === null;
  const infoRequest = useMemo(() => (replyEdge ? findInfoRequest(events) : null), [replyEdge, events]);
  const infoRequestNote = eventNote(infoRequest);
  const replyNoteError =
    replyNote.trim().length < REPLY_NOTE_MIN
      ? `Nội dung phản hồi cần ít nhất ${REPLY_NOTE_MIN} ký tự.`
      : null;

  /** Thao tác tiến tới nằm trên thanh dính đáy; thao tác không hoàn tác được đặt riêng, cuối trang. */
  const forwardTransitions = orderedTransitions.filter(
    (edge) => !isDestructiveEdge(edge) && edge !== replyEdge
  );
  const destructiveTransitions = orderedTransitions.filter(isDestructiveEdge);
  const barSize: BottomBarSize =
    activeEdge !== null || showReplyComposer
      ? 'tall'
      : forwardTransitions.length > 0
        ? 'compact'
        : 'none';
  const isBottomBar = barSize !== 'none';

  useEffect(() => {
    onBottomBarChange?.(barSize);
  }, [barSize, onBottomBarChange]);

  const activeEdgeKey = activeEdge ? edgeKey(activeEdge) : null;

  // Mở form: đưa con trỏ vào ô phải nhập đầu tiên; nếu không có ô bắt buộc thì vào tiêu đề form,
  // để không bật bàn phím điện thoại khi người dùng chỉ cần bấm xác nhận.
  useEffect(() => {
    if (!activeEdge) return;
    const target = activeEdge.resolutionNoteRequired
      ? resolutionFieldRef.current
      : noteRequired(activeEdge)
        ? noteFieldRef.current
        : formHeadingRef.current;
    target?.focus();
    // Chỉ chạy khi mở một thao tác khác, không chạy lại mỗi lần gõ.
  }, [activeEdgeKey]);

  // Đóng form bằng Esc/"Quay lại": trả con trỏ về đúng nút đã mở form.
  useEffect(() => {
    if (activeEdge || !returnFocusKey.current) return;
    const key = returnFocusKey.current;
    returnFocusKey.current = null;
    const opener = Array.from(document.querySelectorAll<HTMLElement>('[data-edge-key]')).find(
      (el) => el.dataset.edgeKey === key
    );
    opener?.focus();
  }, [activeEdge]);

  const openTransitionForm = (edge: TransitionEdge) => {
    setActiveEdge(edge);
    setNote('');
    setResolutionNote('');
    setTouched({ note: false, resolution: false });
    setTransitionError(null);
    setSuccessMessage(null);
  };

  const closeTransitionForm = () => {
    setActiveEdge(null);
    setNote('');
    setResolutionNote('');
    setTouched({ note: false, resolution: false });
    setTransitionError(null);
  };

  /** Người dùng tự quay lại (không phải sau khi gửi thành công): trả con trỏ về nút đã mở form. */
  const cancelTransitionForm = () => {
    if (isTransitioning) return;
    returnFocusKey.current = activeEdgeKey;
    closeTransitionForm();
  };

  const submitTransition = async (
    edge: TransitionEdge,
    noteText: string,
    successText: string
  ) => {
    setTransitionError(null);
    setSuccessMessage(null);
    try {
      setIsTransitioning(true);
      const body: UpdateTicketStatusPayload = { to: edge.to };
      if (ticket.ticket_version !== undefined) body.expected_version = ticket.ticket_version;
      if (noteText.trim()) body.note = noteText.trim();
      if (edge.resolutionNoteRequired) body.resolution_note = resolutionNote.trim();
      await updateTicketStatus(ticket.id, body);
      closeTransitionForm();
      setReplyNote('');
      setReplyTouched(false);
      const msg = successText;
      setSuccessMessage(msg);
      await onTransitionSuccess(msg);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setActiveEdge(null);
        const msg =
          'Phiếu đã được cập nhật bởi người khác. Dữ liệu mới đã được tải lại; hãy kiểm tra trước khi thao tác tiếp.';
        setSuccessMessage(msg);
        await onTransitionSuccess(msg);
      } else {
        setTransitionError(err);
      }
    } finally {
      setIsTransitioning(false);
    }
  };

  const confirmTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEdge || !ticket.id || isTransitioning) return;
    if (resolutionNoteError || noteError) {
      setTouched({ note: true, resolution: true });
      (resolutionNoteError ? resolutionFieldRef.current : noteFieldRef.current)?.focus();
      return;
    }
    await submitTransition(activeEdge, note, `Đã chuyển phiếu sang “${statusLabel(activeEdge.to)}”.`);
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setReplyTouched(true);
    if (replyNoteError) {
      document.getElementById('reply-note')?.focus();
      return;
    }
    if (!replyEdge || !ticket.id || isTransitioning) return;
    await submitTransition(
      replyEdge,
      replyNote,
      'Đã gửi phản hồi. Kỹ thuật viên sẽ tiếp tục xử lý phiếu.'
    );
  };

  return (
    <aside aria-label="Thao tác chuyển trạng thái" className="z-10 lg:sticky lg:top-20 lg:self-start">
      <div
        className={`lg:max-h-[calc(100vh_-_6rem)] lg:overflow-y-auto lg:rounded-lg lg:border lg:border-edge lg:bg-surface ${
          isBottomBar
            ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:max-h-[55dvh] max-lg:overflow-y-auto max-lg:border-t max-lg:border-[var(--color-edge-subtle)] max-lg:bg-surface max-lg:px-4 max-lg:pb-3 max-lg:pt-3 max-lg:shadow-[0_-4px_12px_rgb(15_23_42_/_8%)]'
            : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-edge bg-surface-muted px-4 py-3 max-lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <GitBranch className="h-4 w-4 shrink-0 text-[var(--color-primary-ink)]" aria-hidden="true" />
            <h2 className="dx-section-title truncate">
              Thao tác
            </h2>
          </div>
        </div>

        <div className="space-y-3 lg:p-4">
          {/* Announcements */}
          <p className="sr-only" role="status" aria-live="polite">
            {successMessage ?? ''}
          </p>

          {successMessage && (
            <div className="flex items-start gap-2 rounded-md border border-status-success-border bg-status-success-bg px-3 py-2 text-xs text-status-success">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-status-success"
                aria-hidden="true"
              />
              <p className="min-w-0 flex-1 px-1 leading-relaxed">{successMessage}</p>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                aria-label="Đóng thông báo chuyển trạng thái"
                className="-mr-1 -mt-0.5 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm text-[var(--color-content-muted)] transition-colors hover:text-[var(--color-content)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] lg:min-h-8 lg:min-w-8"
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
              noValidate
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelTransitionForm();
                }
              }}
              aria-labelledby="transition-dialog-title"
              className="space-y-3 rounded-sm border border-[var(--color-primary-border)] bg-surface-muted p-3 sm:p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3
                    id="transition-dialog-title"
                    ref={formHeadingRef}
                    tabIndex={-1}
                    className="break-words outline-none text-sm font-semibold leading-snug text-[var(--color-content)]"
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
                  onClick={cancelTransitionForm}
                  aria-label="Đóng form chuyển trạng thái"
                  className="-mr-1 -mt-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm text-[var(--color-content-muted)] transition-colors hover:text-[var(--color-content)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] lg:min-h-8 lg:min-w-8"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={activeEdge.from} />
                <ArrowRight className="h-3 w-3 shrink-0 text-content-subtle" aria-hidden="true" />
                <StatusBadge status={activeEdge.to} />
              </div>

              {isDestructiveActive && (
                <div className="flex items-start gap-2 rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-xs leading-relaxed text-status-danger">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-status-danger"
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
                <div className="rounded-md border border-primary-border bg-surface p-3">
                  <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
                    <label
                      htmlFor="transition-resolution-note"
                      className="text-xs font-semibold text-content"
                    >
                      Mô tả cách giải quyết{' '}
                      <span className="text-status-danger" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <span className="tabular-nums text-xs text-content-muted">
                      {resolutionNote.trim().length} / {RESOLUTION_NOTE_MAX}
                    </span>
                  </div>
                  <textarea
                    id="transition-resolution-note"
                    ref={resolutionFieldRef}
                    rows={4}
                    required
                    aria-required="true"
                    aria-invalid={showResolutionError}
                    aria-describedby={
                      showResolutionError
                        ? 'transition-resolution-note-help transition-resolution-note-error'
                        : 'transition-resolution-note-help'
                    }
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, resolution: true }))}
                    maxLength={2100}
                    placeholder="Mô tả nguyên nhân gốc, cách khắc phục và kết quả kiểm tra..."
                    className={`${TEXTAREA_CLASS} ${
                      showResolutionError
                        ? 'border-status-danger focus:border-status-danger focus-visible:ring-status-danger'
                        : ''
                    }`}
                  />
                  <p
                    id="transition-resolution-note-help"
                    className="mt-1 text-xs leading-relaxed text-content-muted"
                  >
                    Bắt buộc khi chuyển sang “{statusLabel(activeEdge.to)}”, từ{' '}
                    {RESOLUTION_NOTE_MIN} đến {RESOLUTION_NOTE_MAX} ký tự.
                  </p>
                  {showResolutionError && (
                    <p
                      id="transition-resolution-note-error"
                      className="mt-1 text-xs font-medium text-status-danger"
                    >
                      {resolutionNoteError}
                    </p>
                  )}
                </div>
              )}

              <div>
                <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
                  <label
                    htmlFor="transition-note"
                    className="text-xs font-semibold text-content"
                  >
                    {noteLabel(activeEdge)}{' '}
                    <span className="font-normal normal-case tracking-normal text-content-muted">
                      {isNoteRequired
                        ? `(bắt buộc, ít nhất ${TRANSITION_NOTE_MIN} ký tự)`
                        : '(không bắt buộc)'}
                    </span>
                  </label>
                  <span className="tabular-nums text-xs text-content-muted">
                    {note.trim().length} / 2000 ký tự
                  </span>
                </div>
                <textarea
                  id="transition-note"
                  ref={noteFieldRef}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, note: true }))}
                  maxLength={2000}
                  required={isNoteRequired}
                  aria-required={isNoteRequired || undefined}
                  aria-invalid={showNoteError}
                  aria-describedby={showNoteError ? 'transition-note-error' : undefined}
                  placeholder={notePlaceholder(activeEdge)}
                  className={`${TEXTAREA_CLASS} ${
                    showNoteError
                      ? 'border-status-danger focus:border-status-danger focus-visible:ring-status-danger'
                      : ''
                  }`}
                />
                {showNoteError && (
                  <p id="transition-note-error" className="mt-1 text-xs font-medium text-status-danger">
                    {noteError}
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={cancelTransitionForm}
                  className="w-full sm:w-auto"
                >
                  Quay lại
                </Button>
                <Button
                  type="submit"
                  variant={
                    isDestructiveActive
                      ? 'danger'
                      : activeEdge.to === 'resolved' || activeEdge.to === 'closed'
                        ? 'success'
                        : 'primary'
                  }
                  isLoading={isTransitioning}
                  disabled={isTransitioning}
                  className="w-full sm:w-auto"
                >
                  {isTransitioning ? 'Đang cập nhật...' : confirmLabel(activeEdge)}
                </Button>
              </div>
            </form>
          ) : showReplyComposer ? (
            <form onSubmit={sendReply} noValidate aria-labelledby="reply-composer-title" className="space-y-3">
              <h3
                id="reply-composer-title"
                className="flex items-center gap-2 text-sm font-semibold leading-snug text-[var(--color-content)]"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-[var(--color-primary-ink)]" aria-hidden="true" />
                Trả lời kỹ thuật viên
              </h3>

              <figure className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2.5">
                <figcaption className="text-xs font-semibold text-[var(--color-content)]">
                  {infoRequest?.actor_name ? `${infoRequest.actor_name} cần bạn bổ sung` : 'Kỹ thuật viên cần bạn bổ sung'}
                  {infoRequest && (
                    <span className="font-normal text-[var(--color-content-muted)]">
                      {' · '}
                      <time dateTime={infoRequest.created_at}>{formatRequestTime(infoRequest.created_at)}</time>
                    </span>
                  )}
                </figcaption>
                <blockquote className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-content)]">
                  {infoRequestNote ??
                    'Kỹ thuật viên chưa ghi cụ thể. Hãy mô tả tình trạng hiện tại hoặc thông tin bạn có thể cung cấp.'}
                </blockquote>
              </figure>

              <div>
                <label
                  htmlFor="reply-note"
                  className="mb-1.5 block text-xs font-semibold text-[var(--color-content)]"
                >
                  Nội dung phản hồi
                </label>
                <textarea
                  id="reply-note"
                  rows={3}
                  value={replyNote}
                  onChange={(e) => setReplyNote(e.target.value)}
                  onBlur={() => setReplyTouched(true)}
                  maxLength={2000}
                  required
                  aria-required="true"
                  aria-invalid={replyTouched && Boolean(replyNoteError)}
                  aria-describedby={replyTouched && replyNoteError ? 'reply-note-error' : undefined}
                  placeholder="VD: Mình đã cài lại chứng chỉ VPN, giờ báo lỗi khác: ..."
                  className={`${TEXTAREA_CLASS} text-sm ${
                    replyTouched && replyNoteError
                      ? 'border-status-danger focus:border-status-danger focus-visible:ring-status-danger'
                      : ''
                  }`}
                />
                {replyTouched && replyNoteError && (
                  <p id="reply-note-error" className="mt-1 text-xs font-medium text-status-danger">
                    {replyNoteError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isTransitioning}
                disabled={isTransitioning}
                leftIcon={<Send className="h-4 w-4 shrink-0" aria-hidden="true" />}
                className="w-full"
              >
                {isTransitioning ? 'Đang gửi...' : 'Gửi phản hồi'}
              </Button>
            </form>
          ) : forwardTransitions.length > 0 ? (
            <>
              <div className="flex flex-col gap-2">
                {forwardTransitions.map((edge) => {
                  const isPrimary = edgeKey(edge) === primaryEdgeKey;
                  const isFinish = edge.to === 'resolved' || edge.to === 'closed';
                  const Icon = STATUS_ICONS[edge.to];
                  return (
                    <Button
                      key={edgeKey(edge)}
                      data-edge-key={edgeKey(edge)}
                      variant={isPrimary ? (isFinish ? 'success' : 'primary') : 'secondary'}
                      leftIcon={<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      onClick={() => openTransitionForm(edge)}
                      className="w-full"
                    >
                      {edge.label}
                    </Button>
                  );
                })}
              </div>
            </>
          ) : destructiveTransitions.length > 0 ? (
            // Chỉ còn thao tác hủy (nằm riêng bên dưới): nói rõ không cần làm gì thay vì để khung trống.
            <p className="text-[0.8125rem] leading-relaxed text-content-muted max-lg:hidden">
              Phiếu đang ở trạng thái «{statusLabel(ticket.status)}». Hiện bạn không cần thao tác gì thêm.
            </p>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-edge bg-surface-muted/80 px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-content-muted">
                Hiện không có thao tác chuyển trạng thái nào khả dụng cho bạn với phiếu ở trạng thái
                «{statusLabel(ticket.status)}».
              </p>
            </div>
          )}
        </div>
      </div>

      {!activeEdge && destructiveTransitions.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 max-lg:border-t max-lg:border-[var(--color-edge-subtle)] max-lg:pt-4">
          {destructiveTransitions.map((edge) => {
            const Icon = STATUS_ICONS[edge.to];
            return (
              <Button
                key={edgeKey(edge)}
                data-edge-key={edgeKey(edge)}
                variant="dangerOutline"
                leftIcon={<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                onClick={() => openTransitionForm(edge)}
                className="w-full"
              >
                {edge.label}
              </Button>
            );
          })}
        </div>
      )}
    </aside>
  );
};
