// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = resolve(ROOT, 'config/doanh-nghiep/cau-hinh.json');
const DEFAULT_PROJECTION = resolve(ROOT, 'config/doanh-nghiep/modules.json');
const RESERVED_FIELDS = new Set(['__proto__', 'prototype', 'constructor']);
let schemaValidator;

export class ConfigValidationError extends Error {
  constructor(errors) {
    super(`Cấu hình không hợp lệ:\n${errors.join('\n')}`);
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}

async function getSchemaValidator() {
  if (schemaValidator) return schemaValidator;
  let Ajv;
  for (const manifest of ['tools/testing/package.json', 'apps/api/package.json']) {
    try {
      const loaded = createRequire(resolve(ROOT, manifest))('ajv');
      Ajv = loaded.default ?? loaded;
      break;
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  if (!Ajv) throw new Error('Thiếu Ajv. Cài dependencies tools/testing trước khi kiểm tra/áp dụng cấu hình.');
  const schema = JSON.parse(await fs.readFile(resolve(ROOT, 'config/schema.json'), 'utf8'));
  schemaValidator = new Ajv({ allErrors: true, strict: true }).compile(schema);
  return schemaValidator;
}

function duplicateJsonKeys(text) {
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g);
  let index = 0;
  const errors = [];
  function value(path, depth) {
    if (depth > 100) throw new ConfigValidationError(['JSON vượt quá 100 cấp lồng nhau.']);
    const token = tokens[index++];
    if (token === '{') {
      const keys = new Set();
      while (tokens[index] !== '}') {
        const key = JSON.parse(tokens[index++]);
        if (keys.has(key)) errors.push(`${path}/${key}: khóa JSON trùng`);
        keys.add(key);
        index++;
        value(`${path}/${key}`, depth + 1);
        if (tokens[index] === ',') index++;
      }
      index++;
    } else if (token === '[') {
      let item = 0;
      while (tokens[index] !== ']') {
        value(`${path}/${item++}`, depth + 1);
        if (tokens[index] === ',') index++;
      }
      index++;
    }
  }
  value('', 0);
  return errors;
}

export async function validateConfig(config, { validateSchema } = {}) {
  const validate = validateSchema ?? await getSchemaValidator();
  if (!validate(config)) {
    throw new ConfigValidationError((validate.errors ?? []).map(error =>
      `${error.instancePath || '/'}: ${error.message}${error.params?.additionalProperty ? ` (${error.params.additionalProperty})` : ''}`));
  }
  const errors = [];
  const unique = (items, key, path) => {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item[key])) errors.push(`${path}: ${key} trùng: ${item[key]}`);
      seen.add(item[key]);
    }
  };
  unique(config.teams, 'code', '/teams');
  unique(config.teams, 'name', '/teams');
  unique(config.categories, 'code', '/categories');
  unique(config.routing, 'category', '/routing');
  for (const category of config.categories) {
    unique(category.requirement_fields, 'key', `/categories/${category.code}/requirement_fields`);
    for (const field of category.requirement_fields) {
      if (RESERVED_FIELDS.has(field.key)) errors.push(`/categories/${category.code}: khóa trường không an toàn: ${field.key}`);
    }
  }
  for (const [priority, policy] of Object.entries(config.sla_policies)) {
    if (policy.resolution_minutes < policy.response_minutes) errors.push(`/sla_policies/${priority}: resolution_minutes phải >= response_minutes`);
  }
  const teams = new Map(config.teams.map(team => [team.code, team]));
  for (const route of config.routing) {
    if (route.active && teams.has(route.team) && !teams.get(route.team).active) {
      errors.push(`/routing/${route.category}: nhóm ${route.team} không hoạt động`);
    }
  }
  if (errors.length) throw new ConfigValidationError(errors);
  return config;
}

export async function loadConfig(file = DEFAULT_CONFIG, { io = fs, ...options } = {}) {
  const text = (await io.readFile(file, 'utf8')).replace(/^\uFEFF/, '');
  let config;
  try { config = JSON.parse(text); }
  catch (error) { throw new ConfigValidationError([`JSON: ${error.message}`]); }
  const duplicates = duplicateJsonKeys(text);
  if (duplicates.length) throw new ConfigValidationError(duplicates);
  return validateConfig(config, options);
}

