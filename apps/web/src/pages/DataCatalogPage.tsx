// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react';
import { catalogDatasets, playgroundUrl, resourceGroups, sampleCatalog, sampleCollections, sampleResources } from '../../catalog-fixtures';

type Document = Record<string, unknown>;
type CatalogResponse = { document: Document; sample: boolean };

async function readResource(path: string, fallback: Document | undefined, signal: AbortSignal): Promise<CatalogResponse> {
  let response: Response;
  let document: unknown;
  try {
    response = await fetch(path, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      credentials: 'omit',
      headers: { Accept: 'application/ld+json' },
    });
    if (response.ok) document = await response.json();
  } catch (error) {
    if (!signal.aborted && fallback) return { document: fallback, sample: true };
    throw error;
  }
  if (response.status === 404) throw new Error('Tài nguyên không còn trong danh mục.');
  if (response.status >= 500 && fallback) return { document: fallback, sample: true };
  if (!response.ok || !document || Array.isArray(document) || typeof document !== 'object' || !('@context' in document)) {
    throw new Error('Không tải được tài nguyên JSON-LD.');
  }
  return { document: document as Document, sample: response.headers.get('X-DXDesk-Catalog') === 'sample' };
}

function resourceItems(group: string, document: Document) {
  if (!Array.isArray(document['@graph'])) return [];
  const prefix = `/ld/${group}/`;
  return document['@graph'].flatMap(item => {
    const path = item?.['@id'];
    const name = item?.['schema:name'];
    return typeof path === 'string' && path.startsWith(prefix) && /^[a-z][a-z0-9_-]{1,39}$/.test(path.slice(prefix.length))
      && typeof name === 'string' ? [{ path, name }] : [];
  });
}

function Playground({ document, origin }: { document: Document; origin: string }) {
  return <a className="font-semibold text-primary underline" href={playgroundUrl(document, origin)}
    target="_blank" rel="noopener noreferrer">Kiểm tra trên JSON-LD Playground</a>;
}

