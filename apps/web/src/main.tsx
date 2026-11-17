// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { preloadModulesConfig } from './modules/config';
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
