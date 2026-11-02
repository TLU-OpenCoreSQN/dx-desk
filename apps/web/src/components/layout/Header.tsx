// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, LogIn, LogOut, User, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { RoleBadge } from '../common/Badge';
import { ThemeSwitcher } from '../common/ThemeSwitcher';
import { getHealth } from '../../services/api';
import { HealthResponse } from '../../types/api';

interface HeaderProps {
  onToggleMobileNav: () => void;
  isMobileNavOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav, isMobileNavOpen = false }) => {
  const { isAuthenticated, username, roles, login, logout, isKeycloakOffline, isLoading } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<boolean>(false);
  const location = useLocation();

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

  // Compute breadcrumbs
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const crumbs = [{ label: 'Trang chủ', to: '/' }];

    if (path.startsWith('/tickets')) {
      crumbs.push({ label: 'Danh sách phiếu', to: '/tickets' });
      if (path === '/tickets/new') {
        crumbs.push({ label: 'Tạo phiếu hỗ trợ', to: '/tickets/new' });
      } else if (path.match(/^\/tickets\/[^/]+$/)) {
        crumbs.push({ label: 'Chi tiết phiếu', to: path });
      }
    } else if (path.startsWith('/device-requests')) {
      crumbs.push({ label: 'Yêu cầu cấp thiết bị', to: '/device-requests' });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="dx-app-header bg-surface/95 backdrop-blur-md text-[var(--color-content)] border-b border-[var(--color-edge-subtle)] sticky top-0 z-30 h-14 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.03)] w-full">
      <div className="w-full px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Brand & Breadcrumb grouped together */}
        <div className="flex flex-1 items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label={isMobileNavOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={isMobileNavOpen}
            aria-controls="app-navigation"
            className="md:hidden text-[var(--color-content-muted)] hover:text-[var(--color-content)] p-2 rounded-[6px] hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            to="/"
            aria-label="DX-Desk — Trang chủ"
            className="group flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-[6px] p-1 -m-1 transition-all shrink-0"
          >
            <div className="w-8 h-8 rounded-[6px] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-active)] flex items-center justify-center font-bold text-white text-sm shadow-xs shrink-0 group-hover:scale-105 transition-transform">
              DX
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-base font-bold tracking-tight text-[var(--color-content)] leading-tight group-hover:text-[var(--color-primary)] transition-colors">
                DX-Desk
              </span>
              <span className="text-[10px] text-[var(--color-content-muted)] hidden lg:block leading-none">
                Hỗ trợ IT nội bộ
              </span>
            </div>
          </Link>

          {/* Vertical divider */}
          <div className="hidden md:block h-5 w-px bg-[var(--color-edge-subtle)] shrink-0" />

          {/* Breadcrumbs immediately on the left, next to the brand! */}
          <nav aria-label="Đường dẫn trang" className="hidden md:flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-content-muted)] overflow-hidden">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.to + idx}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-[var(--color-content-subtle)] shrink-0" />}
                  {isLast ? (
                    <span className="font-semibold text-[var(--color-content)] bg-[var(--color-surface-warm)] px-2 py-0.5 rounded-[4px] border border-[var(--color-edge-subtle)] truncate" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.to}
                      className="hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded-[4px] transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right: Theme Switcher, Service Status & User controls - unified h-9 */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Theme Switcher (from V5) */}
          <ThemeSwitcher />

          {/* Health status badge */}
          <div
            className={`hidden 2xl:flex items-center gap-2 text-xs px-3 h-9 rounded-[6px] border transition-all ${
              !health && !healthError
                ? 'bg-[var(--color-surface-warm)] border-[var(--color-edge-subtle)]'
                : health && !healthError
                ? 'bg-[#edf3ec] border-[#b8dcce] text-[#2c6246]'
                : 'bg-[#fbe4e4] border-[#f6c3c1] text-[#a3332e]'
            }`}
            title="Trạng thái dịch vụ máy chủ DX-Desk"
          >
            <span className="relative flex h-2 w-2">
              {health && !healthError && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#448361] opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  !health && !healthError
                    ? 'bg-[var(--color-content-subtle)]'
                    : health && !healthError
                    ? 'bg-[#448361]'
                    : 'bg-[#d44c47]'
                }`}
              />
            </span>
            <span className="text-[11px] sm:text-xs">
              Dịch vụ:{' '}
              {!health && !healthError ? (
                <span className="text-[var(--color-content-muted)]">Đang kiểm tra…</span>
              ) : health && !healthError ? (
                <span className="font-semibold">Hoạt động ({health.version})</span>
              ) : (
                <span className="font-semibold">Mất kết nối</span>
              )}
            </span>
          </div>

          {/* User authentication info */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex max-w-64 2xl:max-w-md items-center gap-2 h-9 px-3 bg-[var(--color-surface-warm)] border border-[var(--color-edge-subtle)] rounded-[6px] shadow-2xs">
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[var(--color-primary-tint)] to-[var(--color-primary-tint)] border border-[var(--color-primary-border)] text-[var(--color-primary)] font-bold text-[10px] flex items-center justify-center shrink-0">
                  {username ? username.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                </div>
                <span className="min-w-0 truncate text-xs font-semibold text-[var(--color-content)]" title={username || 'Người dùng'}>
                  {username || 'Người dùng'}
                </span>
                <div className="hidden 2xl:flex items-center gap-1 shrink-0">
                  {roles.length > 0 ? (
                    roles.map((role) => <RoleBadge key={role} role={role} />)
                  ) : (
                    <span className="text-[10px] text-[var(--color-content-muted)]">Nhân viên</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[6px] text-xs font-medium bg-surface text-[var(--color-content-muted)] hover:text-[#d44c47] hover:bg-[#fbe4e4]/50 border border-[var(--color-edge-subtle)] hover:border-[#f6c3c1] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all shadow-2xs"
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void login()}
              disabled={isKeycloakOffline || isLoading}
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-[6px] text-xs font-semibold shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] active:scale-[0.98] ${
                isKeycloakOffline || isLoading
                  ? 'bg-[var(--color-surface-warm)] text-[var(--color-content-subtle)] border border-[var(--color-edge-subtle)] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] text-white shadow-[0_1px_3px_rgba(10,120,190,0.3)]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Đang kiểm tra…' : 'Đăng nhập'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
