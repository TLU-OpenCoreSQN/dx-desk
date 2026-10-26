// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

export const Layout: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isKeycloakOffline } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} />

      {isKeycloakOffline && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-medium text-center shadow-inner">
          Dịch vụ đăng nhập hiện không thể kết nối.
          <button type="button" className="ml-3 underline font-semibold" onClick={() => window.location.reload()}>
            Thử kết nối lại
          </button>
        </div>
      )}

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
