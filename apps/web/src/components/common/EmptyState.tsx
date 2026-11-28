// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  /** 2 khi nằm ngay dưới tiêu đề trang (mặc định), 3 khi nằm trong một mục đã có h2. */
  headingLevel?: 2 | 3;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
  headingLevel = 2,
}) => {
  // Cấp tiêu đề theo vị trí: ngay dưới <h1> của trang là h2, trong một mục đã có h2 thì là h3.
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-edge bg-surface p-8 text-center sm:p-12">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-edge bg-surface-muted text-content-muted">
        {icon || <Inbox className="h-6 w-6 text-content-muted" aria-hidden="true" />}
      </div>
      <Heading className="dx-section-title mb-1.5">{title}</Heading>
      <p className="mb-6 max-w-md text-sm leading-relaxed text-content-muted">{description}</p>
      {actionText && onAction && <Button onClick={onAction}>{actionText}</Button>}
    </div>
  );
};
