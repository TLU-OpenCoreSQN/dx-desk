// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chunkText, searchKnowledge, syncKnowledge, wikiKnowledge } from './knowledge.mjs';

test('chunkText preserves Vietnamese text, caps chunk length and keeps overlap', () => {
  const text = Array.from({ length: 70 }, (_, i) => `Mật khẩu ${i} nên được đổi định kỳ.`).join(' ');
  const chunks = chunkText(text, 160, 42);
  assert.ok(chunks.length > 2 && chunks.every(chunk => chunk.length <= 160));
  assert.match(chunks.at(-1), /69 nên được đổi định kỳ\.$/);
  assert.ok(chunks[1].slice(0, 42).includes(chunks[0].split(' ').slice(-4).join(' ')));
});

test('Wiki revisions are embedded once, search masks stale data, and removed chunks are deleted', async t => {
  const article = { id: 3, path: 'ho-tro/vpn', locale: 'en', title: 'VPN', description: 'Mạng riêng',
    isPublished: true, isPrivate: false, updatedAt: '2026-11-17T00:00:00Z', content: 'VPN qua công ty. '.repeat(130) };
  const hidden = { ...article, id: 4, path: 'ho-tro/wifi', isPrivate: true };
  const arbitrary = { ...article, id: 5, path: 'tai-lieu/bi-mat' };
  const points = new Map();
  let exists = false, embeddings = 0, dependencyFailed = false;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
    let result;
    if (request.url === '/graphql') {
      assert.equal(request.headers.authorization, 'Bearer wiki-fixture');
      result = body.variables ? { data: { pages: { single: article } } } :
        { data: { pages: { list: [article, hidden, arbitrary] } } };
      if (body.variables) assert.equal(body.variables.id, article.id);
    } else if (request.url === '/api/embed') {
      if (dependencyFailed) response.statusCode = 503;
      embeddings++;
      result = { embeddings: body.input.map(() => [1, 2]) };
    } else if (/\/points\/scroll$/.test(request.url)) {
      result = { result: { points: [...points.values()] } };
    } else if (/\/points\/query$/.test(request.url)) {
      const [versions] = body.filter.must;
      result = { result: { points: [...points.values()].filter(point => versions.match.any.includes(point.payload.version)) } };
    } else if (/\/points\/delete\?wait=true$/.test(request.url)) {
      body.points.forEach(id => points.delete(id));
    } else if (/\/points\?wait=true$/.test(request.url)) {
      body.points.forEach(point => points.set(point.id, point));
    } else if (request.method === 'PUT') {
      assert.deepEqual(body.vectors, { size: 2, distance: 'Cosine' });
      exists = true;
    } else if (!exists) response.statusCode = 404;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(result ?? {}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const config = wikiKnowledge({ ASSISTANT_WIKI_URL: base, WIKI_INDEX_TOKEN: 'wiki-fixture',
    OLLAMA_URL: base, QDRANT_URL: base, WIKI_PUBLIC_URL: 'https://wiki.example.test' });

  assert.deepEqual(await syncKnowledge(config), { pages: 1, updated: 1, removed: 0 });
  const previous = points.size;
  assert.ok(previous > 1);
  assert.deepEqual(await syncKnowledge(config), { pages: 1, updated: 0, removed: 0 });
  assert.equal(embeddings, 1);
  assert.equal((await searchKnowledge(config, 'Kết nối VPN'))[0].url, 'https://wiki.example.test/en/ho-tro/vpn');

  article.updatedAt = '2026-11-17T01:00:00Z';
  article.content = 'Hướng dẫn VPN mới.';
  assert.deepEqual(await searchKnowledge(config, 'Kết nối VPN'), []);
  dependencyFailed = true;
  await assert.rejects(syncKnowledge(config), /HTTP 503/);
  assert.equal(points.size, previous);
  dependencyFailed = false;
  assert.deepEqual(await syncKnowledge(config), { pages: 1, updated: 1, removed: previous - 1 });
  assert.equal((await searchKnowledge(config, 'Kết nối VPN'))[0].text, article.content);
  article.isPublished = false;
  assert.deepEqual(await searchKnowledge(config, 'Kết nối VPN'), []);
  assert.deepEqual(await syncKnowledge(config), { pages: 0, updated: 0, removed: 1 });
  assert.equal(points.size, 0);
});

test('searchKnowledge handles Qdrant response without result safely', async t => {
  const article = { id: 3, path: 'ho-tro/vpn', locale: 'en', title: 'VPN', description: 'Mạng riêng',
    isPublished: true, isPrivate: false, updatedAt: '2026-11-17T00:00:00Z' };
  const server = createServer(async (request, response) => {
    for await (const _ of request) { /* drain */ }
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/graphql') return response.end(JSON.stringify({ data: { pages: { list: [article] } } }));
    if (request.url === '/api/embed') return response.end(JSON.stringify({ embeddings: [[1, 2]] }));
    response.end(JSON.stringify({}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const config = wikiKnowledge({ ASSISTANT_WIKI_URL: base, WIKI_INDEX_TOKEN: 'wiki-fixture', OLLAMA_URL: base, QDRANT_URL: base });
  assert.deepEqual(await searchKnowledge(config, 'VPN'), []);
});
