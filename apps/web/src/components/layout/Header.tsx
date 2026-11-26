// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, LogIn, LogOut, User, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useModules } from '../../modules/ModuleContext';
import { breadcrumbsFor } from '../../modules/registry';
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

  // W6-11: breadcrumb dựng từ sổ đăng ký module, theo module đang bật.
  const { modules } = useModules();
  const breadcrumbs = breadcrumbsFor(location.pathname, modules);

  return (
    <header className="dx-app-header bg-surface/95 backdrop-blur-md text-content border-b border-edge sticky top-0 z-30 h-14 transition-all shadow-xs w-full">
      <div className="w-full px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Brand & Breadcrumb grouped together */}
        <div className="flex flex-1 items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label={isMobileNavOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={isMobileNavOpen}
            aria-controls="app-navigation"
            className="md:hidden text-content-muted hover:text-content p-2 rounded-md hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            to="/"
            aria-label="DX-Desk - Trang chủ"
            className="group flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-primary rounded-md p-1 -m-1 transition-all shrink-0"
          >
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center font-bold text-white text-sm shadow-xs shrink-0 group-hover:bg-primary-hover transition-colors">
              DX
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-base font-bold tracking-tight text-content leading-tight group-hover:text-[var(--color-primary-ink)] transition-colors">
                DX-Desk
              </span>
              <span className="text-xs text-content-muted hidden lg:block leading-none">
                Hỗ trợ IT nội bộ
              </span>
            </div>
          </Link>

          {/* Vertical divider */}
          <div className="hidden md:block h-5 w-px bg-edge shrink-0" />

          {/* Breadcrumbs immediately on the left, next to the brand */}
          <nav aria-label="Đường dẫn trang" className="hidden md:flex min-w-0 items-center gap-1.5 text-xs text-content-muted overflow-hidden">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.to + idx}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-content-subtle shrink-0" />}
                  {isLast ? (
                    <span className="font-semibold text-content bg-surface-muted px-2 py-0.5 rounded-sm border border-edge truncate" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.to}
                      className="hover:text-[var(--color-primary-ink)] hover:bg-surface-muted px-1.5 py-0.5 rounded-sm transition-colors truncate"
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
          {/* Theme Switcher */}
          <ThemeSwitcher />

          {/* Health status badge */}
          <div
            className={`hidden 2xl:flex items-center gap-2 text-xs px-3 h-9 rounded-md border transition-all ${
              !health && !healthError
                ? 'bg-surface-muted border-edge text-content-muted'
                : health && !healthError
                ? 'bg-status-success-bg border-status-success-border text-status-success'
                : 'bg-status-danger-bg border-status-danger-border text-status-danger'
            }`}
            title="Trạng thái dịch vụ máy chủ DX-Desk"
          >
            <span className="relative flex h-2 w-2">
              {health && !healthError && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  !health && !healthError
                    ? 'bg-content-subtle'
                    : health && !healthError
                    ? 'bg-status-success'
                    : 'bg-status-danger'
                }`}
              />
            </span>
            <span className="text-xs">
              Dịch vụ:{' '}
              {!health && !healthError ? (
                <span className="text-content-muted">Đang kiểm tra…</span>
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
              <div className="hidden lg:flex max-w-64 2xl:max-w-md items-center gap-2 h-9 px-3 bg-surface-muted border border-edge rounded-md shadow-2xs">
                <div className="w-5 h-5 rounded-full bg-primary-tint border border-primary-border text-[var(--color-primary-text)] font-bold text-xs flex items-center justify-center shrink-0">
                  {username ? username.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                </div>
                <span className="min-w-0 truncate text-xs font-semibold text-content" title={username || 'Người dùng'}>
                  {username || 'Người dùng'}
                </span>
                <div className="hidden 2xl:flex items-center gap-1 shrink-0">
                  {roles.length > 0 ? (
                    roles.map((role) => <RoleBadge key={role} role={role} />)
                  ) : (
                    <span className="text-xs text-content-muted">Nhân viên</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-xs font-medium bg-surface text-content-muted hover:text-status-danger hover:bg-status-danger-bg border border-edge hover:border-status-danger-border focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-2xs"
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
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-md text-xs font-semibold shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-[0.98] ${
                isKeycloakOffline || isLoading
                  ? 'bg-surface-muted text-content-subtle border border-edge cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover text-white'
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
