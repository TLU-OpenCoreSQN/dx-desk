// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { KnowledgeSuggestions } from '../common/KnowledgeSuggestions';

export interface KnowledgeInlineHelperProps {
  categoryId: string;
}

export const KnowledgeInlineHelper: React.FC<KnowledgeInlineHelperProps> = ({ categoryId }) => {
  if (!categoryId) return null;
  return (
    <div className="mt-3">
      <KnowledgeSuggestions categoryId={categoryId} />
    </div>
  );
};
