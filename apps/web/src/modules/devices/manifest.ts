// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { lazy } from 'react';
import { ExternalLink, Laptop } from 'lucide-react';
import type { ModuleManifest } from '../types';

const DeviceRequestPage = lazy(() => import('./pages/DeviceRequestPage').then((m) => ({ default: m.DeviceRequestPage })));

export const devicesModule: ModuleManifest = {
  id: 'devices',
  name: 'Thiết bị',
  icon: Laptop,
  access: 'authenticated',
  pages: [
    { path: 'device-requests', component: DeviceRequestPage, access: 'authenticated', nav: { label: 'Yêu cầu cấp thiết bị', icon: Laptop, order: 30 } },
  ],
  // W5-01: ứng dụng 2 chạy riêng dưới /thiet-bi/ (cùng origin, dùng chung phiên Keycloak),
  // nên là liên kết tải trang thật chứ không phải route của SPA này.
  links: [
    { href: '/thiet-bi/', access: 'authenticated', nav: { label: 'Xin cấp thiết bị (ứng dụng 2)', icon: ExternalLink, order: 90 } },
  ],
};
