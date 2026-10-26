// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import { Menu, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { RoleBadge } from '../common/Badge';
import { getHealth } from '../../services/api';
import { HealthResponse } from '../../types/api';

interface HeaderProps {
  onToggleMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav }) => {
  const { isAuthenticated, username, roles, login, logout, isKeycloakOffline, isLoading } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        const res = await getHealth();
        if (isMounted) {
          setHealth(res);
          setHealthError(false);
        }
      } catch {
        if (isMounted) {
          setHealthError(true);
        }
      }
    }
    void checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="bg-navy-900 text-white border-b border-navy-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left side: Brand and Mobile toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label="Mở menu điều hướng"
            className="md:hidden text-slate-300 hover:text-white p-2 rounded-lg hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white shadow-sm">
              DX
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                DX-Desk
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Hệ thống hỗ trợ IT nội bộ</p>
            </div>
          </div>
        </div>

        {/* Center / Status: Real Backend Health status */}
        <div className="hidden lg:flex items-center gap-3 text-xs bg-navy-950/60 px-3 py-1.5 rounded-full border border-navy-800">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                !health && !healthError ? 'bg-slate-400' : health && !healthError
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
              }`}
            />
            <span className="text-slate-300">
              Dịch vụ:{' '}
              {!health && !healthError ? <span>Đang kiểm tra…</span> : health && !healthError ? (
                <span className="text-emerald-400 font-medium">Hoạt động ({health.version})</span>
              ) : (
                <span className="text-rose-400 font-medium">Mất kết nối</span>
              )}
            </span>
          </div>
        </div>

        {/* Right side: Auth Controls */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal-400" />
                  {username || 'Người dùng'}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {roles.length > 0 ? (
                    roles.map((role) => <RoleBadge key={role} role={role} />)
                  ) : (
                    <span className="text-[11px] text-slate-400">Nhân viên</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-navy-800 text-slate-200 hover:bg-navy-700 hover:text-white border border-navy-700 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void login()}
              disabled={isKeycloakOffline || isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-900 focus:ring-teal-500 ${
                isKeycloakOffline || isLoading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-500 text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'Đang kiểm tra…' : 'Đăng nhập'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
