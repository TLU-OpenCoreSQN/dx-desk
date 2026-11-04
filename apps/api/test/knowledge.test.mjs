// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { articleUrl, CreateSelfService, presentArticles, wikiBaseUrl } from '../dist/knowledge.js';

test('W5-08 Wiki base URL accepts only plain http(s) origins and paths', () => {
  assert.equal(wikiBaseUrl('http://localhost:18030/'), 'http://localhost:18030');
  assert.equal(wikiBaseUrl('https://wiki.example.edu.vn/kb'), 'https://wiki.example.edu.vn/kb');
  for (const invalid of [undefined, '', 'javascript:alert(1)', 'ftp://wiki', 'http://u:p@wiki', 'http://wiki/?q=1', 'không-phải-url']) {
    assert.equal(wikiBaseUrl(invalid), null, String(invalid));
  }
});

test('W5-08 article URLs are built only from constrained wiki paths', () => {
  assert.equal(articleUrl('http://wiki', 'ho-tro/vpn'), 'http://wiki/ho-tro/vpn');
  assert.equal(articleUrl(null, 'ho-tro/vpn'), null);
  for (const bad of ['../admin', '/ho-tro', 'ho tro', 'HO-TRO', 'a?b']) assert.equal(articleUrl('http://wiki', bad), null, bad);
  const [article] = presentArticles([{ id: 'a', slug: 'vpn', title: 'VPN', summary: 's', wiki_path: 'ho-tro/vpn' }], 'http://wiki');
  assert.deepEqual(article, { id: 'a', slug: 'vpn', title: 'VPN', summary: 's', url: 'http://wiki/ho-tro/vpn' });
  assert.equal('wiki_path' in article, false);
});

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = value => pipe.transform(value, { metatype: CreateSelfService, type: 'body' });
test('W5-08 self-service body accepts only category/article ids, never a user id', async () => {
  const body = { category_id: '10000000-0000-4000-8000-000000000001', article_id: '20000000-0000-4000-8000-000000000001' };
  assert.deepEqual({ ...(await validate(body)) }, body);
  await assert.rejects(validate({ ...body, user_id: '30000000-0000-4000-8000-000000000001' }));
  await assert.rejects(validate({ ...body, article_id: 'vpn' }));
  await assert.rejects(validate({ category_id: body.category_id }));
});
