// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Ứng dụng 2 dùng chung realm và phiên Keycloak với DX-Desk: người đã đăng nhập DX-Desk được
// chuyển qua Keycloak rồi quay lại ngay, không phải nhập lại mật khẩu. Token chỉ ở trong bộ nhớ.
import Keycloak from 'keycloak-js';
import type { CurrentUser } from './workflow';

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'dxdesk',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'dxdesk-device',
});

let initPromise: Promise<boolean> | null = null;
/** Khởi tạo một lần (an toàn với StrictMode); chưa có phiên thì chuyển sang trang đăng nhập Keycloak. */
export function initKeycloak(): Promise<boolean> {
  initPromise ??= keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false, enableLogging: false });
  return initPromise;
}

export function currentUser(): CurrentUser | null {
  const claims = keycloak.tokenParsed as { sub?: string; preferred_username?: string; name?: string;
    department?: unknown; realm_access?: { roles?: string[] } } | undefined;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    name: claims.name || claims.preferred_username || claims.sub,
    department: typeof claims.department === 'string' && claims.department ? claims.department : null,
    roles: (claims.realm_access?.roles ?? []).filter(role => ['Employee', 'Agent', 'Manager'].includes(role)),
  };
}

/** Trả token còn hạn ít nhất 30 giây; hết phiên thì đưa người dùng về trang đăng nhập. */
export async function accessToken(): Promise<string> {
  try {
    await keycloak.updateToken(30);
  } catch {
    await keycloak.login();
  }
  if (!keycloak.token) throw new Error('unauthenticated');
  return keycloak.token;
}

export function logout(): Promise<void> {
  return keycloak.logout({ redirectUri: window.location.origin + '/' });
}
