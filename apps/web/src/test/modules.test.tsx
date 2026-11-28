// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as auth from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { AppRoutes } from '../App';
import { Sidebar } from '../components/layout/Sidebar';
import { canAccess } from '../modules/access';
import { loadModulesConfig, MODULES_CONFIG_TIMEOUT_MS, parseModulesConfig } from '../modules/config';
import { ModuleProvider } from '../modules/ModuleContext';
import { breadcrumbsFor, enabledModules, MODULES, navEntries } from '../modules/registry';
import type { ModuleId } from '../modules/types';
import type { UserRole } from '../types/api';

const anonymous = { isAuthenticated: false, roles: [] as UserRole[] };
const as = (...roles: UserRole[]) => ({ isAuthenticated: true, roles });
const labels = (viewer: { isAuthenticated: boolean; roles: UserRole[] }, enabled: Set<ModuleId> | null = null) =>
  navEntries(enabledModules(enabled), viewer).map((entry) => entry.label);

function signIn(isAuthenticated: boolean, roles: UserRole[]) {
  vi.spyOn(auth, 'useAuth').mockReturnValue({
    isAuthenticated, isLoading: false, isKeycloakOffline: false, roles, username: isAuthenticated ? 'user' : null,
    profile: isAuthenticated ? { id: 'u-1', username: 'user', roles } : null,
    token: null, login: vi.fn(), logout: vi.fn(), refreshToken: vi.fn(), hasRole: (r: UserRole) => roles.includes(r),
  } as unknown as ReturnType<typeof auth.useAuth>);
}

function sidebar(enabled: Set<ModuleId> | null) {
  const view = render(
    <MemoryRouter>
      <ModuleProvider enabled={enabled}>
        <Sidebar isOpen={false} onClose={() => {}} />
      </ModuleProvider>
    </MemoryRouter>,
  );
  return { nav: within(screen.getByRole('navigation', { name: 'Điều hướng chính' })), unmount: view.unmount };
}

describe('W6-11: quyền theo vai trò', () => {
  it('vai trò cao hơn bao hàm vai trò thấp hơn', () => {
    expect(canAccess('public', anonymous)).toBe(true);
    expect(canAccess('authenticated', anonymous)).toBe(false);
    expect(canAccess('authenticated', as())).toBe(true);
    expect(canAccess('Agent', as('Employee'))).toBe(false);
    expect(canAccess('Agent', as('Employee', 'Agent'))).toBe(true);
    expect(canAccess('Agent', as('Manager'))).toBe(true);
    expect(canAccess('Manager', as('Agent'))).toBe(false);
  });

  it('menu chỉ hiện mục đúng vai trò, giữ đúng thứ tự cũ', () => {
    expect(labels(anonymous)).toEqual(['Trang chủ', 'Danh mục dữ liệu']);
    expect(labels(as('Employee'))).toEqual([
      'Trang chủ', 'Danh sách phiếu', 'Tạo phiếu hỗ trợ', 'Yêu cầu cấp thiết bị',
      'Xin cấp thiết bị (ứng dụng 2)', 'Danh mục dữ liệu',
    ]);
    expect(labels(as('Agent'))).toContain('Bảng việc kỹ thuật viên');
    expect(labels(as('Agent'))).not.toContain('Phê duyệt phiếu hỗ trợ');
    expect(labels(as('Manager'))).toEqual([
      'Trang chủ', 'Danh sách phiếu', 'Tạo phiếu hỗ trợ', 'Yêu cầu cấp thiết bị',
      'Bảng việc kỹ thuật viên', 'Phê duyệt phiếu hỗ trợ', 'Báo cáo vận hành', 'Xin cấp thiết bị (ứng dụng 2)',
      'Danh mục dữ liệu',
    ]);
  });

  it('Danh mục dữ liệu nằm ở nhóm Tài nguyên, tách khỏi luồng công việc', () => {
    const entries = navEntries(enabledModules(null), as('Employee'));
    expect(entries.find((e) => e.label === 'Danh mục dữ liệu')?.section).toBe('resources');
    expect(entries.filter((e) => e.section === 'resources').map((e) => e.label)).toEqual(['Danh mục dữ liệu']);
  });

  it('trợ lý AI chỉ hiện khi /api/me bật assistant_enabled', () => {
    const profile = (assistant_enabled: boolean) => ({ id: 'u-1', username: 'u', roles: ['Employee' as UserRole], assistant_enabled });
    const viewer = (enabled: boolean) => ({ ...as('Employee'), profile: profile(enabled) });
    expect(navEntries(enabledModules(null), viewer(false)).map((e) => e.label)).not.toContain('Trợ lý AI');
    const labels = navEntries(enabledModules(null), viewer(true)).map((e) => e.label);
    expect(labels.indexOf('Trợ lý AI')).toBe(labels.indexOf('Tạo phiếu hỗ trợ') + 1);
  });

  it('mỗi module có manifest đủ mã, tên, biểu tượng, vai trò và đường dẫn không trùng', () => {
    const paths = MODULES.flatMap((m) => m.pages.map((p) => p.path));
    expect(new Set(paths).size).toBe(paths.length);
    for (const m of MODULES) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.icon).toBeDefined();
      expect(m.access).toBeTruthy();
      expect(m.pages.length).toBeGreaterThan(0);
    }
  });
});

