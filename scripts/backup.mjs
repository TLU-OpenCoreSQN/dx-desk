// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W7-01: sao lưu và khôi phục dữ liệu DX-Desk.
//   node scripts/dxdesk.mjs backup                       # một bản mới trong BACKUP_DIR, giữ BACKUP_KEEP bản
//   node scripts/dxdesk.mjs restore <thư-mục> --xac-nhan # khôi phục vào project Compose hiện hành
// Phạm vi: CSDL PostgreSQL của DX-Desk, Keycloak, n8n (cùng vai trò/role), Mattermost, Wiki.js, Metabase
// và volume SeaweedFS (tệp đính kèm, biên bản PDF). Không sao lưu: .env/secret, chỉ mục Qdrant (dựng lại
// từ Wiki), chữ ký ClamAV, tệp tải lên trong Mattermost (DX-Desk chỉ gửi thông báo chữ).
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST = 'manifest.json';
export const FORMAT = 1;
const NAME = /^dxdesk-\d{8}T\d{6}Z$/;

/** CSDL cần sao lưu theo dịch vụ đang chạy. `owner` dùng để kiểm tra sau khôi phục. */
export function databasePlan(env, running) {
  const all = [
    { service: 'postgres', user: env.POSTGRES_USER, database: env.POSTGRES_DB },
    { service: 'postgres', user: env.POSTGRES_USER, database: env.KEYCLOAK_DB },
    { service: 'postgres', user: env.POSTGRES_USER, database: env.N8N_DB },
    { service: 'mattermost-db', user: 'mattermost', database: 'mattermost' },
    { service: 'wiki-db', user: 'wiki', database: 'wiki' },
    { service: 'metabase-db', user: 'metabase', database: 'metabase' },
  ];
  if (!running.has('postgres')) throw new Error('PostgreSQL chưa chạy. Chạy `node scripts/dxdesk.mjs up` trước.');
  for (const item of all) if (!item.user || !item.database) throw new Error(`Thiếu biến .env cho CSDL của ${item.service}.`);
  return all.filter(item => running.has(item.service));
}

export function backupName(date = new Date()) {
  return 'dxdesk-' + date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Bản hoàn chỉnh (có manifest) cũ hơn `keep` bản mới nhất thì xóa; tên theo thời gian UTC nên sắp xếp chuỗi là đủ. */
export function retentionPlan(entries, keep) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error('BACKUP_KEEP phải là số nguyên ≥ 1.');
  const complete = entries.filter(entry => NAME.test(entry.name) && entry.complete).map(entry => entry.name).sort().reverse();
  return complete.slice(keep);
}

/** Dung lượng cần: kích thước dữ liệu gốc (dump nén thường nhỏ hơn) + 20% + 256 MiB dự phòng. */
export function requiredBytes(sourceBytes) {
  return Math.ceil(sourceBytes * 1.2) + 256 * 1024 * 1024;
}

