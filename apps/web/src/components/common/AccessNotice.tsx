// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Link } from 'react-router-dom';
import { LogIn, ShieldAlert } from 'lucide-react';
import { Button, buttonClass } from './Button';

const LINK_BUTTON = buttonClass('secondary');

/** 403: người dùng đã đăng nhập nhưng vai trò không đủ. Một <h1> cho trang, lối thoát rõ ràng. */
export const AccessNotice: React.FC<{ message: string; backTo?: string; backLabel?: string }> = ({
  message,
  backTo = '/',
  backLabel = 'Về trang chủ',
}) => (
  <section role="alert" className="mx-auto my-12 max-w-md rounded-lg border border-edge bg-surface p-6 text-center">
    <h1 className="dx-page-title">Không có quyền truy cập</h1>
    <p className="mt-2 text-sm text-content-muted">{message}</p>
    <Link className={`mt-4 ${LINK_BUTTON}`} to={backTo}>
      {backLabel}
    </Link>
  </section>
);

/** Trang cần đăng nhập mà phiên chưa có: một <h1>, nút đăng nhập chuẩn và lối về trang chủ. */
export const SignInNotice: React.FC<{ onLogin: () => void; disabled?: boolean }> = ({ onLogin, disabled = false }) => (
  <section className="mx-auto my-12 max-w-md rounded-lg border border-edge bg-surface p-8 text-center">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-status-warning-border bg-status-warning-bg text-status-warning">
      <ShieldAlert className="h-6 w-6" aria-hidden="true" />
    </div>
    <h1 className="dx-page-title">Yêu cầu đăng nhập</h1>
    <p className="mt-2 text-sm leading-relaxed text-content-muted">
      Bạn cần đăng nhập bằng tài khoản của tổ chức để truy cập các tính năng quản lý phiếu và yêu cầu cấp thiết bị.
    </p>
    <div className="mt-6 flex flex-col gap-2.5">
      <Button className="w-full" onClick={onLogin} disabled={disabled} leftIcon={<LogIn className="h-4 w-4" />}>
        Đăng nhập ngay
      </Button>
      <Link to="/" className={`w-full ${LINK_BUTTON}`}>
        Quay lại trang chủ
      </Link>
    </div>
  </section>
);
