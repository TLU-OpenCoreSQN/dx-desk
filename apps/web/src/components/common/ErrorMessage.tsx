// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiClientError } from '../../services/api';

interface ErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  title = 'Đã xảy ra lỗi khi tải dữ liệu',
  className = '',
}) => {
  let displayMessage = 'Không thể hoàn thành yêu cầu. Vui lòng kiểm tra kết nối mạng và thử lại.';
  let statusCode: number | undefined;
  let details: string[] = [];

  if (error instanceof ApiClientError) {
    statusCode = error.statusCode;
    details = error.messages;
    if (statusCode === 401) {
      displayMessage = 'Phiên làm việc đã hết hạn hoặc chưa được xác thực. Vui lòng đăng nhập lại.';
    } else if (statusCode === 403) {
      displayMessage = 'Bạn không có quyền truy cập hoặc thực hiện thao tác này (Role không phù hợp).';
    } else if (statusCode === 404) {
      displayMessage = 'Tài nguyên được yêu cầu không tìm thấy trên hệ thống hoặc đã bị ẩn.';
    } else if (statusCode === 500) {
      displayMessage = 'Máy chủ nội bộ gặp lỗi khi xử lý dữ liệu. Vui lòng thử lại sau.';
    } else if (statusCode === 0) {
      displayMessage = 'Không thể kết nối tới dịch vụ. Vui lòng kiểm tra mạng và thử lại.';
    } else if (error.message) {
      displayMessage = error.message;
    }
  } else if (error instanceof Error) {
    displayMessage = error.message;
  }

  return (
    <div
      role="alert"
      className={`p-5 sm:p-6 bg-[#fbe4e4] border border-[#f6c3c1] rounded-[8px] text-[#962824] shadow-2xs ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <AlertCircle className="w-5 h-5 text-[#d44c47] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-bold text-sm sm:text-base text-[#962824] tracking-tight">{title}</h3>
            {statusCode !== undefined && statusCode > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-[4px] font-mono font-bold bg-[#f9dad9] text-[#962824] border border-[#f6c3c1]">
                HTTP {statusCode}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#7a1c18] mb-3 leading-relaxed break-words">{displayMessage}</p>

          {details.length > 1 && (
            <ul className="text-xs list-disc list-inside text-[#962824] space-y-1 mb-3">
              {details.map((msg, i) => (
                <li key={i} className="break-words">{msg}</li>
              ))}
            </ul>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#962824] bg-white hover:bg-[#fbe4e4] rounded-[6px] border border-[#f6c3c1] transition-all focus:outline-none focus:ring-2 focus:ring-[#d44c47] shadow-2xs min-h-[36px] active:scale-[0.98]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
