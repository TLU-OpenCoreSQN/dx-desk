// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Pause,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { Ticket, TicketEvent } from '../../types/api';
import { Button } from '../common/Button';
import { TicketStatus, STATUS_LABELS } from '../../lib/ticketWorkflow';

export interface TicketStageTrackerProps {
  ticket: Ticket;
  events?: TicketEvent[];
  className?: string;
  onActionClick?: (actionKey: string) => void;
  actionsSlot?: React.ReactNode;
}

export interface StageStepDef {
  key: TicketStatus;
  label: string;
  description: string;
  order: number;
}

/** Tên bước dùng đúng nhãn trạng thái trên badge, để một trạng thái chỉ có một tên. */
export const LINEAR_STAGES: StageStepDef[] = [
  { key: 'new', label: STATUS_LABELS.new, description: 'Ghi nhận yêu cầu', order: 1 },
  { key: 'triaged', label: STATUS_LABELS.triaged, description: 'Xác định danh mục, ưu tiên', order: 2 },
  { key: 'assigned', label: STATUS_LABELS.assigned, description: 'Giao kỹ thuật viên', order: 3 },
  { key: 'in_progress', label: STATUS_LABELS.in_progress, description: 'Khắc phục sự cố', order: 4 },
  { key: 'resolved', label: STATUS_LABELS.resolved, description: 'Ghi kết quả xử lý', order: 5 },
  { key: 'closed', label: STATUS_LABELS.closed, description: 'Người tạo phiếu xác nhận', order: 6 },
];

