// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-[8px] border border-dashed border-[#e4e3e0] shadow-2xs">
      <div className="w-14 h-14 rounded-[10px] bg-[#f7f6f3] flex items-center justify-center text-[#5f5e5a] mb-4 border border-[#e4e3e0] shadow-2xs">
        {icon || <Inbox className="w-6 h-6 text-[#5f5e5a]" aria-hidden="true" />}
      </div>
      <h3 className="text-sm sm:text-base font-bold text-[#211f1b] mb-1.5 tracking-tight">{title}</h3>
      <p className="text-xs sm:text-sm text-[#5f5e5a] max-w-md mb-6 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] text-white text-xs sm:text-sm font-semibold rounded-[6px] shadow-xs active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-all min-h-[40px]"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
