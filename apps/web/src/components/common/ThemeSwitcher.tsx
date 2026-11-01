// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useRef, useState } from 'react';
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
    <span className="inline-flex h-3.5 w-7 shrink-0 overflow-hidden rounded-[3px] border border-[#d6d5d2]">
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
  const colorInputRef = useRef<HTMLInputElement>(null);

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
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Hidden color input for custom accent */}
      <input
        ref={colorInputRef}
        type="color"
        className="sr-only"
        value={customAccentHex}
        onChange={(e) => setCustomAccent(e.target.value)}
      />

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Tùy biến giao diện và màu sắc"
        aria-expanded={isOpen}
        title="Tùy biến giao diện và màu sắc"
        className={`h-9 w-9 rounded-[6px] border flex items-center justify-center transition-all ${
          isOpen
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-tint)] text-[var(--color-primary)] shadow-xs'
            : 'border-[#e4e3e0] bg-white text-[#5f5e5a] hover:bg-[#f1f1ef] hover:text-[#211f1b] shadow-2xs'
        }`}
      >
        <Palette className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Tùy biến giao diện"
          className="absolute right-0 mt-2 w-72 max-h-[82vh] overflow-y-auto rounded-[8px] border border-[#e4e3e0] bg-white p-2 text-xs text-[#211f1b] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.05)] z-50 animate-in fade-in-50 zoom-in-95"
        >
          {/* Section: Kiểu giao diện */}
          <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8a8884]">
            Giao diện
          </div>
          <div className="space-y-0.5">
            {THEME_PRESETS.map((preset) => {
              const selected = theme === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setTheme(preset.key as ThemeKey)}
                  className={`w-full flex items-center justify-between p-2 rounded-[5px] text-left transition-colors ${
                    selected
                      ? 'bg-[#f7f6f3] font-semibold text-[#211f1b]'
                      : 'hover:bg-[#fbfaf8] text-[#5f5e5a]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-[#211f1b]">{preset.label}</div>
                    <div className="text-[11px] text-[#8a8884] leading-tight mt-0.5">
                      {preset.description}
                    </div>
                  </div>
                  {selected && <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="my-2 border-t border-[#e4e3e0]" />

          {/* Section: Màu chủ đạo */}
          <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8a8884]">
            Màu chủ đạo
          </div>
          <div className="space-y-0.5">
            {ACCENT_PRESETS.map((preset) => {
              const selected = accent === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setAccent(preset.key as AccentKey)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-[5px] text-left transition-colors ${
                    selected
                      ? 'bg-[#f7f6f3] font-semibold text-[#211f1b]'
                      : 'hover:bg-[#fbfaf8] text-[#5f5e5a]'
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
              onClick={() => {
                colorInputRef.current?.click();
              }}
              className={`w-full flex items-center gap-2.5 p-2 rounded-[5px] text-left transition-colors ${
                accent === 'custom'
                  ? 'bg-[#f7f6f3] font-semibold text-[#211f1b]'
                  : 'hover:bg-[#fbfaf8] text-[#5f5e5a]'
              }`}
            >
              <SwatchSquare color={customAccentHex} bg={customAccentBgHex} />
              <Pipette className="w-3.5 h-3.5 text-[#8a8884]" />
              <span className="flex-1 text-xs">Tùy chỉnh</span>
              {accent === 'custom' && <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0" />}
            </button>
          </div>

          <div className="my-2 border-t border-[#e4e3e0]" />

          {/* Section: Mode & Table Grid */}
          <div className="space-y-0.5">
            {/* Chế độ tối */}
            <button
              type="button"
              onClick={toggleMode}
              className="w-full flex items-center justify-between p-2 rounded-[5px] text-left text-xs hover:bg-[#fbfaf8] text-[#211f1b] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {mode === 'light' ? (
                  <Moon className="w-4 h-4 text-[#5f5e5a]" />
                ) : (
                  <Sun className="w-4 h-4 text-[#cb912f]" />
                )}
                <span>Chế độ tối</span>
              </div>
              <span className="text-[11px] font-semibold text-[#8a8884]">
                {mode === 'dark' ? 'Đang bật' : 'Đang tắt'}
              </span>
            </button>

            {/* Viền ô bảng */}
            <button
              type="button"
              onClick={() => setTableGridLines(!tableGridLines)}
              className="w-full flex items-center justify-between p-2 rounded-[5px] text-left text-xs hover:bg-[#fbfaf8] text-[#211f1b] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Grid3x3 className="w-4 h-4 text-[#5f5e5a]" />
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
