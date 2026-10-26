// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Real PostgreSQL 17 + real PostgREST, isolated from the user's application data.
import EmbeddedPostgres from 'embedded-postgres';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).on('error', reject));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { capture = false, ...spawnOptions } = options;
    const child = spawn(command, args, { stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', windowsHide: true, ...spawnOptions });
    let output = '';
    if (capture) {
      child.stdout.on('data', chunk => { output += chunk; process.stdout.write(chunk); });
      child.stderr.on('data', chunk => { output += chunk; process.stderr.write(chunk); });
    }
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output) : reject(Object.assign(new Error(`${command} exited ${code}`), { output })));
  });
}
async function postgrestBinary() {
  if (process.env.TEST_POSTGREST_BIN) return resolve(process.env.TEST_POSTGREST_BIN);
  const version = 'v16.4';
  const assets = {
    win32: ['windows-x86-64.zip', '29a5b56e5a09b7168bb552ef14aa7ade40bf0a81dd0687cffa86610187b89d78'],
    linux: ['linux-static-x86-64.tar.xz', 'b47ecc82fce1dcebbbc4183d839e52f07f7630c9d7ad0f54db753d1939299354'],
  };
  if (process.arch !== 'x64' || !assets[process.platform])
    throw new Error('Set TEST_POSTGREST_BIN on this OS/architecture.');
  const [suffix, digest] = assets[process.platform];
  const directory = resolve(root, '.local/bin', `postgrest-${version}-${process.platform}`);
  const executable = resolve(directory, process.platform === 'win32' ? 'postgrest.exe' : 'postgrest');
  try { await access(executable); return executable; } catch { /* download pinned release */ }
  await mkdir(directory, { recursive: true });
  const filename = `postgrest-${version}-${suffix}`;
  console.log(`Downloading official ${filename} (SHA-256 verified)`);
  const response = await fetch(`https://github.com/PostgREST/postgrest/releases/download/${version}/${filename}`);
  if (!response.ok) throw new Error(`Download failed ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('PostgREST checksum mismatch');
  const archive = resolve(directory, filename);
  await writeFile(archive, bytes);
  if (process.platform === 'win32') {
    // Paths come solely from this checkout; quote literals for PowerShell.
    const quote = value => "'" + value.replaceAll("'", "''") + "'";
    await run('powershell.exe', ['-NoProfile', '-Command',
      `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(directory)} -Force`]);
  } else {
    await run('tar', ['-xJf', archive, '-C', directory]);
  }
  await access(executable);
  return executable;
}

await mkdir(resolve(root, '.local'), { recursive: true });
const databaseDir = await mkdtemp(resolve(root, '.local/pg-test-'));
const port = await freePort();
const pg = new EmbeddedPostgres({
  databaseDir, user: 'postgres', password: 'dxdesk_test_only',
  port, persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {}, onError: message => console.error(String(message).trim()),
});
let started = false;
const report = { started_at: new Date().toISOString(), postgres: '17.10', postgrest: '16.4',
  authentication: 'Signed RSA fixture, not real Keycloak', passed: false };
let testOutput = '';
try {
  const executable = await postgrestBinary();
  await pg.initialise();
  await pg.start();
  started = true;
  await pg.createDatabase('dxdesk_test');
  console.log('Starting integration tests with PostgreSQL 17.10 and PostgREST 16.4');
  testOutput = await run(process.execPath, ['--test', '--test-reporter=tap', 'test/integration.mjs'], {
    capture: true,
    cwd: resolve(root, 'apps/api'),
    env: {
      ...process.env,
      ...(process.platform === 'win32' ? {
        PATH: resolve(root, 'tools/testing/node_modules/@embedded-postgres/windows-x64/native/bin') + ';' + process.env.PATH,
      } : {}),
      TEST_DATABASE_ADMIN_URL: `postgres://postgres:dxdesk_test_only@127.0.0.1:${port}/dxdesk_test`,
      TEST_POSTGREST_BIN: executable,
    },
  });
  report.passed = true;
} catch (error) {
  testOutput = error.output ?? testOutput;
  report.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  if (started) await pg.stop();
  report.finished_at = new Date().toISOString();
  await mkdir(resolve(root, '.local/reports'), { recursive: true });
  await writeFile(resolve(root, '.local/reports/integration.tap'), testOutput);
  await writeFile(resolve(root, '.local/reports/integration.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Isolated test database stopped. Evidence directory: ${databaseDir}`);
}
