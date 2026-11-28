// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Check, XCircle } from 'lucide-react';
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
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-sm leading-relaxed text-status-danger">
          <div className="flex items-center gap-1.5 font-semibold">
            <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>Yêu cầu đã bị từ chối</span>
          </div>
          {request.decision_note && (
            <p className="mt-1.5 font-medium">Lý do từ chối: {request.decision_note}</p>
          )}
          {request.decided_by && (
            <p className="mt-1 text-xs">Người quyết định: {request.decided_by}</p>
          )}
        </div>
      ) : (
        <ol className="grid grid-cols-4 gap-1.5 text-xs" aria-label="Tiến trình">
          {DEVICE_STEP_LABELS.map((label, index) => {
            const isDone = index < currentStepIndex || isHandedOver;
            const isCurrent = index === currentStepIndex && !isHandedOver;
            return (
              <li
                key={label}
                aria-current={isCurrent ? 'step' : undefined}
                className={`border-t-2 pt-1.5 ${
                  isCurrent
                    ? 'border-primary text-content font-semibold'
                    : isDone
                    ? 'border-primary text-content'
                    : 'border-edge text-content-muted'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      isDone
                        ? 'bg-primary text-white'
                        : isCurrent
                        ? 'border border-primary-border bg-primary-tint text-primary-text'
                        : 'bg-surface-muted text-content-muted'
                    }`}
                  >
                    {isDone ? <Check aria-hidden="true" className="h-3 w-3" /> : index + 1}
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
