// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { MessagesSquare } from 'lucide-react';
import type { UserProfile, UserRole } from '../../types/api';

const assistantRoles: UserRole[] = ['Employee', 'Agent', 'Manager'];

export const assistantManifest = {
  module: 'desk',
  to: '/tro-ly',
  label: 'Trợ lý AI',
  icon: MessagesSquare,
  enabled: (profile: UserProfile | null) => profile?.assistant_enabled === true &&
    profile.roles.some(role => assistantRoles.includes(role)),
  route: () => import('./AssistantPage').then(module => ({ default: module.AssistantPage })),
};
