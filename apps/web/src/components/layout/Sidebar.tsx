// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Ticket,
  PlusCircle,
  Laptop,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  ChartNoAxesCombined,
  Database,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { isAuthenticated, roles } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Lock body scroll and handle keyboard shortcuts for mobile drawer
  useEffect(() => {
    if (!isOpen) return;

    // Body scroll lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const previous = document.activeElement as HTMLElement | null;
    const elements = () =>
      Array.from(dialog.current?.querySelectorAll<HTMLElement>('a,button') ?? []);
    elements()[0]?.focus();

    function handle(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === 'Tab') {
        const items = elements();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener('keydown', handle);
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => {
      if (desktop.matches) closeRef.current();
    };
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handle);
      desktop.removeEventListener('change', closeOnDesktop);
      previous?.focus();
    };
  }, [isOpen]);

  const links = [
    { to: '/', label: 'Trang chủ', icon: Home },
    { to: '/du-lieu', label: 'Danh mục dữ liệu', icon: Database },
    ...(isAuthenticated
      ? [
          { to: '/tickets', label: 'Danh sách phiếu', icon: Ticket },
          { to: '/tickets/new', label: 'Tạo phiếu hỗ trợ', icon: PlusCircle },
          { to: '/device-requests', label: 'Yêu cầu cấp thiết bị', icon: Laptop },
          ...(roles.includes('Agent') || roles.includes('Manager') ? [
            { to: '/work-queue', label: 'Bảng việc kỹ thuật viên', icon: ClipboardList },
          ] : []),
          ...(roles.includes('Manager') ? [
            { to: '/approvals', label: 'Phê duyệt phiếu hỗ trợ', icon: ShieldCheck },
            { to: '/bao-cao', label: 'Báo cáo vận hành', icon: ChartNoAxesCombined },
          ] : []),
        ]
      : []),
  ];

  const renderContent = (isMobile = false) => {
    const isCompact = !isMobile && collapsed;

    return (
      <div className="dx-sidebar h-full bg-[color-mix(in_srgb,var(--color-primary)_3%,var(--color-surface-sidebar))] flex flex-col text-[var(--color-content)] border-r border-[var(--color-edge-subtle)] select-none">
        {/* Section title / header */}
        <div className="p-3 pb-2 flex items-center justify-between">
          {!isCompact && (
            <div className="flex items-center gap-1.5 px-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
              <p className="text-[11px] font-bold tracking-wider uppercase text-[var(--color-content-subtle)]">
                Hỗ trợ IT
              </p>
            </div>
          )}
          {!isMobile && (
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
              title={collapsed ? 'Mở rộng thanh bên (256px)' : 'Thu gọn thanh bên (56px)'}
              className={`p-1.5 rounded-[6px] text-[var(--color-content-muted)] hover:text-[var(--color-content)] hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors ${
                isCompact ? 'mx-auto' : ''
              }`}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav
          className="space-y-1 px-2.5 flex-1 mt-1"
          aria-label="Điều hướng chính"
          id={isMobile ? 'app-navigation' : undefined}
        >
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={isMobile ? onClose : undefined}
              title={isCompact ? label : undefined}
              aria-label={label}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm font-medium transition-all min-h-[40px] ${
                  isCompact ? 'justify-center px-2' : ''
                } ${
                  isActive
                    ? 'bg-[var(--color-primary-tint)] text-[var(--color-primary-text)] font-semibold shadow-2xs border border-[var(--color-primary-border)]/50'
                    : 'text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]'
                }`
              }
            >
              <Icon
                size={18}
                aria-hidden="true"
                className="shrink-0 transition-transform group-hover:scale-110"
              />
              {!isCompact && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer info */}
        <div className="mt-auto border-t border-[var(--color-edge-subtle)] p-3 text-xs text-[var(--color-content-muted)]">
          {!isCompact ? (
            <div className="bg-surface/80 p-2.5 rounded-[6px] border border-[var(--color-edge-subtle)] shadow-2xs">
              <div className="flex items-center gap-2 font-semibold text-[var(--color-content)]">
                <div className="w-5 h-5 rounded-[4px] bg-[var(--color-primary-tint)] flex items-center justify-center text-[var(--color-primary)]">
                  <Shield size={13} />
                </div>
                <span className="text-xs">TLU-OpenCoreSQN</span>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-content-subtle)] leading-relaxed">
                Không gian tiếp nhận yêu cầu IT của tổ chức.
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-1" title="TLU-OpenCoreSQN: Hệ thống hỗ trợ IT">
              <div className="w-7 h-7 rounded-[4px] bg-surface border border-[var(--color-edge-subtle)] flex items-center justify-center text-[var(--color-primary)] shadow-2xs">
                <Shield size={15} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-64'
        }`}
        aria-label="Thanh điều hướng bên"
      >
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          {renderContent(false)}
        </div>
      </aside>

      {/* Mobile Drawer with Backdrop */}
      {isOpen && (
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng"
          className="fixed inset-0 z-40 md:hidden"
        >
          {/* Scrim backdrop */}
          <div
            onClick={onClose}
            aria-hidden="true"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity"
          />

          {/* Drawer container */}
          <div className="absolute inset-y-0 left-0 w-64 max-w-[85vw] shadow-lg dx-drawer-panel">
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={onClose}
              className="absolute right-2 top-2 p-2.5 text-[var(--color-content-muted)] hover:text-[var(--color-content)] hover:bg-[var(--color-surface-muted)] rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] z-10 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            >
              <X size={20} />
            </button>
            {renderContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
