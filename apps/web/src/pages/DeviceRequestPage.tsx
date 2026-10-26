// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState, useCallback } from 'react';
import {
  Laptop,
  Monitor,
  Keyboard,
  Mouse,
  Layers,
  PlusCircle,
  RefreshCw,
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getDeviceRequests, createDeviceRequest } from '../services/api';
import { DeviceRequest, DeviceType } from '../types/api';
import { StatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { Alert } from '../components/common/Alert';

const PAGE_SIZE = 25;

export const DeviceRequestPage: React.FC = () => {
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  // Form states
  const [showForm, setShowForm] = useState<boolean>(false);
  const [deviceType, setDeviceType] = useState<DeviceType>('laptop');
  const [reason, setReason] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadRequests = useCallback(async (currentOffset: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getDeviceRequests(PAGE_SIZE, currentOffset);
      setRequests(res.data || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests(offset);
  }, [loadRequests, offset]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 10) {
      errors.reason = `Lý do yêu cầu quá ngắn (tối thiểu 10 ký tự, hiện tại: ${trimmedReason.length}).`;
    } else if (trimmedReason.length > 2000) {
      errors.reason = `Lý do yêu cầu quá dài (tối đa 2000 ký tự, hiện tại: ${trimmedReason.length}).`;
    }

    if (!quantity || quantity < 1 || quantity > 10 || !Number.isInteger(quantity)) {
      errors.quantity = 'Số lượng phải là số nguyên từ 1 đến 10.';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const newReq = await createDeviceRequest({
        device_type: deviceType,
        reason: reason.trim(),
        quantity,
      });

      setSuccessMessage(`Đã gửi yêu cầu cấp thiết bị thành công (Mã yêu cầu: ${newReq.id})`);
      setReason('');
      setQuantity(1);
      setDeviceType('laptop');
      setShowForm(false);
      if (offset === 0) await loadRequests(0);
      else setOffset(0);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'laptop':
        return <Laptop className="w-4 h-4 text-teal-600" />;
      case 'monitor':
        return <Monitor className="w-4 h-4 text-blue-600" />;
      case 'keyboard':
        return <Keyboard className="w-4 h-4 text-indigo-600" />;
      case 'mouse':
        return <Mouse className="w-4 h-4 text-emerald-600" />;
      default:
        return <Layers className="w-4 h-4 text-slate-600" />;
    }
  };

  const getDeviceLabel = (type: DeviceType) => {
    switch (type) {
      case 'laptop':
        return 'Máy tính xách tay (Laptop)';
      case 'monitor':
        return 'Màn hình máy tính (Monitor)';
      case 'keyboard':
        return 'Bàn phím làm việc';
      case 'mouse':
        return 'Chuột máy tính';
      case 'other':
        return 'Thiết bị khác';
      default:
        return type;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Yêu cầu cấp phát thiết bị IT
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gửi đề xuất thiết bị và xem lại các yêu cầu bạn được truy cập.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadRequests(offset)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showForm ? 'Đóng biểu mẫu' : 'Gửi yêu cầu mới'}</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <Alert
          type="success"
          title="Thành công"
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      {/* Device Request Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-6 sm:p-8 animate-fadeIn">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Đề xuất cấp thiết bị làm việc
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Vui lòng nêu rõ lý do và nhu cầu sử dụng thực tế.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-teal-50 text-teal-800 font-semibold border border-teal-200">
              POST /api/device-requests
            </span>
          </div>

          {!!submitError && (
            <ErrorMessage
              error={submitError}
              title="Không thể gửi yêu cầu cấp thiết bị"
              className="mb-6"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Device Type */}
              <div>
                <label
                  htmlFor="device-type"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Loại thiết bị <span className="text-rose-500">*</span>
                </label>
                <select
                  id="device-type"
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="laptop">Máy tính xách tay (Laptop)</option>
                  <option value="monitor">Màn hình máy tính (Monitor)</option>
                  <option value="keyboard">Bàn phím làm việc (Keyboard)</option>
                  <option value="mouse">Chuột máy tính (Mouse)</option>
                  <option value="other">Thiết bị khác (Other)</option>
                </select>
              </div>

              {/* Quantity */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="device-quantity"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                  >
                    Số lượng <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Từ 1 đến 10 thiết bị</span>
                </div>
                <input
                  id="device-quantity"
                  type="number"
                  min={1}
                  max={10}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className={`w-full text-xs border rounded-lg p-2.5 focus:outline-none focus:ring-2 ${
                    clientErrors.quantity
                      ? 'border-rose-400 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-teal-500'
                  }`}
                />
                {clientErrors.quantity && (
                  <p className="text-xs text-rose-600 mt-1">{clientErrors.quantity}</p>
                )}
              </div>
            </div>

            {/* Reason */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="device-reason"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Lý do đề xuất <span className="text-rose-500">*</span>
                </label>
                <span
                  className={`text-[11px] ${
                    reason.trim().length > 2000 ||
                    (reason.trim().length > 0 && reason.trim().length < 10)
                      ? 'text-rose-500 font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  {reason.trim().length} / 2000 ký tự (tối thiểu 10)
                </span>
              </div>
              <textarea
                id="device-reason"
                rows={4}
                placeholder="VD: Cần thêm màn hình phụ phục vụ lập trình giao diện hoặc thiết bị cũ bị hỏng..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2100}
                className={`w-full text-xs border rounded-lg p-3 focus:outline-none focus:ring-2 leading-relaxed ${
                  clientErrors.reason
                    ? 'border-rose-400 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-teal-500'
                }`}
              />
              {clientErrors.reason && (
                <p className="text-xs text-rose-600 mt-1">{clientErrors.reason}</p>
              )}
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Hủy
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Đang gửi đề xuất...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi yêu cầu thiết bị</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      {isLoading ? (
        <LoadingSpinner label="Đang tải danh sách yêu cầu thiết bị từ máy chủ..." />
      ) : error ? (
        <ErrorMessage
          error={error}
          onRetry={() => void loadRequests(offset)}
          title="Không thể tải danh sách yêu cầu thiết bị"
        />
      ) : requests.length === 0 ? (
        <EmptyState
          title="Chưa có yêu cầu cấp thiết bị nào"
          description="Hiện tại bạn chưa gửi đề xuất cấp thiết bị nào trên hệ thống."
          actionText="Gửi yêu cầu ngay"
          onAction={() => setShowForm(true)}
          icon={<Laptop className="w-6 h-6 text-slate-400" />}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th scope="col" className="px-4 py-3">Loại thiết bị</th>
                  <th scope="col" className="px-4 py-3">Số lượng</th>
                  <th scope="col" className="px-4 py-3">Lý do đề xuất</th>
                  <th scope="col" className="px-4 py-3">Trạng thái</th>
                  <th scope="col" className="px-4 py-3">Thời gian tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(req.device_type)}
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {getDeviceLabel(req.device_type)}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {req.id}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">
                      {req.quantity}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-xs">
                      <p className="line-clamp-2 leading-relaxed">{req.reason}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatDate(req.created_at)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
      {!isLoading && !error && <div>
          {/* Pagination */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Hiển thị từ <span className="font-semibold text-slate-800">{requests.length ? offset + 1 : offset}</span>{' '}
              đến{' '}
              <span className="font-semibold text-slate-800">
                {offset + requests.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                disabled={offset === 0 || isLoading}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium ${
                  offset === 0 || isLoading
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                    : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trang trước</span>
              </button>

              <button
                type="button"
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={requests.length < PAGE_SIZE || isLoading}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium ${
                  requests.length < PAGE_SIZE || isLoading
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                    : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100'
                }`}
              >
                <span>Trang sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  );
};
