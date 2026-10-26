// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailPage } from '../pages/TicketDetailPage';
import * as apiService from '../services/api';

const mockTicket = {
  id: 'ticket-abc-123',
  requester_id: 'emp-user-1',
  category_id: 'cat-hardware',
  title: 'Màn hình Dell bị chớp nháy liên tục',
  description: 'Màn hình tại bàn làm việc bị chớp đen mỗi 30 giây khi cắm cáp DisplayPort.',
  priority: 'high' as const,
  status: 'new',
  assigned_to: null,
  created_at: '2026-10-21T01:15:00Z',
  updated_at: '2026-10-21T01:15:00Z',
};

const mockEvents = [
  {
    id: 'evt-1',
    ticket_id: 'ticket-abc-123',
    actor_id: 'emp-user-1',
    event_type: 'created',
    payload: { status: 'new' },
    created_at: '2026-10-21T01:15:00Z',
  },
];

describe('TicketDetailPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({
      data: [{ id: 'cat-hardware', code: 'HW', name: 'Thiết bị phần cứng', description: null }],
    });
  });

  const renderWithRoute = (ticketId = 'ticket-abc-123') =>
    render(
      <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders ticket details and event timeline', async () => {
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(mockTicket);
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: mockEvents });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Màn hình Dell bị chớp nháy liên tục')).toBeInTheDocument();
      expect(
        screen.getByText(/Màn hình tại bàn làm việc bị chớp đen mỗi 30 giây/i)
      ).toBeInTheDocument();
      expect(screen.getByText('Đã tiếp nhận phiếu')).toBeInTheDocument();
      expect(screen.getAllByText('emp-user-1')).toHaveLength(2);
      expect(screen.getByText('Thiết bị phần cứng (HW)')).toBeInTheDocument();
    });
  });

  it('handles empty event list truthfully', async () => {
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(mockTicket);
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Màn hình Dell bị chớp nháy liên tục')).toBeInTheDocument();
      expect(screen.getByText(/Chưa có sự kiện nào/i)).toBeInTheDocument();
    });
  });
});
