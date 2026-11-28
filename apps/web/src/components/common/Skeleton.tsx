// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';

/*
 * Khung chờ tải. Chỉ khối ngoài cùng là vùng role="status" (một thông báo cho trình đọc màn hình);
 * các thanh bên trong là trang trí (`decorative`, aria-hidden) để không đọc lặp "Đang tải" nhiều lần.
 * Hiệu ứng nhấp nháy tắt khi người dùng chọn giảm chuyển động.
 */

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  /** Thanh nằm trong một khối chờ tải khác: ẩn khỏi trình đọc màn hình. */
  decorative?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  circle = false,
  decorative = false,
  className = '',
  style,
  ...props
}) => {
  const dynamicStyles: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...style,
  };

  const shape = `animate-pulse motion-reduce:animate-none bg-surface-muted ${circle ? 'rounded-full' : 'rounded-sm'} ${className}`;

  if (decorative) {
    return <div aria-hidden="true" className={shape} style={dynamicStyles} {...props} />;
  }

  return (
    <div role="status" aria-label="Đang tải dữ liệu..." className={shape} style={dynamicStyles} {...props}>
      <span className="sr-only">Đang tải...</span>
    </div>
  );
};

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lineHeight?: string;
  lastLineWidth?: string;
  decorative?: boolean;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  className = '',
  lineHeight = 'h-4',
  lastLineWidth = '60%',
  decorative = false,
}) => {
  const bars = Array.from({ length: lines }).map((_, i) => (
    <Skeleton
      key={i}
      decorative
      className={`${lineHeight} w-full`}
      style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
    />
  ));
  if (decorative) {
    return <div aria-hidden="true" className={`space-y-2.5 ${className}`}>{bars}</div>;
  }
  return (
    <div className={`space-y-2.5 ${className}`} role="status" aria-label="Đang tải đoạn văn bản...">
      {bars}
    </div>
  );
};

export interface SkeletonCardProps {
  className?: string;
  hasHeader?: boolean;
  hasFooter?: boolean;
  bodyLines?: number;
  decorative?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  className = '',
  hasHeader = true,
  hasFooter = false,
  bodyLines = 3,
  decorative = false,
}) => {
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'status', 'aria-label': 'Đang tải thẻ nội dung...' };
  return (
    <div {...a11y} className={`dx-card space-y-4 rounded-lg border border-edge bg-surface p-5 ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between border-b border-edge pb-3">
          <Skeleton decorative className="h-5 w-1/3" />
          <Skeleton decorative className="h-4 w-16 rounded-full" />
        </div>
      )}

      <SkeletonText decorative lines={bodyLines} />

      {hasFooter && (
        <div className="flex items-center justify-between border-t border-edge pt-3">
          <Skeleton decorative className="h-4 w-24" />
          <Skeleton decorative className="h-8 w-20" />
        </div>
      )}
    </div>
  );
};

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
  showHeader?: boolean;
  decorative?: boolean;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 5,
  className = '',
  showHeader = true,
  decorative = false,
}) => {
  const width = (idx: number) => (idx === 0 ? 'w-24' : idx === 1 ? 'flex-1' : 'w-20');
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'status', 'aria-label': 'Đang tải bảng dữ liệu...' };
  return (
    <div {...a11y} className={`w-full overflow-hidden rounded-lg border border-edge bg-surface ${className}`}>
      {showHeader && (
        <div className="flex items-center gap-4 border-b border-edge bg-surface-muted px-4 py-3">
          {Array.from({ length: columns }).map((_, idx) => (
            <Skeleton key={`th-${idx}`} decorative className={`h-4 ${width(idx)}`} />
          ))}
        </div>
      )}

      <div className="divide-y divide-edge">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={`tr-${rIdx}`} className="flex h-11 items-center gap-4 px-4">
            {Array.from({ length: columns }).map((_, cIdx) => (
              <Skeleton key={`td-${rIdx}-${cIdx}`} decorative className={`h-4 ${width(cIdx)}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export interface SkeletonPageProps {
  className?: string;
}

export const SkeletonPage: React.FC<SkeletonPageProps> = ({ className = '' }) => {
  return (
    <div role="status" aria-label="Đang tải trang..." className={`mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8 ${className}`}>
      <div className="flex flex-col gap-4 border-b border-edge pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton decorative className="h-7 w-48" />
          <Skeleton decorative className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton decorative className="h-9 w-24" />
          <Skeleton decorative className="h-9 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SkeletonCard decorative bodyLines={2} />
        <SkeletonCard decorative bodyLines={2} />
        <SkeletonCard decorative bodyLines={2} />
      </div>

      <SkeletonTable decorative rows={6} columns={5} />
    </div>
  );
};

export default Skeleton;
