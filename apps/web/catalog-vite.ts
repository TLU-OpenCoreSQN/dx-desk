// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import type { Connect, Plugin } from 'vite';
import { sampleCatalog, sampleResources } from './catalog-fixtures';

export function catalogFallback(): Plugin {
  const files = new Map(Object.entries({ '/ld/catalog': sampleCatalog, ...sampleResources })
    .map(([path, json]) => [path, JSON.stringify(json, null, 2) + '\n']));
  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    const path = request.url?.split('?')[0];
    if (!path?.startsWith('/ld/')) return next();
    const json = files.get(path);
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      response.setHeader('Allow', 'GET, HEAD');
      response.statusCode = 405;
    } else if (json === undefined) response.statusCode = 404;
    else {
      response.setHeader('Content-Type', 'application/ld+json; charset=utf-8');
      response.setHeader('X-DXDesk-Catalog', 'sample');
    }
    response.end(request.method === 'GET' && response.statusCode === 200 ? json : undefined);
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
