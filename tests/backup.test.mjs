// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  backupMain, backupName, databasePlan, formatBytes, MANIFEST, requiredBytes, restoreMain, retentionPlan,
  validateManifest, validateRestorePlan, verifyBackup,
} from '../scripts/backup.mjs';

const ENV = { POSTGRES_USER: 'dxdesk', POSTGRES_DB: 'dxdesk', KEYCLOAK_DB: 'keycloak', N8N_DB: 'n8n' };
const sha = text => createHash('sha256').update(text).digest('hex');
const manifest = files => ({ format: 1, created_at: '2026-11-28T07:49:43.405Z', files });
const mainDb = { name: 'postgres-dxdesk.dump', kind: 'database', service: 'postgres', user: 'dxdesk', database: 'dxdesk', sha256: sha('a') };

test('databasePlan chỉ lấy CSDL của dịch vụ đang chạy, luôn cần PostgreSQL chính', () => {
  const light = databasePlan(ENV, new Set(['postgres', 'mattermost-db', 'wiki-db', 'seaweedfs']));
  assert.deepEqual(light.map(db => `${db.service}/${db.database}`),
    ['postgres/dxdesk', 'postgres/keycloak', 'postgres/n8n', 'mattermost-db/mattermost', 'wiki-db/wiki']);
  assert.equal(databasePlan(ENV, new Set(['postgres', 'metabase-db'])).at(-1).user, 'metabase');
  assert.throws(() => databasePlan(ENV, new Set(['seaweedfs'])), /PostgreSQL chưa chạy/);
  assert.throws(() => databasePlan({ ...ENV, N8N_DB: '' }, new Set(['postgres'])), /Thiếu biến \.env/);
});

test('backupName theo giờ UTC, sắp xếp chuỗi đúng thứ tự thời gian', () => {
  assert.equal(backupName(new Date('2026-11-28T07:49:43.405Z')), 'dxdesk-20261128T074943Z');
  assert.ok(backupName(new Date('2026-12-01T00:00:00Z')) > backupName(new Date('2026-11-30T23:59:59Z')));
});

test('retentionPlan giữ đúng số bản mới nhất, bỏ qua bản dở dang và thư mục lạ', () => {
  const day = n => `dxdesk-202611${String(n).padStart(2, '0')}T020000Z`;
  const entries = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ name: day(n), complete: true }));
  entries.push({ name: day(10), complete: false }, { name: 'ghi-chu', complete: true });
  assert.deepEqual(retentionPlan(entries, 7), [day(2), day(1)]);
  assert.deepEqual(retentionPlan(entries.slice(0, 3), 7), []);
  assert.throws(() => retentionPlan(entries, 0), /BACKUP_KEEP/);
  assert.throws(() => retentionPlan(entries, 1.5), /BACKUP_KEEP/);
});

test('requiredBytes có biên dự phòng; formatBytes theo kiểu Việt Nam', () => {
  assert.equal(requiredBytes(0), 256 * 1024 * 1024);
  assert.ok(requiredBytes(10 * 1024 ** 3) > 12 * 1024 ** 3);
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(3_460_000), '3,3 MiB');
});

test('validateManifest từ chối manifest thiếu CSDL chính, tên tệp có đường dẫn hoặc thiếu checksum', () => {
  assert.ok(validateManifest(manifest([mainDb])));
  assert.throws(() => validateManifest({ ...manifest([mainDb]), format: 2 }), /định dạng/);
  assert.throws(() => validateManifest(manifest([])), /không có tệp/);
  assert.throws(() => validateManifest(manifest([{ ...mainDb, name: '../.env' }])), /Tên tệp/);
  assert.throws(() => validateManifest(manifest([mainDb, { ...mainDb }])), /Tên tệp/);
  assert.throws(() => validateManifest(manifest([{ ...mainDb, sha256: 'abc' }])), /SHA-256/);
  assert.throws(() => validateManifest(manifest([{ ...mainDb, service: 'wiki-db' }])), /CSDL chính/);
  assert.throws(() => validateManifest(manifest([mainDb, { name: 'x', kind: 'khac', sha256: sha('x') }])), /Loại tệp/);
});

