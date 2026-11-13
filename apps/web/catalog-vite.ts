// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import type { Connect, Plugin } from 'vite';
import { sampleCatalog, sampleResources } from './catalog-fixtures';

/**
 * Dev/preview: /ld/* đi tới API thật qua gateway (W5-04) khi stack đang chạy; chỉ khi
 * không kết nối được gateway mới phục vụ mẫu tĩnh kèm header X-DXDesk-Catalog: sample.
 */
export function catalogFallback(gateway?: string): Plugin {
  const files = new Map(Object.entries({ '/ld/catalog': sampleCatalog, ...sampleResources })
    .map(([path, json]) => [path, JSON.stringify(json, null, 2) + '\n']));
  function sample(path: string, method: string, response: Parameters<Connect.NextHandleFunction>[1]) {
    const json = files.get(path);
    if (!['GET', 'HEAD'].includes(method)) {
      response.setHeader('Allow', 'GET, HEAD');
      response.statusCode = 405;
    } else if (json === undefined) response.statusCode = 404;
    else {
      response.setHeader('Content-Type', 'application/ld+json; charset=utf-8');
      response.setHeader('X-DXDesk-Catalog', 'sample');
    }
    response.end(method === 'GET' && response.statusCode === 200 ? json : undefined);
  }
  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    const path = request.url?.split('?')[0];
    if (!path?.startsWith('/ld/')) return next();
    const method = request.method ?? '';
    if (!gateway || !['GET', 'HEAD'].includes(method)) return sample(path, method, response);
    void fetch(new URL(path, gateway), {
      method, headers: { Accept: 'application/ld+json' }, signal: AbortSignal.timeout(1500),
    }).then(async upstream => {
      if (upstream.status >= 500) return sample(path, method, response);
      response.statusCode = upstream.status;
      // Stack cũ chưa có route W5-04 thì nginx trả mẫu: giữ nguyên header đánh dấu mẫu.
      for (const name of ['Content-Type', 'X-DXDesk-Catalog']) {
        const value = upstream.headers.get(name);
        if (value) response.setHeader(name, value);
      }
      response.end(method === 'GET' ? Buffer.from(await upstream.arrayBuffer()) : undefined);
    }, () => sample(path, method, response));
  };
  return {
    name: 'dxdesk-catalog-sample',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
    generateBundle() {
      for (const [path, source] of files) this.emitFile({ type: 'asset', fileName: path.slice(1) + '.json', source });
    },
  };
}
