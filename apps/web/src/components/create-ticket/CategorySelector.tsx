// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Tag } from 'lucide-react';
import { Category } from '../../types/api';
import { FieldError, fieldClass } from '../common/FormField';

export interface CategorySelectorProps {
  categories: Category[];
  categoriesLoading: boolean;
  categoryId: string;
  onChange: (categoryId: string) => void;
  onBlur: () => void;
  error?: string;
  showError?: boolean;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  categoriesLoading,
  categoryId,
  onChange,
  onBlur,
  error,
  showError = false,
}) => {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 flex w-full items-center gap-2 border-b border-edge-subtle pb-2">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-primary-tint text-[10px] font-bold text-primary">
          1
        </span>
        <Tag className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-content">
          Phân loại sự cố
        </span>
      </legend>

      <label
        htmlFor="ticket-category"
        className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-content"
      >
        Danh mục sự cố <span className="text-danger" aria-hidden="true">*</span>
      </label>
      <select
        id="ticket-category"
        value={categoryId}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={categoriesLoading}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? 'ticket-category-error' : undefined}
        className={`${fieldClass(showError)} cursor-pointer disabled:cursor-wait disabled:bg-surface-muted`}
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
      {showError && error && <FieldError id="ticket-category-error">{error}</FieldError>}
    </fieldset>
  );
};
