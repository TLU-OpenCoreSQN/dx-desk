// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemeKey = 'clear' | 'modern' | 'classic';
export type AccentKey =
  | 'default'
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'
  | 'custom';

export interface ThemePreset {
  key: ThemeKey;
  label: string;
  description: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { key: 'clear', label: 'Đơn giản', description: 'Phẳng, khoáng đạt, tối giản' },
  { key: 'modern', label: 'Hiện đại', description: 'Kính mờ trong suốt, ánh sáng mềm' },
  { key: 'classic', label: 'Cổ điển', description: 'Header màu, đường viền rõ, sọc bảng' },
];

export interface AccentPreset {
  key: AccentKey;
  label: string;
  swatch: string;
  swatchBg: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { key: 'default', label: 'Mặc định', swatch: '#cb912f', swatchBg: '#fbf3db' },
  { key: 'gray', label: 'Xám', swatch: '#787774', swatchBg: '#f1f1ef' },
  { key: 'brown', label: 'Nâu', swatch: '#9f6b53', swatchBg: '#f4eeee' },
  { key: 'orange', label: 'Cam', swatch: '#d9730d', swatchBg: '#fbecdd' },
  { key: 'yellow', label: 'Vàng', swatch: '#cb912f', swatchBg: '#fbf3db' },
  { key: 'green', label: 'Xanh lá', swatch: '#448361', swatchBg: '#edf3ec' },
  { key: 'blue', label: 'Xanh dương', swatch: '#0a78be', swatchBg: '#deeef8' },
  { key: 'purple', label: 'Tím', swatch: '#9065b0', swatchBg: '#f4eeff' },
  { key: 'pink', label: 'Hồng', swatch: '#c14c8a', swatchBg: '#fbe4ee' },
  { key: 'red', label: 'Đỏ', swatch: '#ee0033', swatchBg: '#ffe0e8' },
];

export interface ThemeContextType {
  mode: ThemeMode;
  theme: ThemeKey;
  accent: AccentKey;
  customAccentHex: string;
  customAccentBgHex: string;
  tableGridLines: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setTheme: (theme: ThemeKey) => void;
  setAccent: (accent: AccentKey) => void;
  setCustomAccent: (hex: string) => void;
  setTableGridLines: (enabled: boolean) => void;
}

const STORAGE_KEY = 'dx-desk-theme';

function deriveLightTint(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#deeef8';
  return `rgb(${Math.round(r * 0.12 + 255 * 0.88)},${Math.round(g * 0.12 + 255 * 0.88)},${Math.round(b * 0.12 + 255 * 0.88)})`;
}

function applyThemeToDOM(state: {
  mode: ThemeMode;
  theme: ThemeKey;
  accent: AccentKey;
  customAccentHex: string;
  customAccentBgHex: string;
  tableGridLines: boolean;
}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (state.mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  root.setAttribute('data-accent', state.accent);
  root.setAttribute('data-theme', state.theme);
  root.setAttribute('data-grid-lines', state.tableGridLines ? 'true' : 'false');

  if (state.accent === 'custom' && state.customAccentHex) {
    root.style.setProperty('--color-primary', state.customAccentHex);
    root.style.setProperty('--color-primary-hover', 'color-mix(in srgb, var(--color-primary), black 20%)');
    root.style.setProperty(
      '--color-primary-tint',
      state.customAccentBgHex || deriveLightTint(state.customAccentHex)
    );
  } else {
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-primary-hover');
    root.style.removeProperty('--color-primary-tint');
  }
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [saved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const [mode, setModeState] = useState<ThemeMode>(saved.mode ?? 'light');
  const [theme, setThemeState] = useState<ThemeKey>(saved.theme ?? 'modern');
  const [accent, setAccentState] = useState<AccentKey>(saved.accent ?? 'blue');
  const [customAccentHex, setCustomAccentHex] = useState<string>(saved.customAccentHex ?? '#0a78be');
  const [customAccentBgHex, setCustomAccentBgHex] = useState<string>(saved.customAccentBgHex ?? '#deeef8');
  const [tableGridLines, setTableGridLinesState] = useState<boolean>(
    typeof saved.tableGridLines === 'boolean' ? saved.tableGridLines : true
  );

  // Sync to DOM and localStorage whenever values change
  useEffect(() => {
    const state = {
      mode,
      theme,
      accent,
      customAccentHex,
      customAccentBgHex,
      tableGridLines,
    };
    applyThemeToDOM(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [mode, theme, accent, customAccentHex, customAccentBgHex, tableGridLines]);

  const toggleMode = () => {
    setModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setCustomAccent = (hex: string) => {
    setCustomAccentHex(hex);
    setCustomAccentBgHex(deriveLightTint(hex));
    setAccentState('custom');
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        theme,
        accent,
        customAccentHex,
        customAccentBgHex,
        tableGridLines,
        setMode: setModeState,
        toggleMode,
        setTheme: setThemeState,
        setAccent: setAccentState,
        setCustomAccent,
        setTableGridLines: setTableGridLinesState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