test('verifyBackup phát hiện tệp bị sửa sau khi sao lưu', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dxdesk-backup-'));
  try {
    await writeFile(join(dir, mainDb.name), 'a');
    await writeFile(join(dir, MANIFEST), JSON.stringify(manifest([mainDb])));
    assert.equal((await verifyBackup(dir)).files.length, 1);
    await writeFile(join(dir, mainDb.name), 'b');
    await assert.rejects(verifyBackup(dir), /SHA-256 không khớp/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const fullPlan = () => ({ ...manifest([
  ...databasePlan(ENV, new Set(['postgres'])).map(db => ({ ...db, kind: 'database', name: db.database + '.dump', sha256: sha(db.database + '.dump') })),
  { kind: 'roles', service: 'postgres', user: 'dxdesk', name: 'roles.sql', sha256: sha('roles.sql') },
  { kind: 'seaweedfs', service: 'seaweedfs', name: 'data.tar.gz', sha256: sha('data.tar.gz') },
]), versions: { postgres: '17.11' }, profiles: '' });

function fakeContext(events, { failArchive = false, hold } = {}) {
  return {
    running: () => new Set(['postgres', 'seaweedfs', 'api', 'assistant', 'keycloak']),
    psql: (...args) => { events.push(['psql', ...args]); return '1024'; },
    run: args => { events.push(['run', ...args]); return args.includes('du') ? '1 /data' : ''; },
    stream: async (args, options) => {
      events.push(['stream', ...args]);
      if (hold) await hold;
      if (failArchive) throw new Error('archive failed');
      if (options.output) await writeFile(options.output, 'archive');
    },
  };
}

test('restore plan bắt buộc đủ CSDL, role, SeaweedFS và khớp project; không nhận dịch vụ lạ', () => {
  const valid = fullPlan();
  assert.equal(validateRestorePlan(valid, ENV).length, 3);
  for (const missing of valid.files) {
    assert.throws(() => validateRestorePlan({ ...valid, files: valid.files.filter(file => file !== missing) }, ENV));
  }
  assert.throws(() => validateRestorePlan(valid, { ...ENV, POSTGRES_DB: 'another-project' }), /không khớp/);
  assert.throws(() => validateRestorePlan({ ...valid, files: [...valid.files, { ...mainDb, service: 'other-db' }] }, ENV), /không thuộc/);
  assert.throws(() => databasePlan({ ...ENV, COMPOSE_PROFILES: 'full' }, new Set(['postgres', 'seaweedfs'])), /chưa chạy/);
});

test('backup trùng tên không xóa bản sao hoàn chỉnh đã tồn tại', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dxdesk-collision-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const date = new Date('2026-11-28T01:00:00Z');
  const existing = join(dir, backupName(date));
  await mkdir(existing);
  await writeFile(join(existing, MANIFEST), 'keep-this-backup');
  const events = [];
  await assert.rejects(backupMain({ ...ENV, BACKUP_DIR: dir, COMPOSE_PROJECT_NAME: randomUUID() }, [], { context: fakeContext(events), date }), /EEXIST/);
  assert.equal(await readFile(join(existing, MANIFEST), 'utf8'), 'keep-this-backup');
  assert.equal(events.some(event => event[0] === 'run' && event[1] === 'stop'), false);
});

test('backup ngừng writer trước dump, bật lại mọi writer kể cả lỗi và chỉ dọn bản dở của chính nó', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dxdesk-resume-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const events = [];
  const date = new Date('2026-11-28T02:00:00Z');
  await assert.rejects(backupMain({ ...ENV, BACKUP_DIR: dir, COMPOSE_PROJECT_NAME: randomUUID() }, [],
    { context: fakeContext(events, { failArchive: true }), date }), /archive failed/);
  const stop = events.findIndex(event => event[0] === 'run' && event[1] === 'stop');
  const dump = events.findIndex(event => event[0] === 'stream');
  assert.ok(stop >= 0 && stop < dump);
  assert.deepEqual(events.at(-1), ['run', 'up', '-d', '--no-deps', '--wait', 'api', 'keycloak', 'assistant']);
  await assert.rejects(stat(join(dir, backupName(date))), { code: 'ENOENT' });
});

test('khóa project chặn hai lượt backup đồng thời và được trả sau khi lỗi', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dxdesk-lock-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let unblock, entered;
  const hold = new Promise(resolve => { unblock = resolve; });
  const waiting = new Promise(resolve => { entered = resolve; });
  const events = [];
  const ctx = fakeContext(events, { failArchive: true });
  const original = ctx.stream;
  ctx.stream = async (...args) => { entered(); await hold; return original(...args); };
  const env = { ...ENV, BACKUP_DIR: dir, COMPOSE_PROJECT_NAME: randomUUID() };
  const first = backupMain(env, [], { context: ctx });
  const failed = assert.rejects(first, /archive failed/);
  await waiting;
  await assert.rejects(backupMain(env, [], { context: ctx }), /đang có thao tác/);
  unblock();
  await failed;
  await assert.rejects(backupMain(env, [], { context: fakeContext([], { failArchive: true }) }), /archive failed/);
});

