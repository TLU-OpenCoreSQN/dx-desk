// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { lazy } from 'react';
import { ClipboardList, Headset, MessagesSquare, PlusCircle, ShieldCheck, Ticket } from 'lucide-react';
import type { ModuleManifest } from '../types';

const TicketListPage = lazy(() => import('./pages/TicketListPage').then((m) => ({ default: m.TicketListPage })));
const CreateTicketPage = lazy(() => import('./pages/CreateTicketPage').then((m) => ({ default: m.CreateTicketPage })));
const TicketDetailPage = lazy(() => import('./pages/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })));
const WorkQueuePage = lazy(() => import('./pages/WorkQueuePage').then((m) => ({ default: m.WorkQueuePage })));
const AssistantPage = lazy(() => import('./AssistantPage').then((m) => ({ default: m.AssistantPage })));
const ManagerApprovalsPage = lazy(() => import('./pages/ManagerApprovalsPage').then((m) => ({ default: m.ManagerApprovalsPage })));

export const deskModule: ModuleManifest = {
  id: 'desk',
  name: 'Service Desk',
  icon: Headset,
  access: 'authenticated',
  pages: [
    { path: 'tickets', component: TicketListPage, access: 'authenticated', nav: { label: 'Danh sách phiếu', icon: Ticket, order: 20 } },
    { path: 'tickets/new', component: CreateTicketPage, access: 'authenticated', nav: { label: 'Tạo phiếu hỗ trợ', icon: PlusCircle, order: 21 } },
    // W6-04: trợ lý AI chỉ hiện khi API bật trợ lý cho người dùng (`assistant_enabled` trong /api/me).
    {
      path: 'tro-ly',
      component: AssistantPage,
      access: 'Employee',
      when: (profile) => profile?.assistant_enabled === true,
      nav: { label: 'Trợ lý AI', icon: MessagesSquare, order: 22 },
    },
    { path: 'tickets/:id', component: TicketDetailPage, access: 'authenticated', title: 'Chi tiết phiếu' },
    { path: 'work-queue', component: WorkQueuePage, access: 'Agent', nav: { label: 'Bảng việc kỹ thuật viên', icon: ClipboardList, order: 40 } },
    { path: 'approvals', component: ManagerApprovalsPage, access: 'Manager', nav: { label: 'Phê duyệt phiếu hỗ trợ', icon: ShieldCheck, order: 50 } },
  ],
};
