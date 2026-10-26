// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailPage } from '../pages/TicketDetailPage';
import * as apiService from '../services/api';
import * as authContext from '../contexts/AuthContext';
import { Ticket, TicketEvent, UserRole } from '../types/api';

const mockTicket: Ticket = {
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
    withAuth(['Employee'], 'emp-user-1');
  });

  function withAuth(roles: UserRole[], profileId = 'emp-user-1') {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isKeycloakOffline: false,
      token: 'jwt-token',
      profile: { id: profileId, username: 'tester', roles },
      username: 'tester',
      roles,
      hasRole: (r) => roles.includes(r),
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });
  }

  const renderWithRoute = (ticketId = 'ticket-abc-123') =>
    render(
      <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  const ticketWith = (overrides: Partial<Ticket>): Ticket => ({ ...mockTicket, ...overrides });

  const statusEvent = (
    id: string,
    from: string,
    to: string,
    extra: Record<string, unknown> = {}
  ): TicketEvent => ({
    id,
    ticket_id: 'ticket-abc-123',
    actor_id: 'agent-user-1',
    event_type: 'status_changed',
    payload: { from, to, ...extra },
    created_at: '2026-10-21T02:00:00Z',
  });

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

  it('renders timeline labels for the new statuses waiting_user and pending_approval', async () => {
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'waiting_user' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({
      data: [
        statusEvent('e2', 'assigned', 'pending_approval', { note: 'Cần phê duyệt cấp quyền CRM' }),
        statusEvent('e3', 'pending_approval', 'assigned'),
        statusEvent('e4', 'in_progress', 'waiting_user'),
      ],
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Chuyển từ Đã phân công sang Chờ phê duyệt')).toBeInTheDocument();
      expect(screen.getByText('Chuyển từ Đang xử lý sang Chờ phản hồi')).toBeInTheDocument();
      expect(screen.getByText('Cần phê duyệt cấp quyền CRM')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Chờ phản hồi').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Chờ phê duyệt').length).toBeGreaterThanOrEqual(2);
  });

  it('shows Agent workflow transition buttons for an in_progress ticket', async () => {
    withAuth(['Agent'], 'agent-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'in_progress' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Chờ người dùng phản hồi' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Đánh dấu đã giải quyết' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Hủy phiếu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Từ chối yêu cầu' })).not.toBeInTheDocument();
  });

  it('hides approval actions from Employee and shows approve/reject to Manager on pending_approval', async () => {
    const getSpy = vi
      .spyOn(apiService, 'getTicketById')
      .mockResolvedValue(ticketWith({ status: 'pending_approval' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });

    withAuth(['Employee'], 'emp-user-1');
    const { unmount } = renderWithRoute();
    await waitFor(() =>
      expect(
        screen.getByText(/Hiện không có thao tác chuyển trạng thái nào khả dụng/)
      ).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: 'Duyệt và chuyển vào xử lý' })).not.toBeInTheDocument();
    unmount();

    getSpy.mockClear();
    withAuth(['Manager'], 'mgr-user-1');
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Duyệt và chuyển vào xử lý' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Từ chối yêu cầu' })).toBeInTheDocument();
    });
  });

  it('Employee can cancel only own new/assigned ticket', async () => {
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'new' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });

    withAuth(['Employee'], 'other-user');
    const { unmount } = renderWithRoute();
    await waitFor(() =>
      expect(screen.getByText(/Hiện không có thao tác chuyển trạng thái nào khả dụng/)).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: 'Hủy phiếu' })).not.toBeInTheDocument();
    unmount();

    withAuth(['Employee'], 'emp-user-1');
    renderWithRoute();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Hủy phiếu' })).toBeInTheDocument()
    );
  });

  it('requires resolution_note before resolving and PATCHes with note + resolution_note, then refetches', async () => {
    withAuth(['Agent'], 'agent-user-1');
    const getSpy = vi
      .spyOn(apiService, 'getTicketById')
      .mockResolvedValue(ticketWith({ status: 'in_progress' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    const patchSpy = vi
      .spyOn(apiService, 'updateTicketStatus')
      .mockResolvedValue(ticketWith({ status: 'resolved' }));

    renderWithRoute();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Đánh dấu đã giải quyết' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã giải quyết' }));

    expect(
      screen.getByText(/Chuyển phiếu sang/, { selector: 'h3' })
    ).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận chuyển trạng thái' });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByText(/Mô tả cách giải quyết quá ngắn \(tối thiểu 5 ký tự/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Mô tả cách giải quyết/), {
      target: { value: 'abc' },
    });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Mô tả cách giải quyết/), {
      target: { value: 'Đã thay adapter màn hình, kiểm tra 10 phút không còn chớp.' },
    });
    fireEvent.change(screen.getByLabelText(/Ghi chú chuyển trạng thái/), {
      target: { value: 'Đã hẹn kiểm tra lại sáng mai.' },
    });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('ticket-abc-123', {
        to: 'resolved',
        note: 'Đã hẹn kiểm tra lại sáng mai.',
        resolution_note: 'Đã thay adapter màn hình, kiểm tra 10 phút không còn chớp.',
      });
      expect(getSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('Employee reply on waiting_user PATCHes only to + note (no resolution_note)', async () => {
    withAuth(['Employee'], 'emp-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'waiting_user' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    const patchSpy = vi
      .spyOn(apiService, 'updateTicketStatus')
      .mockResolvedValue(ticketWith({ status: 'in_progress' }));

    renderWithRoute();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Phản hồi, tiếp tục xử lý' })
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Phản hồi, tiếp tục xử lý' }));

    expect(screen.queryByLabelText(/Mô tả cách giải quyết/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Ghi chú chuyển trạng thái/), {
      target: { value: 'Đã gửi lại hướng dẫn kết nối.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển trạng thái' }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('ticket-abc-123', {
        to: 'in_progress',
        note: 'Đã gửi lại hướng dẫn kết nối.',
      });
    });
  });

  it('shows the server Vietnamese message when PATCH returns 4xx', async () => {
    withAuth(['Employee'], 'emp-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'waiting_user' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    vi.spyOn(apiService, 'updateTicketStatus').mockRejectedValue(
      new apiService.ApiClientError(409, 'Phiếu vừa được người khác cập nhật, vui lòng làm mới trang.')
    );

    renderWithRoute();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Phản hồi, tiếp tục xử lý' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Phản hồi, tiếp tục xử lý' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển trạng thái' }));

    await waitFor(() => {
      expect(
        screen.getByText('Phiếu vừa được người khác cập nhật, vui lòng làm mới trang.')
      ).toBeInTheDocument();
      expect(screen.getByText(/Không thể chuyển trạng thái/)).toBeInTheDocument();
    });
  });
});
