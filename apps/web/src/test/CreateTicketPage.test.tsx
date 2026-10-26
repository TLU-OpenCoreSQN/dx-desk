// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateTicketPage } from '../pages/CreateTicketPage';
import * as apiService from '../services/api';
import * as authContext from '../contexts/AuthContext';

const mockCategories = [
  { id: 'cat-1111-uuid', code: 'HW', name: 'Phần cứng máy tính', description: 'Sự cố thiết bị' },
  { id: 'cat-2222-uuid', code: 'NET', name: 'Mạng nội bộ', description: 'Kết nối mạng' },
];

describe('CreateTicketPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({ data: mockCategories });
  });

  const renderWithAuth = (roles: ('Employee' | 'Agent' | 'Manager')[] = ['Employee']) => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isKeycloakOffline: false,
      token: 'jwt-token',
      profile: { id: 'user-1', username: 'testuser', roles },
      username: 'testuser',
      roles,
      hasRole: (r) => roles.includes(r),
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    return render(
      <MemoryRouter>
        <CreateTicketPage />
      </MemoryRouter>
    );
  };

  it('renders category options after loading', async () => {
    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument();
      expect(screen.getByText('Mạng nội bộ (NET)')).toBeInTheDocument();
    });
  });

  it('disables Critical priority option for non-Manager users', async () => {
    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Khẩn cấp')).toBeInTheDocument();
    });

    const criticalBtn = screen.getByText('Khẩn cấp').closest('button');
    expect(criticalBtn).toBeDisabled();
    expect(screen.getByText(/Mức "Khẩn cấp" chỉ dành riêng cho tài khoản Quản lý/i)).toBeInTheDocument();
  });

  it('enables Critical priority option for Manager users', async () => {
    renderWithAuth(['Manager']);

    await waitFor(() => {
      expect(screen.getByText('Khẩn cấp')).toBeInTheDocument();
    });

    const criticalBtn = screen.getByText('Khẩn cấp').closest('button');
    expect(criticalBtn).not.toBeDisabled();
  });

  it('validates minimum lengths on submit', async () => {
    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tiêu đề quá ngắn \(tối thiểu 5 ký tự/i)).toBeInTheDocument();
      expect(screen.getByText(/Mô tả chi tiết quá ngắn \(tối thiểu 10 ký tự/i)).toBeInTheDocument();
    });
  });

  it('submits valid ticket and renders success message with ticket ID', async () => {
    const createTicketSpy = vi.spyOn(apiService, 'createTicket').mockResolvedValue({
      id: 'ticket-created-789',
      requester_id: 'user-1',
      category_id: 'cat-1111-uuid',
      title: 'Hỏng bàn phím phòng họp',
      description: 'Bàn phím cơ bị liệt toàn bộ hàng phím số sau khi cắm lại cổng USB.',
      priority: 'normal',
      status: 'new',
      assigned_to: null,
      created_at: '2026-10-21T01:00:00Z',
      updated_at: '2026-10-21T01:00:00Z',
    });

    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/Tiêu đề phiếu/i);
    const descInput = screen.getByLabelText(/Mô tả chi tiết sự cố/i);

    fireEvent.change(titleInput, { target: { value: 'Hỏng bàn phím phòng họp' } });
    fireEvent.change(descInput, {
      target: {
        value: 'Bàn phím cơ bị liệt toàn bộ hàng phím số sau khi cắm lại cổng USB.',
      },
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createTicketSpy).toHaveBeenCalledWith({
        category_id: 'cat-1111-uuid',
        title: 'Hỏng bàn phím phòng họp',
        description: 'Bàn phím cơ bị liệt toàn bộ hàng phím số sau khi cắm lại cổng USB.',
        priority: 'normal',
      });
      expect(screen.getByText(/Tạo phiếu yêu cầu thành công!/i)).toBeInTheDocument();
      expect(screen.getByText('ticket-created-789')).toBeInTheDocument();
    });
  });
});
