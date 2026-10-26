// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
        <HelpCircle className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">404</h1>
      <h2 className="text-lg font-semibold text-slate-800 mb-2">
        Không tìm thấy trang yêu cầu
      </h2>
      <p className="text-xs text-slate-500 mb-6 leading-relaxed">
        Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển trong hệ thống DX-Desk.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
      >
        <Home className="w-4 h-4" />
        <span>Về trang chủ</span>
      </Link>
    </div>
  );
};
