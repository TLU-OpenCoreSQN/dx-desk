// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  circle = false,
  className = '',
  style,
  ...props
}) => {
  const dynamicStyles: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...style,
  };

  return (
    <div
      role="status"
      aria-label="Đang tải dữ liệu..."
      className={`animate-pulse motion-reduce:animate-none bg-[var(--color-surface-muted)] ${
        circle ? 'rounded-full' : 'rounded-[4px]'
      } ${className}`}
      style={dynamicStyles}
      {...props}
    >
      <span className="sr-only">Đang tải...</span>
    </div>
  );
};

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lineHeight?: string;
  lastLineWidth?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  className = '',
  lineHeight = 'h-4',
  lastLineWidth = '60%',
}) => {
  return (
    <div className={`space-y-2.5 ${className}`} role="status" aria-label="Đang tải đoạn văn bản...">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`${lineHeight} w-full`}
          style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
      <span className="sr-only">Đang tải đoạn văn bản...</span>
    </div>
  );
};

export interface SkeletonCardProps {
  className?: string;
  hasHeader?: boolean;
  hasFooter?: boolean;
  bodyLines?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  className = '',
  hasHeader = true,
  hasFooter = false,
  bodyLines = 3,
}) => {
  return (
    <div
      role="status"
      aria-label="Đang tải thẻ nội dung..."
      className={`dx-card rounded-[6px] border border-[var(--color-edge-subtle)] bg-[var(--color-surface-card)] p-5 space-y-4 ${className}`}
    >
      {hasHeader && (
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-edge-subtle)]">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      )}

      <SkeletonText lines={bodyLines} />

      {hasFooter && (
        <div className="pt-3 border-t border-[var(--color-edge-subtle)] flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20 rounded-[4px]" />
        </div>
      )}
      <span className="sr-only">Đang tải thẻ...</span>
    </div>
  );
};

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
  showHeader?: boolean;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 5,
  className = '',
  showHeader = true,
}) => {
  return (
    <div
      role="status"
      aria-label="Đang tải bảng dữ liệu..."
      className={`w-full overflow-hidden rounded-[6px] border border-[var(--color-edge)] bg-[var(--color-surface)] ${className}`}
    >
      {showHeader && (
        <div className="flex items-center gap-4 bg-[var(--color-surface-warm)] border-b border-[var(--color-edge)] px-4 py-3">
          {Array.from({ length: columns }).map((_, idx) => (
            <Skeleton
              key={`th-${idx}`}
              className={`h-4 ${idx === 0 ? 'w-24' : idx === 1 ? 'flex-1' : 'w-20'}`}
            />
          ))}
        </div>
      )}

      <div className="divide-y divide-[var(--color-edge-subtle)]">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={`tr-${rIdx}`} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, cIdx) => (
              <Skeleton
                key={`td-${rIdx}-${cIdx}`}
                className={`h-4 ${cIdx === 0 ? 'w-24' : cIdx === 1 ? 'flex-1' : 'w-20'}`}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Đang tải bảng...</span>
    </div>
  );
};

export interface SkeletonPageProps {
  className?: string;
}

export const SkeletonPage: React.FC<SkeletonPageProps> = ({ className = '' }) => {
  return (
    <div
      role="status"
      aria-label="Đang tải trang..."
      className={`space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto ${className}`}
    >
      {/* Top Header & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--color-edge-subtle)]">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24 rounded-[6px]" />
          <Skeleton className="h-9 w-32 rounded-[6px]" />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonCard hasHeader={true} hasFooter={false} bodyLines={2} />
        <SkeletonCard hasHeader={true} hasFooter={false} bodyLines={2} />
        <SkeletonCard hasHeader={true} hasFooter={false} bodyLines={2} />
      </div>

      {/* Main Content / Table Area */}
      <SkeletonTable rows={6} columns={5} />
      <span className="sr-only">Đang tải toàn bộ trang...</span>
    </div>
  );
};

export default Skeleton;
