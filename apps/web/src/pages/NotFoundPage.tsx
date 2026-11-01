// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center max-w-md mx-auto px-4">
      <div className="w-16 h-16 rounded-[12px] bg-gradient-to-br from-[var(--color-primary-tint)] to-[var(--color-primary-tint)] text-[var(--color-primary)] flex items-center justify-center mb-5 border border-[var(--color-primary-border)] shadow-sm">
        <HelpCircle className="w-8 h-8" aria-hidden="true" />
      </div>
      <h1 className="text-5xl font-black text-[#211f1b] mb-2 tracking-tight">404</h1>
      <h2 className="text-base sm:text-lg font-bold text-[#211f1b] mb-2">
        Không tìm thấy trang yêu cầu
      </h2>
      <p className="text-xs sm:text-sm text-[#5f5e5a] mb-6 leading-relaxed">
        Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển trong hệ thống DX-Desk.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] text-white text-xs sm:text-sm font-semibold rounded-[6px] shadow-xs active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] min-h-[40px]"
      >
        <Home className="w-4 h-4" />
        <span>Về trang chủ</span>
      </Link>
    </div>
  );
};
