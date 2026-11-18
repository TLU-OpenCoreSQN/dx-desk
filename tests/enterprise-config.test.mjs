// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConfigValidationError, validateConfig, loadConfig, applyConfig, buildApplySql,
  publishModules, createComposeExecutor, enterpriseConfigMain,
} from '../scripts/enterprise-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sample = JSON.parse(await fs.readFile(resolve(root, 'config/doanh-nghiep/cau-hinh.json'), 'utf8'));
const copy = () => structuredClone(sample);
const fixtureClient = () => {
  const queries = [];
  return { queries, async query(sql) { queries.push(sql); } };
};

async function temporary(t) {
  const directory = await fs.mkdtemp(resolve(tmpdir(), 'dxdesk-enterprise-config-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('canonical example validates against JSON Schema without normalization or mutation', async () => {
  const config = copy();
  assert.equal(await validateConfig(config), config);
  assert.deepEqual(config, sample);
  assert.deepEqual(config.modules.enabled, ['core', 'desk', 'devices', 'data']);
});

const invalidCases = [
  ['schema version', c => { c.schema_version = 2; }],
  ['unknown root key', c => { c.unexpected = true; }],
  ['core disabled', c => { c.modules.enabled = ['desk']; }],
  ['unknown module', c => { c.modules.enabled.push('unknown'); }],
  ['duplicate module', c => { c.modules.enabled.push('core'); }],
  ['unsafe category code', c => { c.categories[0].code = "vpn'; DROP TABLE public.tickets;--"; }],
  ['unsafe team code', c => { c.teams[0].code = '../network'; }],
  ['blank name', c => { c.categories[0].name = ' \t '; }],
  ['NUL description', c => { c.categories[0].description = 'a\0b'; }],
  ['duplicate team code', c => { c.teams.push({ ...c.teams[0], name: 'Other' }); }],
  ['duplicate team name', c => { c.teams.push({ ...c.teams[0], code: 'other' }); }],
  ['duplicate category', c => { c.categories.push(c.categories[0]); }],
  ['duplicate routing category', c => { c.routing.push(c.routing[0]); }],
  ['duplicate field key', c => { c.categories[0].requirement_fields.push(c.categories[0].requirement_fields[0]); }],
  ['unknown field key', c => { c.categories[0].requirement_fields[0].extra = 'ignored?'; }],
  ['unsupported field type', c => { c.categories[0].requirement_fields[0].type = 'number'; }],
  ['nonboolean required', c => { c.categories[0].requirement_fields[0].required = 'true'; }],
  ['unsafe field key', c => { c.categories[0].requirement_fields[0].key = '__proto__'; }],
  ['prototype field key', c => { c.categories[0].requirement_fields[0].key = 'constructor'; }],
  ['unknown priority', c => { c.sla_policies.urgent = c.sla_policies.high; }],
  ['zero SLA', c => { c.sla_policies.low.response_minutes = 0; }],
  ['fraction SLA', c => { c.sla_policies.low.response_minutes = 1.5; }],
  ['integer overflow SLA', c => { c.sla_policies.low.resolution_minutes = 2147483648; }],
  ['resolution shorter than response', c => { c.sla_policies.high.resolution_minutes = 59; }],
  ['inactive team reference', c => { c.teams[0].active = false; }],
];
for (const [name, alter] of invalidCases) {
  test(`preflight rejects ${name} before any DB/filesystem write`, async () => {
    const config = copy(); alter(config);
    const client = fixtureClient(); let published = false;
    await assert.rejects(applyConfig(config, { client, publish: async () => { published = true; } }), ConfigValidationError);
    assert.deepEqual(client.queries, []);
    assert.equal(published, false);
  });
}

test('string field type and explicit inactive routing are supported; missing entities are not deletions', async () => {
  const config = copy();
  config.categories[0].requirement_fields[0].type = 'string';
  config.teams[0].active = false;
  config.routing[0].active = false;
  await validateConfig(config);
  await validateConfig({ schema_version: 1, modules: { enabled: ['core'] }, teams: [], categories: [], routing: [], sla_policies: {} });
});

test('loader rejects duplicate JSON member names including escaped/nested duplicates', async () => {
  for (const text of ['{"schema_version":1,"schema_version":1}', '{"nested":{"key":1,"k\\u0065y":2}}']) {
    await assert.rejects(loadConfig('injected.json', { io: { readFile: async () => text } }), /khóa JSON trùng/);
  }
  await assert.rejects(loadConfig('injected.json', { io: { readFile: async () => '{ invalid' } }), /JSON:/);
  assert.deepEqual(await loadConfig('injected.json', { io: { readFile: async () => '\uFEFF' + JSON.stringify(sample) } }), sample);
});

test('apply commits exactly one transaction before publishing', async () => {
  const client = fixtureClient();
  const config = copy();
  const result = await applyConfig(config, { client, publish: async modules => {
    assert.equal(client.queries.length, 3);
    assert.equal(client.queries[0], 'BEGIN');
    assert.equal(client.queries.at(-1), 'COMMIT');
    assert.deepEqual(modules, config.modules);
  } });
  assert.equal(result.databaseApplied, true);
  assert.equal(result.projectionPublished, true);
  assert.deepEqual(config, sample);
});

for (const stage of ['sql', 'commit']) {
  test(`${stage} failure rolls back and never publishes`, async () => {
    const client = fixtureClient();
    const failure = new Error(`injected ${stage} failure`);
    client.query = async sql => {
      client.queries.push(sql);
      if ((stage === 'sql' && sql.startsWith('DO ')) || (stage === 'commit' && sql === 'COMMIT')) throw failure;
    };
    let published = false;
    await assert.rejects(applyConfig(copy(), { client, publish: async () => { published = true; } }), error => error === failure);
    assert.equal(client.queries.at(-1), 'ROLLBACK');
    assert.equal(published, false);
  });
}

test('apply snapshots the input before asynchronous preflight/DB work', async () => {
  const config = copy();
  await applyConfig(config, { executeTransaction: async sql => {
    assert.ok(sql.startsWith('BEGIN;\nDO '));
    assert.ok(sql.endsWith('COMMIT;\n'));
    config.modules.enabled = ['core'];
  }, publish: async modules => { assert.deepEqual(modules.enabled, sample.modules.enabled); } });
});

test('untrusted SQL and psql meta-command text is encoded, never interpolated as syntax', async () => {
  const config = copy();
  const attack = "'; END; $$; DROP TABLE public.tickets; --\n\\! touch injected\n\\q\nTiếng Việt";
  config.categories[0].description = attack;
  await validateConfig(config);
  const sql = buildApplySql(config);
  assert.equal(sql.includes(attack), false);
  assert.equal(sql.includes('DROP TABLE'), false);
  assert.equal(sql.includes('\\!'), false);
  const hex = sql.match(/decode\('([a-f0-9]+)', 'hex'\)/)[1];
  assert.deepEqual(JSON.parse(Buffer.from(hex, 'hex').toString('utf8')), config);
});

test('projection rename failure preserves old file, reports committed DB, and retry repairs', async t => {
  const directory = await temporary(t);
  const target = resolve(directory, 'modules.json');
  const old = '{"enabled":["core"]}\n';
  await fs.writeFile(target, old);
  const client = fixtureClient();
  const io = { ...fs, rename: async () => { throw new Error('injected rename failure'); } };
  await assert.rejects(applyConfig(copy(), { client, projectionPath: target, io }), error => {
    assert.equal(error.code, 'CONFIG_PROJECTION_FAILED');
    assert.equal(error.databaseApplied, true);
    assert.match(error.message, /chạy lại config apply/);
    assert.match(error.cause.message, /rename failure/);
    return true;
  });
  assert.equal(client.queries.at(-1), 'COMMIT');
  assert.equal(await fs.readFile(target, 'utf8'), old);
  assert.deepEqual(await fs.readdir(directory), ['modules.json']);
  await applyConfig(copy(), { client, projectionPath: target });
  assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), sample.modules);
  assert.equal(client.queries.filter(sql => sql === 'COMMIT').length, 2);
  assert.deepEqual(await fs.readdir(directory), ['modules.json']);
});

