// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import * as apiService from '../services/api';
import * as authContext from '../contexts/AuthContext';

describe('HomePage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

  it('renders signed-out introduction and public API health when unauthenticated', async () => {
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
      version: '0.1.0',
    });

    renderComponent();

    expect(screen.getByText(/Hệ thống hỗ trợ IT nội bộ/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Đăng nhập hệ thống \(SSO\)/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Dịch vụ đang hoạt động bình thường')).toBeInTheDocument();
      expect(screen.getByText('0.1.0')).toBeInTheDocument();
    });
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
      version: '0.1.0',
    });

    renderComponent();

    expect(
      screen.getByText(/Dịch vụ đăng nhập đang tạm thời gián đoạn/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Đăng nhập hệ thống \(SSO\)/i })
    ).toBeDisabled();
  });

  it('renders authenticated dashboard with user roles and action cards', async () => {
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
      version: '0.1.0',
    });

    renderComponent();

    expect(screen.getByText('manager.1')).toBeInTheDocument();
    expect(screen.getByText('Quản lý (Manager)')).toBeInTheDocument();
    expect(screen.getByText('Phiếu yêu cầu IT')).toBeInTheDocument();
    expect(screen.getByText('Gửi sự cố mới')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu cấp thiết bị')).toBeInTheDocument();
  });
});
