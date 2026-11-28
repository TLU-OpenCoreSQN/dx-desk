// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useId } from 'react';
import { ArrowRight, Bot, Check, Sliders, X } from 'lucide-react';
import { Button } from '../common/Button';

export interface AiTriageDiffProps {
  currentCategory?: string;
  currentPriority?: string;
  currentTeam?: string;
  proposedCategory?: string;
  proposedPriority?: string;
  proposedTeam?: string;
  /** Chỉ truyền khi mô hình thực sự trả về độ tin cậy; bỏ trống thì không hiển thị. */
  confidenceScore?: number;
  /** Giải trình do mô hình trả về. Không có thì không tự bịa lý do thay mô hình. */
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
  low: 'Thấp',
  normal: 'Bình thường',
  high: 'Cao',
  critical: 'Khẩn cấp',
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
  acceptLabel = 'Xác nhận đề xuất',
  customizeLabel = 'Sửa đề xuất',
  rejectLabel = 'Bỏ qua đề xuất',
}) => {
  const headingId = useId();
  const diffItems = [
    {
      key: 'category',
      label: 'Danh mục sự cố',
      current: currentCategory,
      proposed: proposedCategory || currentCategory,
      isChanged: !!proposedCategory && proposedCategory !== currentCategory,
    },
    {
      key: 'priority',
      label: 'Mức ưu tiên',
      current: formatPriority(currentPriority),
      proposed: formatPriority(proposedPriority || currentPriority),
      isChanged: !!proposedPriority && proposedPriority.toLowerCase() !== currentPriority.toLowerCase(),
    },
    {
      key: 'team',
      label: 'Nhóm xử lý',
      current: currentTeam,
      proposed: proposedTeam || currentTeam,
      isChanged: !!proposedTeam && proposedTeam !== currentTeam,
    },
  ];

  return (
    <section aria-labelledby={headingId} className={`rounded-lg border border-edge bg-surface p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-edge pb-3">
        <div className="flex items-start gap-2">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary-ink)]" aria-hidden="true" />
          <div>
            <h2 id={headingId} className="dx-section-title">Đề xuất phân loại từ trợ lý AI</h2>
            <p className="mt-0.5 text-[0.8125rem] text-content-muted">
              Đề xuất do AI tạo; cần người xử lý xác nhận trước khi áp dụng.
            </p>
          </div>
        </div>
        {confidenceScore !== undefined && (
          <span data-numeric className="rounded-sm border border-edge bg-surface-muted px-2 py-0.5 text-xs font-medium text-content-muted">
            Độ tin cậy: {confidenceScore}%
          </span>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[0.8125rem]">
          <caption className="sr-only">So sánh giá trị hiện tại của phiếu với đề xuất của AI</caption>
          <thead>
            <tr className="border-b border-edge text-xs font-semibold text-content-muted">
              <th scope="col" className="w-1/4 py-2 pr-3">Thuộc tính</th>
              <th scope="col" className="w-1/3 px-3 py-2">Hiện tại</th>
              <th scope="col" className="py-2 pl-3">Đề xuất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {diffItems.map((item) => (
              <tr key={item.key}>
                <th scope="row" className="py-2.5 pr-3 font-medium text-content">{item.label}</th>
                <td className="px-3 py-2.5 text-content-muted">{item.current}</td>
                <td className="py-2.5 pl-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />
                    <span className={item.isChanged ? 'font-semibold text-content' : 'text-content'}>{item.proposed}</span>
                    {/* Thay đổi được nói bằng chữ, không chỉ bằng màu. */}
                    {item.isChanged ? (
                      <span className="rounded-sm border border-primary-border bg-primary-tint px-1.5 text-xs font-medium text-[var(--color-primary-text)]">
                        Thay đổi
                      </span>
                    ) : (
                      <span className="text-xs text-content-muted">Giữ nguyên</span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(rationale || summary) && (
        <div className="mt-3 space-y-1 rounded-md border border-edge bg-surface-muted p-3 text-[0.8125rem] leading-relaxed text-content">
          {summary && (
            <p>
              <span className="font-semibold">Tóm tắt của AI: </span>
              {summary}
            </p>
          )}
          {rationale && (
            <p className="text-content-muted">
              <span className="font-semibold text-content">Giải trình của mô hình: </span>
              {rationale}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-3">
        <Button disabled={isBusy} isLoading={isBusy} leftIcon={<Check className="h-4 w-4" />} onClick={() => void onAccept()}>
          {acceptLabel}
        </Button>
        {onCustomize && (
          <Button variant="secondary" disabled={isBusy} leftIcon={<Sliders className="h-4 w-4" />} onClick={onCustomize}>
            {customizeLabel}
          </Button>
        )}
        <Button variant="ghost" disabled={isBusy} leftIcon={<X className="h-4 w-4" />} onClick={() => void onReject()}>
          {rejectLabel}
        </Button>
      </div>
    </section>
  );
};
