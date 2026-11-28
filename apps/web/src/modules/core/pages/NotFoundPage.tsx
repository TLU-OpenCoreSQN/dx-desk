// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { buttonClass } from '../../../components/common/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <section className="mx-auto max-w-md px-4 py-16 text-center sm:py-24">
      <p data-numeric className="font-mono text-sm font-medium text-content-muted">Lỗi 404</p>
      <h1 className="dx-page-title mt-2">Không tìm thấy trang yêu cầu</h1>
      <p className="mt-2 text-sm leading-relaxed text-content-muted">
        Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển trong hệ thống DX-Desk.
      </p>
      <Link
        to="/"
        className={`mt-6 ${buttonClass('primary')}`}
      >
        <Home className="h-4 w-4" aria-hidden="true" />
        Về trang chủ
      </Link>
    </section>
  );
};
