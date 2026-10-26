// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TicketListPage } from '../pages/TicketListPage';
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
});
