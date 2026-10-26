// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Cross-platform alternative to GNU Make (Node >=22.12 + Docker Compose).
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const action = process.argv[2] ?? 'help';
const help = 'node scripts/dxdesk.mjs <up|down|ps|config|migrate|verify|n8n-reload|credentials-import>';
if (action === 'help') { console.log(help); process.exit(0); }
const allowed = ['up', 'down', 'ps', 'config', 'migrate', 'verify', 'n8n-reload', 'credentials-import'];
if (!allowed.includes(action)) throw new Error(help);
let env;
try { env = parseEnv(await readFile(resolve(root, '.env'), 'utf8')); }
catch { throw new Error('Thiếu .env. Sao chép .env.example thành .env trước.'); }
const base = ['compose', '--env-file', resolve(root, '.env'), '-f', resolve(root, 'infra/compose/docker-compose.yml')];
function compose(...args) {
  const result = spawnSync('docker', [...base, ...args], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw new Error(`Docker chưa sẵn sàng: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`docker compose ${args[0]} thất bại (${result.status})`);
}
function migrate() { compose('exec', '-T', 'postgres', 'sh', '/docker-entrypoint-initdb.d/02-migrations.sh'); }
async function initialize() {
  await mkdir(resolve(root, 'infra/seaweedfs'), { recursive: true });
  await mkdir(resolve(root, 'infra/postgrest'), { recursive: true });
  if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) throw new Error('Thiếu S3 credentials trong .env.');
  await writeFile(resolve(root, 'infra/seaweedfs/s3.json'), JSON.stringify({
    identities: [{
      name: 'dxdesk',
      credentials: [{ accessKey: env.S3_ACCESS_KEY, secretKey: env.S3_SECRET_KEY }],
      actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'],
    }],
  }, null, 2) + '\n');
  try { await readFile(resolve(root, 'infra/postgrest/jwks.json')); }
  catch { await writeFile(resolve(root, 'infra/postgrest/jwks.json'), '{"keys":[]}\n'); }
}
async function syncKeys() {
  const response = await fetch(
    `http://localhost:${env.KEYCLOAK_PORT}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error(`Keycloak JWKS trả HTTP ${response.status}`);
  const jwks = await response.json();
  if (!Array.isArray(jwks.keys) || !jwks.keys.some(key => key.kty === 'RSA')) throw new Error('JWKS không có RSA key.');
  await writeFile(resolve(root, 'infra/postgrest/jwks.json'), JSON.stringify(jwks) + '\n');
}
if (action === 'up') {
  await initialize();
  compose('up', '-d', '--wait', 'postgres', 'keycloak');
  migrate();
  await syncKeys();
  compose('up', '-d', '--build', '--wait');
  // PostgREST may still hold the old signing keys when the realm was recreated.
  compose('restart', 'postgrest');
  compose('up', '-d', '--wait', 'postgrest');
  console.log(`DX-Desk: http://localhost:${env.APISIX_PORT}`);
} else if (action === 'migrate') {
  migrate();
} else if (action === 'verify') {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/stack-test.mjs')], {
    cwd: root, stdio: 'inherit', windowsHide: true,
  });
  process.exitCode = result.status ?? 1;
} else if (action === 'n8n-reload') {
  compose('stop', 'n8n');
  compose('run', '--rm', '--no-deps', 'n8n-import');
  compose('run', '--rm', '--no-deps', 'n8n-publish');
  compose('up', '-d', '--wait', 'n8n');
} else if (action === 'credentials-import') {
  const source = resolve(root, 'infra/n8n/credentials/credentials.json');
  const credentials = JSON.parse(await readFile(source, 'utf8'));
  if (!Array.isArray(credentials) || !credentials.length) throw new Error('credentials.json phải là mảng không rỗng.');
  compose('run', '--rm', '--no-deps', '-v', `${source}:/import/credentials.json:ro`,
    'n8n-import', 'import:credentials', '--input=/import/credentials.json');
} else if (action === 'config') compose('config', '-q');
else if (action === 'down') compose('down');
else compose('ps');
