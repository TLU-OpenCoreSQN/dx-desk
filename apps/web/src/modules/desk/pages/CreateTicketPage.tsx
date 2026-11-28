// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  HelpCircle,
  Paperclip,
  Send,
  ShieldAlert,
  Tag,
  X,
} from 'lucide-react';
import { createTicket, getCategories, uploadAttachment } from '../../../services/api';
import { ATTACHMENT_TYPES, fileError } from '../../../lib/attachments';
import { Category, RequirementField, TicketPriority } from '../../../types/api';
import { useAuth } from '../../../contexts/AuthContext';
import { Alert } from '../../../components/common/Alert';
import { Button, buttonClass } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { ErrorMessage } from '../../../components/common/ErrorMessage';
import { FieldError, fieldClass } from '../../../components/common/FormField';
import { CategorySelector } from '../../../components/create-ticket/CategorySelector';
import { DynamicRequirementFields } from '../../../components/create-ticket/DynamicRequirementFields';
import { KnowledgeInlineHelper } from '../../../components/create-ticket/KnowledgeInlineHelper';
import { CreateTicketDraft, readDraft, removeDraft, writeDraft } from '../../../lib/ticketDraft';


const PRIORITY_ORDER: TicketPriority[] = ['low', 'normal', 'high', 'critical'];

const PRIORITY_META: Record<TicketPriority, { name: string; desc: string }> = {
  low: { name: 'Thấp', desc: 'Không gấp' },
  normal: { name: 'Bình thường', desc: 'Sự cố định kỳ' },
  high: { name: 'Cao', desc: 'Ảnh hưởng nhóm' },
  critical: { name: 'Khẩn cấp', desc: 'Toàn hệ thống' },
};

