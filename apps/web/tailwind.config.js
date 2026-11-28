// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
          hover: 'var(--color-surface-hover)',
          card: 'var(--color-surface-card)',
          sidebar: 'var(--color-surface-sidebar)',
        },
        content: {
          DEFAULT: 'var(--color-content)',
          muted: 'var(--color-content-muted)',
          subtle: 'var(--color-content-subtle)',
        },
        edge: {
          DEFAULT: 'var(--color-edge)',
          subtle: 'var(--color-edge-subtle)',
          strong: 'var(--color-edge-strong)',
          control: 'var(--color-edge-control)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          tint: 'var(--color-primary-tint)',
          border: 'var(--color-primary-border)',
          text: 'var(--color-primary-text)',
        },
        state: {
          hover: 'var(--color-state-hover)',
          selected: 'var(--color-state-selected)',
          'selected-edge': 'var(--color-state-selected-edge)',
          'disabled-bg': 'var(--color-state-disabled-bg)',
          'disabled-text': 'var(--color-state-disabled-text)',
        },
        ring: 'var(--color-ring)',
        status: {
          success: 'var(--color-status-success)',
          'success-bg': 'var(--color-status-success-bg)',
          'success-border': 'var(--color-status-success-border)',
          'success-solid': 'var(--color-status-success-solid)',
          warning: 'var(--color-status-warning)',
          'warning-bg': 'var(--color-status-warning-bg)',
          'warning-border': 'var(--color-status-warning-border)',
          'warning-solid': 'var(--color-status-warning-solid)',
          danger: 'var(--color-status-danger)',
          'danger-bg': 'var(--color-status-danger-bg)',
          'danger-border': 'var(--color-status-danger-border)',
          'danger-solid': 'var(--color-status-danger-solid)',
          info: 'var(--color-status-info)',
          'info-bg': 'var(--color-status-info-bg)',
          'info-border': 'var(--color-status-info-border)',
          'info-solid': 'var(--color-status-info-solid)',
          pending: 'var(--color-status-pending)',
          'pending-bg': 'var(--color-status-pending-bg)',
          'pending-border': 'var(--color-status-pending-border)',
          'pending-solid': 'var(--color-status-pending-solid)',
          neutral: 'var(--color-status-neutral)',
          'neutral-bg': 'var(--color-status-neutral-bg)',
          'neutral-border': 'var(--color-status-neutral-border)',
          'neutral-solid': 'var(--color-status-neutral-solid)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm, 4px)',
        DEFAULT: 'var(--radius-md, 6px)',
        md: 'var(--radius-md, 6px)',
        lg: 'var(--radius-lg, 8px)',
        full: 'var(--radius-full, 9999px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
};
