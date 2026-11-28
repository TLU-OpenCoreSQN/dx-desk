// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, LogIn, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { RoleBadge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useModules } from '../../ModuleContext';
import { navEntries } from '../../registry';

/*
 * Bàn điều phối theo vai trò. Lối tắt lấy từ chính sổ đăng ký điều hướng (navEntries) nên chỉ
 * hiện chức năng mà module đang bật VÀ vai trò hiện tại được phép mở: giao diện trung thực với quyền.
 */
interface Shortcut {
  title: string;
  text: string;
  group: 'self' | 'operations';
}

const SHORTCUTS: Record<string, Shortcut> = {
  '/tickets/new': { title: 'Gửi sự cố mới', text: 'Mô tả vấn đề để IT tiếp nhận.', group: 'self' },
  '/tickets': { title: 'Phiếu yêu cầu IT', text: 'Theo dõi nội dung và tiến độ phiếu.', group: 'self' },
  '/device-requests': { title: 'Yêu cầu cấp thiết bị', text: 'Đề xuất thiết bị cho công việc.', group: 'self' },
  '/work-queue': {
    title: 'Bảng việc kỹ thuật viên',
    text: 'Phiếu của bạn và của nhóm, việc gấp theo hạn SLA lên trước.',
    group: 'operations',
  },
  '/approvals': {
    title: 'Phê duyệt phiếu hỗ trợ',
    text: 'Duyệt hoặc từ chối yêu cầu đang chờ quyết định.',
    group: 'operations',
  },
  '/bao-cao': { title: 'Báo cáo vận hành', text: 'Khối lượng phiếu, thời gian xử lý và tuân thủ SLA.', group: 'operations' },
};

const BENEFITS = [
  'Gửi yêu cầu và theo dõi tiến độ ở cùng một nơi.',
  'Tra cứu lại lịch sử phiếu đã gửi.',
  'Không cần tài khoản riêng - dùng chung SSO của tổ chức.',
];

const STEPS = [
  { step: '1', title: 'Đăng nhập bằng SSO', desc: 'Xác thực bằng tài khoản do tổ chức cấp.' },
  { step: '2', title: 'Gửi yêu cầu hỗ trợ', desc: 'Chọn danh mục và mô tả điều bạn cần.' },
  { step: '3', title: 'Theo dõi tiến độ', desc: 'Xem lại nội dung và lịch sử xử lý.' },
];

function ShortcutGrid({ items }: { items: { to: string; icon: LucideIcon; shortcut: Shortcut }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ to, icon: Icon, shortcut }) => (
        <li key={to} className="min-w-0">
          <Link
            to={to}
            className="group flex h-full items-start gap-3 rounded-lg border border-edge bg-surface p-4 transition-colors duration-150 hover:border-primary hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary-text">
              <Icon size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-content group-hover:text-primary">{shortcut.title}</h3>
                <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-content-subtle group-hover:text-primary" />
              </div>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-content-muted">{shortcut.text}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  const { isAuthenticated, isLoading, username, roles, profile, login, isKeycloakOffline } = useAuth();
  const { modules } = useModules();

  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-4xl space-y-6">
        <section aria-labelledby="home-hero-title" className="rounded-lg border border-edge bg-surface p-6 sm:p-8">
          <h1 id="home-hero-title" className="dx-page-title">
            Hệ thống hỗ trợ IT nội bộ DX-Desk
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-muted">
            Gửi sự cố, theo dõi yêu cầu và đề xuất thiết bị trong một không gian duy nhất dành cho nhân viên.
          </p>

          <ul className="mt-5 space-y-2">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5 text-sm text-content">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          {isKeycloakOffline && (
            <div
              id="sso-offline-note"
              role="status"
              className="mt-5 flex items-start gap-2.5 rounded-lg border border-status-warning-border bg-status-warning-bg p-3 text-sm text-status-warning"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold">Dịch vụ đăng nhập đang tạm thời gián đoạn.</p>
                <p className="mt-0.5 leading-relaxed">
                  Chưa thể mở trang đăng nhập, nút bên dưới tạm thời bị vô hiệu. Vui lòng thử lại sau hoặc liên hệ bộ phận IT.
                </p>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            className="mt-5 w-full sm:w-auto"
            onClick={() => void login()}
            disabled={isLoading || isKeycloakOffline}
            aria-describedby={isKeycloakOffline ? 'sso-offline-note' : undefined}
            leftIcon={<LogIn size={18} />}
          >
            {isLoading ? 'Đang kiểm tra đăng nhập…' : 'Đăng nhập hệ thống (SSO)'}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-content-muted">
            {isKeycloakOffline
              ? 'Trong lúc chờ, bạn vẫn có thể xem thông tin giới thiệu trên trang này.'
              : 'Sử dụng tài khoản do tổ chức cấp để tiếp tục.'}
          </p>
        </section>

        <section aria-labelledby="support-steps-title">
          <h2 id="support-steps-title" className="dx-section-title">
            Quy trình hỗ trợ
          </h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {STEPS.map(({ step, title, desc }) => (
              <li key={step} className="min-w-0 rounded-lg border border-edge bg-surface p-4">
                <span
                  data-numeric
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-primary-tint text-xs font-semibold text-primary-text"
                >
                  {step}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-content">{title}</h3>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-content-muted">{desc}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  const entries = navEntries(modules, { isAuthenticated, roles, profile }).filter(
    (entry) => !entry.external && SHORTCUTS[entry.to],
  );
  const items = entries.map((entry) => ({ to: entry.to, icon: entry.icon, shortcut: SHORTCUTS[entry.to] }));
  const self = items.filter((item) => item.shortcut.group === 'self');
  const operations = items.filter((item) => item.shortcut.group === 'operations');
  const canCreate = self.some((item) => item.to === '/tickets/new');

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 id="home-hero-title" className="dx-page-title">
            Xin chào, {username}
          </h1>
          <p className="mt-1 text-sm text-content-muted">Chọn một chức năng bên dưới để bắt đầu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Vai trò của bạn">
          {(roles.length > 0 ? roles : ['Employee']).map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      </header>

      {operations.length > 0 && (
        <section aria-labelledby="operations-title">
          <h2 id="operations-title" className="dx-section-title mb-3">
            Công việc vận hành
          </h2>
          <ShortcutGrid items={operations} />
        </section>
      )}

      {self.length > 0 && (
        <section aria-labelledby="quick-actions-title">
          <h2 id="quick-actions-title" className="dx-section-title mb-3">
            Thao tác nhanh
          </h2>
          <ShortcutGrid items={self} />
        </section>
      )}

      {canCreate && (
        <p className="flex items-start gap-2.5 rounded-lg border border-edge bg-surface p-4 text-[0.8125rem] leading-relaxed text-content-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-info" aria-hidden="true" />
          <span>
            Sự cố ảnh hưởng nhiều người? Ghi rõ phạm vi ảnh hưởng (bao nhiêu người, dịch vụ nào bị gián đoạn) trong mô
            tả để IT đánh giá đúng mức ưu tiên.
          </span>
        </p>
      )}
    </div>
  );
}
