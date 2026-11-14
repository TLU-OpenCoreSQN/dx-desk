// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Ứng dụng 2 chạy cùng origin với DX-Desk, dưới đường dẫn /thiet-bi/ của APISIX.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: '/thiet-bi/',
    plugins: [react()],
    server: {
      port: 5174,
      host: true,
      proxy: { '/rest': { target: env.VITE_PROXY_TARGET || 'http://localhost:9080', changeOrigin: true } },
    },
  };
});
