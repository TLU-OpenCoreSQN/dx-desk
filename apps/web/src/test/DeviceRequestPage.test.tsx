// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DeviceRequestPage } from '../pages/DeviceRequestPage';
import * as apiService from '../services/api';
import { DeviceRequest } from '../types/api';

const mockDeviceRequests: DeviceRequest[] = [
  {
    id: 'dreq-001',
    requester_id: 'emp-1',
    device_type: 'laptop',
    reason: 'Cần máy tính xách tay phục vụ việc đi công tác tỉnh.',
    quantity: 1,
    status: 'pending',
    created_at: '2026-10-21T01:00:00Z',
  },
];

const emptyPage = { data: [] as DeviceRequest[], limit: 25, offset: 0 };

describe('DeviceRequestPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <DeviceRequestPage />
      </MemoryRouter>
    );

  it('renders device requests list from server', async () => {
    vi.spyOn(apiService, 'getDeviceRequests').mockResolvedValue({
      data: mockDeviceRequests,
      limit: 25,
      offset: 0,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Máy tính xách tay (Laptop)')).toBeInTheDocument();
      expect(
        screen.getByText('Cần máy tính xách tay phục vụ việc đi công tác tỉnh.')
      ).toBeInTheDocument();
      expect(screen.getByText('Chờ xử lý')).toBeInTheDocument();
    });
  });

  it('validates minimum reason length and integer quantity', async () => {
    vi.spyOn(apiService, 'getDeviceRequests').mockResolvedValue(emptyPage);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Chưa có yêu cầu cấp thiết bị nào/i)).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu ngay/i }));

    const reasonInput = screen.getByLabelText(/Lý do đề xuất/i);
    fireEvent.change(reasonInput, { target: { value: 'ngắn' } });

    const submitBtn = screen.getByRole('button', { name: /Gửi yêu cầu thiết bị/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Lý do yêu cầu quá ngắn \(tối thiểu 10 ký tự/i)
      ).toBeInTheDocument();
    });
  });

  it('keeps previous-page navigation available on an empty last page', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ ...mockDeviceRequests[0], id: `device-${i}` }));
    const request = vi.spyOn(apiService, 'getDeviceRequests').mockImplementation(async (_limit, offset) => ({
      data: offset === 0 ? rows : [], limit: 25, offset: offset ?? 0,
    }));
    renderComponent();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang trước' })).toBeEnabled());
    // Trang rỗng không được hiển thị "Hiển thị từ 0 đến 0" hay nút "Trang sau" vô nghĩa
    expect(screen.queryByText(/Hiển thị từ/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trang sau' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(25, 0));
  });

  it('submits valid device request without state or ownership fields', async () => {
    vi.spyOn(apiService, 'getDeviceRequests').mockResolvedValue(emptyPage);

    const createSpy = vi.spyOn(apiService, 'createDeviceRequest').mockResolvedValue({
      id: 'dreq-new-999',
      requester_id: 'emp-1',
      device_type: 'monitor',
      reason: 'Cần màn hình ngoài 27 inch để đọc tài liệu thiết kế hệ thống.',
      quantity: 2,
      status: 'pending',
      created_at: '2026-10-21T02:00:00Z',
    });

    renderComponent();

    // Open form
    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu mới/i }));

    const typeRadio = screen.getByRole('radio', { name: /Màn hình máy tính/i });
    const quantityInput = screen.getByLabelText(/Số lượng/i);
    const reasonInput = screen.getByLabelText(/Lý do đề xuất/i);

    expect(screen.getByText(/Loại thiết bị/)).toBeInTheDocument();

    fireEvent.click(typeRadio);
    fireEvent.change(quantityInput, { target: { value: '2' } });
    fireEvent.change(reasonInput, {
      target: { value: 'Cần màn hình ngoài 27 inch để đọc tài liệu thiết kế hệ thống.' },
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi yêu cầu thiết bị/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        device_type: 'monitor',
        reason: 'Cần màn hình ngoài 27 inch để đọc tài liệu thiết kế hệ thống.',
        quantity: 2,
      });
      expect(
        screen.getByText(/Đã gửi yêu cầu cấp thiết bị thành công/i)
      ).toBeInTheDocument();
    });
  });

  it('does not render a zero-range counter or pagination on an empty list', async () => {
    vi.spyOn(apiService, 'getDeviceRequests').mockResolvedValue(emptyPage);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Chưa có yêu cầu cấp thiết bị nào')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Hiển thị từ/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trang sau' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trang trước' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi yêu cầu ngay/i })).toBeInTheDocument();
  });

  it('hides pagination when the request list fails to load', async () => {
    vi.spyOn(apiService, 'getDeviceRequests').mockRejectedValue(new Error('Mất kết nối máy chủ'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Không thể tải danh sách yêu cầu thiết bị')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Hiển thị từ/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trang sau' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trang trước' })).not.toBeInTheDocument();
  });

  it('blocks submission and shows an inline error when quantity is out of range', async () => {
    vi.spyOn(apiService, 'getDeviceRequests').mockResolvedValue(emptyPage);
    const createSpy = vi.spyOn(apiService, 'createDeviceRequest');

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Chưa có yêu cầu cấp thiết bị nào')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu mới/i }));

    fireEvent.change(screen.getByLabelText(/Lý do đề xuất/i), {
      target: { value: 'Cần thêm màn hình phụ để làm việc với tài liệu thiết kế.' },
    });
    fireEvent.change(screen.getByLabelText(/Số lượng/i), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu thiết bị/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Số lượng phải là số nguyên từ 1 đến 10.')
      ).toBeInTheDocument();
    });
    expect(createSpy).not.toHaveBeenCalled();
  });
});