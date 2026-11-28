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
import { getDeviceRequests, createDeviceRequest, getDeviceHandoverDownload } from '../../../services/api';
import { DeviceRequest, DeviceType } from '../../../types/api';
import { StatusBadge } from '../../../components/common/Badge';
import { ErrorMessage } from '../../../components/common/ErrorMessage';
import { EmptyState } from '../../../components/common/EmptyState';
import { Alert } from '../../../components/common/Alert';
import { Button } from '../../../components/common/Button';
import { Skeleton, SkeletonText } from '../../../components/common/Skeleton';
import { DeviceWorkflowStepper } from '../../../components/workflow';

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
    iconColor: 'text-[var(--color-primary-ink)]',
  },
  monitor: {
    label: 'Màn hình máy tính (Monitor)',
    icon: Monitor,
    tint: 'bg-[var(--color-primary-tint)]',
    iconColor: 'text-[var(--color-primary-ink)]',
  },
  keyboard: {
    label: 'Bàn phím làm việc (Keyboard)',
    icon: Keyboard,
    tint: 'bg-status-pending-bg',
    iconColor: 'text-status-pending',
  },
  mouse: {
    label: 'Chuột máy tính (Mouse)',
    icon: Mouse,
    tint: 'bg-status-success-bg',
    iconColor: 'text-status-success',
  },
  other: {
    label: 'Thiết bị khác (Other)',
    icon: Layers,
    tint: 'bg-[var(--color-surface-muted)]',
    iconColor: 'text-[var(--color-content-muted)]',
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
  <div role="status" className="space-y-3">
    <span className="sr-only">Đang tải danh sách yêu cầu thiết bị từ máy chủ...</span>
    {[0, 1, 2].map((row) => (
      <div key={row} className="flex items-start gap-3 rounded-lg border border-edge bg-surface p-4 sm:p-5">
        <Skeleton decorative className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton decorative className="h-3 w-40 max-w-[60%]" />
            <Skeleton decorative className="h-5 w-20" />
          </div>
          <SkeletonText decorative lines={2} lineHeight="h-2.5" lastLineWidth="66%" />
          <Skeleton decorative className="h-2.5 w-44 max-w-[70%]" />
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
  // Liên kết tải biên bản là liên kết đã ký, ngắn hạn; chỉ xin khi người dùng bấm tải.
  const [handoverLinks, setHandoverLinks] = useState<Record<string, string>>({});
  const [handoverBusyId, setHandoverBusyId] = useState<string | null>(null);
  const [handoverError, setHandoverError] = useState<unknown>(null);

  const formTriggerRef = useRef<HTMLButtonElement>(null);
  const formHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestRevision = useRef(0);

  const quantityValue = quantityText.trim() === '' ? Number.NaN : Number(quantityText);

  const loadRequests = useCallback(async (currentOffset: number) => {
    const revision = ++requestRevision.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getDeviceRequests(PAGE_SIZE, currentOffset);
      if (revision !== requestRevision.current) return;
      setRequests(res.data || []);
    } catch (err) {
      if (revision !== requestRevision.current) return;
      setError(err);
    } finally {
      if (revision === requestRevision.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests(offset);
    return () => {
      requestRevision.current += 1;
    };
  }, [loadRequests, offset]);

  const requestHandoverLink = async (id: string) => {
    setHandoverBusyId(id);
    setHandoverError(null);
    try {
      const { url } = await getDeviceHandoverDownload(id);
      setHandoverLinks((prev) => ({ ...prev, [id]: url }));
    } catch (err) {
      setHandoverError(err);
    } finally {
      setHandoverBusyId(null);
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-[var(--color-edge-subtle)]">
        <div className="min-w-0">
          <h1 className="dx-page-title">
            Yêu cầu cấp phát thiết bị IT
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-content-muted)] mt-1">
            Gửi đề xuất thiết bị và theo dõi trạng thái các yêu cầu đã gửi.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => void loadRequests(offset)}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin motion-reduce:animate-none' : ''}`} />}
          >
            Làm mới
          </Button>

          <Button
            ref={formTriggerRef}
            onClick={toggleForm}
            aria-expanded={showForm}
            aria-controls="device-request-form"
            leftIcon={showForm ? <X className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
          >
            {showForm ? 'Đóng biểu mẫu' : 'Gửi yêu cầu mới'}
          </Button>
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
          className="overflow-hidden rounded-lg border border-edge bg-surface"
        >
          <div className="border-b border-edge bg-surface-muted px-5 pb-3.5 pt-4 sm:px-6 sm:pt-5">
            <div className="min-w-0">
              <h2
                id="device-request-form-title"
                ref={formHeadingRef}
                tabIndex={-1}
                className="dx-section-title focus-visible:outline-none"
              >
                Đề xuất cấp thiết bị làm việc
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-content-muted">
                Vui lòng nêu rõ lý do và nhu cầu sử dụng thực tế.
              </p>
            </div>
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
                  <legend className="mb-2 block text-[0.8125rem] font-medium text-content">
                    Loại thiết bị <span className="text-status-danger" aria-hidden="true">*</span>
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {DEVICE_ORDER.map((type) => {
                      const meta = DEVICE_META[type];
                      const Icon = meta.icon;
                      const selected = deviceType === type;
                      return (
                        <label
                          key={type}
                          className={`flex items-center gap-2.5 min-h-[56px] p-2.5 rounded-md border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:ring-offset-1 ${
                            selected
                              ? 'border-primary bg-primary-tint font-semibold'
                              : 'border-edge bg-surface hover:border-edge-strong hover:bg-state-hover'
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
                            className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${meta.tint}`}
                            aria-hidden="true"
                          >
                            <Icon className={`w-4 h-4 ${meta.iconColor}`} aria-hidden="true" />
                          </span>
                          <span className={`text-[0.8125rem] leading-snug min-w-0 ${selected ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-content)]'}`}>
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
                    className="mb-2 block text-[0.8125rem] font-medium text-content"
                  >
                    Số lượng <span className="text-status-danger" aria-hidden="true">*</span>
                  </label>
                  <div className="flex items-stretch gap-2">
                    <button
                      type="button"
                      onClick={() => stepQuantity(-1)}
                      disabled={!canStepDown}
                      aria-label="Bớt một thiết bị"
                      className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md border border-edge-strong bg-surface text-content hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                      className={`w-16 h-11 text-center text-sm font-semibold rounded-md border bg-[var(--color-surface-sidebar)] text-[var(--color-content)] focus:bg-surface focus-visible:outline-none focus-visible:ring-2 ${
                        quantityError
                          ? 'border-status-danger focus-visible:ring-status-danger'
                          : 'border-[var(--color-edge-subtle)] focus-visible:ring-[var(--color-primary)] focus:border-[var(--color-primary)]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => stepQuantity(1)}
                      disabled={!canStepUp}
                      aria-label="Thêm một thiết bị"
                      className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md border border-edge-strong bg-surface text-content hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <p id="device-quantity-hint" className="text-xs text-[var(--color-content-muted)] mt-1.5">
                    Từ {MIN_QUANTITY} đến {MAX_QUANTITY} thiết bị.
                  </p>
                  <div aria-live="polite">
                    {quantityError && (
                      <p id="device-quantity-error" className="text-xs text-status-danger mt-1 font-medium">
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
                      className="block text-[0.8125rem] font-medium text-content"
                    >
                      Lý do đề xuất <span className="text-status-danger" aria-hidden="true">*</span>
                    </label>
                    <span
                      className={`text-xs tabular-nums ${
                        reasonLength > MAX_REASON_LENGTH ||
                        (reasonLength > 0 && reasonLength < MIN_REASON_LENGTH)
                          ? 'text-status-danger font-semibold'
                          : 'text-[var(--color-content-muted)]'
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
                    className={`w-full text-base sm:text-sm border rounded-md p-3 focus-visible:outline-none focus-visible:ring-2 leading-relaxed bg-[var(--color-surface-sidebar)] focus:bg-surface text-[var(--color-content)] transition-colors ${
                      reasonError
                        ? 'border-status-danger focus-visible:ring-status-danger'
                        : 'border-[var(--color-edge-subtle)] focus-visible:ring-[var(--color-primary)] focus:border-[var(--color-primary)]'
                    }`}
                  />
                  <p id="device-reason-hint" className="text-xs text-[var(--color-content-muted)] mt-1">
                    Mô tả ngắn gọn nhu cầu và bối cảnh sử dụng thiết bị.
                  </p>
                  <div aria-live="polite">
                    {reasonError && (
                      <p id="device-reason-error" className="text-xs text-status-danger mt-1 font-medium">
                        {reasonError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Form actions */}
              <div className="sticky bottom-0 z-10 -mx-5 sm:mx-0 -mb-5 sm:mb-0 mt-2 px-5 py-3 sm:p-0 bg-surface sm:bg-transparent border-t border-[var(--color-edge-subtle)] sm:border-0 flex items-center justify-end gap-3">
                <Button variant="secondary" className="flex-1 sm:flex-none" onClick={closeForm}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  className="flex-1 sm:flex-none"
                  isLoading={isSubmitting}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  {isSubmitting ? 'Đang gửi đề xuất...' : 'Gửi yêu cầu thiết bị'}
                </Button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Requests List */}
      <section aria-labelledby="device-request-list-title" aria-busy={isLoading} className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 id="device-request-list-title" className="dx-section-title">
            Danh sách yêu cầu đã gửi
          </h2>
          <span className="text-xs text-[var(--color-content-muted)]">Tối đa {PAGE_SIZE} yêu cầu mỗi trang</span>
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
                headingLevel={3}
                title="Chưa có yêu cầu cấp thiết bị nào"
                description="Bạn chưa gửi đề xuất cấp thiết bị nào. Hãy tạo yêu cầu đầu tiên để bộ phận IT xem xét và phản hồi."
                actionText="Gửi yêu cầu ngay"
                onAction={openForm}
                icon={<Laptop className="w-6 h-6 text-[var(--color-content-muted)]" aria-hidden="true" />}
              />
            </div>
            {showBackOnly && (
              <div className="flex justify-center mt-3">
                <Button
                  variant="secondary"
                  onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  Trang trước
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
          {handoverError != null && (
            <div className="mb-3">
              <ErrorMessage error={handoverError} title="Không lấy được biên bản bàn giao" />
            </div>
          )}
          <ul className="space-y-3">
            {requests.map((req) => {
              const meta = DEVICE_META[req.device_type] ?? DEVICE_META.other;
              const Icon = meta.icon;
              return (
                <li key={req.id}>
                  <article className="flex items-start gap-4 rounded-lg border border-edge bg-surface p-4 sm:p-5">
                    <span
                      className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${meta.tint}`}
                      aria-hidden="true"
                    >
                      <Icon className={`w-5 h-5 ${meta.iconColor}`} aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[var(--color-content)] leading-snug">
                            {meta.label}
                          </h3>
                          {/* Mã ngắn như mã phiếu; mã đầy đủ chỉ ở thuộc tính title để sao chép khi cần. */}
                          <p className="mt-0.5 text-xs text-content-muted">
                            Mã yêu cầu{' '}
                            <span data-numeric title={req.id} className="font-mono">#{req.id.slice(0, 8)}</span>
                          </p>
                        </div>
                        <StatusBadge status={req.status} />
                      </div>

                      <p className="text-[0.8125rem] text-content-muted leading-relaxed line-clamp-2 break-words">
                        {req.reason}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--color-content-muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[var(--color-content-subtle)]" aria-hidden="true" />
                          <span>{formatDate(req.created_at)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-[var(--color-content-subtle)]" aria-hidden="true" />
                          <span>
                            Số lượng: <strong className="text-[var(--color-content)] font-semibold">{req.quantity}</strong>
                          </span>
                        </span>
                      </div>

                      <div className="pt-2">
                        <DeviceWorkflowStepper
                          request={req}
                          handoverUrl={handoverLinks[req.id]}
                          isDownloading={handoverBusyId === req.id}
                          onDownloadHandover={() => void requestHandoverLink(req.id)}
                        />
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </section>

      {/* Pagination - only rendered when there is data (or a previous page to return to) */}
      {showFullPager && (
        <nav
          aria-label="Phân trang yêu cầu thiết bị"
          className="flex flex-col gap-3 text-[0.8125rem] text-content-muted sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            Hiển thị từ <span className="font-semibold text-[var(--color-content)]">{offset + 1}</span> đến{' '}
            <span className="font-semibold text-[var(--color-content)]">{offset + requests.length}</span> yêu cầu
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
              disabled={offset === 0}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
            >
              Trang trước
            </Button>
            <Button
              variant="secondary"
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              disabled={requests.length < PAGE_SIZE}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Trang sau
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
};
