// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  HelpCircle,
  Send,
  ShieldAlert,
  Tag,
} from 'lucide-react';
import { createTicket, getCategories, uploadAttachment } from '../services/api';
import { ATTACHMENT_TYPES, fileError } from '../lib/attachments';
import { Category, RequirementField, TicketPriority } from '../types/api';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from '../components/common/Alert';
import { ErrorMessage } from '../components/common/ErrorMessage';

const PRIORITY_ORDER: TicketPriority[] = ['low', 'normal', 'high', 'critical'];

const PRIORITY_META: Record<TicketPriority, { name: string; desc: string }> = {
  low: { name: 'Thấp', desc: 'Không gấp' },
  normal: { name: 'Bình thường', desc: 'Sự cố định kỳ' },
  high: { name: 'Cao', desc: 'Ảnh hưởng nhóm' },
  critical: { name: 'Khẩn cấp', desc: 'Toàn hệ thống' },
};

const isDateField = (field: RequirementField): boolean => field.key.toLowerCase().includes('until');

const fieldClass = (invalid: boolean): string =>
  [
    'w-full min-h-[44px] rounded-[6px] border bg-[#fbfaf8] px-3.5 py-2.5 text-sm text-[#211f1b]',
    'transition-all focus:bg-white focus:outline-none focus:ring-2',
    invalid
      ? 'border-[#f6c3c1] focus:border-[#d44c47] focus:ring-[#d44c47]'
      : 'border-[#e4e3e0] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]',
  ].join(' ');

const FieldError: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <p
    id={id}
    aria-live="polite"
    className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-danger"
  >
    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

const Legend: React.FC<{ step: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  step,
  icon,
  children,
}) => (
  <legend className="mb-3 flex w-full items-center gap-2 border-b border-edge-subtle pb-2">
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-primary-tint text-[10px] font-bold text-primary">
      {step}
    </span>
    {icon}
    <span className="text-[11px] font-bold uppercase tracking-wider text-content">{children}</span>
  </legend>
);

type ChecklistItem = {
  key: string;
  label: string;
  ready: boolean;
  required: boolean;
};

