// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import type { UserRole } from '../types/api';
import type { ModuleAccess } from './types';

/** Hạng của từng mức truy cập; vai trò cao hơn bao hàm vai trò thấp hơn. */
const RANK: Record<ModuleAccess, number> = { public: 0, authenticated: 1, Employee: 2, Agent: 3, Manager: 4 };

export interface Viewer {
  isAuthenticated: boolean;
  roles: readonly UserRole[];
}

/** Người xem có đạt mức truy cập tối thiểu không. Vai trò cao hơn bao hàm vai trò thấp hơn. */
export function canAccess(access: ModuleAccess, viewer: Viewer): boolean {
  if (access === 'public') return true;
  if (!viewer.isAuthenticated) return false;
  if (access === 'authenticated') return true;
  return viewer.roles.some((role) => (RANK[role] ?? 0) >= RANK[access]);
}

/** Mức chặt hơn trong hai mức, dùng để gộp quyền của module với quyền của trang. */
export function strictestAccess(a: ModuleAccess, b: ModuleAccess): ModuleAccess {
  return RANK[a] >= RANK[b] ? a : b;
}
