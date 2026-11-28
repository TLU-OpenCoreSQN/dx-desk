// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Kiểu nút và ô nhập dùng chung, khớp với Button/fieldClass của apps/web (cùng token, cùng kích cỡ):
// vùng chạm 44px tới breakpoint lg, 32px (sm) / 40px (md) trên desktop, chuyển màu 150ms.

const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-md border font-semibold transition-colors duration-150 '
  + 'motion-reduce:transition-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring '
  + 'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const SIZES = {
  sm: 'min-h-[44px] px-3 py-1.5 text-[0.8125rem] lg:min-h-8',
  md: 'min-h-[44px] px-3.5 py-2 text-sm lg:min-h-10',
} as const;

const VARIANTS = {
  primary: 'border-primary bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
  secondary: 'border-edge-strong bg-surface text-content hover:bg-surface-muted',
  dangerOutline: 'border-status-danger-border bg-surface text-status-danger hover:bg-status-danger-bg',
  ghost: 'border-transparent bg-transparent text-content-muted hover:bg-surface-muted hover:text-content',
} as const;

export function buttonClass(variant: keyof typeof VARIANTS = 'secondary', size: keyof typeof SIZES = 'sm'): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`;
}

export const fieldClass = 'mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm text-content '
  + 'focus-visible:outline-none';

export const alertClass = {
  danger: 'rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-sm text-status-danger',
  warning: 'rounded-lg border border-status-warning-border bg-status-warning-bg p-3 text-sm text-status-warning',
  success: 'rounded-lg border border-status-success-border bg-status-success-bg p-3 text-sm text-status-success',
} as const;
