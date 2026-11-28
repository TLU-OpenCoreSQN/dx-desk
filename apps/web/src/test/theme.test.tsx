// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as auth from '../contexts/AuthContext';
import * as api from '../services/api';
import { ModuleProvider } from '../modules/ModuleContext';
import { Header } from '../components/layout/Header';

describe('fixed enterprise light corporate-blue baseline', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isKeycloakOffline: false,
      roles: ['Employee'],
      username: 'nhan.vien',
      profile: { id: 'u-1', username: 'nhan.vien', roles: ['Employee'] },
      token: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      hasRole: () => true,
    } as unknown as ReturnType<typeof auth.useAuth>);
    vi.spyOn(api, 'getHealth').mockResolvedValue({
      status: 'ok',
      version: '0.5.0',
      time: '2026-11-28T00:00:00Z',
    } as unknown as Awaited<ReturnType<typeof api.getHealth>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('renders Header without theme or layout customization controls and sets no root switching attributes', async () => {
    render(
      <MemoryRouter>
        <ModuleProvider enabled={null}>
          <Header onToggleMobileNav={() => {}} />
        </ModuleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Hoạt động/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tùy biến giao diện/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Tùy biến giao diện/i })).not.toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
    expect(Array.from(document.documentElement.attributes).some((attr) => attr.name.startsWith('data-'))).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('locks index.css to light corporate-blue tokens and fixed corporate shell without switching selectors', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

    expect(css).toContain('color-scheme: light;');
    expect(css).toContain('--color-background: #f8fafc;');
    expect(css).toContain('--color-surface: #ffffff;');
    expect(css).toContain('--color-content: #0f172a;');
    expect(css).toContain('--color-primary: #1d4ed8;');
    expect(css).toContain('.dx-app-header {');
    expect(css).toContain('.dx-main {');

    expect(css).not.toContain('.dark');
    expect(css).not.toMatch(/\[data-(?!numeric\b)/);
  });
});
