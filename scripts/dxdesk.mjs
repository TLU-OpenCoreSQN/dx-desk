// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Cross-platform alternative to GNU Make (Node >=22.12 + Docker Compose).
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { renderGateway } from './render-gateway.mjs';
import { demoSeedIdentities, prepareAutomation, setupIdentity, setupChannelsAndRoster } from './setup-automation.mjs';
import { seedMain } from './seed-synthetic.mjs';
import { setupDepartments, setupDeviceClient } from './setup-directory.mjs';
import { prepareWiki, setupWiki, setupWikiClient, wikiEnabled, wikiIndexEnabled } from './setup-wiki.mjs';
import { configureMetabaseReader, metabaseEnabled, prepareMetabase, setupMetabase } from './setup-metabase.mjs';
import { validateWorkflowDirectory } from '../infra/n8n/validate-workflows.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const action = process.argv[2] ?? 'help';
const help = 'node scripts/dxdesk.mjs <up|down|ps|config|migrate|verify|seed|import-nhan-vien|backup|restore|n8n-reload|credentials-import>';
if (action === 'help') { console.log(help + '\nnode scripts/dxdesk.mjs config <validate|apply> [cau-hinh.json]'); process.exit(0); }
if (action === 'config' && process.argv.length > 3) {
  try {
    const { enterpriseConfigMain } = await import('./enterprise-config.mjs');
    await enterpriseConfigMain(process.argv.slice(3));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}
if (action === 'seed') {
  try {
    await seedMain(process.argv.slice(3), process.env, async () => {
      const local = parseEnv(await readFile(resolve(root, '.env'), 'utf8'));
      return demoSeedIdentities(local);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}
// W6-15: nhập nhân viên từ CSV; mặc định chạy thử, xem `import-nhan-vien --help`.
if (action === 'import-nhan-vien') {
  // Tiến trình con tự thoát khi hết việc: gọi process.exit() lúc socket fetch còn đang đóng làm Node trên
  // Windows dừng bằng lỗi libuv và mất mã thoát.
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/import-nhan-vien.mjs'), ...process.argv.slice(3)], {
    stdio: 'inherit', windowsHide: true,
  });
  process.exit(result.status ?? 1);
}
// W7-01: sao lưu/khôi phục chạy ở tiến trình con vì cùng lý do với import-nhan-vien (fetch/stream trên Windows).
if (action === 'backup' || action === 'restore') {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/backup.mjs'), action, ...process.argv.slice(3)], {
    stdio: 'inherit', windowsHide: true,
  });
  process.exit(result.status ?? 1);
}
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
  await writeFile(resolve(root, 'infra/apisix/runtime.yaml'), renderGateway(
    await readFile(resolve(root, 'infra/apisix/apisix.yaml'), 'utf8'), jwks,
    `${env.KEYCLOAK_PUBLIC_URL}/realms/${env.KEYCLOAK_REALM}`, env.OIDC_AUDIENCE,
    env.GATEWAY_SIGNING_KID,
  ));
}
if (action === 'up') {
  await validateWorkflowDirectory(resolve(root, 'config/doanh-nghiep/workflows'));
  await prepareAutomation(root, env);
  await prepareWiki(root, env);
  await prepareMetabase(root, env);
  await initialize();
  compose('up', '-d', '--wait', 'postgres', 'keycloak');
  await setupIdentity(env);
  // W5-02: realm có sẵn volume không nhập lại JSON, nên gán thuộc tính đơn vị qua Admin API.
  await setupDeviceClient(env);
  await setupDepartments(env);
  await setupWikiClient(env);
  migrate();
  if (metabaseEnabled(env)) configureMetabaseReader(base, root);
  await syncKeys();
  if (wikiIndexEnabled(env)) {
    compose('up', '-d', '--wait', 'wikijs');
    await setupWiki(root, env);
  }
  compose('up', '-d', '--build', '--wait');
  if (wikiIndexEnabled(env)) {
    // These Node services mount source files, so an existing process must reload its modules after a pull.
    compose('restart', 'wiki-index', 'assistant');
    compose('up', '-d', '--wait', 'assistant');
  }
  // PostgREST may still hold the old signing keys when the realm was recreated.
  compose('restart', 'postgrest');
  compose('up', '-d', '--wait', 'postgrest');
  // Cùng khuôn mẫu nhưng cho địa chỉ upstream: `--build` làm compose RECREATE api/web, còn
  // APISIX vẫn gửi request tới IP cũ của container đã chết -> 502 "No route to host"
  // (CI #10/#17/#20/#21/#23/#24). Run #23 chứng minh hai cách không ăn thua: retry 60s trong
  // harness vẫn 502 ở giây 63, và nginx_config.http.dns_resolver_valid=5 (job
  // "kiểm tra apisix.yaml" chấp nhận key, image khởi động bình thường) cũng không khiến
  // cổng bỏ địa chỉ cũ — bảng cân bằng của APISIX không phân giải lại theo nginx resolver.
  // Restart cổng là biện pháp duy nhất đã kiểm chứng; chi phí là một lần cổng khởi động lại.
  compose('restart', 'apisix');
  compose('up', '-d', '--wait', 'apisix');
  if (env.AUTOMATION_ENABLED === 'true') {
    await setupChannelsAndRoster(root, env);
    // API env changed after channel/token bootstrap; refresh gateway upstreams too.
    compose('up', '-d', '--wait', 'api');
    compose('restart', 'apisix');
    compose('up', '-d', '--wait', 'apisix');
  }
  if (!wikiIndexEnabled(env)) await setupWiki(root, env);
  if (metabaseEnabled(env) && await setupMetabase(root, env)) {
    compose('up', '-d', '--wait', 'api');
    compose('restart', 'apisix');
    compose('up', '-d', '--wait', 'apisix');
  }
  console.log(`DX-Desk: http://localhost:${env.APISIX_PORT}`);
  if (wikiEnabled(env)) console.log(`Wiki.js: ${env.WIKI_PUBLIC_URL}`);
  if (metabaseEnabled(env)) console.log(`Metabase: ${env.METABASE_PUBLIC_URL}`);
} else if (action === 'migrate') {
  migrate();
} else if (action === 'verify') {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/stack-test.mjs')], {
    cwd: root, stdio: 'inherit', windowsHide: true,
  });
  process.exitCode = result.status ?? 1;
} else if (action === 'n8n-reload') {
  await validateWorkflowDirectory(resolve(root, 'config/doanh-nghiep/workflows'));
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
