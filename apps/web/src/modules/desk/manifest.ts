// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { MessagesSquare } from 'lucide-react';
import type { UserRole } from '../../types/api';

export const assistantManifest = {
  module: 'desk',
  to: '/tro-ly',
  label: 'Trợ lý AI',
  icon: MessagesSquare,
  roles: ['Employee', 'Agent', 'Manager'] as UserRole[],
  route: () => import('./AssistantPage').then(module => ({ default: module.AssistantPage })),
};
