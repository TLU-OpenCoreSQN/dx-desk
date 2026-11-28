// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { ClipboardList } from 'lucide-react';
import { RequirementField } from '../../types/api';
import { FieldError, fieldClass } from '../common/FormField';

export interface DynamicRequirementFieldsProps {
  fields: RequirementField[];
  fieldValues: Record<string, string>;
  onChange: (fieldKey: string, value: string) => void;
  onBlur: (fieldKey: string) => void;
  isInvalid: (field: RequirementField) => boolean;
}

const isDateField = (field: RequirementField): boolean =>
  field.key.toLowerCase().includes('until');

interface FieldGuide {
  /** Ví dụ cụ thể hiển thị trong ô nhập. */
  placeholder: string;
  /** Giải thích ngắn cho người chưa quen thuật ngữ. */
  hint: string;
}

/**
 * Hướng dẫn dự phòng theo khóa trường, dùng khi danh mục chưa khai báo `placeholder`/`hint`
 * (ví dụ stack mới chỉ có dữ liệu mẫu của migration, chưa `config apply`). Nội dung cụ thể
 * cho từng doanh nghiệp nên khai báo trong config/doanh-nghiep/cau-hinh.json.
 */
const FIELD_GUIDES: Record<string, FieldGuide> = {
  system_name: {
    placeholder: 'VD: Phần mềm kế toán, Email công ty, Hệ thống nhân sự',
    hint: 'Tên phần mềm hoặc trang web bạn đang dùng, đúng như tên hiển thị trên màn hình hoặc biểu tượng.',
  },
  permission_level: {
    placeholder: 'VD: Chỉ xem báo cáo; Thêm và sửa chứng từ',
    hint: 'Bạn cần làm được gì trong hệ thống. Nếu chưa rõ, ghi giống quyền của một đồng nghiệp cùng vị trí.',
  },
  valid_until: {
    placeholder: '',
    hint: 'Ngày cuối cùng bạn cần dùng quyền này, để bộ phận IT biết khi nào có thể thu hồi.',
  },
  account_name: {
    placeholder: 'VD: nguyen.van.a hoặc nguyen.van.a@congty.vn',
    hint: 'Tên bạn dùng để đăng nhập máy tính hoặc email công ty.',
  },
  issue_type: {
    placeholder: 'VD: Quên mật khẩu, tài khoản bị khóa, không nhận được mã xác thực',
    hint: 'Mô tả ngắn chuyện gì đang xảy ra với tài khoản.',
  },
  client_version: {
    placeholder: 'VD: 7.2.4',
    hint: 'Mở phần mềm VPN, vào mục Giới thiệu (About) để xem số phiên bản.',
  },
  error_message: {
    placeholder: 'VD: "Không thể kết nối tới máy chủ (mã lỗi -14)"',
    hint: 'Chép nguyên văn dòng thông báo lỗi trên màn hình, kể cả mã lỗi nếu có.',
  },
  device_os: {
    placeholder: 'VD: Windows 11, macOS 14, Android 14',
    hint: 'Hệ điều hành của máy đang gặp sự cố.',
  },
  device_code: {
    placeholder: 'VD: mã in trên tem dán ở mặt dưới máy',
    hint: 'Mã tài sản trên tem dán của thiết bị. Không thấy tem thì ghi tên và màu thiết bị.',
  },
  location: {
    placeholder: 'VD: Tầng 3, phòng 305, bàn số 12',
    hint: 'Nơi kỹ thuật viên có thể tìm đến bạn hoặc thiết bị.',
  },
  software_name: {
    placeholder: 'VD: Microsoft Excel, Zoom, phần mềm chấm công',
    hint: 'Tên phần mềm đang gặp lỗi hoặc cần cài đặt.',
  },
  occurred_at: {
    placeholder: 'VD: Khoảng 9h sáng nay, sau khi khởi động lại máy',
    hint: 'Thời điểm bạn thấy lỗi lần đầu và lỗi có lặp lại hay không.',
  },
};

// Cấu hình doanh nghiệp được ưu tiên; thiếu thì dùng bản dự phòng theo khóa, cuối cùng là câu chung.
const fieldGuide = (field: RequirementField): FieldGuide => {
  const fallback = FIELD_GUIDES[field.key] ?? {
    placeholder: isDateField(field) ? '' : `Nhập ${field.label.toLowerCase()}`,
    hint: '',
  };
  return {
    placeholder: isDateField(field) ? '' : field.placeholder?.trim() || fallback.placeholder,
    hint: field.hint?.trim() || fallback.hint,
  };
};

export const DynamicRequirementFields: React.FC<DynamicRequirementFieldsProps> = ({
  fields,
  fieldValues,
  onChange,
  onBlur,
  isInvalid,
}) => {
  if (fields.length === 0) return null;

  return (
    <fieldset className="min-w-0 rounded-[4px] border border-edge bg-surface-muted/60 p-4">
      <legend className="flex items-center gap-1.5 rounded-[4px] bg-surface px-1.5 py-0.5">
        <ClipboardList className="h-3.5 w-3.5 text-[var(--color-primary-ink)]" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-content">
          Thông tin bổ sung theo danh mục
        </span>
      </legend>
      <p className="mb-3 text-[11px] text-content-muted">
        Các trường có dấu <span className="font-semibold text-status-danger">*</span> là bắt
        buộc theo danh mục đã chọn.
      </p>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {fields.map((field) => {
          const value = fieldValues[field.key] || '';
          const invalid = isInvalid(field);
          const guide = fieldGuide(field);
          const hintId = guide.hint ? `requirement-${field.key}-hint` : undefined;
          const errorId = invalid ? `requirement-${field.key}-error` : undefined;
          const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
          return (
            <div key={field.key} className="min-w-0">
              <label
                htmlFor={`requirement-${field.key}`}
                className="mb-1.5 flex flex-wrap items-center gap-1 text-xs font-semibold text-content"
              >
                <span className="break-words">{field.label}</span>
                {field.required ? (
                  <span className="text-status-danger" aria-hidden="true">*</span>
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
                onChange={(e) => onChange(field.key, e.target.value)}
                onBlur={() => onBlur(field.key)}
                aria-required={field.required}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                placeholder={guide.placeholder}
                className={fieldClass(invalid)}
              />
              {guide.hint && (
                <p id={hintId} className="mt-1 text-[11px] leading-snug text-content-muted">
                  {guide.hint}
                </p>
              )}
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
  );
};
