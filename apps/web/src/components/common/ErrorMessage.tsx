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
      className={`p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-rose-900">{title}</h3>
            {statusCode !== undefined && statusCode > 0 && (
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-rose-200 text-rose-800">
                HTTP {statusCode}
              </span>
            )}
          </div>
          <p className="text-sm text-rose-800 mb-2 leading-relaxed">{displayMessage}</p>

          {details.length > 1 && (
            <ul className="text-xs list-disc list-inside text-rose-700 space-y-1 mb-3">
              {details.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-800 bg-rose-100 hover:bg-rose-200 rounded-md border border-rose-300 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