test('projection write failure cleans partial temp and does not replace old file', async t => {
  const directory = await temporary(t), target = resolve(directory, 'modules.json');
  await fs.writeFile(target, '{"enabled":["core"]}');
  const io = { ...fs, writeFile: async (path, text, options) => {
    await fs.writeFile(path, text.slice(0, 8), options);
    throw new Error('injected disk full');
  } };
  await assert.rejects(publishModules(sample.modules, target, { io }), /disk full/);
  assert.deepEqual(await fs.readdir(directory), ['modules.json']);
  assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), { enabled: ['core'] });
});

test('apply lock covers commit through projection and prevents stale concurrent publication', async t => {
  const directory = await temporary(t), target = resolve(directory, 'modules.json');
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const publishing = new Promise(resolve => { entered = resolve; });
  const first = applyConfig(copy(), { client: fixtureClient(), projectionPath: target,
    publish: async modules => { entered(); await gate; await publishModules(modules, target); } });
  await publishing;
  const next = copy();
  next.modules.enabled = ['core'];
  const secondClient = fixtureClient();
  try {
    await assert.rejects(applyConfig(next, { client: secondClient, projectionPath: target }), { code: 'CONFIG_APPLY_LOCKED' });
    assert.deepEqual(secondClient.queries, []);
  } finally {
    release();
    await first;
  }
  await applyConfig(next, { client: secondClient, projectionPath: target });
  assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), next.modules);
  assert.deepEqual(await fs.readdir(directory), ['modules.json']);
});

