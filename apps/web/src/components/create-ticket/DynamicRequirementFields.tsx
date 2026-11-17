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
        {fields.map((field) => {
          const value = fieldValues[field.key] || '';
          const invalid = isInvalid(field);
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
                onChange={(e) => onChange(field.key, e.target.value)}
                onBlur={() => onBlur(field.key)}
                aria-required={field.required}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `requirement-${field.key}-error` : undefined}
                placeholder={isDateField(field) ? '' : `VD: nội dung cho "${field.label}"`}
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
  );
};