export function buildApplySql(config) {
  const hex = Buffer.from(JSON.stringify(config), 'utf8').toString('hex');
  return `DO $enterprise_config$
DECLARE cfg jsonb := convert_from(decode('${hex}', 'hex'), 'UTF8')::jsonb;
BEGIN
  LOCK TABLE public.teams, public.categories, public.routing_rules, public.sla_policies IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (
    SELECT FROM jsonb_to_recordset(cfg->'teams') AS x(code text, name text)
    JOIN public.teams t ON t.name=x.name AND t.code<>x.code
  ) THEN RAISE EXCEPTION 'Team name belongs to another business code'; END IF;
  IF EXISTS (
    WITH teams AS (
      SELECT code, active FROM jsonb_to_recordset(cfg->'teams') AS x(code text, active boolean)
      UNION ALL SELECT t.code,t.active FROM public.teams t
        WHERE NOT EXISTS (SELECT FROM jsonb_array_elements(cfg->'teams') x WHERE x->>'code'=t.code)
    ), categories AS (
      SELECT code FROM jsonb_to_recordset(cfg->'categories') AS x(code text)
      UNION ALL SELECT c.code FROM public.categories c
        WHERE NOT EXISTS (SELECT FROM jsonb_array_elements(cfg->'categories') x WHERE x->>'code'=c.code)
    )
    SELECT FROM jsonb_to_recordset(cfg->'routing') AS r(category text, team text, active boolean)
    LEFT JOIN categories c ON c.code=r.category LEFT JOIN teams t ON t.code=r.team
    WHERE c.code IS NULL OR t.code IS NULL OR (r.active AND NOT t.active)
  ) THEN RAISE EXCEPTION 'Routing requires an existing category and active team'; END IF;
  IF EXISTS (
    SELECT FROM public.routing_rules r JOIN public.categories c ON c.id=r.category_id
    JOIN public.teams t ON t.id=r.team_id
    JOIN jsonb_to_recordset(cfg->'teams') AS x(code text, active boolean) ON x.code=t.code
    WHERE r.active AND NOT x.active
      AND NOT EXISTS (SELECT FROM jsonb_array_elements(cfg->'routing') y WHERE y->>'category'=c.code)
  ) THEN RAISE EXCEPTION 'Deactivate or reroute existing active routing before disabling its team'; END IF;

  INSERT INTO public.teams AS target(id,code,name,active)
  SELECT gen_random_uuid(),code,name,active FROM jsonb_to_recordset(cfg->'teams') AS x(code text,name text,active boolean)
  ON CONFLICT(code) DO UPDATE SET name=excluded.name,active=excluded.active
    WHERE (target.name,target.active) IS DISTINCT FROM (excluded.name,excluded.active);
  INSERT INTO public.categories AS target(code,name,description,active,requirement_fields)
  SELECT code,name,description,active,requirement_fields FROM jsonb_to_recordset(cfg->'categories')
    AS x(code text,name text,description text,active boolean,requirement_fields jsonb)
  ON CONFLICT(code) DO UPDATE SET name=excluded.name,description=excluded.description,
    active=excluded.active,requirement_fields=excluded.requirement_fields
    WHERE (target.name,target.description,target.active,target.requirement_fields)
      IS DISTINCT FROM (excluded.name,excluded.description,excluded.active,excluded.requirement_fields);
  INSERT INTO public.routing_rules AS target(category_id,team,active,team_id)
  SELECT c.id,t.name,r.active,t.id FROM jsonb_to_recordset(cfg->'routing') AS r(category text,team text,active boolean)
    JOIN public.categories c ON c.code=r.category JOIN public.teams t ON t.code=r.team
  ON CONFLICT(category_id) DO UPDATE SET team=excluded.team,active=excluded.active,team_id=excluded.team_id
    WHERE (target.team,target.active,target.team_id) IS DISTINCT FROM (excluded.team,excluded.active,excluded.team_id);
  UPDATE public.routing_rules r SET team=t.name FROM public.teams t
    WHERE r.team_id=t.id AND r.team IS DISTINCT FROM t.name;
  INSERT INTO public.sla_policies AS target(priority,response_minutes,resolution_minutes)
  SELECT p.key,(p.value->>'response_minutes')::integer,(p.value->>'resolution_minutes')::integer
    FROM jsonb_each(cfg->'sla_policies') p
  ON CONFLICT(priority) DO UPDATE SET response_minutes=excluded.response_minutes,resolution_minutes=excluded.resolution_minutes
    WHERE (target.response_minutes,target.resolution_minutes) IS DISTINCT FROM (excluded.response_minutes,excluded.resolution_minutes);
END;
$enterprise_config$;`;
}

