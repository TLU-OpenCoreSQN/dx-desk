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

export const LINEAR_STAGES: StageStepDef[] = [
  { key: 'new', label: 'Tiếp nhận', description: 'Ghi nhận yêu cầu', order: 1 },
  { key: 'triaged', label: 'Phân loại', description: 'Xác định phạm vi', order: 2 },
  { key: 'assigned', label: 'Phân công', description: 'Gán người phụ trách', order: 3 },
  { key: 'in_progress', label: 'Đang xử lý', description: 'Khắc phục sự cố', order: 4 },
  { key: 'resolved', label: 'Giải quyết', description: 'Đã hoàn thành', order: 5 },
  { key: 'closed', label: 'Đóng phiếu', description: 'Nghiệm thu đóng phiếu', order: 6 },
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
      className={`rounded-lg border border-edge bg-surface p-4 shadow-2xs sm:p-5 ${className}`}
    >
      {/* Header section with ticket title and current status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge-subtle pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold tracking-wider text-primary">
            TIẾN TRÌNH XỬ LÝ PHIẾU
          </span>
          <span className="font-mono text-xs text-content-subtle tabular-nums">
            #{ticket.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-muted">Trạng thái:</span>
          <span className="font-semibold text-xs text-content">
            {STATUS_LABELS[currentStatus] || currentStatus}
          </span>
        </div>
      </div>

      {/* Mobile condensed bar (< sm) */}
      <div className="mt-3 block sm:hidden">
        <div className="flex items-center justify-between rounded-md border border-edge bg-surface-muted px-3 py-2 text-xs">
          <div className="flex items-center gap-2 font-medium text-content">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
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
            className="inline-flex items-center gap-1 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs px-1"
            aria-expanded={mobileExpanded}
          >
            <span>{mobileExpanded ? 'Thu gọn' : 'Xem tiến trình'}</span>
            {mobileExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Full 6-stage tracker (visible on sm: and desktop, or when mobileExpanded) */}
      <div className={`mt-5 ${mobileExpanded ? 'block' : 'hidden sm:block'}`}>
        <ol
          className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-start sm:gap-0"
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

            let nodeClass = 'border-2 border-edge bg-surface-muted text-content-subtle';
            if (isCompleted) {
              nodeClass = 'border-2 border-status-success bg-status-success text-white shadow-2xs';
            } else if (isBranchPoint) {
              nodeClass = isBranchWaiting
                ? 'border-2 border-status-warning bg-status-warning text-white ring-4 ring-status-warning-bg animate-pulse'
                : 'border-2 border-status-pending bg-status-pending text-white ring-4 ring-status-pending-bg';
            } else if (isCurrent) {
              nodeClass = 'border-2 border-primary bg-primary text-white ring-4 ring-primary-tint';
            }

            return (
              <li
                key={step.key}
                role="listitem"
                aria-current={isCurrent || isBranchPoint ? 'step' : undefined}
                aria-label={isCompleted ? `Bước ${index + 1}: ${step.label} đã hoàn thành` : undefined}
                className="relative flex flex-1 flex-row items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
              >
                {/* Connecting track line for sm+ desktop */}
                {index > 0 && (
                  <div
                    aria-hidden="true"
                    className={`hidden sm:block absolute top-4 right-1/2 w-full -translate-y-1/2 h-0.5 transition-colors ${
                      index <= effectiveLinearIndex && !isBranchCancelled
                        ? 'bg-status-success'
                        : 'border-t-2 border-dashed border-edge'
                    }`}
                    style={{ left: '-50%' }}
                  />
                )}

                {/* Node circle */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold text-xs transition-all ${nodeClass}`}
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
                <div className="flex flex-col sm:items-center">
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent || isBranchPoint
                        ? 'text-primary font-bold'
                        : isCompleted
                        ? 'text-content'
                        : 'text-content-subtle'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] text-content-muted hidden sm:inline">
                    {step.description}
                  </span>
                  <span className="font-mono text-[10px] text-content-subtle tabular-nums mt-0.5">
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

      {/* Conditional Branch Callout: Waiting User (SLA Paused) */}
      {isBranchWaiting && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-md border border-status-warning-border bg-status-warning-bg p-3.5 sm:p-4 text-status-warning"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-warning text-white">
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                ĐANG CHỜ PHẢN HỒI TỪ NGƯỜI DÙNG · SLA TẠM DỪNG
              </h4>
            </div>
            {pausedMinutes > 0 && (
              <span className="font-mono text-xs font-semibold tabular-nums">
                Thời gian đã dừng: {pausedMinutes} phút
              </span>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-content">
            Kỹ thuật viên đang chờ thông tin phản hồi từ người tạo phiếu để tiếp tục xử lý.
            Đồng hồ SLA được tạm dừng tính giờ cho đến khi có phản hồi.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onActionClick && (
              <button
                type="button"
                onClick={() => onActionClick('reply')}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md bg-status-warning px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-warning"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Phản hồi ngay</span>
              </button>
            )}
            {actionsSlot}
          </div>
        </div>
      )}

      {/* Conditional Branch Callout: Pending Manager Approval */}
      {isBranchApproval && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-md border border-status-pending-border bg-status-pending-bg p-3.5 sm:p-4 text-status-pending"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-pending text-white">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                CHỜ PHÊ DUYỆT TỪ QUẢN LÝ DỊCH VỤ
              </h4>
            </div>
            <span className="text-xs font-medium">Nhánh phê duyệt bảo mật</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-content">
            Yêu cầu này cần được Quản lý dịch vụ hoặc Trưởng bộ phận phê duyệt trước khi phân
            công kỹ thuật viên triển khai thực tế.
          </p>
          {actionsSlot && <div className="mt-3">{actionsSlot}</div>}
        </div>
      )}

      {/* Conditional Branch Callout: Cancelled */}
      {isBranchCancelled && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-status-danger-border bg-status-danger-bg p-3.5 sm:p-4 text-status-danger"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-danger text-white">
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h4 className="text-xs font-bold uppercase tracking-wider">
              PHIẾU ĐÃ BỊ HỦY BỎ
            </h4>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-content">
            Phiếu sự cố này đã kết thúc ở trạng thái hủy. Không thể thực hiện thêm các thao tác xử lý
            kỹ thuật trên phiếu này.
          </p>
        </div>
      )}
    </section>
  );
};
