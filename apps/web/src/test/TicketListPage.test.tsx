// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { TicketListPage } from '../modules/desk/pages/TicketListPage';
import * as apiService from '../services/api';
import * as authContext from '../contexts/AuthContext';
import { Ticket } from '../types/api';

const mockTickets: Ticket[] = [
  {
    id: 't-1',
    requester_id: 'emp-1',
    category_id: 'cat-1',
    title: 'Mất kết nối mạng dây phòng 401',
    description: 'Dây mạng cắm vào máy tính không nhận tín hiệu IP',
    priority: 'high',
    status: 'new',
    assigned_to: null,
    created_at: '2026-10-21T01:30:00Z',
    updated_at: '2026-10-21T01:30:00Z',
  },
  {
    id: 't-2',
    requester_id: 'emp-2',
    category_id: 'cat-1',
    title: 'Cài đặt phần mềm VPN',
    description: 'Cần hỗ trợ cấu hình OpenVPN để làm việc từ xa',
    priority: 'normal',
    status: 'in_progress',
    assigned_to: 'agent.1',
    created_at: '2026-10-21T01:00:00Z',
    updated_at: '2026-10-21T01:10:00Z',
  },
];

describe('TicketListPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isKeycloakOffline: false,
      token: 'jwt-token',
      profile: { id: 'user-1', username: 'employee.a', roles: ['Employee'] },
      username: 'employee.a',
      roles: ['Employee'],
      hasRole: (r) => r === 'Employee',
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({
      data: [{ id: 'cat-1', code: 'NET', name: 'Mạng', description: null }],
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <TicketListPage />
      </MemoryRouter>
    );

  it('khung bảng không tạo vùng cuộn riêng để header sticky không đè lên phiếu đầu', async () => {
    vi.spyOn(apiService, 'getTickets').mockResolvedValue({ data: mockTickets, limit: 25, offset: 0 });
    renderComponent();
    const table = await screen.findByTestId('ticket-table');
    // overflow-hidden làm khung thành scroll container của header `sticky top-14`.
    expect(table.className).not.toMatch(/overflow-(hidden|auto|scroll)/);
  });

  it('renders ticket table with real data', async () => {
    vi.spyOn(apiService, 'getTickets').mockResolvedValue({
      data: mockTickets,
      limit: 25,
      offset: 0,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Mất kết nối mạng dây phòng 401')).toBeInTheDocument();
      expect(screen.getByText('Cài đặt phần mềm VPN')).toBeInTheDocument();
      expect(screen.getByText('Mới tạo', { selector: 'span' })).toBeInTheDocument();
      expect(screen.getByText('Đang xử lý', { selector: 'span' })).toBeInTheDocument();
    });
  });

  it('renders truthful empty state when no tickets exist', async () => {
    vi.spyOn(apiService, 'getTickets').mockResolvedValue({
      data: [],
      limit: 25,
      offset: 0,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Chưa có phiếu yêu cầu nào/i)).toBeInTheDocument();
      expect(screen.getByText(/Tạo phiếu hỗ trợ ngay/i)).toBeInTheDocument();
    });
  });

  it('can return from an empty last page even with a filter active', async () => {
    const firstPage = Array.from({ length: 25 }, (_, i) => ({ ...mockTickets[0], id: `ticket-${i}` }));
    const request = vi.spyOn(apiService, 'getTickets').mockImplementation(async (_limit, offset) => ({
      data: offset === 0 ? firstPage : [], limit: 25, offset: offset ?? 0,
    }));
    renderComponent();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Tìm trong trang hiện tại'), { target: { value: 'không trùng' } });
    expect(screen.getByText('Không tìm thấy kết quả phù hợp')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang trước' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(25, 0));
  });

  it('offers a return to the previous page when the next page is empty', async () => {
    const firstPage = Array.from({ length: 25 }, (_, i) => ({ ...mockTickets[0], id: `ticket-${i}` }));
    const request = vi.spyOn(apiService, 'getTickets').mockImplementation(async (_limit, offset) => ({
      data: offset === 0 ? firstPage : [], limit: 25, offset: offset ?? 0,
    }));
    renderComponent();
    fireEvent.click(await screen.findByRole('button', { name: 'Trang sau' }));
    expect(await screen.findByText('Trang này không còn phiếu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại trang trước' }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(25, 0));
  });

  it('allows returning to the previous page after a page load error', async () => {
    const firstPage = Array.from({ length: 25 }, (_, i) => ({ ...mockTickets[0], id: `ticket-${i}` }));
    const request = vi.spyOn(apiService, 'getTickets').mockImplementation(async (_limit, offset) => {
      if (offset) throw new Error('Không kết nối được');
      return { data: firstPage, limit: 25, offset: 0 };
    });
    renderComponent();
    fireEvent.click(await screen.findByRole('button', { name: 'Trang sau' }));
    await screen.findByText('Không thể tải danh sách phiếu yêu cầu');
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(25, 0));
  });

  it('renders error state and retry button on API failure', async () => {
    const errorSpy = vi
      .spyOn(apiService, 'getTickets')
      .mockRejectedValue(new apiService.ApiClientError(500, 'Máy chủ bị lỗi'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải danh sách phiếu yêu cầu/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
    });

    // Test retry
    errorSpy.mockResolvedValueOnce({ data: mockTickets, limit: 25, offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/i }));

    await waitFor(() => {
      expect(screen.getByText('Mất kết nối mạng dây phòng 401')).toBeInTheDocument();
    });
  });

  it('renders an 8-character ticket code and makes the whole row a real link', async () => {
    const longId = 'abcdef12-3456-7890';
    vi.spyOn(apiService, 'getTickets').mockResolvedValue({
      data: [{ ...mockTickets[0], id: longId, title: 'Sự cố máy in tầng 3' }],
      limit: 25,
      offset: 0,
    });

    renderComponent();

    const rowLink = await screen.findByRole('link', { name: /Sự cố máy in tầng 3/ });
    expect(rowLink).toHaveAttribute('href', `/tickets/${longId}`);
    expect(screen.getByText('#abcdef12')).toHaveAttribute('title', longId);
  });

  it('shows the filtered result count and clears filters from the empty state', async () => {
    vi.spyOn(apiService, 'getTickets').mockResolvedValue({
      data: mockTickets,
      limit: 25,
      offset: 0,
    });

    renderComponent();
    await screen.findByText('Cài đặt phần mềm VPN');
    expect(screen.getByText('2 phiếu trên trang này')).toBeInTheDocument();

    const search = screen.getByLabelText('Tìm trong trang hiện tại');
    fireEvent.change(search, { target: { value: 'VPN' } });
    expect(screen.getByText('1/2 phiếu khớp bộ lọc')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'không trùng' } });
    expect(screen.getByText('Không tìm thấy kết quả phù hợp')).toBeInTheDocument();

    // Toolbar and empty state must not expose two identically named clear buttons.
    const clearButtons = screen.getAllByRole('button', { name: 'Xóa bộ lọc' });
    expect(clearButtons).toHaveLength(1);
    fireEvent.click(clearButtons[0]);

    expect(screen.getByText('Cài đặt phần mềm VPN')).toBeInTheDocument();
    expect(screen.getByText('2 phiếu trên trang này')).toBeInTheDocument();
  });

  it('hides pagination controls when the current page has no tickets', async () => {
    vi.spyOn(apiService, 'getTickets').mockResolvedValue({
      data: [],
      limit: 25,
      offset: 0,
    });

    renderComponent();
    await screen.findByText(/Chưa có phiếu yêu cầu nào/i);

    expect(screen.queryByRole('button', { name: 'Trang sau' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trang trước' })).not.toBeInTheDocument();
  });

  it('displays assignee_name instead of the raw assigned_to id', async () => {
    vi.spyOn(apiService, 'getTickets').mockResolvedValue({
      data: [{ ...mockTickets[1], assigned_to: 'agent-uuid-1', assignee_name: 'Nguyễn Văn A' }],
      limit: 25,
      offset: 0,
    });

    renderComponent();

    expect((await screen.findAllByText('Nguyễn Văn A')).length).toBeGreaterThan(0);
    expect(screen.queryByText('agent-uuid-1')).not.toBeInTheDocument();
  });

  it('ignores a stale page response that resolves after a newer one', async () => {
    let resolveStale!: (value: { data: Ticket[]; limit: number; offset: number }) => void;
    const getSpy = vi
      .spyOn(apiService, 'getTickets')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve; }))
      .mockResolvedValueOnce({
        data: [{ ...mockTickets[0], id: 'fresh', title: 'Phiếu trang 1 mới nhất' }],
        limit: 25,
        offset: 0,
      });
    let goTo!: (to: string) => void;
    const Navigator = () => {
      goTo = useNavigate();
      return null;
    };

    render(
      <MemoryRouter initialEntries={['/tickets?page=2']}>
        <Navigator />
        <TicketListPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith(25, 25));

    // Trang 2 còn đang tải thì người dùng quay về trang 1 (ví dụ nút Back của trình duyệt).
    act(() => goTo('/tickets?page=1'));
    await screen.findByText('Phiếu trang 1 mới nhất');

    await act(async () => {
      resolveStale({ data: [{ ...mockTickets[0], id: 'stale', title: 'Dữ liệu trang 2 bị trễ' }], limit: 25, offset: 25 });
    });

    expect(screen.getByText('Phiếu trang 1 mới nhất')).toBeInTheDocument();
    expect(screen.queryByText('Dữ liệu trang 2 bị trễ')).not.toBeInTheDocument();
  });
});
