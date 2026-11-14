// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W5-04: JSON-LD/DCAT công khai, chỉ đọc. Nội dung sinh từ dữ liệu tham chiếu trong
// PostgreSQL qua các hàm SECURITY DEFINER của migration 020 và 023; không cần JWT.
// Lược đồ URI và hình dạng JSON giữ đúng như mẫu tĩnh apps/web/catalog-fixtures.ts.
import { All, Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { Database } from './database';

export const LD_CONTENT_TYPE = 'application/ld+json; charset=utf-8';
export const NOT_FOUND_MESSAGE = 'Không tìm thấy tài nguyên dữ liệu liên kết.';

export const ldContext = {
  dcat: 'http://www.w3.org/ns/dcat#',
  dct: 'http://purl.org/dc/terms/',
  schema: 'https://schema.org/',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};

/** Nhóm URI -> kiểu schema.org, cùng thứ tự với resourceGroups của web. */
export const resourceKinds = {
  services: 'schema:Service',
  'request-types': 'schema:DefinedTerm',
  'device-types': 'schema:Product',
} as const;
export type ResourceKind = keyof typeof resourceKinds;

const CODE = /^[a-z][a-z0-9_-]{1,39}$/;
export function validCode(code: string): boolean { return CODE.test(code); }

export type ResourceRow = { code: string; name: string; description: string };
export type DatasetRow = { code: string; title: string; description: string; license_url: string; modified: string | Date };

/** pg trả kiểu date thành Date theo múi giờ cục bộ; chuẩn hóa về YYYY-MM-DD. */
function isoDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
const xsdDate = (value: string) => ({ '@value': value, '@type': 'xsd:date' });
const ref = (iri: string) => ({ '@id': iri });

export function resourceDocument(kind: ResourceKind, row: ResourceRow) {
  const path = `/ld/${kind}/${row.code}`;
  return {
    '@context': ldContext, '@id': path, '@type': resourceKinds[kind],
    'schema:name': row.name, 'schema:identifier': row.code,
    ...(row.description.trim() ? { 'schema:description': row.description } : {}),
  };
}

export function catalogDocument(rows: DatasetRow[]) {
  const dates = rows.map(row => isoDate(row.modified)).sort();
  const modified = dates.at(-1);
  return {
    '@context': ldContext, '@id': '/ld/catalog', '@type': 'dcat:Catalog',
    'dct:title': 'Danh mục dữ liệu giả lập DX-Desk',
    ...(modified ? { 'dct:modified': xsdDate(modified) } : {}),
    'dcat:dataset': rows.map(row => ({
      '@id': `/ld/catalog#${row.code}`, '@type': 'dcat:Dataset',
      'dct:title': row.title, 'dct:description': row.description,
      'dct:license': ref(row.license_url), 'dct:modified': xsdDate(isoDate(row.modified)),
      'dcat:keyword': 'Dữ liệu giả lập',
      'dcat:distribution': {
        '@type': 'dcat:Distribution', 'dcat:downloadURL': ref(`/data/synthetic/${row.code}.json`),
        'dct:license': ref(row.license_url),
        'dcat:mediaType': ref('https://www.iana.org/assignments/media-types/application/json'),
      },
    })),
  };
}

@Controller('ld')
export class LinkedDataController {
  constructor(private readonly db: Database) {}

  @Get('catalog')
  @Header('Content-Type', LD_CONTENT_TYPE)
  @Header('Cache-Control', 'public, max-age=300')
  async catalog() {
    const rows = (await this.db.pool.query<DatasetRow>('SELECT * FROM private.linked_catalog()')).rows;
    return catalogDocument(rows);
  }

  @Get(':kind')
  @Header('Content-Type', LD_CONTENT_TYPE)
  @Header('Cache-Control', 'public, max-age=300')
  async collection(@Param('kind') kind: string) {
    if (!Object.hasOwn(resourceKinds, kind)) throw new NotFoundException(NOT_FOUND_MESSAGE);
    const { rows } = await this.db.pool.query<ResourceRow>('SELECT * FROM private.linked_resources($1)', [kind]);
    return { '@context': ldContext, '@id': `/ld/${kind}`, '@graph': rows.map(row => {
      const { '@context': _context, ...resource } = resourceDocument(kind as ResourceKind, row);
      return resource;
    }) };
  }

  @Get(':kind/:code')
  @Header('Content-Type', LD_CONTENT_TYPE)
  @Header('Cache-Control', 'public, max-age=300')
  async resource(@Param('kind') kind: string, @Param('code') code: string) {
    if (!Object.hasOwn(resourceKinds, kind) || !validCode(code)) throw new NotFoundException(NOT_FOUND_MESSAGE);
    const row = (await this.db.pool.query<ResourceRow>(
      'SELECT * FROM private.linked_resource($1, $2)', [kind, code])).rows[0];
    if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return resourceDocument(kind as ResourceKind, row);
  }

  // Mọi đường dẫn hay phương thức khác dưới /ld/ đều 404 với thông báo cố định.
  @All('*path')
  unknown(): never { throw new NotFoundException(NOT_FOUND_MESSAGE); }
}
