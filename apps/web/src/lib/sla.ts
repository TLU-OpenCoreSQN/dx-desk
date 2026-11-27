// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import type { Ticket } from '../types/api';

/** Trạng thái đã kết thúc: đồng hồ SLA không còn chạy. */
export const SLA_FINISHED_STATUSES = new Set(['resolved', 'closed', 'cancelled']);

export interface SlaSnapshot {
  /** Phiếu có hạn SLA hay không. Khi false, các trường còn lại là giá trị trung tính. */
  hasSla: boolean;
  isFinished: boolean;
  isPaused: boolean;
  /** Đã vi phạm: theo cờ của máy chủ, hoặc (khi còn mở) quá hạn hiệu lực. */
  isBreached: boolean;
  originalDue: number;
  effectiveDue: number;
  /** Âm khi đã quá hạn. */
  remainingMs: number;
  /** Tổng thời gian tạm dừng, gồm cả lần đang chờ người dùng. */
  totalPausedMs: number;
  /** Phần trăm cửa sổ SLA đã dùng (0..100), không tính thời gian tạm dừng. */
  elapsedPercent: number;
}

/**
 * Quy ước khớp migration 003: sla_due_at = created_at + resolution_minutes; sla_paused_ms cộng dồn
 * khi rời waiting_user; khi đang waiting_user, thời gian từ waiting_since chưa được cộng.
 */
export function computeSlaSnapshot(ticket: Ticket, now: number = Date.now()): SlaSnapshot {
  const isFinished = SLA_FINISHED_STATUSES.has(ticket.status);
  const isPaused = ticket.status === 'waiting_user';
  if (!ticket.sla_due_at) {
    return {
      hasSla: false, isFinished, isPaused, isBreached: false, originalDue: 0, effectiveDue: 0,
      remainingMs: 0, totalPausedMs: 0, elapsedPercent: 0,
    };
  }

  const originalDue = new Date(ticket.sla_due_at).getTime();
  const created = new Date(ticket.created_at).getTime();
  const pausedMs = Number(ticket.sla_paused_ms || 0);

  let activePauseMs = 0;
  if (isPaused && ticket.waiting_since) {
    const waitingSince = new Date(ticket.waiting_since).getTime();
    if (!Number.isNaN(waitingSince) && now > waitingSince) activePauseMs = now - waitingSince;
  }

  const totalPausedMs = pausedMs + activePauseMs;
  const effectiveDue = originalDue + totalPausedMs;
  const remainingMs = effectiveDue - now;
  const totalWindow = Math.max(1000, originalDue - created);
  const isBreached = ticket.sla_breached === true || (!isFinished && remainingMs < 0);
  const elapsedPercent = Math.min(
    100,
    Math.max(0, Math.round(((now - created - totalPausedMs) / totalWindow) * 100)),
  );

  return {
    hasSla: true, isFinished, isPaused, isBreached, originalDue, effectiveDue, remainingMs,
    totalPausedMs, elapsedPercent,
  };
}

/** Lớp màu thanh tiến độ SLA cho phiếu đang chạy. */
export function slaGaugeColor(elapsedPercent: number, isBreached: boolean): string {
  if (isBreached) return 'bg-status-danger-solid';
  if (elapsedPercent >= SLA_AT_RISK_PERCENT) return 'bg-status-warning-solid';
  return 'bg-status-success-solid';
}

/** Ngưỡng "sắp quá SLA": cùng ngưỡng 80% mà thanh SLA đã dùng để chuyển màu cảnh báo. */
export const SLA_AT_RISK_PERCENT = 80;

export type SlaRisk = 'breached' | 'at_risk' | 'running' | 'paused' | 'finished' | 'none';

export function slaRisk(snapshot: SlaSnapshot): SlaRisk {
  if (!snapshot.hasSla) return 'none';
  if (snapshot.isBreached) return 'breached';
  if (snapshot.isFinished) return 'finished';
  if (snapshot.isPaused) return 'paused';
  return snapshot.elapsedPercent >= SLA_AT_RISK_PERCENT ? 'at_risk' : 'running';
}

/** Khoảng thời gian ngắn gọn tiếng Việt, ví dụ "2 ngày 4 giờ", "3 giờ 20 phút", "dưới 1 phút". */
export function formatSlaDuration(ms: number): string {
  const minutes = Math.floor(Math.abs(ms) / 60000);
  if (minutes < 1) return 'dưới 1 phút';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  if (hours > 0) return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  return `${mins} phút`;
}
