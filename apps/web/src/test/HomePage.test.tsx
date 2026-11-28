// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from '../modules/core/pages/HomePage';
import { ModuleProvider } from '../modules/ModuleContext';
import * as apiService from '../services/api';
import * as authContext from '../contexts/AuthContext';

describe('HomePage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <ModuleProvider enabled={null}>
          <HomePage />
        </ModuleProvider>
      </MemoryRouter>
    );

  it('renders signed-out introduction without duplicating the Header service status', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      isKeycloakOffline: false,
      token: null,
      profile: null,
      username: null,
      roles: [],
      hasRole: () => false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    vi.spyOn(apiService, 'getHealth').mockResolvedValue({
      status: 'ok',
      service: 'dx-desk-api',
      version: '0.5.0',
    });

    renderComponent();

    expect(screen.getByText(/Hệ thống hỗ trợ IT nội bộ/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Đăng nhập hệ thống \(SSO\)/i })
    ).toBeInTheDocument();

    expect(screen.queryByText('Dịch vụ đang hoạt động bình thường')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('displays offline notice when Keycloak is unavailable without crashing', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      isKeycloakOffline: true,
      token: null,
      profile: null,
      username: null,
      roles: [],
      hasRole: () => false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    vi.spyOn(apiService, 'getHealth').mockResolvedValue({
      status: 'ok',
      service: 'dx-desk-api',
      version: '0.5.0',
    });

    renderComponent();

    expect(
      screen.getByText(/Dịch vụ đăng nhập đang tạm thời gián đoạn/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Đăng nhập hệ thống \(SSO\)/i })
    ).toBeDisabled();
  });

  it('renders a Manager dashboard with operational shortcuts and honest priority guidance', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isKeycloakOffline: false,
      token: 'jwt-token',
      profile: { id: 'usr-mgr', username: 'manager.1', roles: ['Manager'] },
      username: 'manager.1',
      roles: ['Manager'],
      hasRole: (r) => r === 'Manager',
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    vi.spyOn(apiService, 'getHealth').mockResolvedValue({
      status: 'ok',
      service: 'dx-desk-api',
      version: '0.5.0',
    });

    renderComponent();

    expect(screen.getByRole('heading', { level: 1, name: /manager.1/ })).toBeInTheDocument();
    expect(screen.getByText('Quản lý')).toBeInTheDocument();
    expect(screen.getByText('Phiếu yêu cầu IT')).toBeInTheDocument();
    expect(screen.getByText('Gửi sự cố mới')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu cấp thiết bị')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bảng việc kỹ thuật viên/ })).toHaveAttribute('href', '/work-queue');
    expect(screen.getByRole('link', { name: /Phê duyệt phiếu hỗ trợ/ })).toHaveAttribute('href', '/approvals');
    expect(screen.getByRole('link', { name: /Báo cáo vận hành/ })).toHaveAttribute('href', '/bao-cao');
    // Không khuyên đặt mức Khẩn cấp: chỉ Quản lý được chọn mức này.
    expect(screen.queryByText(/mức ưu tiêns+Khẩn cấp/)).not.toBeInTheDocument();
    expect(screen.queryByText('Sẵn sàng 24/7')).not.toBeInTheDocument();
  });

  it('shows an Employee only the self-service shortcuts', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isKeycloakOffline: false,
      token: 'jwt-token',
      profile: { id: 'usr-emp', username: 'employee.a', roles: ['Employee'] },
      username: 'employee.a',
      roles: ['Employee'],
      hasRole: (r) => r === 'Employee',
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    renderComponent();

    expect(screen.getByRole('link', { name: /Gửi sự cố mới/ })).toHaveAttribute('href', '/tickets/new');
    expect(screen.queryByRole('link', { name: /Bảng việc kỹ thuật viên/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Phê duyệt phiếu hỗ trợ/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Công việc vận hành')).not.toBeInTheDocument();
  });
});
