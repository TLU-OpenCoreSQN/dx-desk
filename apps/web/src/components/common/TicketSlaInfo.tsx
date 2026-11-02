// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { Ticket } from '../../types/api';

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

export function TicketSlaInfo({ ticket }: { ticket: Ticket }) {
  const pausedMinutes = Math.floor(Number(ticket.sla_paused_ms || 0) / 60000);
  return (
    <div className="space-y-1 text-xs text-content-muted">
      <p>Hạn gốc SLA: <span className="font-semibold text-content">{ticket.sla_due_at ? dateLabel(ticket.sla_due_at) : 'Chưa có hạn SLA'}</span></p>
      {ticket.waiting_since && <p>SLA đang tạm dừng từ {dateLabel(ticket.waiting_since)}.</p>}
      {pausedMinutes > 0 && <p>Thời gian đã tạm dừng: {pausedMinutes.toLocaleString('vi-VN')} phút.</p>}
      {ticket.sla_breached && <p className="font-semibold text-danger">Đã vi phạm SLA{ticket.sla_breached_at ? ` từ ${dateLabel(ticket.sla_breached_at)}` : ''}.</p>}
    </div>
  );
}
