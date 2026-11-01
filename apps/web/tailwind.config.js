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
        primary: {
          DEFAULT: '#0a78be',
          hover: '#08639e',
          active: '#064f7e',
          tint: '#deeef8',
          subtle: '#f0f7fc',
        },
        surface: {
          DEFAULT: '#ffffff',
          warm: '#eeede9',
          muted: '#f6f5f3',
        },
        content: {
          DEFAULT: '#211f1b',
          muted: '#5f5e5a',
          subtle: '#8c8a85',
        },
        edge: {
          DEFAULT: '#d4d4d0',
          subtle: '#e5e5e2',
          strong: '#a8a8a2',
        },
        success: {
          DEFAULT: '#448361',
          hover: '#36694e',
          tint: '#e8f3ed',
          border: '#b8dcce',
        },
        warning: {
          DEFAULT: '#cb912f',
          hover: '#a87724',
          tint: '#fcf3e6',
          border: '#f5ddb2',
        },
        danger: {
          DEFAULT: '#d44c47',
          hover: '#b53c37',
          tint: '#fcedec',
          border: '#f6c3c1',
        },
        info: {
          DEFAULT: '#0a78be',
          hover: '#08639e',
          tint: '#deeef8',
          border: '#b9daf0',
        },
        purple: {
          DEFAULT: '#9065b0',
          hover: '#794e99',
          tint: '#f4eeff',
          border: '#e0cdfc',
        },
        navy: {
          50: '#deeef8',
          100: '#c5e2f3',
          200: '#9bc8e8',
          300: '#64a7da',
          400: '#3488cb',
          500: '#0a78be',
          600: '#08639e',
          700: '#07507f',
          800: '#08436a',
          900: '#0c3858',
          950: '#07243b',
        },
        teal: {
          50: '#deeef8',
          100: '#deeef8',
          200: '#9bc8e8',
          300: '#64a7da',
          400: '#3488cb',
          500: '#0a78be',
          600: '#0a78be',
          700: '#08639e',
          800: '#07507f',
          900: '#0c3858',
          950: '#07243b',
        },
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '4px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
