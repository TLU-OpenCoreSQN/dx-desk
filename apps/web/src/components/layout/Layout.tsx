// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const Layout: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isKeycloakOffline } = useAuth();

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-[#211f1b] flex flex-col font-sans selection:bg-[var(--color-primary-tint)] selection:text-[var(--color-primary-text)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-[6px] focus:bg-[var(--color-primary)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Bỏ qua điều hướng, tới nội dung chính
      </a>
      <Header
        onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        isMobileNavOpen={mobileNavOpen}
      />

      {isKeycloakOffline && (
        <div
          role="alert"
          className="bg-[#fbf3db] border-b border-[#f5ddb2] text-[#7c5108] px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-2 flex-wrap shadow-2xs"
        >
          <AlertTriangle className="w-4 h-4 text-[#cb912f] shrink-0" aria-hidden="true" />
          <span>Dịch vụ đăng nhập hiện không thể kết nối.</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 font-semibold underline hover:text-[#211f1b] transition-colors ml-1 focus:outline-none focus:ring-2 focus:ring-[#cb912f] rounded-[4px] px-1"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-3 h-3" />
            <span>Thử kết nối lại</span>
          </button>
        </div>
      )}

      <div className="flex-1 flex w-full">
        <Sidebar isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        <main
          className="dx-main flex-1 min-w-0 p-4 sm:p-6 lg:p-8 focus:outline-none"
          id="main-content"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
