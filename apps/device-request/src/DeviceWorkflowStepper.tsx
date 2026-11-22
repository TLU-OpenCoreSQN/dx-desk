// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import type { DeviceRequest } from './workflow';

export interface DeviceWorkflowStepperProps {
  request: DeviceRequest;
  onDownloadHandover?: () => void;
  className?: string;
}

export const DEVICE_STEP_LABELS = ['Gửi đề nghị', 'Quản lý duyệt', 'IT chuẩn bị', 'Bàn giao'];

export function DeviceWorkflowStepper({
  request,
  className = '',
}: DeviceWorkflowStepperProps) {
  const isRejected = request.status === 'rejected';
  const isHandedOver = request.status === 'handed_over';
  const stepKeys = ['pending', 'approved', 'preparing', 'handed_over'];
  const currentStepIndex = stepKeys.indexOf(request.status);

  return (
    <div className={`mt-3.5 space-y-2.5 ${className}`}>
      {isRejected ? (
        <div className="rounded-md border border-danger-edge bg-danger-tint p-3 text-xs leading-relaxed text-danger">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold">✕</span>
            <span>Yêu cầu đã bị từ chối</span>
          </div>
          {request.decision_note && (
            <p className="mt-1.5 font-medium">Lý do từ chối: {request.decision_note}</p>
          )}
          {request.decided_by && (
            <p className="mt-1 text-[11px] opacity-80">Người quyết định: {request.decided_by}</p>
          )}
        </div>
      ) : (
        <ol className="grid grid-cols-4 gap-1.5 text-[11px]" aria-label="Tiến trình">
          {DEVICE_STEP_LABELS.map((label, index) => {
            const isDone = index < currentStepIndex || isHandedOver;
            const isCurrent = index === currentStepIndex && !isHandedOver;
            return (
              <li
                key={label}
                aria-current={isCurrent ? 'step' : undefined}
                className={`border-t-2 pt-1.5 transition-colors ${
                  isCurrent
                    ? 'border-primary text-content font-semibold'
                    : isDone
                    ? 'border-primary text-content'
                    : 'border-edge text-muted'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isDone
                        ? 'bg-primary text-white'
                        : isCurrent
                        ? 'border border-primary-edge bg-primary-tint text-primary-text'
                        : 'bg-surface-muted text-muted'
                    }`}
                  >
                    {isDone ? '✓' : index + 1}
                  </span>
                  <span className="truncate">{label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
