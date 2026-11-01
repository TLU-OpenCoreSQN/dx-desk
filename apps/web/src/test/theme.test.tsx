// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ThemeSwitcher } from '../components/common/ThemeSwitcher';

describe('theme preferences', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('style');
  });

  it('applies and persists a selected accent', async () => {
    const view = render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Tùy biến giao diện và màu sắc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vàng' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-accent', 'yellow'));
    expect(JSON.parse(localStorage.getItem('dx-desk-theme')!).accent).toBe('yellow');
    view.unmount();
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-accent', 'yellow'));
    expect(JSON.parse(localStorage.getItem('dx-desk-theme')!).accent).toBe('yellow');
  });

  it('switches and restores each interface style', async () => {
    const view = render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Tùy biến giao diện và màu sắc' }));
    for (const [label, key] of [['Đơn giản', 'clear'], ['Hiện đại', 'modern'], ['Cổ điển', 'classic']]) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
      await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', key));
      expect(JSON.parse(localStorage.getItem('dx-desk-theme')!).theme).toBe(key);
    }
    view.unmount();
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'classic'));
  });

  it('restores a custom color and removes its inline overrides after switching presets', async () => {
    localStorage.setItem('dx-desk-theme', JSON.stringify({ accent: 'custom', customAccentHex: '#123456', customAccentBgHex: '#e0e0e0' }));
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#123456'));
    fireEvent.click(screen.getByRole('button', { name: 'Tùy biến giao diện và màu sắc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xanh lá' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-accent', 'green'));
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--color-primary-hover')).toBe('');
  });
});
