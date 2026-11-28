// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const styles = {
    info: {
      bg: 'bg-status-info-bg border-status-info-border text-status-info',
      icon: <Info className="w-4 h-4 text-status-info shrink-0 mt-0.5" aria-hidden="true" />,
    },
    success: {
      bg: 'bg-status-success-bg border-status-success-border text-status-success',
      icon: <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" aria-hidden="true" />,
    },
    warning: {
      bg: 'bg-status-warning-bg border-status-warning-border text-status-warning',
      icon: <AlertTriangle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" aria-hidden="true" />,
    },
    error: {
      bg: 'bg-status-danger-bg border-status-danger-border text-status-danger',
      icon: <AlertCircle className="w-4 h-4 text-status-danger shrink-0 mt-0.5" aria-hidden="true" />,
    },
  }[type];

  return (
    <div
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      className={`border rounded-lg p-4 flex items-start gap-3 text-sm ${styles.bg} ${className}`}
    >
      {styles.icon}
      <div className="flex-1 min-w-0">
        {/* Không dùng thẻ heading: Alert nằm ở nhiều độ sâu khác nhau, heading cố định sẽ nhảy cấp. */}
        {title && <p className="font-semibold mb-1">{title}</p>}
        <div className="leading-relaxed break-words">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="text-content-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1 min-w-[32px] min-h-[32px] flex items-center justify-center -mr-1 -mt-1 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
