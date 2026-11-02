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
    <span className="inline-flex h-3.5 w-7 shrink-0 overflow-hidden rounded-[3px] border border-[var(--color-edge)]">
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
        className={`h-9 w-9 rounded-[6px] border flex items-center justify-center transition-all ${
          isOpen
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-tint)] text-[var(--color-primary)] shadow-xs'
            : 'border-[var(--color-edge-subtle)] bg-surface text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)] shadow-2xs'
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
          className="fixed left-4 right-4 top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface p-2 text-xs text-[var(--color-content)] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.05)] z-50 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72"
        >
          {/* Section: Kiểu giao diện */}
          <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-content-subtle)]">
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
                  className={`w-full flex items-center justify-between p-2 rounded-[5px] text-left transition-colors ${
                    selected
                      ? 'bg-[var(--color-surface-warm)] font-semibold text-[var(--color-content)]'
                      : 'hover:bg-[var(--color-surface-sidebar)] text-[var(--color-content-muted)]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-[var(--color-content)]">{preset.label}</div>
                    <div className="text-[11px] text-[var(--color-content-subtle)] leading-tight mt-0.5">
                      {preset.description}
                    </div>
                  </div>
                  {selected && <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="my-2 border-t border-[var(--color-edge-subtle)]" />

          {/* Section: Màu chủ đạo */}
          <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-content-subtle)]">
            Màu chủ đạo
          </div>
          <div className="space-y-0.5">
            {ACCENT_PRESETS.map((preset) => {
              const selected = accent === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAccent(preset.key as AccentKey)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-[5px] text-left transition-colors ${
                    selected
                      ? 'bg-[var(--color-surface-warm)] font-semibold text-[var(--color-content)]'
                      : 'hover:bg-[var(--color-surface-sidebar)] text-[var(--color-content-muted)]'
                  }`}
                >
                  <SwatchSquare color={preset.swatch} bg={preset.swatchBg} />
                  <span className="flex-1 text-xs">{preset.label}</span>
                  {selected && <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
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
              className={`w-full flex items-center gap-2.5 p-2 rounded-[5px] text-left transition-colors ${
                accent === 'custom'
                  ? 'bg-[var(--color-surface-warm)] font-semibold text-[var(--color-content)]'
                  : 'hover:bg-[var(--color-surface-sidebar)] text-[var(--color-content-muted)]'
              }`}
            >
              <SwatchSquare color={customAccentHex} bg={customAccentBgHex} />
              <Pipette className="w-3.5 h-3.5 text-[var(--color-content-subtle)]" />
              <span className="flex-1 text-xs">Tùy chỉnh</span>
              {accent === 'custom' && <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
            </button>
          </div>

          <div className="my-2 border-t border-[var(--color-edge-subtle)]" />

          {/* Section: Mode & Table Grid */}
          <div className="space-y-0.5">
            {/* Chế độ tối */}
            <button
              type="button"
              onClick={toggleMode}
              aria-pressed={mode === 'dark'}
              className="w-full flex items-center justify-between p-2 rounded-[5px] text-left text-xs hover:bg-[var(--color-surface-sidebar)] text-[var(--color-content)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {mode === 'light' ? (
                  <Moon className="w-4 h-4 text-[var(--color-content-muted)]" />
                ) : (
                  <Sun className="w-4 h-4 text-[#cb912f]" />
                )}
                <span>Chế độ tối</span>
              </div>
              <span className="text-[11px] font-semibold text-[var(--color-content-subtle)]">
                {mode === 'dark' ? 'Đang bật' : 'Đang tắt'}
              </span>
            </button>

            {/* Viền ô bảng */}
            <button
              type="button"
              onClick={() => setTableGridLines(!tableGridLines)}
              aria-pressed={tableGridLines}
              className="w-full flex items-center justify-between p-2 rounded-[5px] text-left text-xs hover:bg-[var(--color-surface-sidebar)] text-[var(--color-content)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Grid3x3 className="w-4 h-4 text-[var(--color-content-muted)]" />
                <span>Viền ô bảng</span>
              </div>
              <span className="text-[11px] font-semibold text-[var(--color-primary)]">
                {tableGridLines ? 'Có' : 'Không'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
