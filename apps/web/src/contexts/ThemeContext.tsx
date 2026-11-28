// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemeKey = 'clear' | 'modern' | 'classic';
export type AccentKey =
  | 'corporate-blue'
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
  { key: 'corporate-blue', label: 'Doanh nghiệp', swatch: '#1d4ed8', swatchBg: '#eff6ff' },
  { key: 'blue', label: 'Xanh dương', swatch: '#0a78be', swatchBg: '#deeef8' },
  { key: 'green', label: 'Xanh lá', swatch: '#059669', swatchBg: '#ecfdf5' },
  { key: 'yellow', label: 'Vàng', swatch: '#d97706', swatchBg: '#fefce8' },
  { key: 'gray', label: 'Xám', swatch: '#64748b', swatchBg: '#f1f5f9' },
  { key: 'purple', label: 'Tím', swatch: '#7c3aed', swatchBg: '#f5f3ff' },
  { key: 'default', label: 'Mặc định', swatch: '#1d4ed8', swatchBg: '#eff6ff' },
  { key: 'orange', label: 'Cam', swatch: '#d9730d', swatchBg: '#fbecdd' },
  { key: 'brown', label: 'Nâu', swatch: '#9f6b53', swatchBg: '#f4eeee' },
  { key: 'pink', label: 'Hồng', swatch: '#db2777', swatchBg: '#fdf2f8' },
  { key: 'red', label: 'Đỏ', swatch: '#dc2626', swatchBg: '#fef2f2' },
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

export const STORAGE_KEY = 'dx-desk-theme';
export const MIGRATION_VERSION = 'v2-corporate';
const DEFAULT_ACCENT: AccentKey = 'corporate-blue';

export interface ThemePreferences {
  version?: string;
  mode: ThemeMode;
  theme: ThemeKey;
  accent: AccentKey;
  customAccentHex: string;
  customAccentBgHex: string;
  tableGridLines: boolean;
}

function deriveLightTint(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#eff6ff';
  return `rgb(${Math.round(r * 0.12 + 255 * 0.88)},${Math.round(g * 0.12 + 255 * 0.88)},${Math.round(b * 0.12 + 255 * 0.88)})`;
}

function runMigrationGuard(): void {
  // Mọi truy cập localStorage đều nằm trong try: trình duyệt chặn bộ nhớ có thể ném SecurityError.
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed: unknown = JSON.parse(saved);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      if (record.version !== MIGRATION_VERSION) {
        // Safely migrate user to corporate default while preserving light/dark mode preference
        const isCustom = record.accent === 'custom' && typeof record.customAccentHex === 'string' && /^#[\da-f]{6}$/i.test(record.customAccentHex);
        const migrated: ThemePreferences = {
          mode: record.mode === 'dark' ? 'dark' : 'light',
          accent: isCustom ? 'custom' : DEFAULT_ACCENT,
          theme: typeof record.theme === 'string' && THEME_PRESETS.some(p => p.key === record.theme) ? (record.theme as ThemeKey) : 'modern',
          customAccentHex: isCustom ? (record.customAccentHex as string) : '#0a78be',
          customAccentBgHex: isCustom && typeof record.customAccentBgHex === 'string' ? (record.customAccentBgHex as string) : deriveLightTint(isCustom ? (record.customAccentHex as string) : '#0a78be'),
          tableGridLines: typeof record.tableGridLines === 'boolean' ? record.tableGridLines : true,
          version: MIGRATION_VERSION,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Bộ nhớ không dùng được: bỏ qua, dùng giá trị mặc định.
    }
  }
}

function readPreferences(): ThemePreferences {
  runMigrationGuard();
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      saved = parsed as Record<string, unknown>;
    }
  } catch {
    // Invalid JSON or unavailable storage must not prevent the app from loading.
  }
  const customAccentHex = typeof saved.customAccentHex === 'string' && /^#[\da-f]{6}$/i.test(saved.customAccentHex)
    ? saved.customAccentHex : '#0a78be';
  return {
    version: MIGRATION_VERSION,
    mode: saved.mode === 'dark' ? 'dark' : 'light',
    theme: THEME_PRESETS.find(preset => preset.key === saved.theme)?.key ?? 'modern',
    accent: saved.accent === 'custom' ? 'custom' : (ACCENT_PRESETS.find(preset => preset.key === saved.accent)?.key ?? DEFAULT_ACCENT),
    customAccentHex,
    customAccentBgHex: deriveLightTint(customAccentHex),
    tableGridLines: typeof saved.tableGridLines === 'boolean' ? saved.tableGridLines : true,
  };
}

function applyThemeToDOM(state: ThemePreferences) {
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
    if (state.mode === 'dark') {
      // Chế độ tối: để quy tắc :root.dark[data-accent] trong index.css dẫn xuất hover/nền nhấn.
      root.style.removeProperty('--color-primary-hover');
      root.style.removeProperty('--color-primary-tint');
    } else {
      root.style.setProperty('--color-primary-hover', 'color-mix(in srgb, var(--color-primary), black 20%)');
      root.style.setProperty(
        '--color-primary-tint',
        state.customAccentBgHex || deriveLightTint(state.customAccentHex)
      );
    }
  } else {
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-primary-hover');
    root.style.removeProperty('--color-primary-tint');
  }
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [saved] = useState(readPreferences);
  const [mode, setModeState] = useState<ThemeMode>(saved.mode);
  const [theme, setThemeState] = useState<ThemeKey>(saved.theme);
  const [accent, setAccentState] = useState<AccentKey>(saved.accent);
  const [customAccentHex, setCustomAccentHex] = useState(saved.customAccentHex);
  const [customAccentBgHex, setCustomAccentBgHex] = useState(saved.customAccentBgHex);
  const [tableGridLines, setTableGridLinesState] = useState(saved.tableGridLines);

  // Sync to DOM and localStorage whenever values change
  useEffect(() => {
    const state: ThemePreferences = {
      version: MIGRATION_VERSION,
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
