// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { AlertCircle } from 'lucide-react';

/** Class dùng chung cho ô nhập/select của form; `invalid` đổi viền sang màu lỗi. */
export const fieldClass = (invalid: boolean): string =>
  [
    'w-full min-h-[44px] md:min-h-[38px] rounded-md border bg-surface px-3 py-2 text-sm text-content',
    'transition-all focus:bg-surface focus:outline-none focus:ring-2',
    invalid
      ? 'border-status-danger focus:border-status-danger focus:ring-status-danger'
      : 'border-edge focus:border-primary focus:ring-primary',
  ].join(' ');

/** Thông báo lỗi ngay dưới một trường; `id` khớp với `aria-describedby` của trường đó. */
export const FieldError: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <p
    id={id}
    aria-live="polite"
    className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-status-danger"
  >
    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);
