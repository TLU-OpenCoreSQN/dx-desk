// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { matchPath } from 'react-router-dom';
import { canAccess, strictestAccess, type Viewer } from './access';
import { coreModule } from './core/manifest';
import { dataModule } from './data/manifest';
import { deskModule } from './desk/manifest';
import { devicesModule } from './devices/manifest';
import type { ModuleId, ModuleManifest, ModuleNavItem, ModulePage } from './types';

/** Sổ đăng ký module. Thêm module mới: tạo thư mục có manifest.ts rồi thêm vào đây. */
export const MODULES: readonly ModuleManifest[] = [coreModule, deskModule, devicesModule, dataModule];

export const MODULE_IDS: readonly ModuleId[] = MODULES.map((m) => m.id);

/** Module đang bật. Module `required` luôn bật; `enabled = null` nghĩa là bật hết. */
export function enabledModules(
  enabled: ReadonlySet<ModuleId> | null,
  modules: readonly ModuleManifest[] = MODULES,
): ModuleManifest[] {
  return modules.filter((m) => m.required || enabled === null || enabled.has(m.id));
}

export interface ModuleRoute extends ModulePage {
  moduleId: ModuleId;
}

/** Route của các module đang bật; `access` đã gộp với mức của module (lấy mức chặt hơn).
 *  Vai trò được kiểm ở bộ bảo vệ route, không ở đây, để liên kết sâu vẫn mở đúng trang
 *  khi phiên đăng nhập còn đang khôi phục. */
export function moduleRoutes(modules: readonly ModuleManifest[]): ModuleRoute[] {
  return modules.flatMap((m) =>
    m.pages.map((page) => ({ ...page, moduleId: m.id, access: strictestAccess(m.access, page.access) })),
  );
}

export interface Breadcrumb {
  label: string;
  to: string;
}

/** Breadcrumb của một đường dẫn, dựng từ trang của các module đang bật: mỗi đoạn tiền tố
 *  khớp một trang có tên (mục menu hoặc `title`) thành một mắt xích. Trang tĩnh ưu tiên
 *  hơn trang có tham số (`/tickets/new` trước `/tickets/:id`). */
export function breadcrumbsFor(pathname: string, modules: readonly ModuleManifest[]): Breadcrumb[] {
  const pages = modules
    .flatMap((m) => m.pages)
    .filter((page) => page.path !== '' && (page.nav || page.title))
    .sort((a, b) => Number(a.path.includes(':')) - Number(b.path.includes(':')));
  const crumbs: Breadcrumb[] = [{ label: 'Trang chủ', to: '/' }];
  const segments = pathname.split('/').filter(Boolean);
  for (let i = 1; i <= segments.length; i += 1) {
    const prefix = '/' + segments.slice(0, i).join('/');
    const page = pages.find((p) => matchPath({ path: '/' + p.path, end: true }, prefix));
    if (page) crumbs.push({ label: page.title ?? page.nav!.label, to: prefix });
  }
  return crumbs;
}

export interface NavEntry extends ModuleNavItem {
  moduleId: ModuleId;
  to: string;
  external: boolean;
}

/** Mục Sidebar của các module đang bật mà người xem đủ quyền, theo `order`. */
export function navEntries(modules: readonly ModuleManifest[], viewer: Viewer): NavEntry[] {
  const entries: NavEntry[] = [];
  for (const m of modules) {
    if (!canAccess(m.access, viewer)) continue;
    for (const page of m.pages) {
      if (page.nav && canAccess(page.access, viewer)) {
        entries.push({ ...page.nav, moduleId: m.id, to: page.nav.to ?? `/${page.path}`, external: false });
      }
    }
    for (const link of m.links ?? []) {
      if (canAccess(link.access, viewer)) {
        entries.push({ ...link.nav, moduleId: m.id, to: link.href, external: true });
      }
    }
  }
  return entries.sort((a, b) => a.order - b.order);
}