describe('W6-11: bật tắt module bằng /config/modules.json', () => {
  it('đọc danh sách module, bỏ mã lạ, tệp sai dạng thì bật hết', () => {
    expect(parseModulesConfig({ enabled: ['desk', 'khong-co'] })).toEqual(new Set(['desk']));
    expect(parseModulesConfig({ enabled: 'desk' })).toBeNull();
    expect(parseModulesConfig(null)).toBeNull();
  });

  it('cảnh báo khi có mã module lạ (ví dụ gõ sai)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseModulesConfig({ enabled: ['desk', 'device'] })).toEqual(new Set(['desk']));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('device'));
  });

  it('breadcrumb dựng từ trang của module đang bật', () => {
    const all = enabledModules(null);
    const trail = (path: string, mods = all) => breadcrumbsFor(path, mods).map((c) => c.label);
    expect(trail('/tickets/new')).toEqual(['Trang chủ', 'Danh sách phiếu', 'Tạo phiếu hỗ trợ']);
    expect(trail('/tickets/abc-123')).toEqual(['Trang chủ', 'Danh sách phiếu', 'Chi tiết phiếu']);
    expect(trail('/bao-cao')).toEqual(['Trang chủ', 'Báo cáo vận hành']);
    expect(trail('/device-requests', enabledModules(new Set<ModuleId>(['desk'])))).toEqual(['Trang chủ']);
  });

  it('module lõi luôn bật kể cả khi không có trong danh sách', () => {
    expect(enabledModules(new Set()).map((m) => m.id)).toEqual(['core']);
  });

  it('tệp thiếu hoặc lỗi mạng thì bật hết module', async () => {
    const missing = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    const offline = vi.fn().mockRejectedValue(new TypeError('offline'));
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify({ enabled: ['desk'] }), { status: 200 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await loadModulesConfig(missing)).toBeNull();
    expect(await loadModulesConfig(offline)).toBeNull();
    expect(await loadModulesConfig(ok)).toEqual(new Set(['desk']));
    expect(ok).toHaveBeenCalledWith('/config/modules.json', expect.objectContaining({ cache: 'no-store' }));
  });

  it('hết deadline khi request chưa trả header, hủy request và bật hết module', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stalled = vi.fn(() => new Promise<Response>(() => {}));
    try {
      const configuration = loadModulesConfig(stalled);
      const signal = (stalled.mock.calls[0] as unknown as [string, RequestInit])[1].signal;
      await vi.advanceTimersByTimeAsync(MODULES_CONFIG_TIMEOUT_MS);
      expect(await configuration).toBeNull();
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deadline bao trùm việc đọc JSON body dù header đã trả thành công', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = new Response('{}', { status: 200 });
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}));
    const stalledBody = vi.fn().mockResolvedValue(response);
    try {
      const configuration = loadModulesConfig(stalledBody);
      await vi.advanceTimersByTimeAsync(MODULES_CONFIG_TIMEOUT_MS);
      expect(await configuration).toBeNull();
      expect(stalledBody.mock.calls[0][1].signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dọn timer khi cấu hình đọc được trước deadline', async () => {
    vi.useFakeTimers();
    const valid = vi.fn().mockResolvedValue(new Response(JSON.stringify({ enabled: ['desk'] })));
    try {
      expect(await loadModulesConfig(valid)).toEqual(new Set(['desk']));
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(MODULES_CONFIG_TIMEOUT_MS);
      expect(valid.mock.calls[0][1].signal.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('HTTP 500 và JSON lỗi dùng fallback, không giữ timer', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(await loadModulesConfig(vi.fn().mockResolvedValue(new Response('', { status: 500 })))).toBeNull();
      expect(await loadModulesConfig(vi.fn().mockResolvedValue(new Response('{')))).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('W6-11: Sidebar và route dựng từ sổ đăng ký', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('tắt module devices thì menu mất mục thiết bị và liên kết ứng dụng 2', () => {
    signIn(true, ['Employee']);
    const { nav } = sidebar(new Set<ModuleId>(['desk', 'data']));
    expect(nav.getByRole('link', { name: 'Danh sách phiếu' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Yêu cầu cấp thiết bị' })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Xin cấp thiết bị (ứng dụng 2)' })).not.toBeInTheDocument();
  });

  it('Employee không thấy mục của Agent, Manager thấy đủ', () => {
    signIn(true, ['Employee']);
    const employee = sidebar(null);
    expect(employee.nav.queryByRole('link', { name: 'Bảng việc kỹ thuật viên' })).not.toBeInTheDocument();
    expect(employee.nav.getByRole('link', { name: 'Xin cấp thiết bị (ứng dụng 2)' })).toHaveAttribute('href', '/thiet-bi/');
    employee.unmount();
    signIn(true, ['Manager']);
    const manager = sidebar(null);
    expect(manager.nav.getByRole('link', { name: 'Báo cáo vận hành' })).toHaveAttribute('href', '/bao-cao');
  });

  function routeTo(path: string, enabled: Set<ModuleId> | null) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <ModuleProvider enabled={enabled}>
            <AppRoutes />
          </ModuleProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
  }

  it('route của module đã tắt trả trang 404', async () => {
    signIn(true, ['Employee']);
    routeTo('/device-requests', new Set<ModuleId>(['desk', 'data']));
    expect(await screen.findByRole('heading', { name: '404' })).toBeInTheDocument();
  });

  it('route đủ vai trò mới mở; thiếu vai trò thì báo không có quyền', async () => {
    signIn(true, ['Employee']);
    routeTo('/bao-cao', null);
    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument();
    expect(screen.getByText(/dành cho Quản lý/)).toBeInTheDocument();
  });

  it('chưa đăng nhập thì route cần đăng nhập yêu cầu đăng nhập', async () => {
    signIn(false, []);
    routeTo('/tickets', null);
    expect(await screen.findByRole('heading', { name: 'Yêu cầu đăng nhập xác thực' })).toBeInTheDocument();
  });
});
