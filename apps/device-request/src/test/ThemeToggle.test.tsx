// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle, getThemeMode, applyThemeMode } from '../ThemeToggle';
import { Workspace } from '../App';
import type { CurrentUser } from '../workflow';

const rest = vi.hoisted(() => ({
  listRequests: vi.fn(),
  createRequest: vi.fn(),
  transition: vi.fn(),
  listEvents: vi.fn(),
  handoverUrl: vi.fn(),
}));
vi.mock('../rest', () => ({ ...rest, REQUEST_PAGE_SIZE: 25 }));
vi.mock('../keycloak', () => ({ initKeycloak: vi.fn(), currentUser: vi.fn(), logout: vi.fn() }));

const employee: CurrentUser = {
  id: 'employee-1',
  name: 'test.user',
  department: 'phong-hanh-chinh',
  roles: ['Employee'],
};

describe('ThemeToggle & Workspace header alignment', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    vi.resetAllMocks();
    rest.listRequests.mockResolvedValue([]);
  });

  it('defaults to light mode when localStorage is empty', () => {
    expect(getThemeMode()).toBe('light');
    applyThemeMode('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reads dark mode from JSON in localStorage', () => {
    localStorage.setItem('dx-desk-theme', JSON.stringify({ mode: 'dark' }));
    expect(getThemeMode()).toBe('dark');
  });

  it('handles corrupted JSON in localStorage gracefully without throwing', () => {
    localStorage.setItem('dx-desk-theme', 'invalid-json{');
    expect(getThemeMode()).toBe('light');
  });

  it('toggles dark mode class on documentElement and persists to localStorage on click', async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Chuyển chế độ giao diện sáng/tối' });
    expect(button).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Toggle to dark
    await userEvent.click(button);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    const storedDark = JSON.parse(localStorage.getItem('dx-desk-theme') || '{}');
    expect(storedDark.mode).toBe('dark');

    // Toggle back to light
    await userEvent.click(button);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    const storedLight = JSON.parse(localStorage.getItem('dx-desk-theme') || '{}');
    expect(storedLight.mode).toBe('light');
  });

  it('renders DX-Desk aligned header with brand mark, role tag, and navigation link', async () => {
    render(<Workspace user={employee} />);
    await screen.findByText('Bạn chưa gửi đề nghị nào.');

    // Brand logo
    expect(screen.getByText('DX')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Xin cấp thiết bị' })).toBeInTheDocument();
    expect(screen.getByText('Module 2')).toBeInTheDocument();

    // User identity and role tag
    const identity = screen.getByTestId('identity');
    expect(identity).toHaveTextContent('test.user');
    expect(identity).toHaveTextContent('Nhân viên');
    expect(identity).toHaveTextContent('đơn vị phong-hanh-chinh');

    // Theme toggle button in header
    expect(screen.getByRole('button', { name: 'Chuyển chế độ giao diện sáng/tối' })).toBeInTheDocument();

    // Navigation back to DX-Desk
    const backLink = screen.getByRole('link', { name: '← Về DX-Desk' });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/');

    // Logout button
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });
});
