// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateTicketPage } from '../pages/CreateTicketPage';
import * as apiService from '../services/api';
import * as authContext from '../contexts/AuthContext';
import { Category } from '../types/api';

const mockCategories = [
  { id: 'cat-1111-uuid', code: 'HW', name: 'Phần cứng máy tính', description: 'Sự cố thiết bị' },
  { id: 'cat-2222-uuid', code: 'NET', name: 'Mạng nội bộ', description: 'Kết nối mạng' },
];

const mockRenderWithAuth = (roles: ('Employee' | 'Agent' | 'Manager')[] = ['Employee']) => {
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

const vpnCategory: Category = {
  id: 'cat-vpn',
  code: 'VPN',
  name: 'Truy cập VPN',
  description: null,
  requirement_fields: [
    { key: 'reason', label: 'Lý do cần VPN', required: true },
    { key: 'valid_until', label: 'Ngày hết hạn mong muốn', required: true },
    { key: 'device_note', label: 'Ghi chú thiết bị', required: false },
  ],
};

const emptyCategory: Category = {
  id: 'cat-empty',
  code: 'OTHER',
  name: 'Khác',
  description: null,
  requirement_fields: [],
};

describe('CreateTicketPage — trường động theo requirement_fields (W3-04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({ data: [vpnCategory, emptyCategory] });
  });

  it('render input động khi chọn danh mục; key chứa "until" dùng input date', async () => {
    mockRenderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument();
    });

    const reasonInput = screen.getByLabelText(/Lý do cần VPN/);
    expect(reasonInput).toHaveAttribute('type', 'text');
    expect(reasonInput).toHaveAttribute('aria-required', 'true');

    const untilInput = screen.getByLabelText(/Ngày hết hạn mong muốn/);
    expect(untilInput).toHaveAttribute('type', 'date');

    const optionalInput = screen.getByLabelText(/Ghi chú thiết bị/);
    expect(optionalInput).toHaveAttribute('aria-required', 'false');
  });

  it('khóa nút Gửi và liệt kê trường động bắt buộc còn thiếu bằng tiếng Việt', async () => {
    mockRenderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i });
    expect(submitBtn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Chưa thể gửi phiếu/i)).toBeInTheDocument();
    expect(screen.getByText('Lý do cần VPN (bắt buộc theo danh mục)')).toBeInTheDocument();
    expect(screen.getByText('Ngày hết hạn mong muốn (bắt buộc theo danh mục)')).toBeInTheDocument();
    expect(screen.queryByText(/Ghi chú thiết bị \(bắt buộc/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/i), {
      target: { value: 'Cần VPN để làm việc từ xa' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết sự cố/i), {
      target: { value: 'Tôi cần truy cập hệ thống nội bộ từ nhà trong tháng 11.' },
    });

    expect(submitBtn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('Tiêu đề phiếu (từ 5 đến 200 ký tự)')).not.toBeInTheDocument();
    expect(screen.getByText('Lý do cần VPN (bắt buộc theo danh mục)')).toBeInTheDocument();
  });

  it('mở khóa nút Gửi và gửi kèm object fields khi điền đủ trường bắt buộc', async () => {
    const createTicketSpy = vi.spyOn(apiService, 'createTicket').mockResolvedValue({
      id: 'ticket-vpn-1',
      requester_id: 'user-1',
      category_id: 'cat-vpn',
      title: 'Cần VPN để làm việc từ xa',
      description: 'Tôi cần truy cập hệ thống nội bộ từ nhà trong tháng 11.',
      priority: 'normal',
      status: 'new',
      assigned_to: null,
      created_at: '2026-10-26T01:00:00Z',
      updated_at: '2026-10-26T01:00:00Z',
    });

    mockRenderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/i), {
      target: { value: 'Cần VPN để làm việc từ xa' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết sự cố/i), {
      target: { value: 'Tôi cần truy cập hệ thống nội bộ từ nhà trong tháng 11.' },
    });
    fireEvent.change(screen.getByLabelText(/Lý do cần VPN/), {
      target: { value: 'Làm việc từ xa cho dự án DX-Desk' },
    });
    fireEvent.change(screen.getByLabelText(/Ngày hết hạn mong muốn/), {
      target: { value: '2026-11-30' },
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createTicketSpy).toHaveBeenCalledWith({
        category_id: 'cat-vpn',
        title: 'Cần VPN để làm việc từ xa',
        description: 'Tôi cần truy cập hệ thống nội bộ từ nhà trong tháng 11.',
        priority: 'normal',
        fields: { reason: 'Làm việc từ xa cho dự án DX-Desk', valid_until: '2026-11-30' },
      });
    });
  });

  it('danh mục không có requirement_fields thì gửi payload cơ bản, không có fields', async () => {
    const createTicketSpy = vi.spyOn(apiService, 'createTicket').mockResolvedValue({
      id: 'ticket-other-1',
      requester_id: 'user-1',
      category_id: 'cat-empty',
      title: 'Sự cố linh tinh cần IT hỗ trợ',
      description: 'Chuột máy tính phòng 202 lúc nhận lúc không, đã thử đổi cổng USB.',
      priority: 'normal',
      status: 'new',
      assigned_to: null,
      created_at: '2026-10-26T01:00:00Z',
      updated_at: '2026-10-26T01:00:00Z',
    });

    mockRenderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Khác (OTHER)')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Danh mục sự cố/), { target: { value: 'cat-empty' } });
    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/i), {
      target: { value: 'Sự cố linh tinh cần IT hỗ trợ' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết sự cố/i), {
      target: { value: 'Chuột máy tính phòng 202 lúc nhận lúc không, đã thử đổi cổng USB.' },
    });

    expect(screen.queryAllByLabelText(/Lý do cần VPN/)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i }));

    await waitFor(() => {
      expect(createTicketSpy).toHaveBeenCalledWith({
        category_id: 'cat-empty',
        title: 'Sự cố linh tinh cần IT hỗ trợ',
        description: 'Chuột máy tính phòng 202 lúc nhận lúc không, đã thử đổi cổng USB.',
        priority: 'normal',
      });
    });
  });

  it('ẩn chọn mức Khẩn cấp với Employee, mở với Manager', async () => {
    const { unmount } = mockRenderWithAuth(['Employee']);
    await waitFor(() => expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument());
    const criticalBtn = screen.getByText('Khẩn cấp').closest('button');
    expect(criticalBtn).toBeDisabled();
    unmount();

    mockRenderWithAuth(['Manager']);
    await waitFor(() => expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument());
    expect(screen.getByText('Khẩn cấp').closest('button')).not.toBeDisabled();
  });
});
