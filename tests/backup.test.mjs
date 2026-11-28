// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  backupName, databasePlan, formatBytes, MANIFEST, requiredBytes, retentionPlan, validateManifest, verifyBackup,
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
