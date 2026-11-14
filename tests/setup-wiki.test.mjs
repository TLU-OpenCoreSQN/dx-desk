// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArticles, parseArticle, RETIRED_PATHS, wikiClient, wikiEnabled, WIKI_GROUPS } from '../scripts/setup-wiki.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('W5-08 six CC BY 4.0 articles match the wiki paths seeded in migration 012 and renamed in 016', async () => {
  const all = await loadArticles(root);
  // Trang chủ (path home) là trang mục lục của Wiki.js, không phải bài gợi ý theo danh mục.
  assert.equal(all.filter(article => article.path === 'home').length, 1, 'Wiki.js has a home page for /');
  const articles = all.filter(article => article.path !== 'home');
  assert.equal(articles.length, 6);
  const migration = await readFile(resolve(root, 'db/migrations/012_knowledge_self_service.sql'), 'utf8');
  let seeded = [...migration.matchAll(/'(ho-tro\/[a-z-]+)'\)/g)].map(match => match[1]);
  const renames = await readFile(resolve(root, 'db/migrations/016_knowledge_enterprise_wording.sql'), 'utf8');
  for (const [, to, from] of renames.matchAll(/wiki_path = '(ho-tro\/[a-z-]+)' WHERE wiki_path = '(ho-tro\/[a-z-]+)'/g)) {
    assert.ok(RETIRED_PATHS.includes(from), `${from} is removed from existing Wiki.js installs`);
    seeded = seeded.map(path => path === from ? to : path);
  }
  seeded.sort();
  assert.deepEqual(articles.map(article => article.path).sort(), seeded);
  for (const article of articles) {
    assert.ok(article.content.includes('CC BY 4.0'), `${article.path} carries attribution`);
    assert.ok(article.tags.length > 0 && article.title.length > 3);
  }
  const reuse = await readFile(resolve(root, 'REUSE.toml'), 'utf8');
  for (const article of articles) assert.ok(reuse.includes(`"docs/wiki/${article.path.split('/').pop()}.md"`));
  assert.ok(reuse.includes('"docs/wiki/home.md"'));
  const home = all.find(article => article.path === 'home');
  for (const article of articles) assert.ok(home.content.includes(`](/${article.path})`), `home links ${article.path}`);
});

test('W5-08 front matter parser rejects missing metadata and unsafe paths', () => {
  const article = parseArticle('---\ntitle: VPN\ndescription: d\npath: ho-tro/vpn\ntags: [a, b]\n---\n# Body\n');
  assert.deepEqual(article.tags, ['a', 'b']);
  assert.ok(article.content.startsWith('# Body'));
  assert.throws(() => parseArticle('# no front matter'));
  assert.throws(() => parseArticle('---\ntitle: x\ndescription: d\npath: ../admin\n---\nx'));
  assert.throws(() => parseArticle('---\ntitle: x\npath: ho-tro/x\n---\nx'));
});

test('W5-08 wikijs client is confidential, callback-only and never carries the API audience', () => {
  const client = wikiClient({ WIKI_PUBLIC_URL: 'https://wiki.example.edu.vn/', WIKI_CLIENT_SECRET: 's' });
  assert.equal(client.publicClient, false);
  assert.equal(client.directAccessGrantsEnabled, false);
  assert.deepEqual(client.redirectUris, ['https://wiki.example.edu.vn/login/keycloak/callback']);
  assert.ok(!client.protocolMappers.some(mapper => mapper.config['included.client.audience']));
  assert.equal(client.protocolMappers[0].config['access.token.claim'], 'false');
  assert.ok(!WIKI_GROUPS.Employee.includes('write:pages') && WIKI_GROUPS.Agent.includes('write:pages'));
});

test('W5-08 Wiki.js is enabled only for product profiles', () => {
  assert.equal(wikiEnabled({ COMPOSE_PROFILES: 'demo-light' }), true);
  assert.equal(wikiEnabled({ COMPOSE_PROFILES: 'benchmark, full' }), true);
  assert.equal(wikiEnabled({ COMPOSE_PROFILES: '' }), false);
  assert.equal(wikiEnabled({}), false);
});
