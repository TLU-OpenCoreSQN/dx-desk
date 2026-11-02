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
      bg: 'bg-[#deeef8] border-[#b9daf0] text-[#07507f]',
      icon: <Info className="w-4 h-4 text-[#0a78be] shrink-0 mt-0.5" aria-hidden="true" />,
    },
    success: {
      bg: 'bg-[#edf3ec] border-[#b8dcce] text-[#27553c]',
      icon: <CheckCircle2 className="w-4 h-4 text-[#448361] shrink-0 mt-0.5" aria-hidden="true" />,
    },
    warning: {
      bg: 'bg-[#fbf3db] border-[#f5ddb2] text-[#7c5108]',
      icon: <AlertTriangle className="w-4 h-4 text-[#cb912f] shrink-0 mt-0.5" aria-hidden="true" />,
    },
    error: {
      bg: 'bg-[#fbe4e4] border-[#f6c3c1] text-[#962824]',
      icon: <AlertCircle className="w-4 h-4 text-[#d44c47] shrink-0 mt-0.5" aria-hidden="true" />,
    },
  }[type];

  return (
    <div
      role="alert"
      className={`border rounded-[6px] p-4 flex items-start gap-3 text-xs sm:text-sm shadow-2xs ${styles.bg} ${className}`}
    >
      {styles.icon}
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-bold mb-1 tracking-tight">{title}</h4>}
        <div className="leading-relaxed break-words">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="text-[var(--color-content-muted)] hover:text-[var(--color-content)] focus:outline-none focus:ring-2 focus:ring-[#0a78be] rounded-[4px] p-1 min-w-[28px] min-h-[28px] flex items-center justify-center -mr-1 -mt-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