export function validateManifest(manifest) {
  if (manifest?.format !== FORMAT) throw new Error(`Manifest không đúng định dạng ${FORMAT}.`);
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Manifest không có tệp nào.');
  const names = new Set();
  for (const file of manifest.files) {
    if (typeof file.name !== 'string' || basename(file.name) !== file.name || names.has(file.name)) {
      throw new Error(`Tên tệp không hợp lệ trong manifest: ${file.name}`);
    }
    names.add(file.name);
    if (!/^[0-9a-f]{64}$/.test(file.sha256 ?? '')) throw new Error(`Thiếu SHA-256 của ${file.name}.`);
    if (!['roles', 'database', 'seaweedfs'].includes(file.kind)) throw new Error(`Loại tệp lạ: ${file.kind}`);
    if (file.kind === 'database' && !(file.service && file.user && file.database)) throw new Error(`Thiếu thông tin CSDL của ${file.name}.`);
  }
  if (!manifest.files.some(file => file.kind === 'database' && file.service === 'postgres')) {
    throw new Error('Bản sao lưu không có CSDL chính của DX-Desk.');
  }
  return manifest;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(1).replace('.', ',')} ${units[unit]}`;
}

const sqlIdent = value => '"' + String(value).replaceAll('"', '""') + '"';

async function sha256(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

function context(env) {
  const base = ['compose', '--env-file', resolve(ROOT, '.env'), '-f', resolve(ROOT, 'infra/compose/docker-compose.yml')];
  const run = (args, options = {}) => {
    const result = spawnSync('docker', [...base, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, ...options });
    if (result.error) throw new Error(`Docker chưa sẵn sàng: ${result.error.message}`);
    if (result.status !== 0) {
      throw new Error(`docker compose ${args.slice(0, 2).join(' ')} thất bại (${result.status}): ${(result.stderr ?? '').trim().slice(-400)}`);
    }
    return result.stdout ?? '';
  };
  /** Chạy lệnh và nối stdout vào tệp, hoặc lấy stdin từ tệp; dữ liệu không đi qua bộ nhớ của Node. */
  const stream = (args, { output, input }) => new Promise((resolvePromise, reject) => {
    const child = spawn('docker', [...base, ...args], { cwd: ROOT, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
    const work = [];
    if (output) work.push(pipeline(child.stdout, createWriteStream(output)));
    else child.stdout.resume();
    if (input) work.push(pipeline(createReadStream(input), child.stdin));
    else child.stdin.end();
    child.on('error', reject);
    child.on('close', async code => {
      try { await Promise.all(work); } catch (error) { reject(error); return; }
      if (code === 0) resolvePromise();
      else reject(new Error(`docker compose ${args.slice(0, 4).join(' ')} thất bại (${code}): ${stderr.trim().slice(-400)}`));
    });
  });
  const psql = (service, user, database, sql) =>
    run(['exec', '-T', service, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-U', user, '-d', database, '-c', sql]).trim();
  const running = () => new Set(run(['ps', '--services', '--status', 'running']).split(/\r?\n/).filter(Boolean));
  return { run, stream, psql, running };
}

function backupDir(env) {
  const dir = env.BACKUP_DIR || '.local/backups';
  return isAbsolute(dir) ? dir : resolve(ROOT, dir);
}

function gitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function log(dir, line) {
  await appendFile(resolve(dir, 'backup.log'), `${new Date().toISOString()} ${line}\n`);
}

export async function backupMain(env, args = []) {
  if (args.length) throw new Error('backup không nhận tham số; đặt BACKUP_DIR, BACKUP_KEEP trong .env.');
  const keep = Number(env.BACKUP_KEEP ?? 7);
  retentionPlan([], keep);
  const ctx = context(env);
  const root = backupDir(env);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const started = Date.now();
  const name = backupName();
  const target = resolve(root, name);
  try {
    const running = ctx.running();
    const databases = databasePlan(env, running);
    const withSeaweed = running.has('seaweedfs');
    if (!withSeaweed) throw new Error('SeaweedFS chưa chạy; tệp đính kèm sẽ không được sao lưu.');

    let source = 0;
    for (const db of databases) {
      source += Number(ctx.psql(db.service, db.user, db.database, `SELECT pg_database_size(${"'" + db.database.replaceAll("'", "''") + "'"})`));
    }
    source += Number(ctx.run(['exec', '-T', 'seaweedfs', 'du', '-sk', '/data']).split(/\s+/)[0]) * 1024;
    const free = await statfs(root).then(info => info.bavail * info.bsize);
    if (free < requiredBytes(source)) {
      throw new Error(`Không đủ dung lượng: cần khoảng ${formatBytes(requiredBytes(source))}, còn trống ${formatBytes(free)} tại ${root}.`);
    }

    await mkdir(target, { mode: 0o700 });
    const files = [];
    const add = async (entry, path) => {
      const info = await stat(path);
      files.push({ ...entry, name: basename(path), bytes: info.size, sha256: await sha256(path) });
      console.log(`  ${basename(path)}: ${formatBytes(info.size)}`);
    };

    // Vai trò của cụm chính (api_login, authenticator, ticket_automation…) kèm hash mật khẩu; CSDL tham chiếu
    // tới chúng trong GRANT/policy. Các cụm phụ chỉ có một người dùng do image tự tạo.
    const roles = resolve(target, 'postgres-roles.sql');
    await ctx.stream(['exec', '-T', 'postgres', 'pg_dumpall', '-U', env.POSTGRES_USER, '--roles-only'], { output: roles });
    await add({ kind: 'roles', service: 'postgres', user: env.POSTGRES_USER }, roles);
    for (const db of databases) {
      const path = resolve(target, `${db.service}-${db.database}.dump`);
      await ctx.stream(['exec', '-T', db.service, 'pg_dump', '-U', db.user, '-d', db.database, '-Fc', '--create'], { output: path });
      await add({ kind: 'database', ...db }, path);
    }

    // SeaweedFS ghi nhiều tệp volume/filer cùng lúc: dừng ngắn để bản nén nhất quán. Trong lúc dừng,
    // tải tệp đính kèm trả lỗi; tạo/xử lý phiếu vẫn chạy.
    const weed = resolve(target, 'seaweedfs-data.tar.gz');
    ctx.run(['stop', 'seaweedfs']);
    try {
      await ctx.stream(['run', '--rm', '--no-deps', '-T', '--entrypoint', 'tar', 'seaweedfs', 'czf', '-', '-C', '/data', '.'], { output: weed });
    } finally {
      ctx.run(['up', '-d', '--wait', 'seaweedfs']);
    }
    await add({ kind: 'seaweedfs', service: 'seaweedfs' }, weed);

    const manifest = {
      format: FORMAT,
      created_at: new Date(started).toISOString(),
      git_sha: gitSha(),
      versions: { postgres: env.POSTGRES_VERSION, seaweedfs: env.SEAWEEDFS_VERSION },
      profiles: env.COMPOSE_PROFILES ?? '',
      files,
    };
    await writeFile(resolve(target, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });

    const entries = await Promise.all((await readdir(root, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(async entry => ({ name: entry.name, complete: await stat(resolve(root, entry.name, MANIFEST)).then(() => true, () => false) })));
    const removed = retentionPlan(entries, keep);
    for (const old of removed) await rm(resolve(root, old), { recursive: true, force: true });

    const total = files.reduce((sum, file) => sum + file.bytes, 0);
    const seconds = Math.round((Date.now() - started) / 1000);
    await log(root, `OK ${name} ${formatBytes(total)} ${seconds}s, xóa ${removed.length} bản cũ, trống ${formatBytes(free)}`);
    console.log(`Đã sao lưu ${name} (${formatBytes(total)}, ${seconds}s) vào ${target}.`);
    if (removed.length) console.log(`Đã xóa ${removed.length} bản cũ, giữ ${keep} bản mới nhất.`);
    return { name, target, manifest, removed };
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    await log(root, `LỖI ${name} ${error.message.replace(/\s+/g, ' ')}`).catch(() => {});
    throw error;
  }
}

export async function verifyBackup(dir) {
  const manifest = validateManifest(JSON.parse(await readFile(resolve(dir, MANIFEST), 'utf8')));
  for (const file of manifest.files) {
    const actual = await sha256(resolve(dir, file.name));
    if (actual !== file.sha256) throw new Error(`Tệp ${file.name} hỏng hoặc đã bị sửa (SHA-256 không khớp).`);
  }
  return manifest;
}

export async function restoreMain(env, args = []) {
  const source = args.find(arg => !arg.startsWith('--'));
  if (!source || !args.includes('--xac-nhan')) {
    throw new Error('Cách dùng: node scripts/dxdesk.mjs restore <thư-mục-bản-sao> --xac-nhan\n'
      + 'Lệnh XÓA và thay toàn bộ CSDL cùng tệp đính kèm của project Compose hiện hành bằng nội dung bản sao.');
  }
  const dir = isAbsolute(source) ? source : resolve(process.cwd(), source);
  const manifest = await verifyBackup(dir);
  console.log(`Bản sao ${basename(dir)} (${manifest.created_at}, commit ${manifest.git_sha?.slice(0, 7) ?? '?'}): SHA-256 khớp.`);
  if (manifest.versions?.postgres?.split('.')[0] !== env.POSTGRES_VERSION?.split('.')[0]) {
    throw new Error(`Bản sao từ PostgreSQL ${manifest.versions?.postgres}, stack hiện là ${env.POSTGRES_VERSION}; khôi phục bằng cùng bản chính.`);
  }
  const ctx = context(env);
  const databases = manifest.files.filter(file => file.kind === 'database');
  const services = [...new Set(databases.map(db => db.service))];
  const project = env.COMPOSE_PROJECT_NAME || process.env.COMPOSE_PROJECT_NAME || basename(ROOT).toLowerCase();
  console.log(`Khôi phục vào project Compose "${project}": ${databases.map(db => db.service + '/' + db.database).join(', ')}, SeaweedFS.`);

  // Dừng mọi dịch vụ để không còn kết nối ghi vào CSDL hay SeaweedFS, rồi chỉ bật lại tầng dữ liệu.
  ctx.run(['stop']);
  ctx.run(['up', '-d', '--wait', ...services]);

  const roles = manifest.files.find(file => file.kind === 'roles');
  if (roles) {
    // Vai trò có sẵn trên cụm mới (do init/migration tạo) báo "already exists" và được bỏ qua;
    // các lệnh ALTER ROLE theo sau vẫn đưa thuộc tính và mật khẩu về như lúc sao lưu.
    await ctx.stream(['exec', '-T', 'postgres', 'psql', '-X', '-q', '-U', env.POSTGRES_USER, '-d', 'postgres'], { input: resolve(dir, roles.name) });
  }
  for (const db of databases) {
    ctx.psql(db.service, db.user, 'postgres', `DROP DATABASE IF EXISTS ${sqlIdent(db.database)} WITH (FORCE)`);
    await ctx.stream(['exec', '-T', db.service, 'pg_restore', '-U', db.user, '-d', 'postgres', '--create', '--exit-on-error'],
      { input: resolve(dir, db.name) });
    console.log(`  ${db.service}/${db.database}: đã khôi phục.`);
  }

  const weed = manifest.files.find(file => file.kind === 'seaweedfs');
  if (weed) {
    ctx.run(['stop', 'seaweedfs']);
    await ctx.stream(['run', '--rm', '--no-deps', '-T', '--entrypoint', 'sh', 'seaweedfs', '-c',
      'find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar xzf - -C /data'], { input: resolve(dir, weed.name) });
    ctx.run(['up', '-d', '--wait', 'seaweedfs']);
    console.log('  seaweedfs: đã khôi phục.');
  }
  console.log('Xong. Chạy `node scripts/dxdesk.mjs up` (cùng .env và COMPOSE_PROJECT_NAME) để bật lại các dịch vụ còn lại.');
  return { manifest, project };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, ...args] = process.argv.slice(2);
  try {
    const env = { ...parseEnv(await readFile(resolve(ROOT, '.env'), 'utf8')), ...process.env };
    if (action === 'backup') await backupMain(env, args);
    else if (action === 'restore') await restoreMain(env, args);
    else throw new Error('Cách dùng: node scripts/backup.mjs <backup|restore> …');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
