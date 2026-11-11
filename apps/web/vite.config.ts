// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { catalogFallback } from './catalog-vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:9080';

  return {
    plugins: [react(), catalogFallback()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/rest': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
