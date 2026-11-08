// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { dashboardCards, dashboardName, questions } from '../infra/metabase/dashboard.mjs';

const keys = ['METABASE_VERSION', 'METABASE_PORT', 'METABASE_PUBLIC_URL', 'METABASE_DB_PASSWORD',
  'METABASE_REPORTING_PASSWORD', 'METABASE_ADMIN_PASSWORD', 'METABASE_EMBED_SECRET', 'METABASE_DASHBOARD_ID'];
const email = 'metabase-admin@dxdesk.local';
const sourceName = 'DX-Desk reporting';
const collectionName = 'DX-Desk reports';

export function metabaseEnabled(env) {
  return (process.env.COMPOSE_PROFILES ?? env.COMPOSE_PROFILES ?? '').split(',').map(value => value.trim()).includes('full');
}

async function save(root, env) {
  const file = resolve(root, '.env');
  let content = await readFile(file, 'utf8');
  for (const key of keys.filter(key => env[key] !== undefined)) {
    const line = `${key}=${env[key]}`;
    const existing = new RegExp(`^${key}=.*$`, 'm');
    content = existing.test(content) ? content.replace(existing, () => line) : content.trimEnd() + '\n' + line + '\n';
  }
  await writeFile(file, content);
}

export async function prepareMetabase(root, env) {
  if (!metabaseEnabled(env)) return;
  env.METABASE_VERSION ||= 'v0.64.3';
  env.METABASE_PORT ||= '18031';
  env.METABASE_PUBLIC_URL ||= `http://localhost:${env.METABASE_PORT}`;
  for (const key of keys.slice(3, 7)) env[key] ||= randomBytes(32).toString('hex');
  if (!/^[a-f0-9]{64}$/i.test(env.METABASE_EMBED_SECRET)) throw new Error('METABASE_EMBED_SECRET cần đúng 64 ký tự hex.');
  await save(root, env);
}

export function configureMetabaseReader(base, root, env = process.env) {
  const sql = "\\getenv reporting_password METABASE_REPORTING_PASSWORD\nALTER ROLE dxdesk_metabase LOGIN PASSWORD :'reporting_password';\n";
  const result = spawnSync('docker', [...base, 'exec', '-T', 'postgres', 'sh', '-ec',
    'test -n "$METABASE_REPORTING_PASSWORD"; exec psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
  { cwd: root, env, input: sql, windowsHide: true, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error('Không thể cấu hình role PostgreSQL đọc báo cáo cho Metabase.');
}

export async function provisionMetabase(url, env, fetcher = fetch) {
  let token;
  async function call(path, method = 'GET', body) {
    const response = await fetcher(url + path, {
      method, headers: {
        ...(token && { 'X-Metabase-Session': token }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`Metabase ${method} ${path} trả HTTP ${response.status}.`);
    const content = await response.text();
    return content ? JSON.parse(content) : null;
  }
  const properties = await call('/api/session/properties');
  if (properties['setup-token']) {
    await call('/api/setup', 'POST', {
      token: properties['setup-token'],
      user: { first_name: 'DX-Desk', last_name: 'Admin', email, password: env.METABASE_ADMIN_PASSWORD },
      prefs: { site_name: 'DX-Desk Reports', allow_tracking: false },
    });
  }
  token = (await call('/api/session', 'POST', { username: email, password: env.METABASE_ADMIN_PASSWORD })).id;
  const details = {
    host: env.METABASE_REPORTING_HOST ?? 'postgres', port: Number(env.METABASE_REPORTING_PORT ?? 5432),
    dbname: env.POSTGRES_DB, user: 'dxdesk_metabase', password: env.METABASE_REPORTING_PASSWORD,
    ssl: false, 'schema-filters-type': 'inclusion', 'schema-filters-patterns': 'reporting',
  };
  const databases = (await call('/api/database')).data;
  const previousSource = databases.find(database => database.name === sourceName);
  const source = await call(previousSource ? '/api/database/' + previousSource.id : '/api/database',
    previousSource ? 'PUT' : 'POST', { name: sourceName, engine: 'postgres', details, is_full_sync: false });
  const collections = await call('/api/collection');
  const collection = collections.find(item => item.name === collectionName && item.location === '/')
    ?? await call('/api/collection', 'POST', { name: collectionName, description: 'Báo cáo DX-Desk từ view tổng hợp.' });

  const existing = await call('/api/card');
  const cards = [];
  for (const question of questions) {
    const card = existing.find(item => item.collection_id === collection.id && item.name === question.name);
    const saved = await call(card ? '/api/card/' + card.id : '/api/card', card ? 'PUT' : 'POST', {
      name: question.name, collection_id: collection.id, display: question.display, visualization_settings: {},
      dataset_query: { database: source.id, type: 'native', native: { query: question.sql, 'template-tags': {} } },
    });
    cards.push({ id: saved.id, width: question.width });
  }
  const dashboards = await call('/api/dashboard');
  const description = 'Báo cáo tổng hợp. Mục VPN client 4.2 sử dụng dữ liệu giả lập của lần nạp gần nhất.';
  const match = dashboards.find(item => item.name === dashboardName && item.collection_id === collection.id);
  const dashboard = match ? await call('/api/dashboard/' + match.id) : await call('/api/dashboard', 'POST', {
    name: dashboardName, collection_id: collection.id, description, parameters: [],
  });
  await call('/api/dashboard/' + dashboard.id, 'PUT', {
    description, enable_embedding: true, embedding_params: {}, dashcards: dashboardCards(cards, dashboard.dashcards),
  });
  if (!Number.isSafeInteger(dashboard.id) || dashboard.id < 1) throw new Error('Metabase không trả ID dashboard hợp lệ.');
  return dashboard.id;
}

export async function setupMetabase(root, env) {
  const id = await provisionMetabase(`http://127.0.0.1:${env.METABASE_PORT}`, env);
  if (env.METABASE_DASHBOARD_ID === String(id)) return false;
  env.METABASE_DASHBOARD_ID = String(id);
  await save(root, env);
  return true;
}
