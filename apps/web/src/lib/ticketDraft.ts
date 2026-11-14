// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { TicketPriority } from '../types/api';

/** Tiền tố khoá localStorage; khoá thực tế luôn gắn với id người dùng. */
export const DRAFT_STORAGE_PREFIX = 'dxdesk_create_ticket_draft';

const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'critical'];

export interface CreateTicketDraft {
  categoryId: string;
  title: string;
  description: string;
  priority: TicketPriority;
  fieldValues: Record<string, string>;
  savedAt: string;
}

export const draftStorageKey = (userId: string): string => `${DRAFT_STORAGE_PREFIX}:${userId}`;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Đọc bản nháp của đúng người dùng. Dữ liệu trong localStorage không đáng tin
 * (schema cũ, bị sửa tay) nên mọi trường đều được kiểm tra kiểu trước khi dùng.
 */
export function readDraft(userId: string | undefined): CreateTicketDraft | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const saved = parsed as Record<string, unknown>;

    const fieldValues: Record<string, string> = {};
    if (saved.fieldValues && typeof saved.fieldValues === 'object' && !Array.isArray(saved.fieldValues)) {
      for (const [key, value] of Object.entries(saved.fieldValues)) {
        if (typeof value === 'string') fieldValues[key] = value;
      }
    }

    return {
      categoryId: asString(saved.categoryId),
      title: asString(saved.title),
      description: asString(saved.description),
      priority: PRIORITIES.includes(saved.priority as TicketPriority)
        ? (saved.priority as TicketPriority)
        : 'normal',
      fieldValues,
      savedAt: asString(saved.savedAt),
    };
  } catch {
    return null;
  }
}

export function writeDraft(userId: string | undefined, draft: CreateTicketDraft): void {
  if (!userId) return;
  try {
    localStorage.setItem(draftStorageKey(userId), JSON.stringify(draft));
  } catch {
    // Hết quota hoặc storage bị chặn: bỏ qua, form vẫn dùng được.
  }
}

export function removeDraft(userId: string | undefined): void {
  if (!userId) return;
  try {
    localStorage.removeItem(draftStorageKey(userId));
  } catch {
    // Bỏ qua khi storage không khả dụng.
  }
}

/** Xoá bản nháp của mọi người dùng trên trình duyệt này (gọi khi đăng xuất). */
export function clearAllDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Bỏ qua khi storage không khả dụng.
  }
}
