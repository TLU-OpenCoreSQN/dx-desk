// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Pause,
  ShieldAlert,
} from 'lucide-react';
import { Ticket } from '../../types/api';
import { SLA_FINISHED_STATUSES, computeSlaSnapshot, slaGaugeColor } from '../../lib/sla';

export interface SlaPauseBannerProps {
  ticket: Ticket;
  className?: string;
  showProgressBar?: boolean;
  compact?: boolean;
  /**
   * Người xem: `staff` (Agent/Manager) thấy số liệu vận hành;
   * `requester` thấy điều phiếu có ý nghĩa với họ, không dùng thuật ngữ SLA nội bộ.
   */
  audience?: 'staff' | 'requester';
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const SlaPauseBanner: React.FC<SlaPauseBannerProps> = ({
  ticket,
  className = '',
  showProgressBar = true,
  compact = false,
  audience = 'staff',
}) => {
  const forRequester = audience === 'requester';
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick every second for active tickets with SLA
  useEffect(() => {
    if (!ticket.sla_due_at || SLA_FINISHED_STATUSES.has(ticket.status)) {
      return;
    }
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [ticket.sla_due_at, ticket.status]);

  if (!ticket.sla_due_at) {
    if (compact) return null;
    return (
      <div
        className={`flex items-center gap-2 rounded-md border border-edge bg-surface-muted/60 px-3.5 py-2.5 text-xs text-content-muted ${className}`}
      >
        <Info className="h-4 w-4 text-content-subtle shrink-0" />
        <span>Chưa thiết lập cam kết SLA cho phiếu này.</span>
      </div>
    );
  }

  const sla = computeSlaSnapshot(ticket, now);
  const { originalDue, remainingMs, isBreached, isPaused, elapsedPercent } = sla;
  const isResolved = sla.isFinished;
  const effectiveDueDate = new Date(sla.effectiveDue);
  const totalPausedMinutes = Math.floor(sla.totalPausedMs / 60000);

  // Phiếu đã hủy: SLA không còn áp dụng, không báo đạt hay trễ.
  if (ticket.status === 'cancelled') {
    if (compact) return null;
    return (
      <div
        className={`flex items-center gap-2 rounded-md border border-edge bg-surface-muted/60 px-3.5 py-2.5 text-xs text-content-muted ${className}`}
      >
        <Info className="h-4 w-4 text-content-subtle shrink-0" />
        <span>Phiếu đã hủy, cam kết SLA không còn áp dụng.</span>
      </div>
    );
  }

  // Case 1: Resolved / Closed
  if (isResolved) {
    const metSla = !ticket.sla_breached;
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center justify-between rounded-md border px-3.5 py-2.5 text-xs ${
          metSla
            ? 'border-status-success-border bg-status-success-bg text-status-success'
            : 'border-status-warning-border bg-status-warning-bg text-status-warning'
        } ${className}`}
      >
        <div className="flex items-center gap-2">
          {metSla ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 stroke-[2.5]" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span className="font-semibold">
            {metSla
              ? 'ĐẠT CAM KẾT SLA · Đã giải quyết thành công trong thời hạn quy định'
              : 'ĐÃ GIẢI QUYẾT NHƯNG QUÁ HẠN SLA'}
          </span>
        </div>
        <span className="font-mono text-xs tabular-nums">
          Hạn cam kết: {formatDateTime(effectiveDueDate)}
        </span>
      </div>
    );
  }

  // Case 2: Paused State (status === 'waiting_user')
  if (isPaused && forRequester) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-md border border-status-warning-border bg-status-warning-bg p-3.5 text-status-warning shadow-2xs ${className}`}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-warning text-white">
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider">Đang chờ bạn phản hồi</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-content">
          Thời hạn xử lý được tạm dừng cho tới khi bạn gửi phản hồi, nên thời gian chờ này không
          tính là phiếu bị chậm.
        </p>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-md border border-status-warning-border bg-status-warning-bg p-3.5 text-status-warning shadow-2xs ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-warning text-white">
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider">
              SLA tạm dừng · chờ người tạo phiếu phản hồi
            </h2>
          </div>
          <span className="font-mono text-xs font-semibold tabular-nums">
            Thời gian đã dừng: {totalPausedMinutes} phút
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-content">
          Khi người tạo phiếu phản hồi, thời hạn được cộng thêm đúng khoảng thời gian tạm dừng. Hạn
          mới ước tính:{' '}
          <span className="font-semibold text-content">{formatDateTime(effectiveDueDate)}</span>.
        </p>
      </div>
    );
  }

  // Case 3: Breached State (sla_breached or remainingMs < 0)
  if (isBreached) {
    // Cờ sla_breached của máy chủ có thể bật trước khi đồng hồ phía trình duyệt thấy quá hạn.
    const overdueMinutes = Math.floor(Math.max(0, -remainingMs) / 60000);
    const overdueHours = Math.floor(overdueMinutes / 60);
    const overdueMinsRem = overdueMinutes % 60;
    const overdueText =
      overdueHours > 0
        ? `${overdueHours} giờ ${overdueMinsRem} phút`
        : `${overdueMinsRem} phút`;

    // Người tạo phiếu: báo chậm một cách bình tĩnh, không dùng ngôn ngữ vận hành
    // và không khẳng định việc leo thang mà giao diện không kiểm chứng được.
    if (forRequester) {
      return (
        <div
          role="status"
          className={`rounded-md border border-status-warning-border bg-status-warning-bg p-3.5 text-status-warning shadow-2xs ${className}`}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-warning text-white">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider">Phiếu đang chậm hơn dự kiến</h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-content">
            Thời hạn xử lý dự kiến là{' '}
            <span className="font-semibold">{formatDateTime(new Date(originalDue))}</span>. Kỹ thuật
            viên sẽ cập nhật tiến độ ngay trên trang này; bạn không cần gửi lại yêu cầu.
          </p>
        </div>
      );
    }

    return (
      <div
        role="status"
        className={`rounded-md border border-status-danger-border bg-status-danger-bg p-3.5 text-status-danger shadow-2xs ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-danger text-white">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider">
              Quá hạn SLA
            </h2>
          </div>
          <span className="font-mono text-xs font-bold tabular-nums">
            Trễ hạn: {overdueText}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-content">
          Hạn cam kết là{' '}
          <span className="font-semibold text-status-danger">{formatDateTime(new Date(originalDue))}</span>.
          Ưu tiên xử lý hoặc cập nhật cho người tạo phiếu.
        </p>
      </div>
    );
  }

  // Case 4: Active Running State
  const gaugeColor = slaGaugeColor(elapsedPercent, false);

  return (
    <div
      className={`rounded-md border border-edge bg-surface p-3.5 shadow-2xs ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--color-primary-ink)] shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-content">
            {forRequester ? 'Thời hạn xử lý dự kiến' : 'Cam kết thời hạn xử lý (SLA)'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-[var(--color-primary-ink)] tabular-nums">
            {formatDuration(remainingMs)} còn lại
          </span>
          <span className="font-mono text-xs text-content-muted tabular-nums">
            (Trước {formatDateTime(effectiveDueDate)})
          </span>
        </div>
      </div>

      {showProgressBar && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-xs text-content-muted mb-1">
            <span>{forRequester ? 'Thời gian đã dùng' : 'Tiến độ SLA'}</span>
            <span className="font-mono tabular-nums">{elapsedPercent}%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-valuenow={elapsedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Tiến độ SLA: ${elapsedPercent}%`}
          >
            <div
              className={`h-full transition-all duration-300 ${gaugeColor}`}
              style={{ width: `${elapsedPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
