// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Real Keycloak import; fixture user and temporary password file are removed in finally.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, unlink, rmdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { importMain, loadEnv, ROOT } from '../../scripts/import-nhan-vien.mjs';
import { adminApi } from '../../scripts/setup-directory.mjs';
const env = await loadEnv();
const username = 'accept-csv-' + randomUUID().slice(0, 18);
const email = username + '@example.invalid';
const directory = await mkdtemp(resolve(tmpdir(), 'dxdesk-csv-acceptance-'));
const csv = resolve(directory, 'employees.csv'), password = resolve(directory, 'passwords.csv');
const report = { started_at: new Date().toISOString(), scope: 'Real Keycloak CSV import with disposable Employee', checks: [], passed: false };
const pass = name => { report.checks.push({ name, passed: true }); console.log('PASS ' + name); };
let admin, userId;
try {
  admin = await adminApi(env);
  const find = async () => (await admin('/users?exact=true&username=' + encodeURIComponent(username))).filter(u => u.username === username);
  assert.equal((await find()).length, 0, 'Fixture name must be new');
  await writeFile(csv, 'tai_khoan,ho_ten,email,vai_tro,nhom_xu_ly,don_vi\n' + username + ',Nghiệm Thu Giả Lập,' + email + ',Employee,,phong-hanh-chinh\n');
  const options = { log() {} }; // Never put the temporary password or admin response in evidence.
  assert.equal(await importMain([csv, '--offline'], {}, options), 0);
  assert.equal(await importMain([csv], env, options), 0);
  assert.equal((await find()).length, 0); pass('Offline validation and live dry run create no user');
  assert.equal(await importMain([csv, '--thuc-hien', '--xuat-mat-khau', password], env, options), 0);
  const users = await find(); assert.equal(users.length, 1); const user = users[0]; userId = user.id;
  assert.equal(user.email, email); assert.equal(user.enabled, true);
  assert.ok(user.requiredActions.includes('UPDATE_PASSWORD'));
  assert.deepEqual(user.attributes.department, ['phong-hanh-chinh']);
  const roles = await admin('/users/' + userId + '/role-mappings/realm');
  assert.ok(roles.some(role => role.name === 'Employee'));
  const secret = await readFile(password, 'utf8');
  assert.equal(secret.trim().split(/\r?\n/).length, 2); pass('Apply creates one Employee with department, temporary password and forced password change');
  assert.equal(await importMain([csv, '--thuc-hien'], env, options), 0);
  assert.equal((await find()).length, 1); assert.equal((await find())[0].id, userId);
  assert.equal(await readFile(password, 'utf8'), secret); pass('Reimport preserves identity and does not reset password or duplicate user');
  report.passed = true;
} catch (error) { report.error = error.message; console.error(error.message); process.exitCode = 1; }
finally {
  try {
    // Recovery also handles an apply that created the fixture before returning an error.
    if (admin) {
      const users = await admin('/users?exact=true&username=' + encodeURIComponent(username));
      for (const user of users) {
        assert.equal(user.username, username); assert.equal(user.email, email);
        await admin('/users/' + user.id, 'DELETE');
      }
      assert.equal((await admin('/users?exact=true&username=' + encodeURIComponent(username))).length, 0);
    }
    for (const path of [password, csv]) await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await rmdir(directory); report.cleaned_up = true;
  } catch (error) { report.cleaned_up = false; report.cleanup_error = error.message; report.passed = false; process.exitCode = 1; }
  report.finished_at = new Date().toISOString();
  await mkdir(resolve(ROOT, '.local/reports'), { recursive: true });
  await writeFile(resolve(ROOT, '.local/reports/csv-import-live.json'), JSON.stringify(report, null, 2) + '\n');
}
