// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DataCatalogPage } from '../pages/DataCatalogPage';
import { sampleCatalog, sampleResources } from '../../catalog-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('Danh mục dữ liệu công khai', () => {
  it('renders all three DCAT datasets without authentication and opens their sample downloads', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(sampleCatalog), {
      headers: { 'Content-Type': 'application/ld+json', 'X-DXDesk-Catalog': 'sample' },
    }));
    vi.stubGlobal('fetch', fetcher);
    render(<DataCatalogPage />);
    expect(screen.getByRole('heading', { name: 'Danh mục dữ liệu DX-Desk' })).toBeVisible();
    const section = within(screen.getByRole('region', { name: 'Ba bộ dữ liệu DCAT' }));
    expect(section.getAllByText('Dữ liệu giả lập')).toHaveLength(3);
    expect(section.getAllByRole('link', { name: 'CC0 1.0' })).toHaveLength(3);
    expect(section.getByRole('link', { name: 'Tải phiếu hỗ trợ' })).toHaveAttribute('href',
      window.location.origin + '/data/synthetic/tickets.json');
    expect(section.getAllByRole('link', { name: 'Kiểm tra trên JSON-LD Playground' })).toHaveLength(3);
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/ld/catalog',
      expect.objectContaining({ credentials: 'omit', headers: { Accept: 'application/ld+json' } })));
  });

  it('shows formatted JSON-LD, copies a stable URI and passes the document to Playground', async () => {
    const path = '/ld/services/vpn';
    const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(
      url === '/ld/catalog' ? sampleCatalog : sampleResources[path],
    )));
    const copy = vi.fn(async () => {});
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
    try {
      vi.stubGlobal('fetch', fetcher);
      render(<DataCatalogPage />);
      fireEvent.click(within(screen.getByRole('region', { name: 'Dịch vụ' })).getByRole('button', { name: 'Kết nối VPN' }));
      const panel = within(screen.getByRole('region', { name: 'JSON-LD Kết nối VPN' }));
      const url = await panel.findByRole('link', { name: 'Kiểm tra trên JSON-LD Playground' });
      const playground = new URL(url.getAttribute('href')!);
      expect(playground.origin).toBe('https://json-ld.org');
      expect(JSON.parse(playground.searchParams.get('json-ld')!)['@type']).toBe('schema:Service');
      expect(panel.getByText(/"schema:identifier": "vpn"/)).toBeVisible();
      fireEvent.click(panel.getByRole('button', { name: 'Sao chép URI' }));
      await waitFor(() => expect(copy).toHaveBeenCalledWith(window.location.origin + path));
      expect(await panel.findByText('Đã sao chép URI.')).toBeVisible();
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('uses a labelled sample if the W5-04 endpoints are unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 404 })));
    render(<DataCatalogPage />);
    expect(screen.getByText('Đang hiển thị danh mục mẫu đi kèm bản demo.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Màn hình' }));
    expect(await screen.findByText('Tài nguyên mẫu')).toBeVisible();
    expect(screen.getByText(/"@type": "schema:Product"/)).toBeVisible();
  });
});
