// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { ToastMessage } from '../../contexts/ToastContext';

export interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { id, type, title, message, duration = 4500 } = toast;
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef<number>(duration);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (duration <= 0) return;

    if (!isPaused) {
      startTimeRef.current = Date.now();
      timerRef.current = window.setTimeout(() => {
        onDismiss(id);
      }, remainingTimeRef.current);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        const elapsed = Date.now() - startTimeRef.current;
        remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [id, duration, isPaused, onDismiss]);

  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  const isAlert = type === 'error' || type === 'warning';
  const role = isAlert ? 'alert' : 'status';
  const ariaLive = isAlert ? 'assertive' : 'polite';

  const typeConfig = {
    success: {
      icon: <CheckCircle2 className="h-5 w-5 text-[var(--color-success)] shrink-0" aria-hidden="true" />,
      border: 'border-[var(--color-success-border)]',
      bg: 'bg-[var(--color-surface)]',
    },
    error: {
      icon: <AlertCircle className="h-5 w-5 text-[var(--color-danger)] shrink-0" aria-hidden="true" />,
      border: 'border-[var(--color-danger-border)]',
      bg: 'bg-[var(--color-surface)]',
    },
    warning: {
      icon: <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] shrink-0" aria-hidden="true" />,
      border: 'border-[var(--color-warning-border)]',
      bg: 'bg-[var(--color-surface)]',
    },
    info: {
      icon: <Info className="h-5 w-5 text-[var(--color-info)] shrink-0" aria-hidden="true" />,
      border: 'border-[var(--color-info-border)]',
      bg: 'bg-[var(--color-surface)]',
    },
  }[type];

  return (
    <div
      role={role}
      aria-live={ariaLive}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto relative flex w-full items-start gap-3 rounded-[6px] border ${typeConfig.border} ${typeConfig.bg} p-3.5 shadow-lg transition-all`}
      data-testid={`toast-${id}`}
    >
      <div className="pt-0.5">{typeConfig.icon}</div>
      <div className="flex-1 space-y-0.5 min-w-0">
        {title && (
          <h4 className="text-xs font-semibold text-[var(--color-content)] leading-snug">
            {title}
          </h4>
        )}
        <p className="text-xs text-[var(--color-content-muted)] leading-relaxed break-words">
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Đóng thông báo"
        className="rounded-[4px] p-1 text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};

export interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      data-testid="toast-container"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export const Toast = ToastContainer;
export default Toast;
