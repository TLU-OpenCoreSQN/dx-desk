// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
//
// Biểu thức SQL cho lọc/sắp xếp danh sách phiếu theo SLA phía máy chủ, để "việc gấp nổi lên trước"
// đúng trên toàn bộ dữ liệu thay vì chỉ trong 25 dòng của một trang. Quy ước khớp 1:1 với
// apps/web/src/lib/sla.ts (computeSlaSnapshot + slaRisk), vốn khớp migration 003:
//   hạn hiệu lực = sla_due_at + sla_paused_ms + (đang waiting_user: now() - waiting_since)
//   quá hạn      = sla_breached, hoặc còn mở mà hạn hiệu lực < now()
//   sắp quá hạn  = còn chạy (không tạm dừng/kết thúc) và đã dùng >= 80% cửa sổ SLA
// Chỉ ghép hằng chuỗi; giá trị người dùng luôn đi qua tham số $n.

/** Ngưỡng "sắp quá SLA", trùng SLA_AT_RISK_PERCENT của apps/web. */
export const SLA_AT_RISK_RATIO = 0.8;

const FINISHED = "t.status IN ('resolved','closed','cancelled')";
const PAUSED_MS = `(coalesce(t.sla_paused_ms,0)::float8 + CASE WHEN t.status='waiting_user' AND t.waiting_since IS NOT NULL
  THEN greatest(0, extract(epoch FROM (now()-t.waiting_since))*1000) ELSE 0 END)`;
export const SLA_EFFECTIVE_DUE = `(t.sla_due_at + ${PAUSED_MS} * interval '1 millisecond')`;
export const SLA_BREACHED = `(t.sla_due_at IS NOT NULL AND (coalesce(t.sla_breached,false)
  OR (NOT ${FINISHED} AND ${SLA_EFFECTIVE_DUE} < now())))`;
export const SLA_AT_RISK = `(t.sla_due_at IS NOT NULL AND NOT ${SLA_BREACHED} AND NOT ${FINISHED} AND t.status<>'waiting_user'
  AND extract(epoch FROM (now()-t.created_at))*1000 - ${PAUSED_MS}
    >= ${SLA_AT_RISK_RATIO} * greatest(1000, extract(epoch FROM (t.sla_due_at-t.created_at))*1000))`;
/** Thứ tự xử lý, trùng RISK_RANK của TicketQueueView: quá hạn 0, sắp quá hạn 1, đang chạy 2, tạm dừng 3, không SLA 4, đã kết thúc 5. */
export const SLA_RISK_RANK = `(CASE WHEN t.sla_due_at IS NULL THEN 4 WHEN ${SLA_BREACHED} THEN 0 WHEN ${FINISHED} THEN 5
  WHEN t.status='waiting_user' THEN 3 WHEN ${SLA_AT_RISK} THEN 1 ELSE 2 END)`;
const PRIORITY_RANK = "(CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END)";

export const TICKET_ORDER: Record<'newest' | 'sla_due', string> = {
  newest: 't.created_at DESC,t.id DESC',
  sla_due: `${SLA_RISK_RANK},${SLA_EFFECTIVE_DUE} ASC NULLS LAST,${PRIORITY_RANK},t.created_at DESC,t.id DESC`,
};

/** Mẫu ILIKE an toàn: thoát ký tự đại diện của người dùng (dùng kèm ESCAPE '\'). */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, char => `\\${char}`)}%`;
}

/** Điều kiện tìm kiếm tự do; `$p` là vị trí tham số đã chứa likePattern(q). */
export function searchClause(p: number): string {
  return `(t.title ILIKE $${p} ESCAPE '\\' OR t.description ILIKE $${p} ESCAPE '\\' OR t.id::text ILIKE $${p} ESCAPE '\\'
    OR private.assignee_name(t.assigned_to) ILIKE $${p} ESCAPE '\\' OR private.team_name(t.assigned_team_id) ILIKE $${p} ESCAPE '\\'
    OR EXISTS (SELECT 1 FROM public.ticket_events e WHERE e.ticket_id=t.id AND e.event_type='created' AND e.actor_name ILIKE $${p} ESCAPE '\\'))`;
}
