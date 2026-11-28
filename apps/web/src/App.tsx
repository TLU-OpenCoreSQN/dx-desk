// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/layout/Layout';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { AccessNotice, SignInNotice } from './components/common/AccessNotice';
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
    return <SignInNotice onLogin={() => void login()} disabled={isKeycloakOffline} />;
  }

  if (!canAccess(access, { isAuthenticated, roles })) {
    return (
      <AccessNotice
        message={`Trang này dành cho ${access === 'Manager' ? 'Quản lý' : access === 'Agent' ? 'kỹ thuật viên và Quản lý' : 'người dùng đã được cấp vai trò trong DX-Desk'}.`}
      />
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
        <ToastProvider>
          <ModuleProvider>
            <RouteErrorBoundary>
              <AppRoutes />
            </RouteErrorBoundary>
          </ModuleProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
