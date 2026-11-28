// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { AlertOctagon, Clock3, PauseCircle } from 'lucide-react';
import type { SlaRisk, SlaSnapshot } from '../../lib/sla';
import { formatSlaDuration } from '../../lib/sla';

function dueLabel(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

/**
 * Thời hạn SLA còn lại, viết bằng chữ để đọc được cả khi không phân biệt màu.
 * Màu chỉ dùng cho hai trạng thái cần chú ý: đã quá hạn và sắp quá hạn.
 */
export function SlaRemaining({ snapshot, risk, size = 'sm' }: { snapshot: SlaSnapshot; risk: SlaRisk; size?: 'sm' | 'md' }) {
  const main = size === 'md' ? 'text-sm' : 'text-[0.8125rem]';
  const due = snapshot.hasSla ? `Hạn ${dueLabel(snapshot.effectiveDue)}` : null;
  switch (risk) {
    case 'breached':
      return (
        <div className="min-w-0 tabular-nums">
          <p className={`inline-flex items-center gap-1 font-semibold text-status-danger ${main}`}>
            <AlertOctagon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {snapshot.isFinished || snapshot.remainingMs >= 0 ? 'Đã vi phạm SLA' : `Quá hạn ${formatSlaDuration(snapshot.remainingMs)}`}
          </p>
          {due && <p className="text-xs text-content-muted">{due}</p>}
        </div>
      );
    case 'at_risk':
      return (
        <div className="min-w-0 tabular-nums">
          <p className={`inline-flex items-center gap-1 font-semibold text-status-warning ${main}`}>
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Sắp quá SLA · còn {formatSlaDuration(snapshot.remainingMs)}
          </p>
          <p className="text-xs text-content-muted">{due}</p>
        </div>
      );
    case 'running':
      return (
        <div className="min-w-0 tabular-nums">
          <p className={`font-medium text-content ${main}`}>Còn {formatSlaDuration(snapshot.remainingMs)}</p>
          <p className="text-xs text-content-muted">{due}</p>
        </div>
      );
    case 'paused':
      return (
        <div className="min-w-0 tabular-nums">
          <p className={`inline-flex items-center gap-1 font-medium text-content ${main}`}>
            <PauseCircle className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />
            Tạm dừng
          </p>
          <p className="text-xs text-content-muted">Chờ người yêu cầu phản hồi</p>
        </div>
      );
    case 'finished':
      return <p className={`text-content-muted ${main}`}>Đã kết thúc</p>;
    default:
      return <p className={`text-content-muted ${main}`}>Chưa có hạn SLA</p>;
  }
}
