// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DataCatalogPage } from '../pages/DataCatalogPage';
import { sampleCatalog, sampleCollections, sampleResources } from '../../catalog-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('Danh mục dữ liệu công khai', () => {
  it('renders all three DCAT datasets without authentication and opens their sample downloads', async () => {
    const fetcher = vi.fn(async (path: string) => new Response(JSON.stringify(path === '/ld/catalog' ? sampleCatalog : sampleCollections[path]), {
      headers: { 'Content-Type': 'application/ld+json', 'X-DXDesk-Catalog': 'sample' },
    }));
    vi.stubGlobal('fetch', fetcher);
    render(<DataCatalogPage />);
    expect(screen.getByRole('heading', { name: 'Danh mục dữ liệu DX-Desk' })).toBeVisible();
    const section = within(screen.getByRole('region', { name: 'Ba bộ dữ liệu DCAT' }));
    expect(await section.findAllByText('Dữ liệu giả lập')).toHaveLength(3);
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
      url === '/ld/catalog' ? sampleCatalog : sampleCollections[url] ?? sampleResources[url],
    )));
    const copy = vi.fn(async () => {});
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
    try {
      vi.stubGlobal('fetch', fetcher);
      render(<DataCatalogPage />);
      fireEvent.click(await within(screen.getByRole('region', { name: 'Dịch vụ' })).findByRole('button', { name: 'Kết nối VPN' }));
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
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network unavailable'); }));
    render(<DataCatalogPage />);
    expect(await screen.findByText('Đang hiển thị danh mục mẫu đi kèm bản demo.')).toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: 'Màn hình' }));
    expect(await screen.findByText('Tài nguyên mẫu')).toBeVisible();
    expect(screen.getByText(/"@type": "schema:Product"/)).toBeVisible();
  });

  it('lists live resources and respects a 404 even when an offline sample exists', async () => {
    const services = { ...sampleCollections['/ld/services'], '@graph': [
      { '@id': '/ld/services/crm', 'schema:name': 'CRM nội bộ' },
      { '@id': '/ld/services/vpn', 'schema:name': 'VPN doanh nghiệp' },
    ] };
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path === '/ld/services/vpn' ? new Response('', { status: 404 })
      : Response.json(path === '/ld/catalog' ? sampleCatalog : path === '/ld/services' ? services : sampleCollections[path])));
    render(<DataCatalogPage />);
    const group = within(screen.getByRole('region', { name: 'Dịch vụ' }));
    expect(await group.findByRole('button', { name: 'CRM nội bộ' })).toBeVisible();
    expect(group.queryByRole('button', { name: 'Phần mềm' })).not.toBeInTheDocument();
    fireEvent.click(group.getByRole('button', { name: 'VPN doanh nghiệp' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tài nguyên không còn trong danh mục.');
    expect(screen.queryByText('Tài nguyên mẫu')).not.toBeInTheDocument();
  });
});
