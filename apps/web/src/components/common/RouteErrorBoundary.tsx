// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface RouteErrorBoundaryState {
  hasError: boolean;
}

/**
 * Bắt lỗi khi tải trang lazy (ví dụ chunk cũ không còn sau khi hệ thống được
 * cập nhật) để người dùng thấy hướng dẫn tải lại thay vì màn hình trắng.
 */
export class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Không thể hiển thị trang:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="mx-auto mt-16 max-w-md space-y-3 rounded-[8px] border border-[var(--color-edge-subtle)] bg-[var(--color-surface)] p-6 text-center text-[var(--color-content)] shadow-xs"
      >
        <h1 className="text-base font-semibold">Không thể tải trang</h1>
        <p className="text-sm leading-relaxed text-[var(--color-content-muted)]">
          Hệ thống có thể vừa được cập nhật hoặc kết nối mạng bị gián đoạn. Vui lòng tải lại trang
          để tiếp tục.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 lg:min-h-10"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tải lại trang</span>
        </button>
      </div>
    );
  }
}
