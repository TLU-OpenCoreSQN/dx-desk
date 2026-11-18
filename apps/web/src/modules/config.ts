// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { MODULE_IDS } from './registry';
import type { ModuleId } from './types';

/** Tệp cấu hình đọc lúc chạy; nginx phục vụ, compose mount từ config/doanh-nghiep/modules.json. */
export const MODULES_CONFIG_URL = '/config/modules.json';
export const MODULES_CONFIG_TIMEOUT_MS = 5000;

/**
 * Đọc danh sách module bật từ nội dung `{"enabled": ["desk", "devices", ...]}`.
 * Trả `null` (bật tất cả) khi tệp thiếu hoặc sai dạng, để lỗi cấu hình không làm mất menu.
 * Mã module không có trong sổ đăng ký bị bỏ qua.
 */
export function parseModulesConfig(raw: unknown): Set<ModuleId> | null {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { enabled?: unknown }).enabled)) {
    return null;
  }
  const known = new Set<string>(MODULE_IDS);
  const listed = (raw as { enabled: unknown[] }).enabled;
  const ids = listed.filter((id): id is ModuleId => typeof id === 'string' && known.has(id));
  const unknown = listed.filter((id) => !(typeof id === 'string' && known.has(id)));
  if (unknown.length > 0) {
    console.warn(`${MODULES_CONFIG_URL}: bỏ qua mã module không có trong sổ đăng ký: ${unknown.map(String).join(', ')}. Mã hợp lệ: ${MODULE_IDS.join(', ')}.`);
  }
  return new Set(ids);
}

let preloaded: Promise<Set<ModuleId> | null> | null = null;

/** Bắt đầu đọc cấu hình module một lần cho cả phiên trang; gọi sớm ở main.tsx để
 *  chạy song song với việc khởi tạo Keycloak thay vì chờ React mount. */
export function preloadModulesConfig(): Promise<Set<ModuleId> | null> {
  preloaded ??= loadModulesConfig();
  return preloaded;
}

export async function loadModulesConfig(fetcher: typeof fetch = fetch): Promise<Set<ModuleId> | null> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Hết thời gian tải cấu hình module.'));
    }, MODULES_CONFIG_TIMEOUT_MS);
  });
  try {
    const configuration = (async () => {
      const response = await fetcher(MODULES_CONFIG_URL, {
        cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
      });
      if (!response.ok) {
        console.warn(`Không đọc được ${MODULES_CONFIG_URL} (HTTP ${response.status}); bật tất cả module.`);
        return null;
      }
      const parsed = parseModulesConfig(await response.json());
      if (parsed === null) console.warn(`${MODULES_CONFIG_URL} sai dạng; bật tất cả module.`);
      return parsed;
    })();
    return await Promise.race([configuration, deadline]);
  } catch (err) {
    console.warn(`Không đọc được ${MODULES_CONFIG_URL}; bật tất cả module.`, err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