test('an existing apply lock is never removed or stolen automatically', async t => {
  const directory = await temporary(t), target = resolve(directory, 'modules.json');
  const lockPath = resolve(directory, '.config-apply.lock');
  const owner = JSON.stringify({ pid: 12345, started_at: 'fixture' });
  await fs.writeFile(lockPath, owner);
  const client = fixtureClient();
  await assert.rejects(applyConfig(copy(), { client, projectionPath: target }), { code: 'CONFIG_APPLY_LOCKED' });
  assert.deepEqual(client.queries, []);
  assert.equal(await fs.readFile(lockPath, 'utf8'), owner);
});

test('compose executor passes SQL only on stdin, no shell, and uses admin psql', async () => {
  const commands = [];
  const execute = createComposeExecutor({ root, env: { POSTGRES_USER: 'postgres', POSTGRES_DB: 'dxdesk' },
    composeArgs: ['compose', '--project-name', 'isolated project'], spawn: (...args) => {
      commands.push(args); return { status: 0, stdout: '' };
    } });
  await execute('BEGIN; SELECT 1; COMMIT;');
  const [command, args, options] = commands[0];
  assert.equal(command, 'docker');
  assert.deepEqual(args.slice(0, 3), ['compose', '--project-name', 'isolated project']);
  assert.ok(args.includes('psql'));
  assert.equal(args.includes('sh'), false);
  assert.equal(args.includes('BEGIN; SELECT 1; COMMIT;'), false);
  assert.equal(options.input, 'BEGIN; SELECT 1; COMMIT;');
  assert.equal(options.shell, false);
  assert.equal(options.cwd, root);
});

test('compose executor fails explicitly for missing admin credentials and SQL errors', async () => {
  assert.throws(() => createComposeExecutor({ env: {} }), /POSTGRES_USER/);
  const execute = createComposeExecutor({ env: { POSTGRES_USER: 'postgres', POSTGRES_DB: 'dxdesk' },
    spawn: () => ({ status: 3, stderr: 'ERROR: injected constraint violation' }) });
  await assert.rejects(execute('SQL'), /constraint violation/);
});

test('CLI validate does not need .env/DB and invalid arguments do not read files', async () => {
  const reads = [], logs = [];
  const io = { readFile: async path => { reads.push(path); return JSON.stringify(sample); } };
  const result = await enterpriseConfigMain(['validate', 'custom config.json'], { root, io, log: text => logs.push(text) });
  assert.equal(result.validated, true);
  assert.deepEqual(reads, [resolve(root, 'custom config.json')]);
  assert.match(logs[0], /tham chiếu DB được kiểm tra khi apply/);
  for (const args of [[], ['wrong'], ['apply', '--force'], ['apply', 'one', 'two']]) {
    await assert.rejects(enterpriseConfigMain(args, { root, io }), /Dùng:/);
  }
  assert.equal(reads.length, 1);
});

test('CLI apply API accepts injected execution and publishes to root projection', async () => {
  const events = [];
  const result = await enterpriseConfigMain(['apply'], { root,
    io: { readFile: async () => JSON.stringify(sample) }, log: text => events.push(text),
    executeTransaction: async sql => { assert.ok(sql.endsWith('COMMIT;\n')); events.push('committed'); },
    publish: async (modules, path) => {
      assert.equal(events[0], 'committed');
      assert.deepEqual(modules, sample.modules);
      assert.equal(path, resolve(root, 'config/doanh-nghiep/modules.json'));
      events.push('published');
    } });
  assert.equal(result.projectionPublished, true);
  assert.deepEqual(events.slice(0, 2), ['committed', 'published']);
});