const Legend: React.FC<{ step: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  step,
  icon,
  children,
}) => (
  <legend className="mb-3 flex w-full items-center gap-2 border-b border-edge-subtle pb-2">
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary-tint text-xs font-semibold text-[var(--color-primary-text)]">
      {step}
    </span>
    {icon}
    <span className="text-[0.8125rem] font-semibold text-content">{children}</span>
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
  const { roles, profile } = useAuth();
  const isManager = roles.includes('Manager');
  // Bản nháp gắn với id người dùng để tài khoản khác trên cùng máy không đọc được.
  const draftUserId = profile?.id;

  // Chỉ khôi phục một lần khi mở trang.
  const initialDraft = useMemo<CreateTicketDraft | null>(() => readDraft(draftUserId), []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<unknown>(null);

  // Form states with draft restoration
  const [categoryId, setCategoryId] = useState<string>(initialDraft?.categoryId || '');
  const [title, setTitle] = useState<string>(initialDraft?.title || '');
  const [description, setDescription] = useState<string>(initialDraft?.description || '');
  const [priority, setPriority] = useState<TicketPriority>(() => {
    if (initialDraft?.priority) {
      if (initialDraft.priority === 'critical' && !isManager) {
        return 'normal';
      }
      return initialDraft.priority;
    }
    return 'normal';
  });
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    initialDraft?.fieldValues || {}
  );
  const [restoredBannerVisible, setRestoredBannerVisible] = useState<boolean>(() => {
    return Boolean(
      initialDraft &&
        (initialDraft.title ||
          initialDraft.description ||
          Object.keys(initialDraft.fieldValues || {}).length > 0)
    );
  });

  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Mỗi lần gửi không hợp lệ tăng bộ đếm để đưa tiêu điểm tới bảng tóm tắt lỗi.
  const [failedSubmits, setFailedSubmits] = useState(0);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (failedSubmits > 0) errorSummaryRef.current?.focus();
  }, [failedSubmits]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pickAttachment = (file: File | null) => {
    const issue = file ? fileError(file) : null;
    setAttachmentError(issue ? new Error(issue) : null);
    setAttachmentFile(issue ? null : file);
  };
  const [attachmentError, setAttachmentError] = useState<unknown>(null);
  const [attachmentUploaded, setAttachmentUploaded] = useState(false);

  const isFirstMount = useRef(true);
  // Lần lưu đang chờ debounce; được gọi ngay khi rời trang để không mất nội dung vừa gõ.
  const pendingSave = useRef<(() => void) | null>(null);

  // Auto-save draft with 800ms debounce
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (successTicketId) {
      pendingSave.current = null;
      return;
    }

    const save = () => {
      pendingSave.current = null;
      const hasContent =
        title.trim().length > 0 ||
        description.trim().length > 0 ||
        Object.values(fieldValues).some((v) => v.trim().length > 0);

      if (hasContent) {
        writeDraft(draftUserId, {
          categoryId,
          title,
          description,
          priority,
          fieldValues,
          savedAt: new Date().toISOString(),
        });
      } else {
        removeDraft(draftUserId);
      }
    };
    pendingSave.current = save;
    const timer = setTimeout(save, 800);

    return () => clearTimeout(timer);
  }, [categoryId, title, description, priority, fieldValues, successTicketId, draftUserId]);

  useEffect(
    () => () => {
      pendingSave.current?.();
    },
    []
  );

  // Hủy bỏ: chỉ hỏi lại khi người dùng đã nhập gì đó; luôn quay về danh sách phiếu
  // (không dùng navigate(-1) vì trang có thể được mở trực tiếp, không có lịch sử).
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  // Nội dung chữ được lưu nháp; tệp đính kèm thì không (chỉ giữ trong phiên trang này).
  const hasDraftContent =
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    Object.values(fieldValues).some((v) => v.trim().length > 0);
  const hasUnsavedInput = hasDraftContent || attachmentFile !== null;

  const leaveToTicketList = () => navigate('/tickets');

  const handleCancel = () => {
    if (hasUnsavedInput) setCancelDialogOpen(true);
    else leaveToTicketList();
  };

  const discardDraftAndLeave = () => {
    pendingSave.current = null;
    removeDraft(draftUserId);
    setCancelDialogOpen(false);
    leaveToTicketList();
  };

  // Người dùng đã tự xử lý được qua bài hướng dẫn: không cần phiếu nữa nên bỏ nháp.
  const resolvedBySelfService = () => {
    pendingSave.current = null;
    removeDraft(draftUserId);
    navigate('/');
  };

  const sendFile = async (ticketId: string) => {
    if (!attachmentFile) return;
    setAttachmentError(null);
    try {
      await uploadAttachment(ticketId, attachmentFile);
      setAttachmentUploaded(true);
    } catch (err) {
      setAttachmentError(err);
    }
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
            const draftCategoryId = initialDraft?.categoryId;
            if (!draftCategoryId || !catList.some((c) => c.id === draftCategoryId)) {
              setCategoryId(catList[0].id);
              // Danh mục trong bản nháp không còn: bỏ các trường bổ sung của danh mục cũ.
              if (draftCategoryId) setFieldValues({});
            }
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

  // Mỗi mục trỏ tới đúng ô cần sửa (id của trường) để bảng tóm tắt lỗi dẫn thẳng tới đó.
  const missingFields: { id: string; label: string }[] = [];
  if (baseErrors.categoryId) missingFields.push({ id: 'ticket-category', label: 'Danh mục sự cố' });
  if (baseErrors.title) missingFields.push({ id: 'ticket-title', label: 'Tiêu đề phiếu (từ 5 đến 200 ký tự)' });
  if (baseErrors.description) missingFields.push({ id: 'ticket-description', label: 'Mô tả chi tiết sự cố (từ 10 đến 5000 ký tự)' });
  if (baseErrors.priority) missingFields.push({ id: 'ticket-priority-normal', label: 'Mức ưu tiên (Khẩn cấp chỉ dành cho Quản lý)' });
  for (const f of missingRequiredFields) {
    missingFields.push({ id: `requirement-${f.key}`, label: `${f.label} (bắt buộc theo danh mục)` });
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

  const clearDraftAndReset = () => {
    pendingSave.current = null;
    removeDraft(draftUserId);
    setRestoredBannerVisible(false);
    setTitle('');
    setDescription('');
    setPriority('normal');
    setFieldValues({});
    setTouched({});
  };

  const resetForm = () => {
    pendingSave.current = null;
    removeDraft(draftUserId);
    setRestoredBannerVisible(false);
    setSuccessTicketId(null);
    setAttachmentFile(null);
    setAttachmentError(null);
    setAttachmentUploaded(false);
    setTitle('');
    setDescription('');
    setPriority('normal');
    setFieldValues({});
    setSubmitAttempted(false);
    setFailedSubmits(0);
    setTouched({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSubmitAttempted(true);

    if (!canSubmit) {
      setFailedSubmits((n) => n + 1);
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

      pendingSave.current = null;
      removeDraft(draftUserId);
      setRestoredBannerVisible(false);
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
      {/* Luôn về danh sách phiếu: trang có thể được mở trực tiếp, không có lịch sử để quay lại. */}
      <Link
        to="/tickets"
        className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-sm px-1 text-[0.8125rem] font-medium text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:min-h-8"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Về danh sách phiếu
      </Link>

      <div>
        <h1 className="dx-page-title">
          Tạo phiếu yêu cầu hỗ trợ IT
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          Điền đầy đủ thông tin để bộ phận IT tiếp nhận và phân loại xử lý kịp thời.
        </p>
      </div>

      {restoredBannerVisible && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-info-border bg-status-info-bg px-4 py-2 text-sm text-status-info"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Đã khôi phục nội dung nháp chưa gửi
              {initialDraft?.savedAt
                ? ` (lưu lúc ${new Date(initialDraft.savedAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })})`
                : ''}
              .
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={clearDraftAndReset}>
              Xóa nháp
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRestoredBannerVisible(false)}
              aria-label="Đóng thông báo khôi phục nháp"
              leftIcon={<X className="h-4 w-4" />}
            />
          </div>
        </div>
      )}

      {successTicketId ? (
        <section className="mx-auto max-w-2xl space-y-4 rounded-lg border border-edge bg-surface p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-status-success" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="dx-section-title">Tạo phiếu yêu cầu thành công!</h2>
              <p className="mt-1 text-sm leading-relaxed text-content-muted">
                Phiếu{' '}
                <span data-numeric title={successTicketId} className="font-mono font-medium text-content">
                  #{successTicketId.slice(0, 8)}
                </span>{' '}
                đã được ghi nhận. Đội kỹ thuật IT sẽ xem xét theo mức ưu tiên đã chọn.
              </p>
            </div>
          </div>
          {attachmentFile && (
            isSubmitting ? (
              <Alert type="info">Phiếu đã được tạo. Đang quét và tải tệp…</Alert>
            ) : attachmentUploaded ? (
              <Alert type="success">Tệp {attachmentFile.name} đã được quét và lưu an toàn.</Alert>
            ) : (
              <div className="space-y-2">
                {attachmentError != null && (
                  <ErrorMessage error={attachmentError} title="Phiếu đã tạo; tệp chưa tải thành công" />
                )}
                <Button
                  variant="secondary"
                  disabled={isSubmitting}
                  onClick={async () => {
                    setIsSubmitting(true);
                    try {
                      await sendFile(successTicketId);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  Thử tải lại tệp vào phiếu này
                </Button>
              </div>
            )
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link to={`/tickets/${encodeURIComponent(successTicketId)}`} className={buttonClass('primary')}>
              Xem chi tiết phiếu
            </Link>
            <Button variant="secondary" onClick={resetForm} disabled={isSubmitting}>
              Tạo phiếu khác
            </Button>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main form */}
          <div className="min-w-0">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-lg border border-edge bg-surface"
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
                <div>
                  <CategorySelector
                    categories={categories}
                    categoriesLoading={categoriesLoading}
                    categoryId={categoryId}
                    onChange={handleCategoryChange}
                    onBlur={() => markTouched('categoryId')}
                    error={baseErrors.categoryId}
                    showError={showBaseError('categoryId')}
                  />
                  {categoryId && (
                    <KnowledgeInlineHelper categoryId={categoryId} onGoHome={resolvedBySelfService} />
                  )}
                </div>

                {/* Dynamic requirement fields */}
                <DynamicRequirementFields
                  fields={requirementFields}
                  fieldValues={fieldValues}
                  onChange={(fieldKey, value) =>
                    setFieldValues((prev) => ({
                      ...prev,
                      [fieldKey]: value,
                    }))
                  }
                  onBlur={(fieldKey) => markTouched(`req-${fieldKey}`)}
                  isInvalid={showDynamicError}
                />

                {/* 2. Content */}
                <fieldset className="min-w-0">
                  <Legend
                    step="2"
                    icon={<ClipboardList className="h-3.5 w-3.5 text-[var(--color-primary-ink)]" aria-hidden="true" />}
                  >
                    Nội dung sự cố
                  </Legend>

                  <div className="space-y-4">
                    <div>
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
                        <label
                          htmlFor="ticket-title"
                          className="flex items-center gap-1 text-[0.8125rem] font-medium text-content"
                        >
                          Tiêu đề phiếu <span className="text-status-danger" aria-hidden="true">*</span>
                        </label>
                        <span
                          className={`tabular-nums text-xs ${
                            titleLength > 200 || (titleLength > 0 && titleLength < 5)
                              ? 'font-semibold text-status-danger'
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
                          className="flex items-center gap-1 text-[0.8125rem] font-medium text-content"
                        >
                          Mô tả chi tiết sự cố{' '}
                          <span className="text-status-danger" aria-hidden="true">*</span>
                        </label>
                        <span
                          className={`tabular-nums text-xs ${
                            descriptionLength > 5000 ||
                            (descriptionLength > 0 && descriptionLength < 10)
                              ? 'font-semibold text-status-danger'
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
                    icon={<Clock className="h-3.5 w-3.5 text-[var(--color-primary-ink)]" aria-hidden="true" />}
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
                          id={`ticket-priority-${p}`}
                          type="button"
                          disabled={locked}
                          aria-pressed={isSelected}
                          onClick={() => setPriority(p)}
                          className={`min-h-[58px] rounded-md border p-3 text-left transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            locked
                              ? 'cursor-not-allowed border-dashed border-edge bg-surface-muted'
                              : isSelected
                                ? isCritical
                                  ? 'border-status-danger bg-status-danger-bg'
                                  : 'border-primary bg-primary-tint'
                                : 'border-edge bg-surface hover:border-edge-strong hover:bg-state-hover'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[0.8125rem] font-semibold ${
                                locked
                                  ? 'text-content-muted'
                                  : isSelected
                                    ? isCritical
                                      ? 'text-status-danger'
                                      : 'text-[var(--color-primary-ink)]'
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
                          <span
                            className={`mt-1 block text-xs leading-snug ${
                              isSelected
                                ? isCritical
                                  ? 'text-status-danger'
                                  : 'text-[var(--color-primary-text)]'
                                : 'text-content-muted'
                            }`}
                          >
                            {PRIORITY_META[p].desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {!isManager && (
                    <p
                      id="critical-priority-hint"
                      className="mt-2 flex items-start gap-1.5 text-xs text-content-muted"
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

                {/* Tóm tắt lỗi: chỉ hiện sau khi bấm Gửi; tiêu điểm chuyển tới đây, mỗi mục dẫn tới ô cần sửa. */}
                {submitAttempted && missingFields.length > 0 && (
                  <div
                    ref={errorSummaryRef}
                    id="missing-fields-summary"
                    role="alert"
                    tabIndex={-1}
                    aria-labelledby="missing-fields-title"
                    className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-sm text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-danger"
                  >
                    <p id="missing-fields-title" className="flex items-start gap-1.5 font-semibold">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Chưa thể gửi phiếu - còn thiếu hoặc chưa hợp lệ:</span>
                    </p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-6">
                      {missingFields.map((field) => (
                        <li key={field.id}>
                          <a
                            href={`#${field.id}`}
                            onClick={(event) => {
                              event.preventDefault();
                              document.getElementById(field.id)?.focus();
                            }}
                            className="font-medium underline underline-offset-2 hover:no-underline"
                          >
                            {field.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mx-4 mb-4 space-y-2 text-xs sm:mx-6">
                <label
                  htmlFor="ticket-attachment"
                  onDragOver={(event) => {
                    // Luôn chặn mặc định: nếu không, thả tệp lúc đang gửi sẽ khiến trình duyệt mở tệp và rời trang.
                    event.preventDefault();
                    if (isSubmitting) {
                      event.dataTransfer.dropEffect = 'none';
                      return;
                    }
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={(event) => {
                    // Bỏ qua khi con trỏ chỉ đi vào phần tử con bên trong vùng thả.
                    const next = event.relatedTarget;
                    if (next instanceof Node && event.currentTarget.contains(next)) return;
                    setIsDraggingFile(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(false);
                    const dropped = event.dataTransfer.files?.[0];
                    // Kéo thả chữ hoặc liên kết (không có tệp) thì giữ nguyên tệp đang chọn.
                    if (isSubmitting || !dropped) return;
                    // Xóa giá trị ô chọn tệp để lần chọn lại cùng tệp vẫn phát sự kiện change.
                    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                    pickAttachment(dropped);
                  }}
                  className={`group flex items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-surface ${
                    isSubmitting
                      ? 'cursor-not-allowed border-edge bg-surface-muted opacity-60'
                      : isDraggingFile
                        ? 'cursor-copy border-primary bg-primary-tint'
                        : 'cursor-pointer border-edge bg-surface-muted hover:border-primary hover:bg-primary-tint'
                  }`}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-edge bg-surface text-content-muted transition-colors group-hover:border-primary-border group-hover:text-[var(--color-primary-ink)]"
                    aria-hidden="true"
                  >
                    <Paperclip className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-content">
                      Ảnh hoặc tệp đính kèm (không bắt buộc)
                    </span>
                    <span className="mt-0.5 block text-content-muted">
                      {attachmentFile ? (
                        <>
                          Đã chọn: <strong className="break-all text-content">{attachmentFile.name}</strong>
                        </>
                      ) : (
                        'Bấm để chọn tệp hoặc kéo thả vào đây.'
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-content-subtle">
                      PNG, JPEG, GIF, WebP, PDF, TXT; tối đa 10 MiB. Phiếu được tạo trước khi quét và lưu tệp.
                    </span>
                  </span>
                  <span className="hidden shrink-0 rounded-md border border-edge-strong bg-surface px-3 py-1.5 font-semibold text-content transition-colors group-hover:border-primary group-hover:text-[var(--color-primary-ink)] sm:inline-flex">
                    {attachmentFile ? 'Đổi tệp' : 'Chọn tệp'}
                  </span>
                  <input
                    ref={attachmentInputRef}
                    id="ticket-attachment"
                    type="file"
                    className="sr-only"
                    accept={ATTACHMENT_TYPES.join(',')}
                    disabled={isSubmitting}
                    onChange={(event) => pickAttachment(event.target.files?.[0] ?? null)}
                  />
                </label>
                {attachmentFile && !isSubmitting && (
                  <button
                    type="button"
                    onClick={() => {
                      pickAttachment(null);
                      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                    }}
                    className="inline-flex items-center gap-1 rounded-sm px-1 font-semibold text-content-muted hover:text-status-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Bỏ tệp đã chọn
                  </button>
                )}
                {attachmentError != null && (
                  <ErrorMessage error={attachmentError} title="Tệp chưa hợp lệ" />
                )}
              </div>

              {/* Action bar */}
              <div className="sticky bottom-0 z-20 flex items-center gap-2.5 rounded-b-lg border-t border-edge bg-surface px-4 py-3 sm:px-6 lg:static lg:bg-surface-muted">
                <p className="mr-auto hidden text-xs text-content-muted lg:block">
                  Mục có dấu <span className="font-semibold text-status-danger">*</span> là bắt buộc.
                </p>
                <Button variant="secondary" onClick={handleCancel}>
                  Hủy bỏ
                </Button>
                {/* Nút luôn bấm được (trừ khi đang gửi): bấm khi còn thiếu sẽ hiện tóm tắt lỗi. */}
                <Button
                  type="submit"
                  className="flex-1 sm:flex-none"
                  disabled={categoriesLoading}
                  isLoading={isSubmitting}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  {isSubmitting ? 'Đang gửi phiếu...' : 'Gửi phiếu hỗ trợ'}
                </Button>
              </div>
            </form>
          </div>

          {/* Summary panel */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
            <section className="overflow-hidden rounded-lg border border-edge bg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-edge bg-surface-muted px-4 py-3">
                <h2 className="text-[0.8125rem] font-semibold text-content">
                  Tóm tắt phiếu
                </h2>
                <span data-numeric className="text-xs font-medium text-content-muted">
                  {completedRequired}/{requiredChecklist.length} bắt buộc
                </span>
              </div>

              <dl className="divide-y divide-edge-subtle">
                <div className="px-4 py-3">
                  <dt className="text-xs font-medium text-content-muted">
                    Danh mục
                  </dt>
                  <dd className="mt-1 flex min-w-0 items-center gap-2">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary-ink)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words text-xs font-semibold text-content">
                      {selectedCategory ? selectedCategory.name : 'Chưa chọn'}
                    </span>
                    {selectedCategory && (
                      <span className="shrink-0 rounded-sm border border-edge bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-content-muted">
                        {selectedCategory.code}
                      </span>
                    )}
                  </dd>
                </div>

                <div className="px-4 py-3">
                  <dt className="text-xs font-medium text-content-muted">
                    Mức ưu tiên
                  </dt>
                  <dd className="mt-1 flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-primary-ink)]" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[var(--color-primary-ink)]">
                      {PRIORITY_META[priority].name}
                    </span>
                  </dd>
                </div>

                <div className="px-4 py-3">
                  <dt className="text-xs font-medium text-content-muted">
                    Tiến độ điền phiếu
                  </dt>
                  <dd className="mt-1.5">
                    <ul className="space-y-1.5">
                      {checklist.map((item) => (
                        <li key={item.key} className="flex items-start gap-2 text-xs">
                          {item.ready ? (
                            <Check
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success"
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
                            <span className="ml-auto shrink-0 text-xs text-content-muted">
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

            <section className="rounded-lg border border-edge bg-surface-muted p-4">
              <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-content">
                <HelpCircle className="h-3.5 w-3.5 text-[var(--color-primary-ink)]" aria-hidden="true" />
                <span>Mẹo viết phiếu nhanh được xử lý</span>
              </h2>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-content-muted">
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
                    Đính kèm ảnh lỗi hoặc tài liệu liên quan để IT có thêm thông tin xử lý.
                  </span>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      )}
      <Modal
        isOpen={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title="Hủy tạo phiếu?"
        description={
          hasDraftContent
            ? 'Bạn đã nhập một số thông tin cho phiếu này.'
            : 'Bạn đã chọn tệp đính kèm nhưng chưa gửi phiếu.'
        }
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {hasDraftContent ? (
              <>
                <Button variant="dangerOutline" onClick={discardDraftAndLeave}>
                  Xóa nháp và rời trang
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCancelDialogOpen(false);
                    leaveToTicketList();
                  }}
                >
                  Giữ nháp và rời trang
                </Button>
              </>
            ) : (
              <Button variant="dangerOutline" onClick={discardDraftAndLeave}>
                Bỏ tệp và rời trang
              </Button>
            )}
            <Button onClick={() => setCancelDialogOpen(false)}>Tiếp tục điền</Button>
          </div>
        }
      >
        <p className="text-sm text-content-muted">
          {hasDraftContent
            ? 'Nháp (tiêu đề, mô tả và thông tin bổ sung) được lưu trên trình duyệt này và tự khôi phục khi bạn quay lại. Tệp đính kèm đã chọn sẽ không được giữ.'
            : 'Tệp đính kèm không được lưu nháp, nên rời trang thì tệp đã chọn sẽ bị bỏ.'}
        </p>
      </Modal>
    </div>
  );
};
