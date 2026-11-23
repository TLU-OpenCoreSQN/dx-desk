// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { lazy } from 'react';
import { Home, LayoutDashboard } from 'lucide-react';
import type { ModuleManifest } from '../types';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));

export const coreModule: ModuleManifest = {
  id: 'core',
  name: 'Lõi',
  icon: LayoutDashboard,
  access: 'public',
  required: true,
  pages: [
    { path: '', component: HomePage, access: 'public', nav: { label: 'Trang chủ', icon: Home, order: 0 } },
  ],
};
