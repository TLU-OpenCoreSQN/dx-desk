// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { lazy } from 'react';
import { ChartNoAxesCombined, Database } from 'lucide-react';
import type { ModuleManifest } from '../types';

const DataCatalogPage = lazy(() => import('./pages/DataCatalogPage').then((m) => ({ default: m.DataCatalogPage })));
const ManagerAnalyticsPage = lazy(() => import('./pages/ManagerAnalyticsPage').then((m) => ({ default: m.ManagerAnalyticsPage })));

export const dataModule: ModuleManifest = {
  id: 'data',
  name: 'Dữ liệu',
  icon: Database,
  access: 'public',
  pages: [
    { path: 'du-lieu', component: DataCatalogPage, access: 'public', nav: { label: 'Danh mục dữ liệu', icon: Database, order: 100, section: 'resources' } },
    { path: 'bao-cao', component: ManagerAnalyticsPage, access: 'Manager', nav: { label: 'Báo cáo vận hành', icon: ChartNoAxesCombined, order: 51 } },
  ],
};
