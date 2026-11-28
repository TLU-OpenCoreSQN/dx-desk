// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';

/*
 * Bảng dữ liệu ITSM dùng chung (TicketListPage, Bảng việc, Phê duyệt): thẻ <table> ngữ nghĩa với
 * <th scope="col">, hàng cao 44px, chữ căn trái, số và ngày căn phải (tabular-nums).
 * Khung là container: khi hẹp hơn @3xl (khung xem nhanh đang mở, hoặc màn hình nhỏ) mỗi hàng
 * chuyển thành thẻ gọn, tiêu đề cột ẩn; khi đủ rộng hiển thị đúng dạng bảng.
 */

export function DataTable({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`@container min-w-0 overflow-x-auto rounded-lg border border-edge bg-surface ${className}`}>
      <table aria-label={label} className="block w-full text-sm @3xl:table @3xl:table-fixed">
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="hidden bg-surface-muted @3xl:table-header-group">
      <tr>{children}</tr>
    </thead>
  );
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="block divide-y divide-edge @3xl:table-row-group @3xl:divide-y-0">{children}</tbody>;
}

type Align = 'left' | 'right';

export function Th({
  children,
  align = 'left',
  width,
  srOnly = false,
}: {
  children: React.ReactNode;
  align?: Align;
  /** Bề rộng cột cố định, ví dụ "w-28"; bỏ trống cho cột co giãn. */
  width?: string;
  srOnly?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`h-10 border-b border-edge px-3 text-xs font-semibold text-content-muted first:pl-4 last:pr-4 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${width ?? ''}`}
    >
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

/** Lớp cho <tr>: thẻ lưới trên khung hẹp, hàng bảng trên khung rộng. */
export function rowClass(selected = false): string {
  return `grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 px-4 py-3 transition-colors duration-150 motion-reduce:transition-none @3xl:table-row @3xl:p-0 ${
    selected ? 'bg-state-selected' : 'hover:bg-state-hover'
  }`;
}

/** Lớp cho <td>. `span` cho ô chiếm trọn chiều ngang thẻ khi khung hẹp. */
export function cellClass({ align = 'left', span = false }: { align?: Align; span?: boolean } = {}): string {
  return `block min-w-0 @3xl:table-cell @3xl:h-11 @3xl:border-b @3xl:border-edge @3xl:px-3 @3xl:py-2 @3xl:align-middle @3xl:first:pl-4 @3xl:last:pr-4 ${
    span ? 'col-span-2 @3xl:col-span-1' : ''
  } ${align === 'right' ? 'text-right' : 'text-left'}`;
}

/** Mã phiếu ngắn, font mono, chữ số cùng độ rộng. Mã đầy đủ ở thuộc tính title để sao chép khi cần. */
export function TicketCode({ id, className = '' }: { id: string; className?: string }) {
  return (
    <span data-numeric title={id} className={`font-mono text-xs text-content-muted ${className}`}>
      #{id.slice(0, 8)}
    </span>
  );
}
