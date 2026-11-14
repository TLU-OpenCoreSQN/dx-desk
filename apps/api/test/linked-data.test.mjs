// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W5-04: JSON-LD/DCAT công khai. Dùng DB giả trả đúng các cột của hàm migration 020;
// test tích hợp (integration.mjs) chạy cùng PostgreSQL thật.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import jsonld from 'jsonld';
import { Database } from '../dist/database.js';
import {
  catalogDocument, LD_CONTENT_TYPE, LinkedDataController, NOT_FOUND_MESSAGE, resourceDocument, validCode,
} from '../dist/linked-data.js';

const categories = {
  vpn: { code: 'vpn', name: 'Kết nối VPN', description: 'Không kết nối được mạng nội bộ từ xa' },
  account: { code: 'account', name: 'Tài khoản', description: 'Đăng nhập và quyền truy cập' },
};
const deviceTypes = { laptop: { code: 'laptop', name: 'Máy tính xách tay', description: '' } };
const license = 'https://creativecommons.org/publicdomain/zero/1.0/';
const datasets = [
  { code: 'tickets', title: 'Phiếu hỗ trợ', description: 'Mẫu phiếu.', license_url: license, modified: '2026-11-02' },
  { code: 'ticket-events', title: 'Sự kiện phiếu hỗ trợ', description: 'Mẫu sự kiện.', license_url: license, modified: '2026-11-02' },
  { code: 'sla-policies', title: 'Chính sách SLA', description: 'Mẫu SLA. Gồm 4 mức ưu tiên.', license_url: license,
    modified: new Date(2026, 10, 5) },
];
const queries = [];
const fakeDb = {
  pool: {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (sql.includes('private.linked_catalog()')) return { rows: datasets };
      if (sql.includes('private.linked_resource($1, $2)')) {
        const [kind, code] = params;
        const table = kind === 'device-types' ? deviceTypes : categories;
        return { rows: Object.hasOwn(table, code) ? [table[code]] : [] };
      }
      throw Object.assign(new Error('relation "secret" does not exist'), { code: '42P01' });
    },
  },
};

let app, base;
before(async () => {
  class TestModule {}
  Module({ controllers: [LinkedDataController], providers: [{ provide: Database, useValue: fakeDb }] })(TestModule);
  app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer();
  if (!server.listening) await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await app?.close(); });

test('W5-04 /ld/services/vpn is schema:Service JSON-LD that jsonld.expand() accepts', async () => {
  const response = await fetch(base + '/ld/services/vpn');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), LD_CONTENT_TYPE);
  const document = await response.json();
  assert.equal(document['@id'], '/ld/services/vpn');
  assert.equal(document['@type'], 'schema:Service');
  assert.equal(document['schema:identifier'], 'vpn');
  const [expanded] = await jsonld.expand(document, { base: 'https://dxdesk.example.test/' });
  assert.equal(expanded['@id'], 'https://dxdesk.example.test/ld/services/vpn');
  assert.deepEqual(expanded['@type'], ['https://schema.org/Service']);
  assert.equal(expanded['https://schema.org/name'][0]['@value'], 'Kết nối VPN');
  assert.equal(expanded['https://schema.org/identifier'][0]['@value'], 'vpn');
  // Không cần base: jsonld vẫn mở rộng được với IRI tương đối như trình duyệt nhận.
  assert.equal((await jsonld.expand(document)).length, 1);
});

test('W5-04 request types and device types keep the fixture URI scheme and types', async () => {
  const term = await (await fetch(base + '/ld/request-types/account')).json();
  assert.equal(term['@type'], 'schema:DefinedTerm');
  assert.equal(term['@id'], '/ld/request-types/account');
  const product = await (await fetch(base + '/ld/device-types/laptop')).json();
  assert.deepEqual(product, {
    '@context': product['@context'], '@id': '/ld/device-types/laptop', '@type': 'schema:Product',
    'schema:name': 'Máy tính xách tay', 'schema:identifier': 'laptop',
  });
  const [expanded] = await jsonld.expand(product);
  assert.deepEqual(expanded['@type'], ['https://schema.org/Product']);
});

test('W5-04 catalog is a dcat:Catalog with three licensed, dated, distributed datasets', async () => {
  const response = await fetch(base + '/ld/catalog');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), LD_CONTENT_TYPE);
  assert.equal(response.headers.get('x-dxdesk-catalog'), null, 'Chỉ mẫu tĩnh mới gắn header sample');
  const catalog = await response.json();
  assert.equal(catalog['@type'], 'dcat:Catalog');
  assert.deepEqual(catalog['dct:modified'], { '@value': '2026-11-05', '@type': 'xsd:date' });
  assert.equal(catalog['dcat:dataset'].length, 3);
  for (const dataset of catalog['dcat:dataset']) {
    assert.equal(dataset['@type'], 'dcat:Dataset');
    assert.equal(dataset['dcat:keyword'], 'Dữ liệu giả lập');
    assert.deepEqual(dataset['dct:license'], { '@id': license });
    assert.match(dataset['dct:modified']['@value'], /^\d{4}-\d{2}-\d{2}$/);
    assert.match(dataset['dcat:distribution']['dcat:downloadURL']['@id'], /^\/data\/synthetic\/[a-z-]+\.json$/);
  }
  assert.deepEqual(catalog['dcat:dataset'].map(dataset => dataset['@id']),
    ['/ld/catalog#tickets', '/ld/catalog#ticket-events', '/ld/catalog#sla-policies']);
  const expanded = await jsonld.expand(catalog, { base: 'https://dxdesk.example.test/' });
  const datasetsIri = 'http://www.w3.org/ns/dcat#dataset';
  assert.equal(expanded[0][datasetsIri].length, 3);
});

test('W5-04 unknown codes, kinds, paths and methods return a fixed Vietnamese 404', async () => {
  queries.length = 0;
  for (const [path, method] of [
    ['/ld/services/khong-co', 'GET'], ['/ld/device-types/vpn', 'GET'], ['/ld/tickets/vpn', 'GET'],
    ['/ld/services/VPN', 'GET'], ['/ld/services/a%27%20OR%201%3D1', 'GET'], ['/ld/khac', 'GET'],
    ['/ld/services/vpn/extra', 'GET'], ['/ld/catalog', 'POST'], ['/ld/services/vpn', 'DELETE'],
  ]) {
    const response = await fetch(base + path, { method });
    assert.equal(response.status, 404, `${method} ${path}`);
    assert.deepEqual(await response.json(), { statusCode: 404, message: NOT_FOUND_MESSAGE, error: 'Not Found' });
  }
  // Mã sai định dạng hay nhóm lạ bị chặn trước khi chạm DB.
  assert.deepEqual(queries.map(query => query.params), [['services', 'khong-co'], ['device-types', 'vpn']]);
});

test('W5-04 document builders and code validation', () => {
  assert.equal(validCode('system-error'), true);
  for (const bad of ['', 'a', 'VPN', '1vpn', '../x', 'x'.repeat(41)]) assert.equal(validCode(bad), false, bad);
  assert.equal('schema:description' in resourceDocument('device-types', deviceTypes.laptop), false);
  assert.equal(resourceDocument('services', categories.vpn)['schema:description'], categories.vpn.description);
  assert.equal('dct:modified' in catalogDocument([]), false);
});
