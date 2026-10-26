// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LogIn, Ticket, PlusCircle, Laptop, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getHealth } from '../services/api';
import type { HealthResponse } from '../types/api';
import { RoleBadge } from '../components/common/Badge';

export function HomePage() {
  const { isAuthenticated, isLoading, username, roles, login, isKeycloakOffline } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setChecking(true);
    getHealth().then(value => { if (active) setHealth(value); })
      .catch(() => { if (active) setHealth(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [attempt]);
  const actions = [
    { to: '/tickets/new', icon: PlusCircle, title: 'Gửi sự cố mới', text: 'Mô tả vấn đề để bộ phận IT tiếp nhận và hỗ trợ.' },
    { to: '/tickets', icon: Ticket, title: 'Phiếu yêu cầu IT', text: 'Xem nội dung và lịch sử những yêu cầu bạn được truy cập.' },
    { to: '/device-requests', icon: Laptop, title: 'Yêu cầu cấp thiết bị', text: 'Gửi nhu cầu thiết bị phục vụ công việc của bạn.' },
  ];
  return <div className="max-w-5xl mx-auto space-y-8">
    <section className="rounded-2xl bg-navy-900 text-white px-6 py-10 sm:p-12">
      <p className="text-teal-300 text-sm font-semibold tracking-wide mb-5">KHÔNG GIAN HỖ TRỢ CỦA BẠN</p>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight max-w-xl">Hệ thống hỗ trợ IT nội bộ <span className="text-teal-300">DX-Desk</span></h1>
      <p className="text-slate-300 mt-5 max-w-xl leading-relaxed">Một nơi để gửi sự cố, theo dõi yêu cầu và đề xuất thiết bị cho công việc hằng ngày.</p>
      {isAuthenticated ? <div className="mt-7">
        <p className="text-lg">Xin chào, <strong>{username}</strong></p>
        <div className="flex gap-2 mt-3">{roles.map(role => <RoleBadge key={role} role={role} />)}</div>
      </div> : <div className="mt-7">
        <button type="button" onClick={() => void login()} disabled={isLoading || isKeycloakOffline}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-3 font-semibold bg-teal-400 text-navy-950 hover:bg-teal-300 disabled:bg-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed">
          <LogIn size={18} />{isLoading ? 'Đang kiểm tra đăng nhập…' : 'Đăng nhập hệ thống (SSO)'}
        </button>
        {isKeycloakOffline && <p role="status" className="mt-4 text-amber-200 text-sm">Dịch vụ đăng nhập đang tạm thời gián đoạn. Vui lòng thử kết nối lại.</p>}
        <p className="mt-4 text-sm text-slate-400">Sử dụng tài khoản do tổ chức cấp để tiếp tục.</p>
      </div>}
    </section>
    {isAuthenticated ? <section className="grid gap-4 md:grid-cols-3" aria-label="Các thao tác">
      {actions.map(({ to, icon: Icon, title, text }) => <Link key={to} to={to} className="group rounded-xl border border-slate-200 bg-white p-6 hover:border-teal-500 transition-colors">
        <Icon size={26} className="text-teal-700 mb-5" />
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
        <ArrowRight size={18} className="text-teal-700 mt-6 group-hover:translate-x-1 transition-transform" />
      </Link>)}
    </section> : <section className="grid gap-6 sm:grid-cols-3" aria-label="Cách sử dụng">
      {['Đăng nhập tài khoản', 'Gửi yêu cầu của bạn', 'Theo dõi tại một nơi'].map((title, index) =>
        <div key={title} className="border-t border-slate-200 pt-5">
          <span className="text-teal-700 font-mono text-sm">0{index + 1}</span>
          <h2 className="mt-3 font-semibold text-slate-800">{title}</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{[
            'Đăng nhập một lần bằng tài khoản của tổ chức.',
            'Chọn danh mục và mô tả rõ điều bạn cần hỗ trợ.',
            'Tra cứu nội dung và lịch sử yêu cầu sau khi gửi.',
          ][index]}</p>
        </div>)}
    </section>}
    <section className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 text-sm" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className={'h-2 w-2 rounded-full ' + (checking ? 'bg-slate-400' : health ? 'bg-emerald-500' : 'bg-amber-500')} />
        <span className="text-slate-600">{checking ? 'Đang kiểm tra kết nối…' : health ? 'Dịch vụ đang hoạt động bình thường' : 'Dịch vụ hỗ trợ hiện chưa kết nối'}</span>
        {health && !checking && <span className="text-slate-400">{health.version}</span>}
      </div>
      <button type="button" onClick={() => setAttempt(value => value + 1)} disabled={checking}
        className="inline-flex gap-2 items-center text-teal-700 font-medium disabled:opacity-50">
        <RefreshCw size={15} />Kiểm tra lại
      </button>
    </section>
  </div>;
}
