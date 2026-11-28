// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { preloadModulesConfig } from './modules/config';
// Be Vietnam Pro tự host (OFL-1.1): mỗi tệp CSS khai báo các subset vietnamese/latin/latin-ext theo
// unicode-range, trình duyệt chỉ tải phần cần dùng; font-display: swap nên chữ hiện ngay bằng font hệ thống.
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './index.css';

// W6-11: đọc /config/modules.json ngay, song song với tải chunk và khởi tạo Keycloak.
void preloadModulesConfig();

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
