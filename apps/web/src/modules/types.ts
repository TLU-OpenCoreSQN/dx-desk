// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import type { ComponentType, LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { UserProfile, UserRole } from '../types/api';

/**
 * Mức truy cập tối thiểu của một module hoặc một mục trong module.
 * - `public`: ai cũng xem được, kể cả chưa đăng nhập.
 * - `authenticated`: chỉ cần đăng nhập, vai trò nào cũng được.
 * - Một vai trò Keycloak: cần vai trò đó hoặc vai trò cao hơn (Employee < Agent < Manager).
 */
export type ModuleAccess = 'public' | 'authenticated' | UserRole;

export type ModuleId = 'core' | 'desk' | 'devices' | 'data';

export interface ModuleNavItem {
  label: string;
  icon: LucideIcon;
  /** Thứ tự trên Sidebar, số nhỏ đứng trước. */
  order: number;
  /** Đường dẫn trên menu nếu khác `path` của trang. */
  to?: string;
  /** Nhóm trên Sidebar: `main` (mặc định) là luồng công việc; `resources` là trang tham
   *  khảo, hiện tách riêng ở cuối thanh bên. */
  section?: 'main' | 'resources';
}

/** Một trang của SPA, gắn vào router. */
export interface ModulePage {
  /** Đường dẫn tương đối với `/`, ví dụ `tickets/:id`; `''` là trang chủ. */
  path: string;
  component: LazyExoticComponent<ComponentType>;
  access: ModuleAccess;
  /** Tên trang trên breadcrumb khi trang không có mục menu (mặc định lấy `nav.label`). */
  title?: string;
  /** Điều kiện bật thêm theo hồ sơ người dùng (ví dụ cờ `assistant_enabled` từ /api/me).
   *  Không đạt thì trang ẩn khỏi menu và route trả 404. */
  when?: (profile: UserProfile | null) => boolean;
  /** Có thì hiện trên Sidebar; trang chi tiết thường không có. */
  nav?: ModuleNavItem;
}

/** Liên kết ra ngoài SPA (tải trang thật), ví dụ ứng dụng 2 dưới `/thiet-bi/`. */
export interface ModuleExternalLink {
  href: string;
  access: ModuleAccess;
  nav: ModuleNavItem;
}

export interface ModuleManifest {
  id: ModuleId;
  name: string;
  icon: LucideIcon;
  /** Vai trò tối thiểu để thấy bất kỳ mục nào của module. */
  access: ModuleAccess;
  /** Module lõi không tắt được bằng cấu hình. */
  required?: boolean;
  pages: ModulePage[];
  links?: ModuleExternalLink[];
}
