// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { embed as embedText, llmConfig } from './llm.mjs';

export const knowledgePaths = [
  'ho-tro/email', 'ho-tro/mat-khau', 'ho-tro/phan-mem-ban-quyen',
  'ho-tro/phan-mem-nghiep-vu', 'ho-tro/vpn', 'ho-tro/wifi',
];
const locale = 'en'; // Wiki.js locale of the Vietnamese seed articles.
const schemaVersion = 1;
const hash = value => createHash('sha256').update(value).digest('hex');

export function wikiKnowledge(env = process.env) {
  const ai = llmConfig(env);
  return {
    wikiUrl: env.ASSISTANT_WIKI_URL || 'http://wikijs:3000',
    wikiPublicUrl: env.WIKI_PUBLIC_URL || 'http://localhost:18030',
    wikiToken: env.WIKI_INDEX_TOKEN,
    ai,
    qdrantUrl: env.QDRANT_URL || 'http://qdrant:6333',
    // Mỗi model nhúng có không gian vector riêng: đổi model là sang collection mới, chỉ mục lại từ đầu.
    collection: 'dxdesk_wiki_' + hash(`${schemaVersion}:${ai.embedModel}`).slice(0, 12),
  };
}

async function json(url, { method = 'GET', headers, body, timeout = 15000, allowMissing = false } = {}) {
  const response = await fetch(url, {
    method, headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error', signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (allowMissing && response.status === 404) return null;
    throw new Error(`Knowledge dependency returned HTTP ${response.status}`);
  }
  return response.json();
}

export async function wikiGraphql(config, query, variables) {
  if (!config.wikiToken) throw new Error('Missing Wiki.js knowledge API token');
  const response = await json(new URL('/graphql', config.wikiUrl), { method: 'POST',
    headers: { Authorization: 'Bearer ' + config.wikiToken }, body: { query, variables } });
  if (response.errors?.length || !response.data) throw new Error('Wiki.js rejected the knowledge query');
  return response.data;
}

async function listedPages(config) {
  const result = (await wikiGraphql(config, `query {
    pages { list(locale: "en") { id path title description locale isPrivate isPublished updatedAt } }
  }`)).pages.list;
  if (!Array.isArray(result)) throw new Error('Invalid Wiki.js page list');
  return result.filter(page => page.locale === locale && knowledgePaths.includes(page.path) &&
    page.isPublished === true && page.isPrivate === false && Number.isInteger(page.id) &&
    typeof page.title === 'string' && Number.isFinite(Date.parse(page.updatedAt)));
}

export function chunkText(content, limit = 950, overlap = 120) {
  const text = content.replace(/<!--[^]*?-->/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const chunks = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + limit, text.length);
    const boundary = text.lastIndexOf(' ', end);
    if (end < text.length && boundary > start + limit * 0.7) end = boundary;
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    const next = text.indexOf(' ', end - overlap);
    start = next >= end - overlap && next < end ? next + 1 : end;
  }
  return chunks;
}

function versionOf(page) {
  return hash(JSON.stringify([page.id, page.updatedAt, page.title, page.description]));
}

function pointId(path, index) {
  const digest = hash(`${path}:${index}`);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export function embed(config, input, signal) {
  return embedText(config.ai, input, signal);
}

function requestCollection(config, suffix = '', options) {
  return json(new URL(`/collections/${config.collection}${suffix}`, config.qdrantUrl), options);
}

async function storedPoints(config) {
  const points = [];
  let cursor;
  do {
    const { result } = await requestCollection(config, '/points/scroll', { method: 'POST',
      body: { limit: 100, with_payload: ['path', 'version'], with_vector: false, offset: cursor } });
    points.push(...result.points);
    cursor = result.next_page_offset ?? undefined;
  } while (cursor !== undefined);
  return points;
}

async function changedPoints(config, page) {
  const { pages } = await wikiGraphql(config, `query($id: Int!) {
    pages { single(id: $id) { id path updatedAt content } }
  }`, { id: page.id });
  const article = pages.single;
  if (article?.path !== page.path || article.id !== page.id || article.updatedAt !== page.updatedAt) {
    throw new Error('Wiki.js article changed during synchronization');
  }
  if (typeof article.content !== 'string' || article.content.length > 100000) throw new Error('Invalid Wiki.js article');
  const chunks = chunkText(article.content);
  const points = [];
  for (let start = 0; start < chunks.length; start += 16) {
    const batch = chunks.slice(start, start + 16);
    const vectors = await embed(config, batch.map(text => `${page.title}\n${page.description ?? ''}\n${text}`));
    for (const [offset, text] of batch.entries()) {
      points.push({ id: pointId(page.path, start + offset), vector: vectors[offset], payload: {
        path: page.path, version: versionOf(page), title: page.title, text,
      } });
    }
  }
  return points;
}

export async function syncKnowledge(config) {
  const pages = await listedPages(config);
  const current = await requestCollection(config, '', { allowMissing: true });
  const stored = current ? await storedPoints(config) : [];
  const keep = new Set();
  let collectionExists = !!current;
  let updated = 0;
  for (const page of pages) {
    const prior = stored.filter(point => point.payload.path === page.path);
    if (prior.length && prior.every(point => point.payload.version === versionOf(page))) {
      prior.forEach(point => keep.add(point.id));
      continue;
    }
    const points = await changedPoints(config, page);
    if (!points.length) continue;
    if (!collectionExists) {
      await requestCollection(config, '', { method: 'PUT', body: { vectors: { size: points[0].vector.length, distance: 'Cosine' } } });
      collectionExists = true;
    }
    await requestCollection(config, '/points?wait=true', { method: 'PUT', body: { points } });
    points.forEach(point => keep.add(point.id));
    updated++;
  }
  const stale = stored.filter(point => !keep.has(point.id)).map(point => point.id);
  if (stale.length) await requestCollection(config, '/points/delete?wait=true', { method: 'POST', body: { points: stale } });
  return { pages: pages.length, updated, removed: stale.length };
}

export async function searchKnowledge(config, question, signal) {
  const authorized = (await listedPages(config)).map(versionOf);
  if (!authorized.length) return [];
  const [vector] = await embed(config, [question], signal);
  const response = await requestCollection(config, '/points/query', { method: 'POST', allowMissing: true,
    body: { query: vector, limit: 12, with_payload: true, filter: {
      must: [{ key: 'version', match: { any: authorized } }],
    } } });
  const results = [];
  const seen = new Set();
  for (const { payload } of response?.result.points ?? []) {
    if (!knowledgePaths.includes(payload.path) || seen.has(payload.path)) continue;
    seen.add(payload.path);
    results.push({ title: payload.title, text: payload.text,
      url: new URL(`/${locale}/${payload.path}`, config.wikiPublicUrl).href });
    if (results.length === 3) break;
  }
  return results;
}