export function DataCatalogPage() {
  const origin = window.location.origin;
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [collections, setCollections] = useState<Record<string, CatalogResponse | null>>({});
  const [catalogError, setCatalogError] = useState('');
  const [selection, setSelection] = useState<{ path: string; name: string; sample: boolean } | null>(null);
  const [resource, setResource] = useState<CatalogResponse | null>(null);
  const [resourceError, setResourceError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => {
    const request = new AbortController();
    void readResource('/ld/catalog', sampleCatalog, request.signal).then(response => {
      if (request.signal.aborted) return;
      if (catalogDatasets(response.document, origin).length !== 3) throw new Error('Danh mục DCAT không hợp lệ.');
      setCatalog(response);
    }).catch((error: Error) => { if (!request.signal.aborted) setCatalogError(error.message); });
    for (const group of resourceGroups) {
      const path = `/ld/${group.path}`;
      void readResource(path, sampleCollections[path], request.signal)
        .then(response => { if (!request.signal.aborted) setCollections(previous => ({ ...previous, [group.path]: response })); })
        .catch(() => { if (!request.signal.aborted) setCollections(previous => ({ ...previous, [group.path]: null })); });
    }
    return () => request.abort();
  }, [origin]);
  useEffect(() => {
    if (!selection) return;
    const request = new AbortController();
    void readResource(selection.path, selection.sample ? sampleResources[selection.path] : undefined, request.signal).then(response => {
      if (!request.signal.aborted) setResource(response);
    }).catch((error: Error) => { if (!request.signal.aborted) setResourceError(error.message); });
    return () => request.abort();
  }, [selection]);

  const datasets = catalog ? catalogDatasets(catalog.document, origin) : [];
  const uri = selection ? new URL(selection.path, origin).href : null;
  async function copyUri() {
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopyStatus('Đã sao chép URI.');
    } catch {
      setCopyStatus('Hãy chọn và sao chép URI trong ô bên cạnh.');
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-xl border border-edge bg-surface p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Dữ liệu mở · DCAT / JSON-LD</p>
        <h1 className="mt-2 text-2xl font-bold text-content sm:text-3xl">Danh mục dữ liệu DX-Desk</h1>
        <p className="mt-2 max-w-3xl text-sm text-content-muted">Khám phá các bộ dữ liệu giả lập và tài nguyên tham chiếu dùng trong bản demo.</p>
        {(catalog?.sample || Object.values(collections).some(group => group?.sample)) && <p className="mt-2 text-xs text-content-muted">Đang hiển thị danh mục mẫu đi kèm bản demo.</p>}
        <a href="/ld/catalog" className="mt-4 inline-block text-sm font-semibold text-primary underline">Mở danh mục DCAT (JSON-LD)</a>
      </header>

      <section aria-labelledby="datasets-title" className="space-y-3">
        <h2 id="datasets-title" className="text-lg font-bold text-content">Ba bộ dữ liệu DCAT</h2>
        {catalogError ? <p role="alert">{catalogError}</p> : !catalog && <p role="status">Đang tải danh mục…</p>}
        <ul className="grid gap-3 lg:grid-cols-3">
          {datasets.map(dataset => (
            <li key={dataset.download} className="flex min-w-0 flex-col gap-3 rounded-xl border border-edge bg-surface p-4 text-sm">
              <span className="self-start rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold">Dữ liệu giả lập</span>
              <h3 className="font-bold text-content">{dataset.title}</h3>
              <p className="flex-1 text-content-muted">{dataset.description}</p>
              <p>Giấy phép <a className="text-primary underline" href={dataset.license}
                target="_blank" rel="noopener noreferrer">{dataset.license.includes('/zero/1.0') ? 'CC0 1.0' : dataset.license}</a></p>
              <p>Cập nhật <time dateTime={dataset.updated}>{dataset.updated}</time></p>
              <a className="font-semibold text-primary underline" href={dataset.download} download>Tải {dataset.title.toLowerCase()}</a>
              <Playground document={dataset.document} origin={origin} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="resources-title" className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
        <h2 id="resources-title" className="text-lg font-bold text-content">Tài nguyên tham chiếu</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {resourceGroups.map(group => {
            const collection = collections[group.path];
            const items = collection ? resourceItems(group.path, collection.document) : [];
            return (
            <section key={group.path} aria-label={group.label}>
              <h3 className="text-sm font-bold text-content">{group.label}</h3>
              {collection === undefined && <p role="status">Đang tải danh sách…</p>}
              {collection === null && <p role="alert">Không tải được danh sách.</p>}
              {collection && items.length === 0 && <p>Không có tài nguyên đang hoạt động.</p>}
              <ul className="mt-2 space-y-1.5">
                {items.map(({ path, name }) => {
                  return <li key={path}><button type="button" aria-pressed={selection?.path === path}
                    className="min-h-10 w-full rounded-md border border-edge px-2 py-1 text-left text-sm text-primary hover:bg-surface-muted aria-pressed:bg-surface-muted"
                    onClick={() => { setResource(null); setResourceError(''); setCopyStatus(''); setSelection({ path, name, sample: !!collection?.sample }); }}>{name}</button></li>;
                })}
              </ul>
            </section>
          ); })}
        </div>
        {selection && <section aria-label={`JSON-LD ${selection.name}`} className="mt-5 min-w-0 space-y-3 border-t border-edge pt-4">
          <h3 className="font-bold text-content">{selection.name}</h3>
          <div className="flex flex-wrap gap-2">
            <input readOnly aria-label="URI tài nguyên" value={uri ?? ''} onFocus={event => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-edge bg-surface p-2 font-mono text-xs" />
            <button type="button" className="rounded-md border border-edge px-3 text-sm font-semibold" onClick={() => void copyUri()}>
              Sao chép URI
            </button>
          </div>
          <p role="status" className="text-sm text-content-muted">{copyStatus}</p>
          {resource ? <>
            <div className="flex flex-wrap gap-3 text-sm">
              <a className="text-primary underline" href={selection.path}>Mở tài nguyên JSON-LD</a>
              <Playground document={resource.document} origin={origin} />
              {resource.sample && <span className="text-content-muted">Tài nguyên mẫu</span>}
            </div>
            <pre tabIndex={0} className="max-w-full overflow-x-auto rounded-md bg-surface-muted p-3 text-xs"><code>{JSON.stringify(resource.document, null, 2)}</code></pre>
          </> : resourceError ? <p role="alert">{resourceError}</p> : <p role="status" className="text-sm">Đang tải JSON-LD…</p>}
        </section>}
      </section>
    </div>
  );
}
