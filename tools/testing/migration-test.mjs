// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Requires native psql + sh. Uses a new disposable PostgreSQL cluster, never application data.
import EmbeddedPostgres from 'embedded-postgres';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, cp, readFile, writeFile, unlink } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shell = process.env.TEST_SHELL ?? 'sh';
await mkdir(resolve(root, '.local/reports'), { recursive: true });
if (spawnSync('psql', ['--version'], { windowsHide: true }).status !== 0) {
  await writeFile(resolve(root, '.local/reports/migrations.json'), JSON.stringify({
    checked_at: new Date().toISOString(), passed: false, status: 'blocked',
    reason: 'Native psql is unavailable; no migration runner acceptance was performed.',
  }, null, 2) + '\n');
  throw new Error('psql required. Install PostgreSQL client tools before running migration verification.');
}
await mkdir(resolve(root, '.local/reports'), { recursive: true });
const directory = await mkdtemp(resolve(root, '.local/migration-test-'));
await cp(resolve(root, 'db'), resolve(directory, 'sql'), { recursive: true });
const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r));
const port = probe.address().port; await new Promise(r => probe.close(r));
const pg = new EmbeddedPostgres({ databaseDir: resolve(directory, 'pg'), user: 'postgres',
  password: 'dxdesk_test_only', port, persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {}, onError: () => {} });
const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: String(port), PGPASSWORD: 'dxdesk_test_only',
  POSTGRES_USER: 'postgres', POSTGRES_DB: 'dxdesk_test', API_DB_PASSWORD: 'test_api_only',
  MIGRATIONS_DIR: resolve(directory, 'sql/migrations').replaceAll('\\', '/'),
  POLICIES_DIR: resolve(directory, 'sql/policies').replaceAll('\\', '/') };
function query(sql) {
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'dxdesk_test', '-Atc', sql], { env, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
function migrate(success = true) {
  const result = spawnSync(shell, [resolve(root, 'infra/postgres/init/02-migrations.sh').replaceAll('\\', '/')], { env, encoding: 'utf8', windowsHide: true });
  if (success) assert.equal(result.status, 0, result.stderr);
  else assert.notEqual(result.status, 0, 'Expected migration to fail');
  return result;
}
const report = { started_at: new Date().toISOString(), checks: [], passed: false };
let started = false;
try {
  await pg.initialise(); await pg.start(); started = true; await pg.createDatabase('dxdesk_test');
  query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; GRANT USAGE ON SCHEMA public TO anon, authenticated');
  migrate();
  const expectedFiles = ['migrations', 'policies']
    .reduce((n, d) => n + readdirSync(resolve(directory, 'sql', d)).filter(f => f.endsWith('.sql')).length, 0);
  assert.equal(query('SELECT count(*) FROM migration_meta.applied'), String(expectedFiles));
  report.checks.push(`First run applies all ${expectedFiles} SQL files`);
  query("INSERT INTO public.tickets(requester_id,category_id,title,description) VALUES ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Preserve this ticket','Migration rerun must keep this ticket')");
  const ledger = query('SELECT string_agg(name || checksum || applied_at::text, chr(10) ORDER BY name) FROM migration_meta.applied');
  migrate();
  assert.equal(query('SELECT count(*) FROM public.tickets'), '1');
  assert.equal(query('SELECT string_agg(name || checksum || applied_at::text, chr(10) ORDER BY name) FROM migration_meta.applied'), ledger);
  report.checks.push('Second run preserves data and migration timestamps');
  const schema = resolve(directory, 'sql/migrations/001_schema.sql'), original = await readFile(schema, 'utf8');
  await writeFile(schema, original + '\n-- Test checksum change\n');
  assert.match(migrate(false).stderr, /checksum mismatch/);
  await writeFile(schema, original);
  report.checks.push('Changed applied migration is rejected');
  const failedFile = resolve(directory, 'sql/migrations/003_failure.sql');
  await writeFile(failedFile, 'CREATE TABLE public.migration_failure_marker(id int); SELECT 1/0;');
  migrate(false);
  assert.equal(query("SELECT to_regclass('public.migration_failure_marker') IS NULL"), 't');
  assert.equal(query("SELECT count(*) FROM migration_meta.applied WHERE name='migrations/003_failure.sql'"), '0');
  await unlink(failedFile); migrate();
  report.checks.push('Failed migration rolls back both DDL and ledger, rerun recovers');
  report.passed = true;
  for (const check of report.checks) console.log(`PASS ${check}`);
} catch (error) { report.error = error.message; console.error(error); process.exitCode = 1; }
finally {
  if (started) await pg.stop();
  report.finished_at = new Date().toISOString();
  await writeFile(resolve(root, '.local/reports/migrations.json'), JSON.stringify(report, null, 2) + '\n');
}
