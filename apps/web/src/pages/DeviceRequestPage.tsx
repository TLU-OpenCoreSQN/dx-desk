// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Laptop,
  Layers,
  Minus,
  Monitor,
  Mouse,
  Package,
  Plus,
  PlusCircle,
  RefreshCw,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getDeviceRequests, createDeviceRequest } from '../services/api';
import { DeviceRequest, DeviceType } from '../types/api';
import { StatusBadge } from '../components/common/Badge';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { EmptyState } from '../components/common/EmptyState';
import { Alert } from '../components/common/Alert';

const PAGE_SIZE = 25;
const MIN_QUANTITY = 1;
// DB CHECK và DTO backend đều chặn 1..10, nên giữ nguyên luật hiện có.
const MAX_QUANTITY = 10;
const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 2000;

interface DeviceMeta {
  label: string;
  icon: LucideIcon;
  tint: string;
  iconColor: string;
}

const DEVICE_META: Record<DeviceType, DeviceMeta> = {
  laptop: {
    label: 'Máy tính xách tay (Laptop)',
    icon: Laptop,
    tint: 'bg-[var(--color-primary-tint)]',
    iconColor: 'text-[var(--color-primary)]',
  },
  monitor: {
    label: 'Màn hình máy tính (Monitor)',
    icon: Monitor,
    tint: 'bg-[var(--color-primary-tint)]',
    iconColor: 'text-[var(--color-primary)]',
  },
  keyboard: {
    label: 'Bàn phím làm việc (Keyboard)',
    icon: Keyboard,
    tint: 'bg-[#f3ebf8]',
    iconColor: 'text-[#6d28d9]',
  },
  mouse: {
    label: 'Chuột máy tính (Mouse)',
    icon: Mouse,
    tint: 'bg-[#e8f3ed]',
    iconColor: 'text-[#448361]',
  },
  other: {
    label: 'Thiết bị khác (Other)',
    icon: Layers,
    tint: 'bg-[#eeede9]',
    iconColor: 'text-[#5f5e5a]',
  },
};

const DEVICE_ORDER: DeviceType[] = ['laptop', 'monitor', 'keyboard', 'mouse', 'other'];

const validateReason = (value: string): string | null => {
  const length = value.trim().length;
  if (length < MIN_REASON_LENGTH) {
    return `Lý do yêu cầu quá ngắn (tối thiểu ${MIN_REASON_LENGTH} ký tự, hiện tại: ${length}).`;
  }
  if (length > MAX_REASON_LENGTH) {
    return `Lý do yêu cầu quá dài (tối đa ${MAX_REASON_LENGTH} ký tự, hiện tại: ${length}).`;
  }
  return null;
};

const validateQuantity = (value: number): string | null =>
  !Number.isInteger(value) || value < MIN_QUANTITY || value > MAX_QUANTITY
    ? `Số lượng phải là số nguyên từ ${MIN_QUANTITY} đến ${MAX_QUANTITY}.`
    : null;

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

