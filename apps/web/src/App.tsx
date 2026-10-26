// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-2">
          Yêu cầu đăng nhập xác thực
        </h2>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Bạn cần đăng nhập bằng tài khoản của tổ chức để truy cập các tính năng
          quản lý phiếu và yêu cầu cấp thiết bị.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void login()}
            disabled={isKeycloakOffline}
            className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold shadow-sm flex items-center justify-center gap-2 ${
              isKeycloakOffline
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập ngay</span>
          </button>
          <Link
            to="/"
            className="w-full py-2 px-4 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
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
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
