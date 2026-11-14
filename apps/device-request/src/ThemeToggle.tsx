// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'dx-desk-theme';

export function getThemeMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'dark') return 'dark';
    if (raw === 'light') return 'light';
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.mode === 'dark') {
        return 'dark';
      }
    }
  } catch {
    // Fallback if localStorage or JSON is unavailable
  }
  return 'light';
}

export function applyThemeMode(mode: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  if (mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const initial = getThemeMode();
    applyThemeMode(initial);
    return initial;
  });

  useEffect(() => {
    applyThemeMode(mode);
  }, [mode]);

  function toggleMode() {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    applyThemeMode(next);
    try {
      let state: Record<string, unknown> = {};
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            state = parsed;
          }
        } catch {
          // Ignore parse errors
        }
      }
      state.mode = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label="Chuyển chế độ giao diện sáng/tối"
      title={mode === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-edge bg-surface text-content hover:bg-surface-warm transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {mode === 'dark' ? (
        <svg
          className="h-4 w-4 text-[#cb912f]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
