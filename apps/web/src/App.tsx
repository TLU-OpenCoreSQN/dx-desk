// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/layout/Layout';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { LogIn, ShieldAlert } from 'lucide-react';
import { ModuleProvider, useModules } from './modules/ModuleContext';
import { moduleRoutes } from './modules/registry';
import { canAccess } from './modules/access';
import type { ModuleAccess, ModulePage } from './modules/types';

const NotFoundPage = lazy(() => import('./modules/core/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const AccessGuard: React.FC<{ access: ModuleAccess; when?: ModulePage['when']; children: React.ReactNode }> = ({ access, when, children }) => {
  const { isAuthenticated, isLoading, login, isKeycloakOffline, roles, profile } = useAuth();

  if (access === 'public') return <>{children}</>;

  if (isLoading) {
    return <LoadingSpinner label="Đang kiểm tra trạng thái đăng nhập..." />;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-surface rounded-lg border border-edge shadow-md text-center transition-all">
        <div className="w-12 h-12 rounded-lg bg-status-warning-bg text-status-warning flex items-center justify-center mx-auto mb-4 border border-status-warning-border shadow-2xs">
          <ShieldAlert className="w-6 h-6 text-status-warning" aria-hidden="true" />
        </div>
        <h2 className="dx-section-title mb-2">
          Yêu cầu đăng nhập xác thực
        </h2>
        <p className="text-xs sm:text-sm text-content-muted mb-6 leading-relaxed">
          Bạn cần đăng nhập bằng tài khoản của tổ chức để truy cập các tính năng
          quản lý phiếu và yêu cầu cấp thiết bị.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => void login()}
            disabled={isKeycloakOffline}
            className={`w-full py-2.5 px-4 rounded-md text-xs font-semibold shadow-xs flex items-center justify-center gap-2 min-h-[44px] transition-all active:scale-[0.98] ${
              isKeycloakOffline
                ? 'bg-surface-muted text-content-subtle border border-edge cursor-not-allowed'
                : 'bg-primary hover:bg-primary-hover text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-xs'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập ngay</span>
          </button>
          <Link
            to="/"
            className="w-full py-2.5 px-4 rounded-md text-xs font-medium text-content-muted hover:bg-surface-muted hover:text-content border border-edge transition-colors min-h-[44px] flex items-center justify-center"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  if (!canAccess(access, { isAuthenticated, roles })) {
    return (
      <section className="max-w-md mx-auto my-12 rounded-lg border border-edge bg-surface p-6 text-center" role="alert">
        <h1 className="dx-page-title">Không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-content-muted">Trang này dành cho {access === 'Manager' ? 'Quản lý' : access === 'Agent' ? 'kỹ thuật viên và Quản lý' : 'người dùng đã được cấp vai trò trong DX-Desk'}.</p>
        <Link className="mt-4 inline-block text-[var(--color-primary-ink)] underline" to="/">Về trang chủ</Link>
      </section>
    );
  }

  if (when && !when(profile)) return <NotFoundPage />;

  return <>{children}</>;
};

/** Route dựng từ sổ đăng ký module (W6-11); module tắt trong /config/modules.json không có route. */
export const AppRoutes: React.FC = () => {
  const { ready, modules } = useModules();

  if (!ready) return <LoadingSpinner label="Đang tải cấu hình module..." />;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {moduleRoutes(modules).map((route) => {
          const element = (
            <AccessGuard access={route.access} when={route.when}>
              <route.component />
            </AccessGuard>
          );
          return route.path === ''
            ? <Route key={`${route.moduleId}:index`} index element={element} />
            : <Route key={`${route.moduleId}:${route.path}`} path={route.path} element={element} />;
        })}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <ModuleProvider>
              <RouteErrorBoundary>
                <AppRoutes />
              </RouteErrorBoundary>
            </ModuleProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
