// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import * as keycloakService from '../services/keycloak';
import * as apiService from '../services/api';

const TestAuthConsumer: React.FC = () => {
  const {
    isAuthenticated,
    isLoading,
    isKeycloakOffline,
    username,
    roles,
    hasRole,
    logout,
    refreshToken,
  } = useAuth();

  if (isLoading) return <div>Đang tải xác thực...</div>;

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="offline-status">{isKeycloakOffline ? 'offline' : 'online'}</div>
      <div data-testid="username">{username || 'anonymous'}</div>
      <div data-testid="roles">{roles.join(',')}</div>
      <div data-testid="is-manager">{hasRole('Manager') ? 'yes' : 'no'}</div>
      <button onClick={() => void logout()}>Đăng xuất</button>
      <button onClick={() => void refreshToken()}>Làm mới phiên</button>
    </div>
  );
};

describe('AuthContext and Provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders unauthenticated state when Keycloak init returns false', async () => {
    vi.spyOn(keycloakService, 'initKeycloak').mockResolvedValue(false);
    vi.spyOn(keycloakService, 'isIdentityServerOffline').mockReturnValue(false);

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Đang tải xác thực...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('offline-status')).toHaveTextContent('online');
    expect(screen.getByTestId('username')).toHaveTextContent('anonymous');
  });

  it('sets isKeycloakOffline to true when identity server is unreachable', async () => {
    vi.spyOn(keycloakService, 'initKeycloak').mockResolvedValue(false);
    vi.spyOn(keycloakService, 'isIdentityServerOffline').mockReturnValue(true);

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Đang tải xác thực...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('offline-status')).toHaveTextContent('offline');
  });

  it('sets user profile and roles when authenticated', async () => {
    vi.spyOn(keycloakService, 'initKeycloak').mockResolvedValue(true);
    vi.spyOn(keycloakService, 'getAccessToken').mockReturnValue('mock-token');
    vi.spyOn(keycloakService, 'isIdentityServerOffline').mockReturnValue(false);
    vi.spyOn(apiService, 'getMe').mockResolvedValue({
      id: 'usr-1',
      username: 'manager.1',
      roles: ['Manager', 'Employee'],
    });

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    expect(screen.getByTestId('username')).toHaveTextContent('manager.1');
    expect(screen.getByTestId('roles')).toHaveTextContent('Manager,Employee');
    expect(screen.getByTestId('is-manager')).toHaveTextContent('yes');
  });

  it('clears state on logout', async () => {
    vi.spyOn(keycloakService, 'initKeycloak').mockResolvedValue(true);
    vi.spyOn(keycloakService, 'getAccessToken').mockReturnValue('mock-token');
    vi.spyOn(keycloakService, 'logout').mockResolvedValue();
    vi.spyOn(apiService, 'getMe').mockResolvedValue({
      id: 'usr-1',
      username: 'employee.a',
      roles: ['Employee'],
    });

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    });
    expect(screen.getByTestId('username')).toHaveTextContent('anonymous');
  });

  it('clears identity and roles when the session is lost', async () => {
    vi.spyOn(keycloakService, 'initKeycloak').mockResolvedValue(true);
    vi.spyOn(keycloakService, 'getAccessToken').mockReturnValue('token');
    vi.spyOn(apiService, 'getMe').mockResolvedValue({ id: 'user', username: 'manager.1', roles: ['Manager'] });
    render(<AuthProvider><TestAuthConsumer /></AuthProvider>);
    await screen.findByText('manager.1');
    act(() => keycloakService.expireSession());
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('username')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('roles')).toBeEmptyDOMElement();
  });

  it('does not restore profile from a stale response after session loss', async () => {
    let complete!: (value: { id: string; username: string; roles: ['Manager'] }) => void;
    vi.spyOn(keycloakService, 'initKeycloak').mockResolvedValue(true);
    vi.spyOn(keycloakService, 'getAccessToken').mockReturnValue('token');
    const request = vi.spyOn(apiService, 'getMe').mockReturnValue(new Promise(resolve => { complete = resolve; }));
    render(<AuthProvider><TestAuthConsumer /></AuthProvider>);
    await waitFor(() => expect(request).toHaveBeenCalled());
    await act(async () => {
      keycloakService.expireSession();
      complete({ id: 'user', username: 'old-manager', roles: ['Manager'] });
    });
    expect(screen.getByTestId('username')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('roles')).toBeEmptyDOMElement();
  });

  it('rejects profile 401 without falling back to a stale token identity', async () => {
    vi.spyOn(keycloakService, 'initKeycloak').mockResolvedValue(true);
    vi.spyOn(keycloakService, 'getAccessToken').mockReturnValue('stale');
    vi.spyOn(keycloakService, 'getParsedUsername').mockReturnValue('old-manager');
    vi.spyOn(apiService, 'getMe').mockRejectedValue(new apiService.ApiClientError(401, 'Expired'));
    render(<AuthProvider><TestAuthConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('username')).toHaveTextContent('anonymous');
  });

  it('clears identity if refreshing the token fails', async () => {
    vi.spyOn(keycloakService, 'initKeycloak').mockResolvedValue(true);
    vi.spyOn(keycloakService, 'getAccessToken').mockReturnValue('token');
    vi.spyOn(keycloakService, 'ensureFreshToken').mockResolvedValue(false);
    vi.spyOn(apiService, 'getMe').mockResolvedValue({ id: 'user', username: 'employee.a', roles: ['Employee'] });
    render(<AuthProvider><TestAuthConsumer /></AuthProvider>);
    await screen.findByText('employee.a');
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới phiên' }));
    await waitFor(() => expect(screen.getByTestId('username')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('roles')).toBeEmptyDOMElement();
  });
});
