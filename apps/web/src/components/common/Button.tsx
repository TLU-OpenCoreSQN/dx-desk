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
    'border border-[var(--color-primary)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-xs hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] focus-visible:ring-[var(--color-primary)]',
  secondary:
    'border border-[var(--color-edge-subtle)] bg-[var(--color-surface,#ffffff)] text-[var(--color-content,#211f1b)] hover:bg-[var(--color-surface-muted,#f1f1ef)] focus-visible:ring-[var(--color-primary)] shadow-2xs',
  success:
    'border border-[var(--color-success,#448361)] bg-[var(--color-success,#448361)] text-white shadow-xs hover:bg-[var(--color-success-hover,#36694e)] focus-visible:ring-[var(--color-success,#448361)]',
  danger:
    'border border-[var(--color-danger,#d44c47)] bg-[var(--color-danger,#d44c47)] text-white shadow-xs hover:bg-[var(--color-danger-hover,#b53c37)] focus-visible:ring-[var(--color-danger,#d44c47)]',
  dangerOutline:
    'border border-[var(--color-danger-border,#f6c3c1)] bg-[var(--color-surface,#ffffff)] text-[var(--color-danger,#d44c47)] hover:bg-[var(--color-danger-tint,#fbe4e4)] focus-visible:ring-[var(--color-danger,#d44c47)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--color-content-muted,#5f5e5a)] hover:bg-[var(--color-surface-muted,#f1f1ef)] hover:text-[var(--color-content,#211f1b)] focus-visible:ring-[var(--color-primary)]',
  outline:
    'border border-[var(--color-edge,#d6d5d2)] bg-transparent text-[var(--color-content,#211f1b)] hover:bg-[var(--color-surface-warm,#f7f6f3)] hover:border-[var(--color-edge-strong,#9e9d99)] focus-visible:ring-[var(--color-primary)]',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-[32px] min-h-[44px] px-3 py-1.5 text-xs gap-1.5 lg:min-h-8',
  md: 'h-[38px] min-h-[44px] md:min-h-[38px] px-3.5 py-2 text-sm font-semibold gap-2 lg:min-h-10',
  lg: 'h-[44px] min-h-[44px] px-5 py-2.5 text-sm gap-2.5 lg:min-h-11',
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
