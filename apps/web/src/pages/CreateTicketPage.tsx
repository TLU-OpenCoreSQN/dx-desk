// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  ClipboardList,
} from 'lucide-react';
import { createTicket, getCategories } from '../services/api';
import { Category, RequirementField, TicketPriority } from '../types/api';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from '../components/common/Alert';
import { ErrorMessage } from '../components/common/ErrorMessage';

const isDateField = (field: RequirementField): boolean => field.key.toLowerCase().includes('until');

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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);

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
  const showError = (key: string, value: string) =>
    Boolean(submitAttempted || (value.trim().length > 0 && baseErrors[key]));

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setFieldValues({});
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
    } catch (err) {
      setServerError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb / Back button */}
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Tạo phiếu yêu cầu hỗ trợ IT
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Điền đầy đủ thông tin để bộ phận IT tiếp nhận và phân loại xử lý kịp thời.
        </p>
      </div>

      {successTicketId ? (
        <div className="bg-white rounded-xl p-8 border border-emerald-200 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Tạo phiếu yêu cầu thành công!
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Phiếu của bạn đã được ghi nhận vào hệ thống với mã định danh{' '}
            <code className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-bold">
              {successTicketId}
            </code>
            . Đội ngũ kỹ thuật IT sẽ xem xét theo mức ưu tiên đã định.
          </p>
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(`/tickets/${successTicketId}`)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            >
              Xem chi tiết phiếu
            </button>
            <button
              type="button"
              onClick={() => {
                setSuccessTicketId(null);
                setTitle('');
                setDescription('');
                setPriority('normal');
                setFieldValues({});
                setSubmitAttempted(false);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              Tạo phiếu khác
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {!!serverError && (
            <ErrorMessage
              error={serverError}
              title="Không thể tạo phiếu yêu cầu"
              className="mb-6"
            />
          )}

          {!!categoriesError && (
            <Alert type="error" title="Lỗi tải danh mục" className="mb-6">
              Không thể tải danh sách danh mục từ máy chủ. Vui lòng tải lại trang.
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Category selection */}
            <div>
              <label
                htmlFor="ticket-category"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Danh mục sự cố <span className="text-rose-500">*</span>
              </label>
              {categoriesLoading ? (
                <div className="text-xs text-slate-400 py-2">Đang tải danh mục...</div>
              ) : (
                <select
                  id="ticket-category"
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={`w-full text-xs border rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 ${
                    showError('categoryId', categoryId)
                      ? 'border-rose-400 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-teal-500'
                  }`}
                >
                  {categories.length === 0 ? (
                    <option value="">Không có danh mục nào trên hệ thống</option>
                  ) : (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.code})
                      </option>
                    ))
                  )}
                </select>
              )}
              {showError('categoryId', categoryId) && (
                <p className="text-xs text-rose-600 mt-1">{baseErrors.categoryId}</p>
              )}
            </div>

            {/* Dynamic requirement fields for the selected category */}
            {requirementFields.length > 0 && (
              <fieldset className="space-y-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <legend className="px-1 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
                  Thông tin bắt buộc theo danh mục
                </legend>
                {requirementFields.map((field) => {
                  const value = fieldValues[field.key] || '';
                  const fieldMissing = submitAttempted && field.required && !value.trim();
                  return (
                    <div key={field.key}>
                      <label
                        htmlFor={`requirement-${field.key}`}
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        {field.label}{' '}
                        {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        id={`requirement-${field.key}`}
                        name={field.key}
                        type={isDateField(field) ? 'date' : 'text'}
                        required={field.required}
                        value={value}
                        onChange={(e) =>
                          setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        aria-required={field.required}
                        aria-invalid={fieldMissing}
                        placeholder={isDateField(field) ? '' : `VD: nội dung cho "${field.label}"`}
                        className={`w-full text-xs border rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 ${
                          fieldMissing
                            ? 'border-rose-400 focus:ring-rose-500'
                            : 'border-slate-300 focus:ring-teal-500'
                        }`}
                      />
                      {fieldMissing && (
                        <p className="text-xs text-rose-600 mt-1">
                          Vui lòng nhập “{field.label}” (trường bắt buộc của danh mục).
                        </p>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            )}

            {/* Title field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="ticket-title"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Tiêu đề phiếu <span className="text-rose-500">*</span>
                </label>
                <span
                  className={`text-[11px] ${
                    title.trim().length > 200 || (title.trim().length > 0 && title.trim().length < 5)
                      ? 'text-rose-500 font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  {title.trim().length} / 200 ký tự (tối thiểu 5)
                </span>
              </div>
              <input
                id="ticket-title"
                type="text"
                placeholder="VD: Không thể kết nối máy in phòng Kế toán tầng 3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={250}
                className={`w-full text-xs border rounded-lg p-2.5 focus:outline-none focus:ring-2 ${
                  showError('title', title)
                    ? 'border-rose-400 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-teal-500'
                }`}
              />
              {showError('title', title) && (
                <p className="text-xs text-rose-600 mt-1">{baseErrors.title}</p>
              )}
            </div>

            {/* Priority selection */}
            <div>
              <label
                htmlFor="ticket-priority"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Mức độ ưu tiên
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(['low', 'normal', 'high', 'critical'] as TicketPriority[]).map((p) => {
                  const isCritical = p === 'critical';
                  const disabled = isCritical && !isManager;
                  const isSelected = priority === p;

                  const labels: Record<TicketPriority, { name: string; desc: string }> = {
                    low: { name: 'Thấp', desc: 'Không gấp' },
                    normal: { name: 'Bình thường', desc: 'Sự cố định kỳ' },
                    high: { name: 'Cao', desc: 'Ảnh hưởng nhóm' },
                    critical: { name: 'Khẩn cấp', desc: 'Toàn hệ thống' },
                  };

                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={disabled}
                      aria-pressed={isSelected}
                      onClick={() => setPriority(p)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        disabled
                          ? 'opacity-40 bg-slate-50 border-slate-200 cursor-not-allowed'
                          : isSelected
                          ? isCritical
                            ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20'
                            : 'bg-teal-50 border-teal-600 ring-2 ring-teal-600/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold ${
                            isSelected
                              ? isCritical
                                ? 'text-rose-900'
                                : 'text-teal-900'
                              : 'text-slate-800'
                          }`}
                        >
                          {labels[p].name}
                        </span>
                        {isCritical && !isManager && (
                          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{labels[p].desc}</div>
                    </button>
                  );
                })}
              </div>

              {!isManager && (
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>Mức "Khẩn cấp" chỉ dành riêng cho tài khoản Quản lý (Manager).</span>
                </p>
              )}
              {baseErrors.priority && (
                <p className="text-xs text-rose-600 mt-1">{baseErrors.priority}</p>
              )}
            </div>

            {/* Description field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="ticket-description"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Mô tả chi tiết sự cố <span className="text-rose-500">*</span>
                </label>
                <span
                  className={`text-[11px] ${
                    description.trim().length > 5000 ||
                    (description.trim().length > 0 && description.trim().length < 10)
                      ? 'text-rose-500 font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  {description.trim().length} / 5000 ký tự (tối thiểu 10)
                </span>
              </div>
              <textarea
                id="ticket-description"
                rows={6}
                placeholder="Mô tả hiện tượng lỗi, thông báo lỗi nếu có, thời điểm xảy ra và các bước đã thử xử lý..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5500}
                className={`w-full text-xs border rounded-lg p-3 focus:outline-none focus:ring-2 leading-relaxed ${
                  showError('description', description)
                    ? 'border-rose-400 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-teal-500'
                }`}
              />
              {showError('description', description) && (
                <p className="text-xs text-rose-600 mt-1">{baseErrors.description}</p>
              )}
            </div>

            {/* Poka-yoke: list of fields still missing before submit is possible */}
            {missingFieldLabels.length > 0 && (
              <div
                id="missing-fields-summary"
                className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900"
                aria-live="polite"
              >
                <p className="font-semibold mb-1">Chưa thể gửi phiếu — còn thiếu hoặc chưa hợp lệ:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {missingFieldLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Note on Week 2 attachments */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Lưu ý tệp đính kèm:</span> Tính năng
              đính kèm chưa khả dụng trong phiên bản này. Vui lòng mô tả lỗi bằng văn bản chi tiết.
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={isSubmitting || categoriesLoading}
                aria-disabled={!canSubmit}
                aria-describedby="missing-fields-summary"
                onClick={() => {
                  if (!canSubmit) setSubmitAttempted(true);
                }}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs font-bold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors ${
                  canSubmit && !isSubmitting && !categoriesLoading
                    ? 'bg-teal-600 hover:bg-teal-700'
                    : 'bg-teal-600 opacity-50 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Đang gửi phiếu...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi phiếu hỗ trợ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
