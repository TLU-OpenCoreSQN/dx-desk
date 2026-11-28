// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, LogIn, LogOut, User, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useModules } from '../../modules/ModuleContext';
import { breadcrumbsFor } from '../../modules/registry';
import { RoleBadge } from '../common/Badge';
import { Button } from '../common/Button';
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
    <header className="dx-app-header bg-surface text-content border-b border-edge sticky top-0 z-30 h-14 w-full">
      <div className="w-full px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Brand & Breadcrumb grouped together */}
        <div className="flex flex-1 items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label={isMobileNavOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={isMobileNavOpen}
            aria-controls="app-navigation"
            className="md:hidden text-content-muted hover:text-content p-2 rounded-md hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
          >
            <Menu aria-hidden="true" className="w-5 h-5" />
          </button>

          <Link
            to="/"
            aria-label="DX-Desk - Trang chủ"
            className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1 -m-1 transition-colors shrink-0"
          >
            <div aria-hidden="true" className="w-8 h-8 rounded-md bg-primary flex items-center justify-center font-bold text-white text-sm shrink-0 group-hover:bg-primary-hover transition-colors">
              DX
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-base font-semibold tracking-tight text-content leading-tight group-hover:text-primary transition-colors">
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
                  {idx > 0 && <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-content-subtle shrink-0" />}
                  {isLast ? (
                    <span className="font-semibold text-content bg-surface-muted px-2 py-0.5 rounded-sm border border-edge truncate" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.to}
                      className="hover:text-primary hover:bg-surface-muted px-1.5 py-0.5 rounded-sm transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right: Service Status & User controls - unified h-9 */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Trạng thái dịch vụ: chấm tĩnh (không hoạt ảnh); khi mất kết nối thì hiện từ md để người dùng thấy ngay. */}
          <div
            className={`${healthError ? 'hidden md:flex' : 'hidden xl:flex'} items-center gap-2 text-xs px-3 h-9 rounded-md border ${
              !health && !healthError
                ? 'bg-surface border-edge text-content-muted'
                : health && !healthError
                ? 'bg-surface border-edge text-content-muted'
                : 'bg-status-danger-bg border-status-danger-border text-status-danger'
            }`}
            title={healthError ? 'Không kết nối được máy chủ DX-Desk' : 'Trạng thái dịch vụ máy chủ DX-Desk'}
          >
            <span
              aria-hidden="true"
              className={`inline-flex rounded-full h-2 w-2 shrink-0 ${
                !health && !healthError
                  ? 'bg-content-subtle'
                  : health && !healthError
                  ? 'bg-status-success-solid'
                  : 'bg-status-danger-solid'
              }`}
            />
            <span className="text-xs">
              Dịch vụ:{' '}
              {!health && !healthError ? (
                <span>Đang kiểm tra…</span>
              ) : health && !healthError ? (
                <span className="font-medium text-content">Hoạt động ({health.version})</span>
              ) : (
                <span className="font-semibold">Mất kết nối</span>
              )}
            </span>
          </div>

          {/* User authentication info */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex max-w-md items-center gap-2 h-9 px-3 bg-surface border border-edge rounded-md">
                <div aria-hidden="true" className="w-6 h-6 rounded-full bg-primary-tint border border-primary-border text-[var(--color-primary-text)] font-semibold text-xs flex items-center justify-center shrink-0">
                  {username ? username.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                </div>
                <span className="min-w-0 truncate text-xs font-semibold text-content" title={username || 'Người dùng'}>
                  {username || 'Người dùng'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {roles.length > 0 ? (
                    roles.map((role) => <RoleBadge key={role} role={role} />)
                  ) : (
                    <span className="text-xs text-content-muted">Nhân viên</span>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => void logout()}
                title="Đăng xuất khỏi hệ thống"
                aria-label="Đăng xuất"
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                <span className="hidden sm:inline">Đăng xuất</span>
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void login()}
              disabled={isKeycloakOffline || isLoading}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              {isLoading ? 'Đang kiểm tra…' : 'Đăng nhập'}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
