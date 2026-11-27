// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  RotateCw,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';

export interface AiTriageDiffProps {
  currentCategory?: string;
  currentPriority?: string;
  currentTeam?: string;
  proposedCategory?: string;
  proposedPriority?: string;
  proposedTeam?: string;
  /** Chỉ truyền khi mô hình thực sự trả về độ tin cậy; bỏ trống thì không hiển thị. */
  confidenceScore?: number;
  rationale?: string;
  summary?: string;
  onAccept: () => void | Promise<void>;
  onCustomize?: () => void;
  onReject: () => void | Promise<void>;
  isBusy?: boolean;
  className?: string;
  acceptLabel?: string;
  customizeLabel?: string;
  rejectLabel?: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Thấp (Low)',
  normal: 'Bình thường (Normal)',
  high: 'Cao (High)',
  critical: 'Khẩn cấp (Critical)',
};

function formatPriority(val?: string): string {
  if (!val) return 'Chưa phân loại';
  return PRIORITY_LABELS[val.toLowerCase()] || val;
}

export const AiTriageDiff: React.FC<AiTriageDiffProps> = ({
  currentCategory = 'Chưa phân loại',
  currentPriority = 'normal',
  currentTeam = 'Chưa gán nhóm',
  proposedCategory,
  proposedPriority,
  proposedTeam,
  confidenceScore,
  rationale,
  summary,
  onAccept,
  onCustomize,
  onReject,
  isBusy = false,
  className = '',
  acceptLabel = 'Chấp nhận toàn bộ & Chuyển giao',
  customizeLabel = 'Tùy chỉnh chi tiết',
  rejectLabel = 'Bỏ qua đề xuất',
}) => {
  const diffItems = [
    {
      key: 'category',
      label: 'Danh mục sự cố',
      current: currentCategory,
      proposed: proposedCategory || currentCategory,
      isChanged: !!proposedCategory && proposedCategory !== currentCategory,
      hint: proposedCategory ? 'Khớp nội dung mô tả' : undefined,
    },
    {
      key: 'priority',
      label: 'Độ ưu tiên',
      current: formatPriority(currentPriority),
      proposed: formatPriority(proposedPriority || currentPriority),
      isChanged:
        !!proposedPriority &&
        proposedPriority.toLowerCase() !== currentPriority.toLowerCase(),
      hint: proposedPriority === 'critical' || proposedPriority === 'high' ? 'Phát hiện sự cố trọng yếu' : undefined,
    },
    {
      key: 'team',
      label: 'Đội ngũ xử lý',
      current: currentTeam,
      proposed: proposedTeam || currentTeam,
      isChanged: !!proposedTeam && proposedTeam !== currentTeam,
      hint: proposedTeam ? 'Định tuyến tự động' : undefined,
    },
  ];

  return (
    <section
      aria-label="So sánh đề xuất phân loại AI"
      className={`rounded-lg border border-edge bg-surface p-4 shadow-2xs sm:p-5 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge-subtle pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-tint text-[var(--color-primary-text)]">
            <Bot className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-content flex items-center gap-1.5">
              <span>ĐỀ XUẤT PHÂN LOẠI & GÁN NHÓM TỰ ĐỘNG TỪ AI TRỢ LÝ</span>
              <Sparkles className="h-3.5 w-3.5 text-status-warning-solid" />
            </h3>
            <p className="text-[11px] text-content-muted">
              Đề xuất do AI tạo, cần người xử lý xác nhận trước khi áp dụng
            </p>
          </div>
        </div>
        {confidenceScore !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary-border bg-primary-tint px-2.5 py-0.5 tabular-nums text-xs font-bold text-[var(--color-primary-text)]">
            Độ tin cậy: {confidenceScore}%
          </span>
        )}
      </div>

      {/* Visual Diff Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-edge-subtle text-[11px] font-semibold uppercase tracking-wider text-content-muted">
              <th className="py-2 pr-3 w-1/4">Thuộc tính</th>
              <th className="py-2 px-3 w-1/3">Giá trị hiện tại</th>
              <th className="py-2 pl-3 w-5/12">Đề xuất mới từ AI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge-subtle">
            {diffItems.map((item) => (
              <tr key={item.key} className="hover:bg-surface-muted/30 transition-colors">
                <td className="py-2.5 pr-3 font-semibold text-content">
                  {item.label}
                </td>
                <td className="py-2.5 px-3 text-content-muted">
                  <span className="rounded-xs border border-edge bg-surface-muted px-2 py-1 tabular-nums text-[11px]">
                    {item.current}
                  </span>
                </td>
                <td className="py-2.5 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-content-subtle shrink-0" />
                    <span
                      className={`rounded-xs px-2 py-1 tabular-nums text-[11px] font-semibold transition-colors ${
                        item.isChanged
                          ? 'border border-primary-border bg-primary-tint text-[var(--color-primary-ink)]'
                          : 'border border-edge bg-surface text-content'
                      }`}
                    >
                      {item.proposed}
                    </span>
                    {item.hint && (
                      <span className="text-[10px] text-content-subtle">
                        ({item.hint})
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary / Rationale Box */}
      {(rationale || summary) && (
        <div className="mt-4 rounded-md border border-edge bg-surface-muted/40 p-3 sm:p-3.5 text-xs text-content leading-relaxed">
          <div className="font-semibold text-content mb-1 flex items-center gap-1.5">
            <span className="tabular-nums text-[11px] text-content-muted uppercase tracking-wider">
              GIẢI TRÌNH TỪ MÔ HÌNH:
            </span>
          </div>
          {summary && (
            <p className="font-medium text-content mb-1">
              <strong>Tóm tắt:</strong> {summary}
            </p>
          )}
          {rationale && (
            <p className="text-content-muted italic">
              &ldquo;{rationale}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Action Affordances */}
      <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-edge-subtle">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void onAccept()}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 transition-colors"
        >
          {isBusy ? (
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
          )}
          <span>{acceptLabel}</span>
        </button>

        {onCustomize && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onCustomize}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-edge bg-surface px-3.5 py-1.5 text-xs font-semibold text-content shadow-2xs hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 transition-colors"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{customizeLabel}</span>
          </button>
        )}

        <button
          type="button"
          disabled={isBusy}
          onClick={() => void onReject()}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-edge-subtle bg-surface px-3 py-1.5 text-xs font-medium text-content-subtle hover:text-content hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          <span>{rejectLabel}</span>
        </button>
      </div>
    </section>
  );
};
