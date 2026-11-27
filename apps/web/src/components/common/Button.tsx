// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'dangerOutline' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'border border-[var(--color-primary)] bg-primary hover:bg-primary-hover active:bg-primary-active text-white shadow-xs hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] focus-visible:ring-[var(--color-primary)]',
  secondary:
    'border border-[var(--color-edge-subtle)] bg-[var(--color-surface)] text-[var(--color-content)] hover:bg-[var(--color-surface-muted)] focus-visible:ring-[var(--color-primary)] shadow-2xs',
  success:
    'border border-[var(--color-success)] bg-[var(--color-success)] text-white shadow-xs hover:bg-[var(--color-success-hover)] focus-visible:ring-[var(--color-success)]',
  danger:
    'border border-[var(--color-danger)] bg-[var(--color-danger)] text-white shadow-xs hover:bg-[var(--color-danger-hover)] focus-visible:ring-[var(--color-danger)]',
  dangerOutline:
    'border border-[var(--color-danger-border)] bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)] focus-visible:ring-[var(--color-danger)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)] focus-visible:ring-[var(--color-primary)]',
  outline:
    'border border-[var(--color-edge)] bg-transparent text-[var(--color-content)] hover:bg-[var(--color-surface-warm)] hover:border-[var(--color-edge-strong)] focus-visible:ring-[var(--color-primary)]',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  // Chỉ dùng min-h: giữ vùng chạm 44px tới breakpoint lg và cho nhãn dài xuống dòng không bị cắt.
  sm: 'min-h-[44px] px-3 py-1.5 text-[13px] gap-1.5 lg:min-h-8',
  md: 'min-h-[44px] px-3.5 py-2 text-sm font-semibold gap-2 lg:min-h-10',
  lg: 'min-h-[44px] px-5 py-2.5 text-sm gap-2.5 lg:min-h-11',
};

const spinnerSizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-4.5 w-4.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    icon,
    leftIcon,
    rightIcon,
    children,
    className = '',
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading;
  const leadIcon = leftIcon ?? icon;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading ? true : undefined}
      className={`inline-flex items-center justify-center font-semibold rounded-md transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2
          aria-hidden="true"
          className={`animate-spin shrink-0 ${spinnerSizeStyles[size]}`}
          data-testid="button-spinner"
        />
      ) : leadIcon ? (
        <span className="shrink-0 flex items-center" aria-hidden="true">
          {leadIcon}
        </span>
      ) : null}

      {children ? <span>{children}</span> : null}

      {!isLoading && rightIcon ? (
        <span className="shrink-0 flex items-center" aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
});

export default Button;