export const CreateTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const isManager = roles.includes('Manager');

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<unknown>(null);

  // Form states
  const [categoryId, setCategoryId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<unknown>(null);
  const [attachmentUploaded, setAttachmentUploaded] = useState(false);

  const sendFile = async (ticketId: string) => {
    if (!attachmentFile) return;
    setAttachmentError(null);
    try { await uploadAttachment(ticketId, attachmentFile); setAttachmentUploaded(true); }
    catch (err) { setAttachmentError(err); }
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchCategories() {
      try {
        setCategoriesLoading(true);
        const res = await getCategories();
        if (isMounted) {
          const catList = res.data || [];
          setCategories(catList);
          if (catList.length > 0) {
            setCategoryId(catList[0].id);
          }
        }
      } catch (err) {
        if (isMounted) setCategoriesError(err);
      } finally {
        if (isMounted) setCategoriesLoading(false);
      }
    }
    void fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const markTouched = (key: string) =>
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  const selectedCategory = categories.find((c) => c.id === categoryId) || null;
  const requirementFields: RequirementField[] = selectedCategory?.requirement_fields || [];

  const baseErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    if (!categoryId.trim()) {
      errors.categoryId = 'Vui lòng chọn danh mục sự cố IT.';
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 5) {
      errors.title = `Tiêu đề quá ngắn (tối thiểu 5 ký tự, hiện tại: ${trimmedTitle.length}).`;
    } else if (trimmedTitle.length > 200) {
      errors.title = `Tiêu đề quá dài (tối đa 200 ký tự, hiện tại: ${trimmedTitle.length}).`;
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 10) {
      errors.description = `Mô tả chi tiết quá ngắn (tối thiểu 10 ký tự, hiện tại: ${trimmedDesc.length}).`;
    } else if (trimmedDesc.length > 5000) {
      errors.description = `Mô tả quá dài (tối đa 5000 ký tự, hiện tại: ${trimmedDesc.length}).`;
    }

    if (priority === 'critical' && !isManager) {
      errors.priority = 'Chỉ tài khoản Quản lý (Manager) mới có quyền tạo phiếu mức Khẩn cấp.';
    }

    return errors;
  }, [categoryId, title, description, priority, isManager]);

  const missingRequiredFields = requirementFields.filter(
    (f) => f.required && !(fieldValues[f.key] || '').trim()
  );

  const missingFieldLabels: string[] = [];
  if (baseErrors.categoryId) missingFieldLabels.push('Danh mục sự cố');
  if (baseErrors.title) missingFieldLabels.push('Tiêu đề phiếu (từ 5 đến 200 ký tự)');
  if (baseErrors.description) missingFieldLabels.push('Mô tả chi tiết sự cố (từ 10 đến 5000 ký tự)');
  if (baseErrors.priority) missingFieldLabels.push('Mức ưu tiên (Khẩn cấp chỉ dành cho Quản lý)');
  for (const f of missingRequiredFields) {
    missingFieldLabels.push(`${f.label} (bắt buộc theo danh mục)`);
  }

  const canSubmit = Object.keys(baseErrors).length === 0 && missingRequiredFields.length === 0;

  const showBaseError = (key: string): boolean =>
    Boolean(baseErrors[key]) && (submitAttempted || Boolean(touched[key]));

  const showDynamicError = (field: RequirementField): boolean =>
    Boolean(field.required && !(fieldValues[field.key] || '').trim()) &&
    (submitAttempted || Boolean(touched[`req-${field.key}`]));

  const titleLength = title.trim().length;
  const descriptionLength = description.trim().length;

  const checklist = useMemo<ChecklistItem[]>(() => {
    const items: ChecklistItem[] = [
      {
        key: 'category',
        label: 'Danh mục sự cố',
        ready: Boolean(categoryId.trim()) && !baseErrors.categoryId,
        required: true,
      },
      {
        key: 'title',
        label: 'Tiêu đề phiếu',
        ready: !baseErrors.title,
        required: true,
      },
      {
        key: 'description',
        label: 'Mô tả chi tiết sự cố',
        ready: !baseErrors.description,
        required: true,
      },
    ];
    for (const f of requirementFields) {
      items.push({
        key: `field-${f.key}`,
        label: f.label,
        ready: Boolean((fieldValues[f.key] || '').trim()),
        required: f.required,
      });
    }
    return items;
  }, [categoryId, baseErrors, requirementFields, fieldValues]);

  const requiredChecklist = checklist.filter((item) => item.required);
  const completedRequired = requiredChecklist.filter((item) => item.ready).length;

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setFieldValues({});
  };

  const resetForm = () => {
    setSuccessTicketId(null);
    setAttachmentFile(null);
    setAttachmentError(null);
    setAttachmentUploaded(false);
    setTitle('');
    setDescription('');
    setPriority('normal');
    setFieldValues({});
    setSubmitAttempted(false);
    setTouched({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSubmitAttempted(true);

    if (!canSubmit) {
      return;
    }

    const filledValues = Object.fromEntries(
      Object.entries(fieldValues).filter(([, value]) => value.trim().length > 0)
    );

    try {
      setIsSubmitting(true);
      const ticket = await createTicket({
        category_id: categoryId.trim(),
        title: title.trim(),
        description: description.trim(),
        priority,
        ...(requirementFields.length > 0 ? { fields: filledValues } : {}),
      });

      setSuccessTicketId(ticket.id);
      await sendFile(ticket.id);
    } catch (err) {
      setServerError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 border-b border-edge pb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] px-1 text-xs font-semibold text-content-muted transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Quay lại</span>
        </button>
        <span className="hidden items-center gap-1.5 rounded-[4px] border border-edge-subtle bg-primary-subtle px-2 py-1 text-[11px] font-semibold text-primary sm:inline-flex">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
          Biểu mẫu tiếp nhận IT
        </span>
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-content sm:text-2xl">
          Tạo phiếu yêu cầu hỗ trợ IT
        </h1>
        <p className="mt-1 text-xs text-content-muted sm:text-sm">
          Điền đầy đủ thông tin để bộ phận IT tiếp nhận và phân loại xử lý kịp thời.
        </p>
      </div>

      {successTicketId ? (
        <div className="mx-auto max-w-2xl space-y-4 rounded-[8px] border border-[#b8dcce] bg-white p-6 text-center shadow-xs sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] border border-[#b8dcce] bg-[#edf3ec] text-[#448361] shadow-2xs">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-[#211f1b] sm:text-xl">
            Tạo phiếu yêu cầu thành công!
          </h2>
          <p className="mx-auto max-w-md text-xs leading-relaxed text-[#5f5e5a] sm:text-sm">
            Phiếu của bạn đã được ghi nhận vào hệ thống với mã định danh{' '}
            <code className="break-all rounded-[4px] border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] px-2 py-0.5 font-mono font-bold text-[var(--color-primary)]">
              {successTicketId}
            </code>
            . Đội ngũ kỹ thuật IT sẽ xem xét theo mức ưu tiên đã định.
          </p>
          {attachmentFile && <div aria-live="polite">
            {isSubmitting ? <p>Phiếu đã được tạo. Đang quét và tải tệp…</p> : attachmentUploaded
              ? <p>Tệp {attachmentFile.name} đã được quét và lưu an toàn.</p>
              : <div>
                {attachmentError != null && <ErrorMessage error={attachmentError} title="Phiếu đã tạo; tệp chưa tải thành công" />}
                <button type="button" className="text-teal-700 underline" disabled={isSubmitting}
                  onClick={async () => { setIsSubmitting(true); try { await sendFile(successTicketId); } finally { setIsSubmitting(false); } }}>
                  Thử tải lại tệp vào phiếu này
                </button>
              </div>}
          </div>}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(`/tickets/${successTicketId}`)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[6px] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)] px-5 text-xs font-bold text-white shadow-xs transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              Xem chi tiết phiếu
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-[#e4e3e0] bg-white px-5 text-xs font-semibold text-[#211f1b] transition-all hover:bg-[#f1f1ef] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              Tạo phiếu khác
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main form */}
          <div className="min-w-0">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-[8px] border border-[#e4e3e0] bg-white shadow-2xs"
            >
              <div className="space-y-6 p-4 sm:p-6">
                {!!serverError && (
                  <ErrorMessage
                    error={serverError}
                    title="Không thể tạo phiếu yêu cầu"
                    className="mb-2"
                  />
                )}

                {!!categoriesError && (
                  <Alert type="error" title="Lỗi tải danh mục">
                    Không thể tải danh sách danh mục từ máy chủ. Vui lòng tải lại trang.
                  </Alert>
                )}

                {/* 1. Category */}
                <fieldset className="min-w-0">
                  <Legend
                    step="1"
                    icon={<Tag className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                  >
                    Phân loại sự cố
                  </Legend>

                  <label
                    htmlFor="ticket-category"
                    className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-content"
                  >
                    Danh mục sự cố <span className="text-danger" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="ticket-category"
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    onBlur={() => markTouched('categoryId')}
                    disabled={categoriesLoading}
                    aria-invalid={showBaseError('categoryId') || undefined}
                    aria-describedby={
                      showBaseError('categoryId') ? 'ticket-category-error' : undefined
                    }
                    className={`${fieldClass(showBaseError('categoryId'))} cursor-pointer disabled:cursor-wait disabled:bg-surface-muted`}
                  >
                    {categoriesLoading && <option value="">Đang tải danh mục...</option>}
                    {!categoriesLoading && categories.length === 0 && (
                      <option value="">Không có danh mục nào trên hệ thống</option>
                    )}
                    {!categoriesLoading &&
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.code})
                        </option>
                      ))}
                  </select>
                  {showBaseError('categoryId') && (
                    <FieldError id="ticket-category-error">{baseErrors.categoryId}</FieldError>
                  )}
                </fieldset>

                {/* Dynamic requirement fields */}
                {requirementFields.length > 0 && (
                  <fieldset className="min-w-0 rounded-[4px] border border-edge bg-surface-muted/60 p-4">
                    <legend className="flex items-center gap-1.5 rounded-[4px] bg-white px-1.5 py-0.5">
                      <ClipboardList className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-content">
                        Thông tin bổ sung theo danh mục
                      </span>
                    </legend>
                    <p className="mb-3 text-[11px] text-content-muted">
                      Các trường có dấu <span className="font-semibold text-danger">*</span> là bắt
                      buộc theo danh mục đã chọn.
                    </p>

                    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                      {requirementFields.map((field) => {
                        const value = fieldValues[field.key] || '';
                        const invalid = showDynamicError(field);
                        return (
                          <div key={field.key} className="min-w-0">
                            <label
                              htmlFor={`requirement-${field.key}`}
                              className="mb-1.5 flex flex-wrap items-center gap-1 text-xs font-semibold text-content"
                            >
                              <span className="break-words">{field.label}</span>
                              {field.required ? (
                                <span className="text-danger" aria-hidden="true">*</span>
                              ) : (
                                <span className="text-[10px] font-normal text-content-subtle">
                                  (không bắt buộc)
                                </span>
                              )}
                            </label>
                            <input
                              id={`requirement-${field.key}`}
                              name={field.key}
                              type={isDateField(field) ? 'date' : 'text'}
                              required={field.required}
                              value={value}
                              onChange={(e) =>
                                setFieldValues((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              onBlur={() => markTouched(`req-${field.key}`)}
                              aria-required={field.required}
                              aria-invalid={invalid || undefined}
                              aria-describedby={
                                invalid ? `requirement-${field.key}-error` : undefined
                              }
                              placeholder={
                                isDateField(field) ? '' : `VD: nội dung cho "${field.label}"`
                              }
                              className={fieldClass(invalid)}
                            />
                            {invalid && (
                              <FieldError id={`requirement-${field.key}-error`}>
                                Vui lòng nhập “{field.label}” (trường bắt buộc của danh mục).
                              </FieldError>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                {/* 2. Content */}
                <fieldset className="min-w-0">
                  <Legend
                    step="2"
                    icon={<ClipboardList className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                  >
                    Nội dung sự cố
                  </Legend>

                  <div className="space-y-4">
                    <div>
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
                        <label
                          htmlFor="ticket-title"
                          className="flex items-center gap-1 text-xs font-semibold text-content"
                        >
                          Tiêu đề phiếu <span className="text-danger" aria-hidden="true">*</span>
                        </label>
                        <span
                          className={`font-mono text-[11px] ${
                            titleLength > 200 || (titleLength > 0 && titleLength < 5)
                              ? 'font-semibold text-danger'
                              : 'text-content-subtle'
                          }`}
                        >
                          {titleLength}/200
                        </span>
                      </div>
                      <input
                        id="ticket-title"
                        type="text"
                        placeholder="VD: Không thể kết nối máy in phòng Kế toán tầng 3"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => markTouched('title')}
                        maxLength={250}
                        aria-invalid={showBaseError('title') || undefined}
                        aria-describedby={showBaseError('title') ? 'ticket-title-error' : undefined}
                        className={fieldClass(showBaseError('title'))}
                      />
                      {showBaseError('title') && (
                        <FieldError id="ticket-title-error">{baseErrors.title}</FieldError>
                      )}
                    </div>

                    <div>
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
                        <label
                          htmlFor="ticket-description"
                          className="flex items-center gap-1 text-xs font-semibold text-content"
                        >
                          Mô tả chi tiết sự cố{' '}
                          <span className="text-danger" aria-hidden="true">*</span>
                        </label>
                        <span
                          className={`font-mono text-[11px] ${
                            descriptionLength > 5000 ||
                            (descriptionLength > 0 && descriptionLength < 10)
                              ? 'font-semibold text-danger'
                              : 'text-content-subtle'
                          }`}
                        >
                          {descriptionLength}/5000
                        </span>
                      </div>
                      <textarea
                        id="ticket-description"
                        rows={5}
                        placeholder="Mô tả hiện tượng lỗi, thông báo lỗi nếu có, thời điểm xảy ra và các bước đã thử xử lý..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={() => markTouched('description')}
                        maxLength={5500}
                        aria-invalid={showBaseError('description') || undefined}
                        aria-describedby={
                          showBaseError('description') ? 'ticket-description-error' : undefined
                        }
                        className={`${fieldClass(showBaseError('description'))} min-h-[112px] leading-relaxed`}
                      />
                      {showBaseError('description') && (
                        <FieldError id="ticket-description-error">
                          {baseErrors.description}
                        </FieldError>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* 3. Priority */}
                <fieldset className="min-w-0">
                  <Legend
                    step="3"
                    icon={<Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                  >
                    Mức độ ưu tiên
                  </Legend>

                  <div
                    role="group"
                    aria-label="Mức độ ưu tiên"
                    aria-describedby={!isManager ? 'critical-priority-hint' : undefined}
                    className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
                  >
                    {PRIORITY_ORDER.map((p) => {
                      const isCritical = p === 'critical';
                      const locked = isCritical && !isManager;
                      const isSelected = priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={locked}
                          aria-disabled={locked ? 'true' : undefined}
                          aria-pressed={isSelected}
                          onClick={() => setPriority(p)}
                          className={`min-h-[58px] rounded-[6px] border p-3 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary ${
                            locked
                              ? 'cursor-not-allowed border-edge bg-surface-muted/70 opacity-50'
                              : isSelected
                                ? isCritical
                                  ? 'border-danger bg-danger-tint shadow-xs'
                                  : 'border-primary bg-primary-tint shadow-xs'
                                : 'border-edge bg-white hover:border-edge-strong hover:bg-surface-warm/40'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs font-bold ${
                                isSelected
                                  ? isCritical
                                    ? 'text-[#962824]'
                                    : 'text-primary'
                                  : 'text-content'
                              }`}
                            >
                              {PRIORITY_META[p].name}
                            </span>
                            {locked && (
                              <ShieldAlert
                                className="h-3.5 w-3.5 shrink-0 text-content-muted"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <span className="mt-1 block text-[11px] leading-snug text-content-muted">
                            {PRIORITY_META[p].desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {!isManager && (
                    <p
                      id="critical-priority-hint"
                      className="mt-2 flex items-start gap-1.5 text-[11px] text-content-muted"
                    >
                      <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Mức "Khẩn cấp" chỉ dành riêng cho tài khoản Quản lý (Manager).
                      </span>
                    </p>
                  )}
                  {baseErrors.priority && (
                    <FieldError id="ticket-priority-error">{baseErrors.priority}</FieldError>
                  )}
                </fieldset>

                {/* Error summary */}
                {missingFieldLabels.length > 0 && (
                  <div
                    id="missing-fields-summary"
                    aria-live="polite"
                    className="rounded-[4px] border border-warning-border bg-warning-tint p-3 text-xs text-[#7c5108]"
                  >
                    <p className="flex items-start gap-1.5 font-semibold">
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                        aria-hidden="true"
                      />
                      <span>Chưa thể gửi phiếu — còn thiếu hoặc chưa hợp lệ:</span>
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {missingFieldLabels.map((label) => (
                        <li
                          key={label}
                          className="rounded-[4px] border border-warning-border bg-white/70 px-2 py-0.5"
                        >
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mx-4 mb-4 rounded-lg border border-edge bg-surface-muted p-3 text-xs sm:mx-6">
                <label htmlFor="ticket-attachment" className="block font-semibold">Ảnh hoặc tệp đính kèm (không bắt buộc)</label>
                <p>PNG, JPEG, PDF, TXT; tối đa 10 MiB. Phiếu được tạo trước khi quét và lưu tệp.</p>
                <input id="ticket-attachment" type="file" accept={ATTACHMENT_TYPES.join(',')}
                  disabled={isSubmitting} onChange={event => {
                    const file = event.target.files?.[0] ?? null;
                    const issue = file ? fileError(file) : null;
                    setAttachmentError(issue ? new Error(issue) : null);
                    setAttachmentFile(issue ? null : file);
                  }} />
                {attachmentError != null && <ErrorMessage error={attachmentError} title="Tệp chưa hợp lệ" />}
              </div>

              {/* Action bar: sticky bottom on mobile, inline on desktop */}
              <div className="sticky bottom-0 z-20 flex items-center gap-2.5 border-t border-edge bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:static lg:bg-surface-warm/30 rounded-b-[8px]">
                <p className="mr-auto hidden text-[11px] text-content-muted lg:block">
                  Mục có dấu <span className="font-semibold text-danger">*</span> là bắt buộc.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[6px] border border-edge bg-white px-4 text-xs font-semibold text-content-muted transition-all hover:bg-surface-warm hover:text-content focus:outline-none focus:ring-2 focus:ring-primary lg:min-h-[40px]"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || categoriesLoading}
                  aria-disabled={!canSubmit}
                  aria-busy={isSubmitting || undefined}
                  aria-describedby={
                    missingFieldLabels.length > 0 ? 'missing-fields-summary' : undefined
                  }
                  className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[6px] px-5 text-xs font-bold text-white shadow-xs transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:flex-none lg:min-h-[40px] ${
                    canSubmit && !isSubmitting && !categoriesLoading
                      ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-primary-active)]'
                      : 'cursor-not-allowed bg-primary opacity-50'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                        aria-hidden="true"
                      />
                      <span>Đang gửi phiếu...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      <span>Gửi phiếu hỗ trợ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Summary panel */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-[8px] border border-edge bg-white shadow-2xs overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-edge-subtle bg-surface-warm/60 px-4 py-3">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-content-muted">
                  Tóm tắt phiếu
                </h2>
                <span className="font-mono text-[11px] font-semibold text-primary bg-primary-tint px-2 py-0.5 rounded-[4px] border border-[var(--color-primary-border)]">
                  {completedRequired}/{requiredChecklist.length} bắt buộc
                </span>
              </div>

              <dl className="divide-y divide-edge-subtle">
                <div className="px-4 py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                    Danh mục
                  </dt>
                  <dd className="mt-1 flex min-w-0 items-center gap-2">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words text-xs font-semibold text-content">
                      {selectedCategory ? selectedCategory.name : 'Chưa chọn'}
                    </span>
                    {selectedCategory && (
                      <span className="shrink-0 rounded-[4px] border border-edge bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-content-muted">
                        {selectedCategory.code}
                      </span>
                    )}
                  </dd>
                </div>

                <div className="px-4 py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                    Mức ưu tiên
                  </dt>
                  <dd className="mt-1 flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-xs font-semibold text-primary">
                      {PRIORITY_META[priority].name}
                    </span>
                  </dd>
                </div>

                <div className="px-4 py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                    Tiến độ điền phiếu
                  </dt>
                  <dd className="mt-1.5">
                    <ul className="space-y-1.5">
                      {checklist.map((item) => (
                        <li key={item.key} className="flex items-start gap-2 text-[11px]">
                          {item.ready ? (
                            <Check
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                              aria-hidden="true"
                            />
                          ) : (
                            <span
                              className="mt-1 h-3 w-3 shrink-0 rounded-full border border-edge-strong"
                              aria-hidden="true"
                            />
                          )}
                          <span className={item.ready ? 'text-content' : 'text-content-muted'}>
                            {item.label}
                          </span>
                          {item.required && (
                            <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-content-subtle">
                              bắt buộc
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-[4px] border border-edge bg-surface-muted/60 p-4">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-content">
                <HelpCircle className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Mẹo viết phiếu nhanh được xử lý</span>
              </h2>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-content-muted">
                <li className="flex gap-1.5">
                  <span aria-hidden="true">•</span>
                  <span>Ghi rõ vị trí làm việc (phòng, tầng, số bàn).</span>
                </li>
                <li className="flex gap-1.5">
                  <span aria-hidden="true">•</span>
                  <span>Mô tả chính xác thông báo lỗi xuất hiện trên màn hình.</span>
                </li>
                <li className="flex gap-1.5">
                  <span aria-hidden="true">•</span>
                  <span>Nêu thời điểm xảy ra lỗi và việc lỗi có lặp lại hay không.</span>
                </li>
                <li className="flex gap-1.5">
                  <span aria-hidden="true">•</span>
                  <span>
                    Tệp đính kèm chưa khả dụng trong phiên bản này — vui lòng mô tả lỗi bằng văn
                    bản.
                  </span>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};