export async function publishModules(modules, projectionPath = DEFAULT_PROJECTION, { io = fs, uuid = randomUUID } = {}) {
  const temp = resolve(dirname(projectionPath), `.${projectionPath.split(/[\\/]/).pop()}.${uuid()}.tmp`);
  let created = false;
  try {
    try {
      await io.writeFile(temp, JSON.stringify({ enabled: modules.enabled }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
      created = true;
    } catch (error) {
      if (error.code !== 'EEXIST') await io.unlink(temp).catch(() => {});
      throw error;
    }
    await io.rename(temp, projectionPath);
  } finally {
    if (created) await io.unlink(temp).catch(() => {});
  }
  return projectionPath;
}

export async function applyConfig(config, {
  client, executeTransaction, projectionPath = DEFAULT_PROJECTION, publish = publishModules, io = fs, validateSchema,
} = {}) {
  const snapshot = JSON.parse(JSON.stringify(config));
  await validateConfig(snapshot, { validateSchema });
  const sql = buildApplySql(snapshot);
  if (executeTransaction && client) throw new Error('Chỉ chọn client hoặc executeTransaction.');
  if (!executeTransaction && !client?.query) throw new Error('Thiếu client quản trị hoặc executeTransaction.');
  const lockPath = resolve(dirname(projectionPath), '.config-apply.lock');
  let lock;
  try { lock = await fs.open(lockPath, 'wx', 0o600); }
  catch (cause) {
    if (cause.code !== 'EEXIST') throw cause;
    throw Object.assign(new Error('Đã có config apply giữ khóa. Kiểm tra PID trong .config-apply.lock; chỉ dọn khóa sau khi xác minh tiến trình đã dừng.', { cause }), { code: 'CONFIG_APPLY_LOCKED' });
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }) + '\n');
    if (executeTransaction) {
      await executeTransaction(`BEGIN;\n${sql}\nCOMMIT;\n`);
    } else {
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) { error.rollbackError = rollbackError; }
        throw error;
      }
    }
    try {
      await publish(snapshot.modules, projectionPath, { io });
    } catch (cause) {
      const error = new Error('DB đã áp dụng nhưng publish modules.json thất bại; file cũ được giữ nếu rename chưa thành công. Sửa quyền/mount thư mục rồi chạy lại config apply để phục hồi idempotent.', { cause });
      error.code = 'CONFIG_PROJECTION_FAILED';
      error.databaseApplied = true;
      throw error;
    }
    return { databaseApplied: true, projectionPublished: true, projectionPath };
  } finally {
    await lock.close();
    await fs.unlink(lockPath);
  }
}

export function createComposeExecutor({ root = ROOT, env, composeArgs, spawn = spawnSync } = {}) {
  if (!env?.POSTGRES_USER || !env?.POSTGRES_DB) throw new Error('Thiếu POSTGRES_USER/POSTGRES_DB cho quyền quản trị PostgreSQL.');
  const base = composeArgs ?? ['compose', '--env-file', resolve(root, '.env'), '-f', resolve(root, 'infra/compose/docker-compose.yml')];
  return async sql => {
    const result = spawn('docker', [...base, 'exec', '-T', 'postgres', 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
      '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB, '-f', '-'],
    { cwd: root, input: sql, encoding: 'utf8', windowsHide: true, shell: false, maxBuffer: 16 * 1024 * 1024 });
    if (result.error) throw new Error(`Không chạy được PostgreSQL admin: ${result.error.message}`, { cause: result.error });
    if (result.status !== 0) throw new Error(`Áp dụng cấu hình DB thất bại (${result.status}): ${result.stderr?.trim() || 'psql không thành công'}`);
  };
}

export async function enterpriseConfigMain(args = process.argv.slice(2), {
  root = ROOT, env, composeArgs, io = fs, log = console.log, executeTransaction, client, publish, validateSchema,
} = {}) {
  const [action, source, ...extra] = args;
  if (!['apply', 'validate'].includes(action) || extra.length || source?.startsWith('-')) {
    throw new Error('Dùng: config <apply|validate> [đường-dẫn-cau-hinh.json]');
  }
  const file = resolve(root, source ?? 'config/doanh-nghiep/cau-hinh.json');
  const config = await loadConfig(file, { io, validateSchema });
  if (action === 'validate') {
    log(`Cấu hình hợp lệ (schema + quy tắc nội bộ; tham chiếu DB được kiểm tra khi apply): ${file}`);
    return { validated: true, file };
  }
  if (!executeTransaction && !client) {
    env ??= parseEnv(await io.readFile(resolve(root, '.env'), 'utf8'));
    executeTransaction = createComposeExecutor({ root, env, composeArgs });
  }
  const result = await applyConfig(config, { client, executeTransaction, io, publish, validateSchema,
    projectionPath: resolve(root, 'config/doanh-nghiep/modules.json') });
  log('Đã áp dụng cấu hình và publish modules.json. Tải lại trang để nạp cấu hình module.');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  enterpriseConfigMain().catch(error => { console.error(error.message); process.exitCode = 1; });
}