test('restore thiếu thành phần hoặc archive hỏng dừng trước mọi stop/DROP', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dxdesk-preflight-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const valid = fullPlan();
  for (const file of valid.files) await writeFile(join(dir, file.name), file.name);
  const env = { ...ENV, POSTGRES_VERSION: '17.11', COMPOSE_PROJECT_NAME: randomUUID() };
  for (const data of [ { ...valid, files: valid.files.filter(file => file.kind !== 'seaweedfs') }, valid ]) {
    await writeFile(join(dir, MANIFEST), JSON.stringify(data));
    const events = [];
    await assert.rejects(restoreMain(env, [dir, '--xac-nhan'], { context: fakeContext(events, { failArchive: true }) }));
    assert.equal(events.some(event => event[0] === 'psql' || event[0] === 'run'), false);
  }
});

test('restore chờ server TCP chính sau init và bắt buộc dừng khi role SQL lỗi', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dxdesk-init-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const valid = fullPlan();
  const roles = valid.files.find(file => file.kind === 'roles');
  const sql = 'CREATE ROLE dxdesk;\nALTER ROLE dxdesk WITH LOGIN;\n';
  roles.sha256 = sha(sql);
  for (const file of valid.files) await writeFile(join(dir, file.name), file.kind === 'roles' ? sql : file.name);
  await writeFile(join(dir, MANIFEST), JSON.stringify(valid));
  const events = [];
  const ctx = fakeContext(events);
  const run = ctx.run;
  let readiness = 0;
  ctx.run = args => {
    if (args.includes('pg_isready') && ++readiness === 1) throw new Error('temporary Unix server is shutting down');
    return run(args);
  };
  const stream = ctx.stream;
  ctx.stream = async (args, options) => {
    if (args.includes('psql')) {
      assert.ok(readiness >= 2, 'must wait for the primary server');
      assert.ok(args.includes('ON_ERROR_STOP=1'));
      assert.match(options.inputText, /EXCEPTION WHEN duplicate_object THEN NULL/);
      throw new Error('role SQL failed');
    }
    return stream(args, options);
  };
  await assert.rejects(restoreMain({ ...ENV, POSTGRES_VERSION: '17.11', COMPOSE_PROJECT_NAME: randomUUID() },
    [dir, '--xac-nhan'], { context: ctx, readinessDelayMs: 1 }), /role SQL failed/);
  assert.equal(events.some(event => event[0] === 'psql'), false, 'no DROP after a role SQL failure');
});
