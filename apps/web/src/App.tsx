// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { TicketListPage } from './pages/TicketListPage';
import { CreateTicketPage } from './pages/CreateTicketPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { DeviceRequestPage } from './pages/DeviceRequestPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { LogIn, ShieldAlert } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, login, isKeycloakOffline } = useAuth();

  if (isLoading) {
    return <LoadingSpinner label="Đang kiểm tra trạng thái đăng nhập..." />;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-[8px] border border-[#e4e3e0] shadow-[0_4px_16px_rgba(0,0,0,0.04)] text-center transition-all">
        <div className="w-12 h-12 rounded-[8px] bg-gradient-to-br from-[#fbf3db] to-[#f5ddb2]/40 text-[#7c5108] flex items-center justify-center mx-auto mb-4 border border-[#f5ddb2] shadow-2xs">
          <ShieldAlert className="w-6 h-6 text-[#cb912f]" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-[#211f1b] mb-2 tracking-tight">
          Yêu cầu đăng nhập xác thực
        </h2>
        <p className="text-xs sm:text-sm text-[#5f5e5a] mb-6 leading-relaxed">
          Bạn cần đăng nhập bằng tài khoản của tổ chức để truy cập các tính năng
          quản lý phiếu và yêu cầu cấp thiết bị.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => void login()}
            disabled={isKeycloakOffline}
            className={`w-full py-2.5 px-4 rounded-[6px] text-xs font-semibold shadow-xs flex items-center justify-center gap-2 min-h-[44px] transition-all active:scale-[0.98] ${
              isKeycloakOffline
                ? 'bg-[#f7f6f3] text-[#8a8884] border border-[#e4e3e0] cursor-not-allowed'
                : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] shadow-[0_1px_3px_rgba(10,120,190,0.25)]'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập ngay</span>
          </button>
          <Link
            to="/"
            className="w-full py-2.5 px-4 rounded-[6px] text-xs font-medium text-[#5f5e5a] hover:bg-[#f1f1ef] hover:text-[#211f1b] border border-[#e4e3e0] transition-colors min-h-[44px] flex items-center justify-center"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route
                path="tickets"
                element={
                  <ProtectedRoute>
                    <TicketListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="tickets/new"
                element={
                  <ProtectedRoute>
                    <CreateTicketPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="tickets/:id"
                element={
                  <ProtectedRoute>
                    <TicketDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="device-requests"
                element={
                  <ProtectedRoute>
                    <DeviceRequestPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