const RequestListSkeleton: React.FC = () => (
  <div role="status" aria-live="polite" className="space-y-3">
    <span className="sr-only">Đang tải danh sách yêu cầu thiết bị từ máy chủ...</span>
    {[0, 1, 2].map((row) => (
      <div
        key={row}
        className="bg-white rounded-[4px] border border-[#d4d4d0] p-4 sm:p-5 animate-pulse motion-reduce:animate-none"
        aria-hidden="true"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-[4px] bg-[#eeede9] shrink-0" />
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-40 max-w-[60%] rounded-[2px] bg-[#eeede9]" />
              <div className="h-5 w-20 rounded-[4px] bg-[#eeede9]" />
            </div>
            <div className="h-2.5 w-full rounded-[2px] bg-[#f6f5f3]" />
            <div className="h-2.5 w-2/3 rounded-[2px] bg-[#f6f5f3]" />
            <div className="h-2.5 w-44 max-w-[70%] rounded-[2px] bg-[#eeede9]" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const DeviceRequestPage: React.FC = () => {
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  // Form states
  const [showForm, setShowForm] = useState<boolean>(false);
  const [deviceType, setDeviceType] = useState<DeviceType>('laptop');
  const [reason, setReason] = useState<string>('');
  const [quantityText, setQuantityText] = useState<string>('1');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const formTriggerRef = useRef<HTMLButtonElement>(null);
  const formHeadingRef = useRef<HTMLHeadingElement>(null);

  const quantityValue = quantityText.trim() === '' ? Number.NaN : Number(quantityText);

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

  useEffect(() => {
    if (showForm) formHeadingRef.current?.focus();
  }, [showForm]);

  const openForm = () => {
    setSuccessMessage(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    formTriggerRef.current?.focus();
  };

  const toggleForm = () => {
    if (showForm) closeForm();
    else openForm();
  };

  const handleReasonChange = (value: string) => {
    setReason(value);
    if (reasonError) setReasonError(validateReason(value));
  };

  const handleQuantityChange = (value: string) => {
    setQuantityText(value);
    if (quantityError) {
      setQuantityError(validateQuantity(value.trim() === '' ? Number.NaN : Number(value)));
    }
  };

  const stepQuantity = (delta: number) => {
    const base = Number.isFinite(quantityValue) ? quantityValue : MIN_QUANTITY;
    const next = Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(base) + delta));
    setQuantityText(String(next));
    setQuantityError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nextReasonError = validateReason(reason);
    const nextQuantityError = validateQuantity(quantityValue);
    setReasonError(nextReasonError);
    setQuantityError(nextQuantityError);
    if (nextReasonError || nextQuantityError) return;

    try {
      setIsSubmitting(true);
      const newReq = await createDeviceRequest({
        device_type: deviceType,
        reason: reason.trim(),
        quantity: quantityValue,
      });

      setSuccessMessage(`Đã gửi yêu cầu cấp thiết bị thành công (Mã yêu cầu: ${newReq.id})`);
      setReason('');
      setQuantityText('1');
      setDeviceType('laptop');
      setReasonError(null);
      setQuantityError(null);
      setShowForm(false);
      if (offset === 0) await loadRequests(0);
      else setOffset(0);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasRows = requests.length > 0;
  const showFullPager = !isLoading && !error && hasRows;
  const showBackOnly = !isLoading && !error && !hasRows && offset > 0;
  const canStepDown = Number.isFinite(quantityValue) && quantityValue > MIN_QUANTITY;
  const canStepUp = !Number.isFinite(quantityValue) || quantityValue < MAX_QUANTITY;
  const reasonLength = reason.trim().length;

  return (
    <div className="space-y-5 sm:space-y-6 w-full min-w-0">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-[#e4e3e0]">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#211f1b] tracking-tight">
            Yêu cầu cấp phát thiết bị IT
          </h1>
          <p className="text-xs sm:text-sm text-[#5f5e5a] mt-1">
            Gửi đề xuất thiết bị và theo dõi trạng thái các yêu cầu đã gửi.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadRequests(offset)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#211f1b] bg-white border border-[#e4e3e0] rounded-[6px] hover:bg-[#f1f1ef] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all min-h-[40px] disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#5f5e5a] ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Làm mới</span>
          </button>

          <button
            ref={formTriggerRef}
            type="button"
            onClick={toggleForm}
            aria-expanded={showForm}
            aria-controls="device-request-form"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] text-white text-xs font-semibold rounded-[6px] shadow-xs active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-all min-h-[40px]"
          >
            {showForm ? (
              <X className="w-4 h-4" aria-hidden="true" />
            ) : (
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{showForm ? 'Đóng biểu mẫu' : 'Gửi yêu cầu mới'}</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <Alert type="success" title="Thành công" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Device Request Form */}
      {showForm && (
        <section
          id="device-request-form"
          aria-labelledby="device-request-form-title"
          className="bg-white rounded-[8px] border border-[var(--color-primary)] shadow-sm overflow-hidden transition-all"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-5 pb-3.5 border-b border-[#e4e3e0] bg-[#fbfaf8]">
            <div className="min-w-0">
              <h2
                id="device-request-form-title"
                ref={formHeadingRef}
                tabIndex={-1}
                className="text-base font-bold text-[#211f1b] tracking-tight focus:outline-none"
              >
                Đề xuất cấp thiết bị làm việc
              </h2>
              <p className="text-xs text-[#5f5e5a] mt-0.5">
                Vui lòng nêu rõ lý do và nhu cầu sử dụng thực tế.
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-[4px] bg-[var(--color-primary-tint)] text-[var(--color-primary)] font-mono font-semibold border border-[var(--color-primary-border)]">
              POST /api/device-requests
            </span>
          </div>

          <div className="px-5 sm:px-6 py-5">
            {!!submitError && (
              <ErrorMessage
                error={submitError}
                title="Không thể gửi yêu cầu cấp thiết bị"
                className="mb-4 sm:mb-5"
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 sm:gap-5">
                {/* Device Type - icon cards */}
                <fieldset className="min-w-0">
                  <legend className="block text-xs font-bold text-[#211f1b] uppercase tracking-wider mb-2">
                    Loại thiết bị <span className="text-[#d44c47]" aria-hidden="true">*</span>
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {DEVICE_ORDER.map((type) => {
                      const meta = DEVICE_META[type];
                      const Icon = meta.icon;
                      const selected = deviceType === type;
                      return (
                        <label
                          key={type}
                          className={`flex items-center gap-2.5 min-h-[56px] p-2.5 rounded-[6px] border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:ring-offset-1 ${
                            selected
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary-tint)]/60 shadow-2xs font-semibold'
                              : 'border-[#e4e3e0] bg-white hover:border-[#d6d5d2] hover:bg-[#fbfaf8]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="device-type"
                            value={type}
                            checked={selected}
                            onChange={() => setDeviceType(type)}
                            className="sr-only"
                          />
                          <span
                            className={`w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 ${meta.tint}`}
                            aria-hidden="true"
                          >
                            <Icon className={`w-4 h-4 ${meta.iconColor}`} aria-hidden="true" />
                          </span>
                          <span className="text-xs leading-snug text-[#211f1b] min-w-0">
                            {meta.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Quantity stepper */}
                <div className="min-w-0">
                  <label
                    htmlFor="device-quantity"
                    className="block text-xs font-bold text-[#211f1b] uppercase tracking-wider mb-2"
                  >
                    Số lượng <span className="text-[#d44c47]" aria-hidden="true">*</span>
                  </label>
                  <div className="flex items-stretch gap-2">
                    <button
                      type="button"
                      onClick={() => stepQuantity(-1)}
                      disabled={!canStepDown}
                      aria-label="Bớt một thiết bị"
                      className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-[6px] border border-[#e4e3e0] bg-white text-[#211f1b] hover:bg-[#f1f1ef] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                    >
                      <Minus className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <input
                      id="device-quantity"
                      type="number"
                      inputMode="numeric"
                      min={MIN_QUANTITY}
                      max={MAX_QUANTITY}
                      step={1}
                      value={quantityText}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      onBlur={() => setQuantityError(validateQuantity(quantityValue))}
                      aria-invalid={!!quantityError}
                      aria-describedby={quantityError ? 'device-quantity-error' : 'device-quantity-hint'}
                      className={`w-16 h-11 text-center text-sm font-semibold rounded-[6px] border bg-[#fbfaf8] text-[#211f1b] focus:bg-white focus:outline-none focus:ring-2 ${
                        quantityError
                          ? 'border-[#f6c3c1] focus:ring-[#d44c47]'
                          : 'border-[#e4e3e0] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => stepQuantity(1)}
                      disabled={!canStepUp}
                      aria-label="Thêm một thiết bị"
                      className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-[6px] border border-[#e4e3e0] bg-white text-[#211f1b] hover:bg-[#f1f1ef] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <p id="device-quantity-hint" className="text-[11px] text-[#5f5e5a] mt-1.5">
                    Từ {MIN_QUANTITY} đến {MAX_QUANTITY} thiết bị.
                  </p>
                  <div aria-live="polite">
                    {quantityError && (
                      <p id="device-quantity-error" className="text-xs text-[#d44c47] mt-1 font-medium">
                        {quantityError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Reason - full width */}
                <div className="lg:col-span-2 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1.5">
                    <label
                      htmlFor="device-reason"
                      className="block text-xs font-bold text-[#211f1b] uppercase tracking-wider"
                    >
                      Lý do đề xuất <span className="text-[#d44c47]" aria-hidden="true">*</span>
                    </label>
                    <span
                      className={`text-[11px] font-mono ${
                        reasonLength > MAX_REASON_LENGTH ||
                        (reasonLength > 0 && reasonLength < MIN_REASON_LENGTH)
                          ? 'text-[#d44c47] font-semibold'
                          : 'text-[#5f5e5a]'
                      }`}
                    >
                      {reasonLength} / {MAX_REASON_LENGTH} ký tự (tối thiểu {MIN_REASON_LENGTH})
                    </span>
                  </div>
                  <textarea
                    id="device-reason"
                    rows={4}
                    placeholder="VD: Cần thêm màn hình phụ phục vụ lập trình giao diện hoặc thiết bị cũ bị hỏng..."
                    value={reason}
                    onChange={(e) => handleReasonChange(e.target.value)}
                    onBlur={() => setReasonError(validateReason(reason))}
                    maxLength={MAX_REASON_LENGTH + 100}
                    aria-invalid={!!reasonError}
                    aria-describedby={reasonError ? 'device-reason-error' : 'device-reason-hint'}
                    className={`w-full text-base sm:text-sm border rounded-[6px] p-3 focus:outline-none focus:ring-2 leading-relaxed bg-[#fbfaf8] focus:bg-white text-[#211f1b] transition-all ${
                      reasonError
                        ? 'border-[#f6c3c1] focus:ring-[#d44c47]'
                        : 'border-[#e4e3e0] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]'
                    }`}
                  />
                  <p id="device-reason-hint" className="text-[11px] text-[#5f5e5a] mt-1">
                    Mô tả ngắn gọn nhu cầu và bối cảnh sử dụng thiết bị.
                  </p>
                  <div aria-live="polite">
                    {reasonError && (
                      <p id="device-reason-error" className="text-xs text-[#d44c47] mt-1 font-medium">
                        {reasonError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Form actions */}
              <div className="sticky bottom-0 z-10 -mx-5 sm:mx-0 -mb-5 sm:mb-0 mt-2 px-5 py-3 sm:p-0 bg-white/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none border-t border-[#e4e3e0] sm:border-0 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-[#5f5e5a] bg-white border border-[#e4e3e0] rounded-[6px] hover:bg-[#f1f1ef] hover:text-[#211f1b] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors min-h-[40px]"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] text-white text-xs font-bold rounded-[6px] shadow-xs active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-all disabled:opacity-50 min-h-[40px]"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" aria-hidden="true" />
                      <span>Đang gửi đề xuất...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Gửi yêu cầu thiết bị</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Requests List */}
      <section aria-labelledby="device-request-list-title" aria-busy={isLoading} className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 id="device-request-list-title" className="text-sm font-bold text-[#211f1b] tracking-tight">
            Danh sách yêu cầu đã gửi
          </h2>
          <span className="text-[11px] text-[#5f5e5a]">Tối đa {PAGE_SIZE} yêu cầu mỗi trang</span>
        </div>

        {isLoading ? (
          <RequestListSkeleton />
        ) : error ? (
          <div className="[&_button]:min-h-[44px]">
            <ErrorMessage
              error={error}
              onRetry={() => void loadRequests(offset)}
              title="Không thể tải danh sách yêu cầu thiết bị"
            />
          </div>
        ) : !hasRows ? (
          <>
            <div className="[&_button]:min-h-[44px]">
              <EmptyState
                title="Chưa có yêu cầu cấp thiết bị nào"
                description="Bạn chưa gửi đề xuất cấp thiết bị nào. Hãy tạo yêu cầu đầu tiên để bộ phận IT xem xét và phản hồi."
                actionText="Gửi yêu cầu ngay"
                onAction={openForm}
                icon={<Laptop className="w-6 h-6 text-[#5f5e5a]" aria-hidden="true" />}
              />
            </div>
            {showBackOnly && (
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[4px] border border-[#d4d4d0] text-xs font-semibold text-[#211f1b] bg-white hover:bg-[#eeede9] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors min-h-[44px]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Trang trước</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <ul className="space-y-3">
            {requests.map((req) => {
              const meta = DEVICE_META[req.device_type] ?? DEVICE_META.other;
              const Icon = meta.icon;
              return (
                <li key={req.id}>
                  <article className="bg-white rounded-[8px] border border-[#e4e3e0] shadow-2xs p-4 sm:p-5 flex items-start gap-4 hover:border-[var(--color-primary-border)] hover:shadow-xs transition-all duration-200">
                    <span
                      className={`w-11 h-11 rounded-[8px] flex items-center justify-center shrink-0 ${meta.tint} shadow-2xs`}
                      aria-hidden="true"
                    >
                      <Icon className={`w-5 h-5 ${meta.iconColor}`} aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[#211f1b] leading-snug">
                            {meta.label}
                          </h3>
                          <p className="text-[11px] font-mono text-[#8a8884] mt-0.5 break-all">
                            ID: {req.id}
                          </p>
                        </div>
                        <StatusBadge status={req.status} />
                      </div>

                      <p className="text-xs text-[#5f5e5a] leading-relaxed line-clamp-2 break-words">
                        {req.reason}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#5f5e5a]">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#8a8884]" aria-hidden="true" />
                          <span>{formatDate(req.created_at)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-[#8a8884]" aria-hidden="true" />
                          <span>
                            Số lượng: <strong className="text-[#211f1b] font-bold">{req.quantity}</strong>
                          </span>
                        </span>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Pagination - only rendered when there is data (or a previous page to return to) */}
      {showFullPager && (
        <nav
          aria-label="Phân trang yêu cầu thiết bị"
          className="p-3 sm:p-4 bg-[#eeede9]/50 rounded-[4px] border border-[#d4d4d0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[#5f5e5a]"
        >
          <p>
            Hiển thị từ <span className="font-semibold text-[#211f1b]">{offset + 1}</span> đến{' '}
            <span className="font-semibold text-[#211f1b]">{offset + requests.length}</span> yêu cầu
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
              disabled={offset === 0}
              className={`inline-flex items-center justify-center gap-1 px-3 py-2 rounded-[4px] border text-xs font-semibold min-h-[44px] transition-colors ${
                offset === 0
                  ? 'border-[#d4d4d0] text-[#8c8a85] cursor-not-allowed bg-white/50'
                  : 'border-[#d4d4d0] text-[#211f1b] bg-white hover:bg-[#eeede9]'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Trang trước</span>
            </button>

            <button
              type="button"
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              disabled={requests.length < PAGE_SIZE}
              className={`inline-flex items-center justify-center gap-1 px-3 py-2 rounded-[4px] border text-xs font-semibold min-h-[44px] transition-colors ${
                requests.length < PAGE_SIZE
                  ? 'border-[#d4d4d0] text-[#8c8a85] cursor-not-allowed bg-white/50'
                  : 'border-[#d4d4d0] text-[#211f1b] bg-white hover:bg-[#eeede9]'
              }`}
            >
              <span>Trang sau</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};