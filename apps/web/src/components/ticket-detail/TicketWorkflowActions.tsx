// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ApiClientError, updateTicketStatus } from '../../services/api';
import { Ticket, UpdateTicketStatusPayload } from '../../types/api';
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

export interface TicketWorkflowActionsProps {
  ticket: Ticket;
  onTransitionSuccess: (message: string) => Promise<void> | void;
  onActiveEdgeChange?: (hasActiveEdge: boolean) => void;
}

const TEXTAREA_CLASS =
  'w-full rounded-md border border-edge bg-surface-sidebar p-3 text-xs leading-relaxed text-content focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm transition-all';

const edgeKey = (edge: TransitionEdge): string => `${edge.from}-${edge.to}-${edge.label}`;

const isDestructiveEdge = (edge: TransitionEdge): boolean =>
  edge.to === 'cancelled' || (edge.from === 'pending_approval' && edge.to === 'new');

export const TicketWorkflowActions: React.FC<TicketWorkflowActionsProps> = ({
  ticket,
  onTransitionSuccess,
  onActiveEdgeChange,
}) => {
  const { roles, profile } = useAuth();

  const [activeEdge, setActiveEdge] = useState<TransitionEdge | null>(null);
  const [note, setNote] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionError, setTransitionError] = useState<unknown>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    onActiveEdgeChange?.(Boolean(activeEdge));
  }, [activeEdge, onActiveEdgeChange]);

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
  const rejectionNoteRequired = activeEdge?.from === 'pending_approval' && activeEdge.to === 'new';
  const rejectionNoteError =
    rejectionNoteRequired && note.trim().length < 5
      ? 'Lý do từ chối cần ít nhất 5 ký tự.'
      : null;
  const canConfirmTransition = !isTransitioning && !resolutionNoteError && !rejectionNoteError;
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
    if (!activeEdge || !ticket.id || !canConfirmTransition) return;
    const target = activeEdge.to;
    setTransitionError(null);
    setSuccessMessage(null);
    try {
      setIsTransitioning(true);
      const body: UpdateTicketStatusPayload = { to: activeEdge.to };
      if (ticket.ticket_version !== undefined) body.expected_version = ticket.ticket_version;
      if (note.trim()) body.note = note.trim();
      if (activeEdge.resolutionNoteRequired) body.resolution_note = resolutionNote.trim();
      await updateTicketStatus(ticket.id, body);
      closeTransitionForm();
      const msg = `Đã chuyển phiếu sang “${statusLabel(target)}”.`;
      setSuccessMessage(msg);
      await onTransitionSuccess(msg);
    } catch (err) {
      setTransitionError(err);
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setActiveEdge(null);
        const msg =
          'Phiếu đã được cập nhật bởi người khác. Dữ liệu mới đã được tải lại; hãy kiểm tra trước khi thao tác tiếp.';
        setSuccessMessage(msg);
        await onTransitionSuccess(msg);
      }
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <aside
      aria-label="Thao tác chuyển trạng thái"
      className={`z-10 lg:sticky lg:top-20 lg:self-start ${
        isBottomBar ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20' : ''
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
          <StatusBadge status={ticket.status} />
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
              className="space-y-3 rounded-[4px] border border-[var(--color-primary-border)] bg-surface-warm p-3 sm:p-4"
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
                      className="text-[11px] font-bold uppercase tracking-wider text-content"
                    >
                      Mô tả cách giải quyết{' '}
                      <span className="text-status-danger" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <span className="font-mono text-[10px] text-content-muted">
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
                        ? 'border-status-danger focus:border-status-danger focus:ring-status-danger'
                        : ''
                    }`}
                  />
                  <p
                    id="transition-resolution-note-help"
                    className="mt-1 text-[11px] leading-relaxed text-content-muted"
                  >
                    Bắt buộc khi chuyển sang “{statusLabel(activeEdge.to)}”, từ{' '}
                    {RESOLUTION_NOTE_MIN} đến {RESOLUTION_NOTE_MAX} ký tự.
                  </p>
                  {resolutionNoteError && (
                    <p className="mt-1 text-[11px] font-medium text-status-danger">
                      {resolutionNoteError}
                    </p>
                  )}
                </div>
              )}

              <div>
                <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
                  <label
                    htmlFor="transition-note"
                    className="text-[11px] font-bold uppercase tracking-wider text-content"
                  >
                    Ghi chú chuyển trạng thái{' '}
                    <span className="font-normal normal-case tracking-normal text-content-muted">
                      {rejectionNoteRequired
                        ? '(bắt buộc khi từ chối, ít nhất 5 ký tự)'
                        : '(không bắt buộc)'}
                    </span>
                  </label>
                  <span className="font-mono text-[10px] text-content-muted">
                    {note.trim().length} / 2000 ký tự
                  </span>
                </div>
                <textarea
                  id="transition-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={2000}
                  required={rejectionNoteRequired}
                  aria-invalid={Boolean(rejectionNoteError)}
                  aria-describedby={rejectionNoteError ? 'transition-note-error' : undefined}
                  placeholder="VD: Đã gọi điện hướng dẫn người dùng khởi động lại modem."
                  className={TEXTAREA_CLASS}
                />
                {rejectionNoteError && (
                  <p id="transition-note-error" className="mt-1 text-xs text-danger">
                    {rejectionNoteError}
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={closeTransitionForm}
                  className="w-full sm:w-auto"
                >
                  Hủy bỏ
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
                  disabled={!canConfirmTransition}
                  className="w-full sm:w-auto"
                >
                  {isTransitioning ? 'Đang cập nhật...' : 'Xác nhận chuyển trạng thái'}
                </Button>
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
                    <Button
                      key={edgeKey(edge)}
                      variant={
                        destructive
                          ? 'dangerOutline'
                          : isPrimary
                            ? isFinish
                              ? 'success'
                              : 'primary'
                            : 'secondary'
                      }
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
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-edge bg-surface-muted/80 px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-content-muted">
                Hiện không có thao tác chuyển trạng thái nào khả dụng cho bạn với phiếu ở trạng thái
                «{statusLabel(ticket.status)}».
              </p>
            </div>
          )}

          {!activeEdge && (
            <div className="rounded-md border border-edge-subtle bg-surface-muted/60 p-3 max-lg:hidden">
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
  );
};
