// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Laptop,
  LogIn,
  PlusCircle,
  RefreshCw,
  Shield,
  Ticket,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getHealth } from '../services/api';
import type { HealthResponse } from '../types/api';
import { RoleBadge } from '../components/common/Badge';

export function HomePage() {
  const { isAuthenticated, isLoading, username, roles, login, isKeycloakOffline } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    setChecking(true);
    getHealth()
      .then((value) => {
        if (active) setHealth(value);
      })
      .catch(() => {
        if (active) setHealth(null);
      })
      .finally(() => {
        if (active) {
          setChecking(false);
          setLastCheckedAt(new Date());
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const actions = [
    {
      to: '/tickets/new',
      icon: PlusCircle,
      title: 'Gửi sự cố mới',
      text: 'Mô tả vấn đề để IT tiếp nhận.',
    },
    {
      to: '/tickets',
      icon: Ticket,
      title: 'Phiếu yêu cầu IT',
      text: 'Theo dõi nội dung và tiến độ.',
    },
    {
      to: '/device-requests',
      icon: Laptop,
      title: 'Yêu cầu cấp thiết bị',
      text: 'Đề xuất thiết bị cho công việc.',
    },
  ];

  const benefits = [
    'Gửi yêu cầu và theo dõi tiến độ ở cùng một nơi.',
    'Tra cứu lại lịch sử phiếu và thiết bị đã đề xuất.',
    'Không cần tài khoản riêng — dùng chung SSO của tổ chức.',
  ];

  const steps = [
    {
      step: '01',
      title: 'Đăng nhập bằng SSO',
      desc: 'Xác thực bằng tài khoản do tổ chức cấp.',
    },
    {
      step: '02',
      title: 'Gửi yêu cầu hỗ trợ',
      desc: 'Chọn danh mục và mô tả điều bạn cần.',
    },
    {
      step: '03',
      title: 'Theo dõi tiến độ',
      desc: 'Xem lại nội dung và lịch sử xử lý.',
    },
  ];

  const statusLabel = checking
    ? 'Đang kiểm tra kết nối…'
    : health
    ? 'Dịch vụ đang hoạt động bình thường'
    : 'Dịch vụ hỗ trợ hiện chưa kết nối';

  const statusHint = checking
    ? 'Đang liên hệ máy chủ DX-Desk.'
    : health
    ? `Máy chủ ${health.service} đã phản hồi.`
    : 'Chưa nhận được phản hồi từ máy chủ. Bạn vẫn có thể thử kiểm tra lại.';

  const dotClass = checking
    ? 'bg-[#8c8a85] ring-4 ring-[#8c8a85]/10'
    : health
    ? 'bg-[#448361] ring-4 ring-[#448361]/15'
    : 'bg-[#cb912f] ring-4 ring-[#cb912f]/15';

  const lastCheckedLabel = lastCheckedAt
    ? lastCheckedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="w-full space-y-6">
      {/* Hero */}
      <section
        aria-labelledby="home-hero-title"
        className="relative overflow-hidden rounded-[8px] border border-[var(--color-edge-subtle)] bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface-sidebar)] to-[var(--color-surface-warm)] shadow-[0_2px_8px_rgba(0,0,0,0.03)] w-full"
      >
        {/* Lưới chấm mờ trang trí tinh tế */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(10, 120, 190, 0.25) 1px, transparent 0)',
            backgroundSize: '24px 24px',
            opacity: 0.18,
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--color-primary-tint)]/40 to-transparent blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[var(--color-primary)] to-[var(--color-primary-active)]"
        />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)] lg:items-start lg:gap-8 lg:p-10">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)] shadow-2xs">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              <span>KHÔNG GIAN HỖ TRỢ CỦA BẠN</span>
            </div>

            <h1
              id="home-hero-title"
              className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-[var(--color-content)] sm:text-3xl lg:text-4xl"
            >
              Hệ thống hỗ trợ IT nội bộ <span className="text-[var(--color-primary)] bg-clip-text">DX-Desk</span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-content-muted)] sm:mt-4 sm:text-base">
              Gửi sự cố, theo dõi yêu cầu và đề xuất thiết bị trong một không gian duy nhất dành
              cho nhân viên.
            </p>

            {isAuthenticated ? (
              <div className="mt-6 rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface/90 backdrop-blur-xs p-5 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--color-primary-tint)] to-[var(--color-primary-tint)] border border-[var(--color-primary-border)] text-[var(--color-primary)] font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                    {username ? username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-content-muted)]">Xin chào,</p>
                    <p className="truncate text-base font-bold text-[var(--color-content)] sm:text-lg">
                      <strong className="font-bold text-[var(--color-primary)]">{username}</strong>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-content-subtle)]">
                    Vai trò
                  </span>
                  {roles.length > 0 ? (
                    roles.map((role) => <RoleBadge key={role} role={role} />)
                  ) : (
                    <span className="text-xs text-[var(--color-content-muted)]">Nhân viên</span>
                  )}
                </div>
                <p className="mt-3 border-t border-[var(--color-edge-subtle)] pt-3 text-xs text-[var(--color-content-muted)]">
                  Chọn một thao tác nhanh bên dưới để bắt đầu.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface/90 backdrop-blur-xs p-5 shadow-2xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-content-muted)]">
                  Khi đăng nhập, bạn có thể
                </p>
                <ul className="mt-3 space-y-2.5">
                  {benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--color-content)] sm:text-sm"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#448361]"
                        aria-hidden="true"
                      />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                {isKeycloakOffline && (
                  <div
                    id="sso-offline-note"
                    role="status"
                    className="mt-4 flex items-start gap-2.5 rounded-[6px] border border-[#f5ddb2] bg-[#fbf3db] p-3 text-xs text-[#7c5108]"
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#cb912f]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold">
                        Dịch vụ đăng nhập đang tạm thời gián đoạn.
                      </p>
                      <p className="mt-0.5 leading-relaxed">
                        Chưa thể mở trang đăng nhập, nút bên dưới tạm thời bị vô hiệu. Vui lòng
                        thử lại sau hoặc liên hệ bộ phận IT.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void login()}
                  disabled={isLoading || isKeycloakOffline}
                  aria-describedby={isKeycloakOffline ? 'sso-offline-note' : undefined}
                  className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[6px] px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-all duration-150 active:scale-[0.98] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border disabled:border-[var(--color-edge-subtle)] disabled:bg-[var(--color-surface-warm)] disabled:text-[var(--color-content-subtle)] disabled:shadow-none motion-reduce:transition-none sm:w-auto"
                >
                  <LogIn size={18} aria-hidden="true" />
                  <span>{isLoading ? 'Đang kiểm tra đăng nhập…' : 'Đăng nhập hệ thống (SSO)'}</span>
                </button>

                <p className="mt-3 text-xs leading-relaxed text-[var(--color-content-muted)]">
                  {isKeycloakOffline
                    ? 'Trong lúc chờ, bạn vẫn có thể xem thông tin giới thiệu trên trang này.'
                    : 'Sử dụng tài khoản do tổ chức cấp để tiếp tục.'}
                </p>
              </div>
            )}
          </div>

          {/* Trạng thái dịch vụ (chỉ dùng dữ liệu thật từ getHealth) */}
          <div className="min-w-0 rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface p-5 shadow-2xs transition-all hover:border-[var(--color-edge)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-content-subtle)]">
                Trạng thái dịch vụ
              </h2>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                disabled={checking}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-tint)]/50 transition-colors duration-150 hover:text-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                <RefreshCw size={13} className={checking ? 'animate-spin' : ''} aria-hidden="true" />
                <span>Kiểm tra lại</span>
              </button>
            </div>

            <div role="status" aria-live="polite" className="mt-4">
              <div className="flex items-start gap-3">
                <span className="relative flex h-3 w-3 mt-0.5">
                  {health && !checking && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#448361] opacity-60"></span>
                  )}
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-3 w-3 shrink-0 rounded-full ${dotClass}`}
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-[var(--color-content)]">
                    {statusLabel}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-content-muted)]">{statusHint}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--color-edge-subtle)] pt-3">
                {health && !checking ? (
                  <span className="rounded-[4px] border border-[#b8dcce] bg-[#edf3ec] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#2c6246]">
                    {health.version}
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--color-content-subtle)]">
                    {checking ? 'Đang lấy phiên bản…' : 'Chưa lấy được phiên bản'}
                  </span>
                )}
                {lastCheckedLabel && !checking && (
                  <span className="text-[11px] text-[var(--color-content-subtle)]">
                    Kiểm tra lúc {lastCheckedLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dải thẻ chỉ số nổi bật tận dụng không gian rộng */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 w-full">
        <div className="bg-surface rounded-[8px] border border-[var(--color-edge-subtle)] p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-[6px] bg-[var(--color-primary-tint)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[var(--color-content-subtle)] uppercase tracking-wider">Hạ tầng IT</p>
            <p className="text-sm font-bold text-[var(--color-content)] truncate">Sẵn sàng 24/7</p>
          </div>
        </div>
        <div className="bg-surface rounded-[8px] border border-[var(--color-edge-subtle)] p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-[6px] bg-[#edf3ec] text-[#448361] flex items-center justify-center shrink-0">
            <Ticket className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[var(--color-content-subtle)] uppercase tracking-wider">Phiếu sự cố</p>
            <p className="text-sm font-bold text-[var(--color-content)] truncate">Đồng bộ tức thời</p>
          </div>
        </div>
        <div className="bg-surface rounded-[8px] border border-[var(--color-edge-subtle)] p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-[6px] bg-[#fbf3db] text-[#cb912f] flex items-center justify-center shrink-0">
            <Laptop className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[var(--color-content-subtle)] uppercase tracking-wider">Cấp thiết bị</p>
            <p className="text-sm font-bold text-[var(--color-content)] truncate">Đề xuất chuẩn hóa</p>
          </div>
        </div>
        <div className="bg-surface rounded-[8px] border border-[var(--color-edge-subtle)] p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-[6px] bg-[#f4eeff] text-[#9065b0] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[var(--color-content-subtle)] uppercase tracking-wider">Xác thực SSO</p>
            <p className="text-sm font-bold text-[var(--color-content)] truncate">An toàn nội bộ</p>
          </div>
        </div>
      </div>

      {/* Thao tác nhanh (đã đăng nhập) hoặc quy trình (chưa đăng nhập) */}
      {isAuthenticated ? (
        <section aria-labelledby="quick-actions-title">
          <div className="mb-4">
            <h2
              id="quick-actions-title"
              className="text-xs font-bold uppercase tracking-wider text-[var(--color-content-muted)]"
            >
              Thao tác nhanh
            </h2>
            <p className="mt-1 text-xs text-[var(--color-content-subtle)]">
              Mỗi thẻ dẫn thẳng tới chức năng tương ứng.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map(({ to, icon: Icon, title, text }) => (
              <li key={to} className="min-w-0">
                <Link
                  to={to}
                  className="group flex h-full min-h-[160px] flex-col justify-between rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-primary)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] focus-visible:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary-tint)] text-[var(--color-primary)] transition-all duration-200 group-hover:bg-[var(--color-primary)] group-hover:text-white group-hover:scale-105 group-focus-visible:bg-[var(--color-primary)] group-focus-visible:text-white motion-reduce:transition-none shadow-2xs">
                        <Icon size={22} aria-hidden="true" />
                      </span>
                      <h3 className="min-w-0 text-sm font-bold text-[var(--color-content)] transition-colors duration-150 group-hover:text-[var(--color-primary)] motion-reduce:transition-none sm:text-base">
                        {title}
                      </h3>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-[var(--color-content-muted)]">{text}</p>
                  </div>
                  <span className="mt-4 inline-flex items-center text-xs font-semibold text-[var(--color-primary)]">
                    Mở chức năng
                    <ArrowRight
                      size={14}
                      aria-hidden="true"
                      className="ml-1.5 transition-transform duration-200 group-hover:translate-x-1.5 motion-reduce:transform-none motion-reduce:transition-none"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface p-4 text-xs leading-relaxed text-[var(--color-content-muted)] shadow-2xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-[6px] bg-[#fbe4e4] flex items-center justify-center text-[#d44c47] shrink-0 font-bold">
              !
            </div>
            <div>
              Sự cố ảnh hưởng nhiều người? Hãy tạo phiếu với mức ưu tiên{' '}
              <span className="font-bold text-[#d44c47]">Khẩn cấp</span> để được xử lý trước.
            </div>
          </div>
        </section>
      ) : (
        <section aria-labelledby="support-steps-title">
          <div className="mb-4">
            <h2
              id="support-steps-title"
              className="text-xs font-bold uppercase tracking-wider text-[var(--color-content-muted)]"
            >
              Quy trình hỗ trợ
            </h2>
            <p className="mt-1 text-xs text-[var(--color-content-subtle)]">
              Ba bước ngắn gọn để yêu cầu của bạn được tiếp nhận.
            </p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map(({ step, title, desc }) => (
              <li
                key={step}
                className="group min-w-0 rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-edge)] hover:shadow-xs"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded-[4px] bg-[var(--color-primary-tint)] px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--color-primary)] border border-[var(--color-primary-border)]/60">
                    {step}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]/40 group-hover:bg-[var(--color-primary)] transition-colors" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-content)] sm:text-base">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-content-muted)]">{desc}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}