function formatTime(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function findStatusTimestamp(
  status: TicketStatus,
  ticket: Ticket,
  events?: TicketEvent[]
): string | null {
  if (status === 'new') return ticket.created_at;
  if (!events || events.length === 0) return null;

  // Search events in chronological or reverse order
  for (const ev of events) {
    const payload = ev.payload as Record<string, unknown> | null;
    if (payload?.to === status || payload?.to_status === status) {
      return ev.created_at;
    }
  }
  return null;
}

export const TicketStageTracker: React.FC<TicketStageTrackerProps> = ({
  ticket,
  events,
  className = '',
  onActionClick,
  actionsSlot,
}) => {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const currentStatus = ticket.status as TicketStatus;
  const isBranchWaiting = currentStatus === 'waiting_user';
  const isBranchApproval = currentStatus === 'pending_approval';
  const isBranchCancelled = currentStatus === 'cancelled';

  // Determine effective happy path index (0..5)
  let effectiveLinearIndex = LINEAR_STAGES.findIndex((s) => s.key === currentStatus);
  if (isBranchWaiting) {
    // waiting_user branches off Step 4 (in_progress)
    effectiveLinearIndex = 3;
  } else if (isBranchApproval) {
    // pending_approval branches off Step 3 (assigned) or Step 4 (in_progress)
    effectiveLinearIndex = 2;
  } else if (isBranchCancelled) {
    effectiveLinearIndex = -1; // Special branch
  }

  // Calculate paused minutes
  const pausedMinutes = Math.floor(Number(ticket.sla_paused_ms || 0) / 60000);

  // Current stage label for mobile summary
  const currentStepDef =
    effectiveLinearIndex >= 0 ? LINEAR_STAGES[effectiveLinearIndex] : null;

  return (
    <section
      aria-label="Tiến trình xử lý phiếu"
      className={`@container rounded-lg border border-edge bg-surface p-4 ${className}`}
    >
      {/* Header section with ticket title and current status */}
      {/* Trạng thái và mã phiếu đã có ở header; ở đây chỉ còn tên khối. */}
      <div className="border-b border-edge-subtle pb-3">
        <h2 className="dx-section-title">
          Tiến trình xử lý phiếu
        </h2>
      </div>

      {/* Mobile condensed bar (< sm) */}
      <div className="mt-3 block @2xl:hidden">
        <div className="flex items-center justify-between rounded-md border border-edge bg-surface-muted px-3 py-2 text-xs">
          <div className="flex items-center gap-2 font-medium text-content">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {effectiveLinearIndex >= 0 ? effectiveLinearIndex + 1 : '!'}
            </span>
            <span>
              {isBranchCancelled
                ? 'Đã hủy phiếu'
                : `Bước ${effectiveLinearIndex + 1}/6: ${currentStepDef?.label}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileExpanded(!mobileExpanded)}
            className="-my-3 inline-flex min-h-11 items-center gap-1 rounded-sm px-2 font-semibold text-[var(--color-primary-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-expanded={mobileExpanded}
          >
            <span>{mobileExpanded ? 'Thu gọn' : 'Xem tiến trình'}</span>
            {mobileExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Đủ 6 bước khi khối đủ rộng (container ≥ 42rem), hoặc khi người dùng mở rộng */}
      <div className={`mt-5 ${mobileExpanded ? 'block' : 'hidden @2xl:block'}`}>
        <ol
          className="relative flex flex-col justify-between gap-4 @2xl:flex-row @2xl:items-start @2xl:gap-0"
          role="list"
        >
          {LINEAR_STAGES.map((step, index) => {
            const isCompleted =
              !isBranchCancelled &&
              (index < effectiveLinearIndex ||
                (currentStatus === 'closed' && index === 5) ||
                (currentStatus === 'resolved' && index === 4));

            const isCurrent =
              !isBranchCancelled &&
              index === effectiveLinearIndex &&
              !isCompleted;

            const isBranchPoint =
              (isBranchWaiting && index === 3) ||
              (isBranchApproval && index === 2);

            const timestamp = findStatusTimestamp(step.key, ticket, events);

            let nodeClass = 'border-2 border-edge bg-surface-muted text-content-muted';
            if (isCompleted) {
              nodeClass = 'border-2 border-status-success bg-status-success text-white';
            } else if (isBranchPoint) {
              nodeClass = isBranchWaiting
                ? 'border-2 border-status-warning bg-status-warning text-white ring-4 ring-status-warning-bg'
                : 'border-2 border-status-pending bg-status-pending text-white ring-4 ring-status-pending-bg';
            } else if (isCurrent) {
              nodeClass = 'border-2 border-primary bg-primary text-white ring-4 ring-primary-tint';
            }

            return (
              <li
                key={step.key}
                role="listitem"
                aria-current={isCurrent || isBranchPoint ? 'step' : undefined}
                aria-label={isCompleted ? `Bước ${index + 1}: ${step.label}, đã hoàn thành` : undefined}
                className="relative flex flex-1 flex-row items-center gap-3 @2xl:flex-col @2xl:items-center @2xl:gap-2 @2xl:text-center"
              >
                {/* Connecting track line for sm+ desktop */}
                {index > 0 && (
                  <div
                    aria-hidden="true"
                    className={`hidden @2xl:block absolute top-4 right-1/2 w-full -translate-y-1/2 h-0.5 transition-colors ${
                      index <= effectiveLinearIndex && !isBranchCancelled
                        ? 'bg-status-success'
                        : 'border-t-2 border-dashed border-edge'
                    }`}
                    style={{ left: '-50%' }}
                  />
                )}

                {/* Node circle */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold text-xs transition-colors ${nodeClass}`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                  ) : isBranchPoint && isBranchWaiting ? (
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : isBranchPoint && isBranchApproval ? (
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : isCurrent ? (
                    <Clock className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span>{step.order}</span>
                  )}
                </div>

                {/* Step labels */}
                <div className="flex flex-col @2xl:items-center">
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent || isBranchPoint
                        ? 'text-[var(--color-primary-ink)] font-semibold'
                        : isCompleted
                        ? 'text-content'
                        : 'text-content-muted'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-xs text-content-muted hidden @2xl:inline">
                    {step.description}
                  </span>
                  <span className="tabular-nums text-xs text-content-muted mt-0.5">
                    {timestamp
                      ? formatTime(timestamp)
                      : isCurrent
                      ? 'Đang tiến hành'
                      : isCompleted
                      ? 'Hoàn thành'
                      : 'Chờ xử lý'}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Ghi chú nhánh chỉ hiện khi kèm thao tác: trạng thái đã có ở tiêu đề phiếu, banner SLA
          và cột thao tác, nên không lặp lại một khối cảnh báo thứ ba. */}
      {isBranchWaiting && (onActionClick || actionsSlot) && (
        <div className="mt-4 rounded-lg border border-status-warning-border bg-status-warning-bg p-3 text-sm text-status-warning">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Pause className="h-4 w-4 shrink-0" aria-hidden="true" />
              Đang chờ người tạo phiếu phản hồi · SLA tạm dừng
            </h3>
            {pausedMinutes > 0 && (
              <span data-numeric className="text-xs font-medium">
                Thời gian đã dừng: {pausedMinutes} phút
              </span>
            )}
          </div>
          <p className="mt-1 text-content">
            Kỹ thuật viên cần người tạo phiếu bổ sung thông tin để xử lý tiếp.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onActionClick && (
              <Button size="sm" leftIcon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => onActionClick('reply')}>
                Phản hồi ngay
              </Button>
            )}
            {actionsSlot}
          </div>
        </div>
      )}

      {isBranchApproval && actionsSlot && (
        <div className="mt-4 rounded-lg border border-status-pending-border bg-status-pending-bg p-3 text-sm text-status-pending">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            Chờ Quản lý phê duyệt
          </h3>
          <p className="mt-1 text-content">Yêu cầu này cần được phê duyệt trước khi giao kỹ thuật viên xử lý.</p>
          <div className="mt-3">{actionsSlot}</div>
        </div>
      )}

      {/* Phiếu đã hủy: các bước phía trên không còn bước hiện tại, nên nói rõ một dòng và lối đi tiếp. */}
      {isBranchCancelled && (
        <p className="mt-4 flex items-start gap-2 text-sm text-content-muted">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" aria-hidden="true" />
          Phiếu đã hủy nên không xử lý tiếp. Nếu sự cố vẫn còn, hãy tạo phiếu mới.
        </p>
      )}
    </section>
  );
};
