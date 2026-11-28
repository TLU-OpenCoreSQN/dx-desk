// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailPage } from '../modules/desk/pages/TicketDetailPage';
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
      expect(screen.getByText('Thiết bị phần cứng')).toBeInTheDocument();
    });
  });

  it('shows server-provided team, assignee, paused SLA and system audit identity', async () => {
    withAuth(['Agent'], 'agent-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({
      status: 'waiting_user', assigned_to: 'agent-1', assignee_name: 'Kỹ thuật viên Một',
      assigned_team_id: 'team-1', team_name: 'Hạ tầng mạng', requester_name: 'Người yêu cầu Một',
      sla_due_at: '2026-11-04T03:00:00Z', waiting_since: '2026-11-03T03:00:00Z',
      sla_paused_ms: 180000, sla_breached: true, ticket_version: 12,
    }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [{ ...mockEvents[0], actor_id: null, actor_type: 'system', actor_name: 'Tự động phân tuyến' }] });
    renderWithRoute();
    await screen.findByText('Kỹ thuật viên Một');
    expect(screen.getByText('Hạ tầng mạng')).toBeInTheDocument();
    expect(screen.getByText('Người yêu cầu Một')).toBeInTheDocument();
    // SLA chỉ được nói một lần, ở banner; header không lặp lại hạn gốc hay thời gian tạm dừng.
    expect(screen.getByText('SLA tạm dừng · chờ người tạo phiếu phản hồi')).toBeInTheDocument();
    expect(screen.getByText(/Thời gian đã dừng: [\d.]+ phút/)).toBeInTheDocument();
    expect(screen.queryByText(/Hạn gốc SLA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SLA đang tạm dừng từ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ĐANG CHỜ NGƯỜI TẠO PHIẾU PHẢN HỒI/)).not.toBeInTheDocument();
    expect(screen.getByText('Hệ thống (Tự động phân tuyến)')).toBeInTheDocument();
  });

  it('requires a rejection reason and sends the observed version from detail', async () => {
    withAuth(['Manager'], 'manager-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'pending_approval', ticket_version: 12 }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: mockEvents });
    const update = vi.spyOn(apiService, 'updateTicketStatus').mockResolvedValue(ticketWith({ status: 'new', ticket_version: 13 }));
    renderWithRoute(); fireEvent.click(await screen.findByRole('button', { name: 'Từ chối yêu cầu' }));
    const confirm = screen.getByRole('button', { name: 'Từ chối yêu cầu' });
    const reason = screen.getByLabelText(/Lý do từ chối/);
    // Lý do là bắt buộc nên con trỏ vào thẳng ô lý do; lỗi chưa hiện khi chưa thao tác.
    expect(reason).toHaveFocus();
    expect(screen.queryByText('Lý do từ chối cần ít nhất 5 ký tự.')).not.toBeInTheDocument();
    fireEvent.click(confirm);
    expect(await screen.findByText('Lý do từ chối cần ít nhất 5 ký tự.')).toBeInTheDocument();
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(update).not.toHaveBeenCalled();
    fireEvent.change(reason, { target: { value: 'Thiếu thông tin quyền cần cấp' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(update).toHaveBeenCalledWith(mockTicket.id, { to: 'new', note: 'Thiếu thông tin quyền cần cấp', expected_version: 12 }));
  });

  it('requires a cancel reason and never sends a whitespace-only note', async () => {
    withAuth(['Employee'], mockTicket.requester_id);
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'new' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    const update = vi.spyOn(apiService, 'updateTicketStatus').mockResolvedValue(ticketWith({ status: 'cancelled' }));
    renderWithRoute();
    fireEvent.click(await screen.findByRole('button', { name: /Hủy phiếu/ }));
    const reason = screen.getByLabelText(/Lý do hủy/);
    expect(reason).toHaveFocus();
    fireEvent.change(reason, { target: { value: '      ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy phiếu này' }));
    expect(await screen.findByText('Lý do hủy cần ít nhất 5 ký tự.')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.change(reason, { target: { value: '  Sự cố đã tự hết  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy phiếu này' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(mockTicket.id, expect.objectContaining({ to: 'cancelled', note: 'Sự cố đã tự hết' })));
  });

  it('closes the transition form on Escape and returns focus to the button that opened it', async () => {
    withAuth(['Agent'], 'agent-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'in_progress' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    renderWithRoute();
    const opener = await screen.findByRole('button', { name: 'Chờ người dùng phản hồi' });
    opener.focus();
    fireEvent.click(opener);
    const field = screen.getByLabelText(/Thông tin cần người tạo phiếu bổ sung/);
    expect(field).toHaveFocus();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByText(/Chuyển phiếu sang/, { selector: 'h3' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Chờ người dùng phản hồi' })).toHaveFocus()
    );
  });

  it('shows category fields and current result, retaining historical field names safely', async () => {
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({
      request_fields: { asset_code: 'DELL-123', retired_field: '<script>alert(1)</script>', legacy_bad: { nested: true } },
      resolution_note: 'Đã thay cáp DisplayPort và kiểm tra ổn định.',
    }));
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({ data: [{
      id: 'cat-hardware', code: 'HW', name: 'Thiết bị',
      requirement_fields: [{ key: 'asset_code', label: 'Mã tài sản', required: true }],
    }] });
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    renderWithRoute();
    expect(await screen.findByText('DELL-123')).toBeInTheDocument();
    expect(screen.getByText('Mã tài sản')).toBeInTheDocument();
    expect(screen.getByText('retired_field')).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('Đã thay cáp DisplayPort và kiểm tra ổn định.')).toBeInTheDocument();
  });

  it('keeps a transition note and its resolution in the timeline independently', async () => {
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'resolved' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [
      statusEvent('resolution-1', 'in_progress', 'resolved', {
        note: 'Đã thông báo người dùng.', resolution_note: 'Cài lại driver màn hình.',
      }),
    ] });
    renderWithRoute();
    expect(await screen.findByText('Đã thông báo người dùng.')).toBeInTheDocument();
    expect(screen.getByText('Cài lại driver màn hình.')).toBeInTheDocument();
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
    const confirmBtn = screen.getByRole('button', { name: 'Đánh dấu đã giải quyết' });
    const resolutionField = screen.getByLabelText(/Mô tả cách giải quyết/);
    expect(resolutionField).toHaveFocus();
    // Không mắng người dùng ngay khi vừa mở form.
    expect(screen.queryByText(/Mô tả cách giải quyết quá ngắn/i)).not.toBeInTheDocument();

    fireEvent.change(resolutionField, { target: { value: 'abc' } });
    fireEvent.click(confirmBtn);
    expect(
      await screen.findByText(/Mô tả cách giải quyết quá ngắn \(tối thiểu 5 ký tự/i)
    ).toBeInTheDocument();
    expect(resolutionField).toHaveFocus();
    expect(patchSpy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Mô tả cách giải quyết/), {
      target: { value: 'Đã thay adapter màn hình, kiểm tra 10 phút không còn chớp.' },
    });
    fireEvent.change(screen.getByLabelText(/^Ghi chú/), {
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
      expect(screen.getByRole('button', { name: 'Gửi phản hồi' })).toBeInTheDocument()
    );

    expect(screen.queryByLabelText(/Mô tả cách giải quyết/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nội dung phản hồi'), {
      target: { value: 'Đã gửi lại hướng dẫn kết nối.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('ticket-abc-123', {
        to: 'in_progress',
        note: 'Đã gửi lại hướng dẫn kết nối.',
      });
    });
  });

  it('Employee on waiting_user sees the technician request above the reply box', async () => {
    withAuth(['Employee'], 'emp-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'waiting_user' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({
      data: [
        statusEvent('evt-a', 'assigned', 'in_progress'),
        {
          ...statusEvent('evt-b', 'in_progress', 'waiting_user', {
            note: 'Gửi giúp ảnh chụp thông báo lỗi khi kết nối VPN.',
          }),
          actor_name: 'agent.1',
        },
      ],
    });

    renderWithRoute();

    const request = await screen.findByText('agent.1 cần bạn bổ sung', { exact: false });
    expect(request.closest('figure')).toHaveTextContent(
      'Gửi giúp ảnh chụp thông báo lỗi khi kết nối VPN.'
    );
    expect(screen.queryByRole('button', { name: 'Phản hồi, tiếp tục xử lý' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Ghi chú/)).not.toBeInTheDocument();
  });

  it('Employee reply requires a note before PATCH', async () => {
    withAuth(['Employee'], 'emp-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'waiting_user' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    const patchSpy = vi.spyOn(apiService, 'updateTicketStatus');

    renderWithRoute();

    fireEvent.click(await screen.findByRole('button', { name: 'Gửi phản hồi' }));

    expect(await screen.findByText('Nội dung phản hồi cần ít nhất 5 ký tự.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nội dung phản hồi')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nội dung phản hồi')).toHaveFocus();
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it('cancel form names the action and the way back', async () => {
    withAuth(['Employee'], 'emp-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'assigned' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });

    renderWithRoute();
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy phiếu' }));

    expect(screen.getByRole('button', { name: 'Hủy phiếu này' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Lý do hủy/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy bỏ' })).not.toBeInTheDocument();
    expect(screen.queryByText(/máy trạng thái/)).not.toBeInTheDocument();
  });

  it('keeps cancel out of the fixed mobile bar', async () => {
    withAuth(['Employee'], 'emp-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'assigned' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });

    const { container } = renderWithRoute();

    const cancel = await screen.findByRole('button', { name: 'Hủy phiếu' });
    expect(cancel.closest('[class*="max-lg:fixed"]')).toBeNull();
    expect(container.querySelector('[class*="max-lg:fixed"]')).toBeNull();
  });

  it('Agent keeps forward actions in the mobile bar and cancel outside it', async () => {
    withAuth(['Agent'], 'agent-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'assigned' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });

    renderWithRoute();

    const start = await screen.findByRole('button', { name: 'Bắt đầu xử lý' });
    expect(start.closest('[class*="max-lg:fixed"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Hủy phiếu' }).closest('[class*="max-lg:fixed"]')).toBeNull();
  });

  it('shows the server Vietnamese message when PATCH returns 4xx', async () => {
    withAuth(['Employee'], 'emp-user-1');
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'waiting_user' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    vi.spyOn(apiService, 'updateTicketStatus').mockRejectedValue(
      new apiService.ApiClientError(422, 'Phiếu không hợp lệ để chuyển trạng thái.')
    );

    renderWithRoute();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Gửi phản hồi' })).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText('Nội dung phản hồi'), {
      target: { value: 'Máy vẫn báo lỗi như cũ.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' }));

    await waitFor(() => {
      expect(
        screen.getByText('Phiếu không hợp lệ để chuyển trạng thái.')
      ).toBeInTheDocument();
      expect(screen.getByText(/Không thể chuyển trạng thái/)).toBeInTheDocument();
    });
  });

  it('lets the requester report an unresolved issue within seven days with a required reason', async () => {
    const resolved = ticketWith({ status: 'resolved', resolved_at: new Date(Date.now() - 3600000).toISOString(),
      assigned_to: 'agent-user-1', ticket_version: 3, sla_due_at: new Date(Date.now() + 3600000).toISOString() });
    const reopened = { ...resolved, status: 'in_progress' };
    vi.spyOn(apiService, 'getTicketById').mockResolvedValueOnce(resolved).mockResolvedValue(reopened);
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    const update = vi.spyOn(apiService, 'updateTicketStatus').mockResolvedValue(reopened);
    renderWithRoute();
    fireEvent.click(await screen.findByRole('button', { name: 'Chưa khắc phục được' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại để xử lý' }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText(/Lý do chưa khắc phục cần ít nhất 5 ký tự/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Lý do chưa khắc phục/), { target: { value: 'VPN vẫn bị ngắt sau vài phút.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại để xử lý' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(mockTicket.id, {
      to: 'in_progress', expected_version: 3, note: 'VPN vẫn bị ngắt sau vài phút.',
    }));
  });

  it.each([
    ['expired', new Date(Date.now() - 8 * 86400000).toISOString()],
    ['unknown resolution time', null],
  ])('does not offer requester reopen with %s', async (_label, resolved_at) => {
    vi.spyOn(apiService, 'getTicketById').mockResolvedValue(ticketWith({ status: 'resolved', resolved_at }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    renderWithRoute();
    await screen.findByRole('button', { name: 'Xác nhận đã hài lòng, đóng phiếu' });
    expect(screen.queryByRole('button', { name: 'Chưa khắc phục được' })).not.toBeInTheDocument();
  });

  it('handles 409 conflict by reloading without showing duplicate error alert', async () => {
    withAuth(['Employee'], 'emp-user-1');
    const getSpy = vi
      .spyOn(apiService, 'getTicketById')
      .mockResolvedValue(ticketWith({ status: 'waiting_user' }));
    vi.spyOn(apiService, 'getTicketEvents').mockResolvedValue({ data: [] });
    vi.spyOn(apiService, 'updateTicketStatus').mockRejectedValue(
      new apiService.ApiClientError(409, 'Phiếu vừa được người khác cập nhật, vui lòng làm mới trang.')
    );

    renderWithRoute();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Gửi phản hồi' })).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText('Nội dung phản hồi'), {
      target: { value: 'Máy vẫn báo lỗi như cũ.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi phản hồi' }));

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledTimes(2);
      expect(
        screen.getAllByText(/Phiếu đã được cập nhật bởi người khác\. Dữ liệu mới đã được tải lại/)
          .length
      ).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Không thể chuyển trạng thái')).not.toBeInTheDocument();
  });
});
