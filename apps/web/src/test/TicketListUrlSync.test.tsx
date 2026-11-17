// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

const LocationWatcher: React.FC<{ onChange: (search: string) => void }> = ({ onChange }) => {
  const location = useLocation();
  onChange(location.search);
  return null;
};

describe('TicketListPage URL Search Parameters Synchronization', () => {
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

  it('restores filters and page from initial URL search parameters', async () => {
    const getTicketsSpy = vi.spyOn(apiService, 'getTickets').mockResolvedValue({
      data: mockTickets,
      limit: 25,
      offset: 25,
    });

    render(
      <MemoryRouter initialEntries={['/tickets?q=VPN&priority=normal&status=in_progress&page=2']}>
        <TicketListPage />
      </MemoryRouter>
    );

    // Verified offset = (page 2 - 1) * 25 = 25
    await waitFor(() => {
      expect(getTicketsSpy).toHaveBeenCalledWith(25, 25);
    });

    const searchInput = screen.getByLabelText('Tìm trong trang hiện tại');
    expect(searchInput).toHaveValue('VPN');

    const prioritySelect = screen.getByLabelText('Mức ưu tiên');
    expect(prioritySelect).toHaveValue('normal');

    const statusSelect = screen.getByLabelText('Trạng thái');
    expect(statusSelect).toHaveValue('in_progress');

    // Filtered result matching on the page
    // Chờ danh sách hiển thị xong; kiểm tra đồng bộ ngay sau lời gọi API sẽ chập chờn.
    expect(await screen.findByText('Cài đặt phần mềm VPN')).toBeInTheDocument();
    expect(screen.queryByText('Mất kết nối mạng dây phòng 401')).not.toBeInTheDocument();
  });

  it('omits default values from URL query string and syncs updates bidirectionally', async () => {
    vi.spyOn(apiService, 'getTickets').mockResolvedValue({
      data: mockTickets,
      limit: 25,
      offset: 0,
    });

    let currentSearch = '';

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <LocationWatcher onChange={(s) => (currentSearch = s)} />
        <TicketListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mất kết nối mạng dây phòng 401')).toBeInTheDocument();
    });

    // Default values must omit all query params
    expect(currentSearch).toBe('');

    // Update search query
    const searchInput = screen.getByLabelText('Tìm trong trang hiện tại');
    fireEvent.change(searchInput, { target: { value: 'mạng dây' } });
    expect(currentSearch).toContain('q=m%E1%BA%A1ng+d%C3%A2y');

    // Update priority
    const prioritySelect = screen.getByLabelText('Mức ưu tiên');
    fireEvent.change(prioritySelect, { target: { value: 'high' } });
    expect(currentSearch).toContain('priority=high');

    // Update status
    const statusSelect = screen.getByLabelText('Trạng thái');
    fireEvent.change(statusSelect, { target: { value: 'new' } });
    expect(currentSearch).toContain('status=new');

    // Reset filters
    const resetButton = screen.getByRole('button', { name: 'Bỏ lọc' });
    fireEvent.click(resetButton);
    expect(currentSearch).toBe('');
  });

  it('updates page query param on pagination and omits page when returning to page 1', async () => {
    const firstPage = Array.from({ length: 25 }, (_, i) => ({
      ...mockTickets[0],
      id: `ticket-${i}`,
    }));
    vi.spyOn(apiService, 'getTickets').mockImplementation(async (_limit, offset) => ({
      data: offset === 0 ? firstPage : [mockTickets[1]],
      limit: 25,
      offset: offset ?? 0,
    }));

    let currentSearch = '';

    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <LocationWatcher onChange={(s) => (currentSearch = s)} />
        <TicketListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled();
    });
    expect(currentSearch).toBe('');

    // Go to page 2
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => {
      expect(currentSearch).toBe('?page=2');
    });

    // Go back to page 1
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    await waitFor(() => {
      expect(currentSearch).toBe('');
    });
  });
});
