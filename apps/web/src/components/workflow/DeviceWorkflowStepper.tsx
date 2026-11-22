// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {
  Check,
  Clock,
  Download,
  FileText,
  XCircle,
} from 'lucide-react';
import { DeviceRequest } from '../../types/api';

export interface DeviceWorkflowStepperProps {
  request: DeviceRequest;
  onDownloadHandover?: () => void;
  handoverUrl?: string;
  isDownloading?: boolean;
  className?: string;
}

export interface DeviceStepDef {
  key: string;
  label: string;
  subtitle: string;
  order: number;
}

export const DEVICE_STEPS: DeviceStepDef[] = [
  { key: 'pending', label: 'Gửi đề nghị', subtitle: 'Khởi tạo yêu cầu', order: 1 },
  { key: 'approved', label: 'Quản lý duyệt', subtitle: 'Xác nhận nhu cầu', order: 2 },
  { key: 'preparing', label: 'IT Chuẩn bị', subtitle: 'Cài đặt & kiểm thử', order: 3 },
  { key: 'handed_over', label: 'Bàn giao thiết bị', subtitle: 'Ký nhận & sử dụng', order: 4 },
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
    year: 'numeric',
  });
}

export const DeviceWorkflowStepper: React.FC<DeviceWorkflowStepperProps> = ({
  request,
  onDownloadHandover,
  handoverUrl,
  isDownloading = false,
  className = '',
}) => {
  const isRejected = request.status === 'rejected';
  const isHandedOver = request.status === 'handed_over';

  // Map step index: pending (0), approved (1), preparing (2), handed_over (3)
  const stepKeys = ['pending', 'approved', 'preparing', 'handed_over'];
  const currentStepIndex = stepKeys.indexOf(request.status);

  return (
    <section
      aria-label="Tiến trình cấp phát thiết bị"
      className={`rounded-lg border border-edge bg-surface p-4 shadow-2xs sm:p-5 ${className}`}
    >
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge-subtle pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold tracking-wider text-primary">
            TIẾN TRÌNH CẤP PHÁT
          </span>
          <span className="font-mono text-xs text-content-subtle tabular-nums">
            #{request.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-content-muted">Phòng ban:</span>
          <span className="font-semibold text-content">{request.department || 'Chung'}</span>
        </div>
      </div>

      {/* 4-Stage Stepper Track (if not rejected) */}
      {!isRejected && (
        <ol
          className="relative mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start sm:gap-0"
          role="list"
        >
          {DEVICE_STEPS.map((step, index) => {
            const isCompleted = isHandedOver || index < currentStepIndex;
            const isCurrent = index === currentStepIndex && !isHandedOver;

            let stepDetail = step.subtitle;
            if (index === 0 && request.created_at) {
              stepDetail = formatTime(request.created_at);
            } else if (index === 1) {
              if (request.decided_at) {
                stepDetail = `${formatTime(request.decided_at)}${
                  request.decided_by ? ` · ${request.decided_by}` : ''
                }`;
              }
            } else if (index === 2) {
              if (request.prepared_at) {
                stepDetail = formatTime(request.prepared_at);
              } else if (isCurrent) {
                stepDetail = 'Đang cấu hình thiết bị';
              }
            } else if (index === 3) {
              if (request.handed_over_at) {
                stepDetail = formatTime(request.handed_over_at);
              }
            }

            let nodeClass = 'border-2 border-edge bg-surface-muted text-content-subtle';
            if (isCompleted) {
              nodeClass = 'border-2 border-status-success bg-status-success text-white shadow-2xs';
            } else if (isCurrent) {
              nodeClass = 'border-2 border-primary bg-primary text-white ring-4 ring-primary-tint';
            }

            return (
              <li
                key={step.key}
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={isCompleted ? `Bước ${index + 1}: ${step.label} đã hoàn thành` : undefined}
                className="relative flex flex-1 flex-row items-center gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
              >
                {/* Connecting Line for desktop */}
                {index > 0 && (
                  <div
                    aria-hidden="true"
                    className={`hidden sm:block absolute top-4 right-1/2 w-full -translate-y-1/2 h-0.5 transition-colors ${
                      isCompleted || isCurrent
                        ? 'bg-status-success'
                        : 'border-t-2 border-dashed border-edge'
                    }`}
                    style={{ left: '-50%' }}
                  />
                )}

                {/* Node Circle */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold text-xs transition-all ${nodeClass}`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                  ) : isCurrent ? (
                    <Clock className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span>{step.order}</span>
                  )}
                </div>

                {/* Step Text */}
                <div className="flex flex-col sm:items-center">
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? 'text-primary font-bold'
                        : isCompleted
                        ? 'text-content'
                        : 'text-content-subtle'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="font-mono text-[10px] text-content-subtle tabular-nums mt-0.5 max-w-[140px] truncate">
                    {stepDetail}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Case 1: Rejection Off-Ramp Callout */}
      {isRejected && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-status-danger-border bg-status-danger-bg p-3.5 sm:p-4 text-status-danger"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-danger text-white">
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                YÊU CẦU ĐÃ BỊ TỪ CHỐI BỞI QUẢN LÝ
              </h4>
            </div>
            {request.decided_at && (
              <span className="font-mono text-xs tabular-nums text-status-danger">
                Thời gian: {formatTime(request.decided_at)}
              </span>
            )}
          </div>
          <div className="mt-2 text-xs leading-relaxed text-content space-y-1">
            <p>
              <strong className="text-status-danger">Lý do từ chối:</strong>{' '}
              {request.decision_note || 'Không có lý do cụ thể.'}
            </p>
            {request.decided_by && (
              <p className="text-content-muted">
                Người quyết định: <span className="font-medium text-content">{request.decided_by}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Case 2: Handover Completed & SeaweedFS PDF Chip */}
      {isHandedOver && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-md border border-status-success-border bg-status-success-bg p-3.5 sm:p-4 text-status-success"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-success text-white">
                <Check className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                ĐÃ BÀN GIAO THÀNH CÔNG VÀO LÚC {formatTime(request.handed_over_at)}
              </h4>
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-content">
            Thiết bị đã được kiểm tra, cài đặt phần mềm chuẩn hóa và bàn giao đầy đủ cho nhân viên.
            Biên bản bàn giao lưu trữ an toàn trên hệ thống SeaweedFS.
          </p>

          {/* SeaweedFS PDF Handover Chip */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {handoverUrl ? (
              <a
                href={handoverUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-status-success-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-status-success shadow-2xs hover:bg-status-success-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success"
              >
                <FileText className="h-4 w-4" />
                <span>Tải biên bản bàn giao (.PDF)</span>
                <Download className="h-3.5 w-3.5 opacity-70" />
              </a>
            ) : onDownloadHandover ? (
              <button
                type="button"
                onClick={onDownloadHandover}
                disabled={isDownloading}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-status-success-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-status-success shadow-2xs hover:bg-status-success-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                <span>{isDownloading ? 'Đang tải biên bản...' : 'Tải biên bản bàn giao (.PDF)'}</span>
                <Download className="h-3.5 w-3.5 opacity-70" />
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
};
