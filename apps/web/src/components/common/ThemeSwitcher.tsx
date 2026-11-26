// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Palette,
  Check,
  Moon,
  Sun,
  Pipette,
  Grid3x3,
} from 'lucide-react';
import {
  useTheme,
  THEME_PRESETS,
  ACCENT_PRESETS,
  ThemeKey,
  AccentKey,
} from '../../contexts/ThemeContext';

function SwatchSquare({ color, bg }: { color: string; bg: string }) {
  return (
    <span className="inline-flex h-3.5 w-7 shrink-0 overflow-hidden rounded-xs border border-edge">
      <span className="flex-1" style={{ backgroundColor: color }} />
      <span className="flex-1" style={{ backgroundColor: bg }} />
    </span>
  );
}

export const ThemeSwitcher: React.FC = () => {
  const {
    mode,
    theme,
    accent,
    customAccentHex,
    customAccentBgHex,
    tableGridLines,
    toggleMode,
    setTheme,
    setAccent,
    setCustomAccent,
    setTableGridLines,
  } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (isOpen) {
      panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={menuRef} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
    }}>
      {/* Hidden color input for custom accent */}
      <input
        ref={colorInputRef}
        type="color"
        aria-label="Màu chủ đạo tùy chỉnh"
        tabIndex={-1}
        className="sr-only"
        value={customAccentHex}
        onChange={(e) => setCustomAccent(e.target.value)}
      />

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Tùy biến giao diện và màu sắc"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? panelId : undefined}
        title="Tùy biến giao diện và màu sắc"
        className={`h-9 w-9 rounded-md border flex items-center justify-center transition-all ${
          isOpen
            ? 'border-primary bg-primary-tint text-[var(--color-primary-ink)] shadow-xs'
            : 'border-edge bg-surface text-content-muted hover:bg-surface-muted hover:text-content shadow-2xs'
        }`}
      >
        <Palette className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Tùy biến giao diện"
          className="fixed left-4 right-4 top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-lg border border-edge bg-surface p-2.5 text-xs text-content shadow-lg z-50 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
        >
          {/* Section: Kiểu giao diện */}
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-content-subtle">
            Giao diện
          </div>
          <div className="space-y-0.5">
            {THEME_PRESETS.map((preset) => {
              const selected = theme === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTheme(preset.key as ThemeKey)}
                  className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                    selected
                      ? 'bg-surface-warm font-semibold text-content'
                      : 'hover:bg-surface-sidebar text-content-muted'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-content">{preset.label}</div>
                    <div className="text-[11px] text-content-subtle leading-tight mt-0.5">
                      {preset.description}
                    </div>
                  </div>
                  {selected && <Check className="w-4 h-4 text-[var(--color-primary-ink)] shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="my-2 border-t border-edge" />

          {/* Section: Bảng màu chuẩn doanh nghiệp */}
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-content-subtle">
            Màu chủ đạo
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-0.5">
            {ACCENT_PRESETS.map((preset) => {
              const selected = accent === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAccent(preset.key as AccentKey)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-md text-left transition-colors ${
                    selected
                      ? 'bg-surface-warm font-semibold text-content'
                      : 'hover:bg-surface-sidebar text-content-muted'
                  }`}
                >
                  <SwatchSquare color={preset.swatch} bg={preset.swatchBg} />
                  <span className="flex-1 text-xs">{preset.label}</span>
                  {selected && <Check className="w-4 h-4 text-[var(--color-primary-ink)] shrink-0" />}
                </button>
              );
            })}

            {/* Custom Accent */}
            <button
              type="button"
              aria-pressed={accent === 'custom'}
              onClick={() => {
                colorInputRef.current?.click();
              }}
              className={`w-full flex items-center gap-2.5 p-2 rounded-md text-left transition-colors ${
                accent === 'custom'
                  ? 'bg-surface-warm font-semibold text-content'
                  : 'hover:bg-surface-sidebar text-content-muted'
              }`}
            >
              <SwatchSquare color={customAccentHex} bg={customAccentBgHex} />
              <Pipette className="w-3.5 h-3.5 text-content-subtle" />
              <span className="flex-1 text-xs">Tùy chỉnh</span>
              {accent === 'custom' && <Check className="w-4 h-4 text-[var(--color-primary-ink)] shrink-0" />}
            </button>
          </div>

          <div className="my-2 border-t border-edge" />

          {/* Section: Tùy chọn hiển thị & Viền ô bảng */}
          <div className="space-y-0.5">
            {/* Chế độ tối */}
            <button
              type="button"
              onClick={toggleMode}
              aria-pressed={mode === 'dark'}
              className="w-full flex items-center justify-between p-2 rounded-md text-left text-xs hover:bg-surface-sidebar text-content transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {mode === 'light' ? (
                  <Moon className="w-4 h-4 text-content-muted" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
                <span>Chế độ tối</span>
              </div>
              <span className="text-[11px] font-semibold text-content-subtle">
                {mode === 'dark' ? 'Đang bật' : 'Đang tắt'}
              </span>
            </button>

            {/* Viền ô bảng */}
            <button
              type="button"
              onClick={() => setTableGridLines(!tableGridLines)}
              aria-pressed={tableGridLines}
              className="w-full flex items-center justify-between p-2 rounded-md text-left text-xs hover:bg-surface-sidebar text-content transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Grid3x3 className="w-4 h-4 text-content-muted" />
                <span>Viền ô bảng</span>
              </div>
              <span className="text-[11px] font-semibold text-[var(--color-primary-ink)]">
                {tableGridLines ? 'Có' : 'Không'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
