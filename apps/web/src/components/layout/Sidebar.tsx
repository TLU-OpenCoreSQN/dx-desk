// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Ticket, PlusCircle, Laptop, Shield, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
interface SidebarProps { isOpen: boolean; onClose: () => void; }
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { isAuthenticated } = useAuth();
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const elements = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('a,button') ?? []);
    elements()[0]?.focus();
    function handle(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const items = elements(); const first = items[0]; const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', handle);
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => { if (desktop.matches) closeRef.current(); };
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => {
      document.removeEventListener('keydown', handle);
      desktop.removeEventListener('change', closeOnDesktop);
      previous?.focus();
    };
  }, [isOpen]);
  const links = [
    { to: '/', label: 'Trang chủ', icon: Home },
    ...(isAuthenticated ? [
      { to: '/tickets', label: 'Danh sách phiếu', icon: Ticket },
      { to: '/tickets/new', label: 'Tạo phiếu hỗ trợ', icon: PlusCircle },
      { to: '/device-requests', label: 'Yêu cầu cấp thiết bị', icon: Laptop },
    ] : []),
  ];
  const content = <div className="h-full bg-navy-950 flex flex-col text-slate-300 p-4">
    <p className="text-xs tracking-wider uppercase text-slate-500 px-3 mt-3 mb-4">Hỗ trợ IT</p>
    <nav className="space-y-2" aria-label="Điều hướng chính">
      {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end onClick={onClose}
        className={({ isActive }) => 'flex gap-3 items-center p-3 rounded-lg text-sm transition-colors ' + (isActive ? 'bg-teal-800/40 text-teal-200' : 'hover:bg-navy-800 hover:text-white')}>
        <Icon size={18} /><span>{label}</span>
      </NavLink>)}
    </nav>
    <div className="mt-auto border-t border-navy-800 pt-5 px-3 text-xs text-slate-400">
      <div className="flex items-center gap-2 text-slate-300"><Shield size={16} />TLU-OpenCoreSQN</div>
      <p className="mt-2 leading-relaxed">Không gian tiếp nhận yêu cầu IT của tổ chức.</p>
    </div>
  </div>;
  return <>
    <aside className="hidden md:block w-60 shrink-0" aria-label="Thanh điều hướng bên">
      <div className="sticky top-16 h-[calc(100vh-4rem)]">{content}</div>
    </aside>
    {isOpen && <div ref={dialog} role="dialog" aria-modal="true" aria-label="Menu điều hướng" className="fixed inset-0 z-40 md:hidden">
      <div onClick={onClose} aria-hidden="true" className="absolute inset-0 bg-navy-950/70" />
      <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
        <button type="button" aria-label="Đóng menu" onClick={onClose} className="absolute right-3 top-3 p-2 text-white z-10"><X size={20} /></button>
        {content}
      </div>
    </div>}
  </>;
}
