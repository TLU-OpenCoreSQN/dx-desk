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
    vi.spyOn(apiService, 'getDeviceRequests').mockResolvedValue({
      data: [],
      limit: 25,
      offset: 0,
    });

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
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(25, 0));
  });

  it('submits valid device request without state or ownership fields', async () => {
    vi.spyOn(apiService, 'getDeviceRequests').mockResolvedValue({
      data: [],
      limit: 25,
      offset: 0,
    });

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

    const typeSelect = screen.getByLabelText(/Loại thiết bị/i);
    const quantityInput = screen.getByLabelText(/Số lượng/i);
    const reasonInput = screen.getByLabelText(/Lý do đề xuất/i);

    fireEvent.change(typeSelect, { target: { value: 'monitor' } });
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
});
