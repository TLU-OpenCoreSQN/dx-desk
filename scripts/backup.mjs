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
import { appendFile, mkdir, readdir, readFile, rm, rmdir, stat, statfs, writeFile } from 'node:fs/promises';
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
  const profiles = String(env.COMPOSE_PROFILES ?? '').split(',');
  const required = profiles.includes('full') ? ['wiki-db', 'mattermost-db', 'metabase-db']
    : profiles.includes('demo-light') ? ['wiki-db', 'mattermost-db'] : [];
  for (const service of required) if (!running.has(service)) throw new Error(`Dịch vụ ${service} chưa chạy; không tạo bản sao thiếu dữ liệu.`);
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

/** Đối chiếu toàn bộ kế hoạch trước khi dừng dịch vụ hoặc xóa bất kỳ CSDL nào. */
export function validateRestorePlan(manifest, env) {
  validateManifest(manifest);
  const databases = manifest.files.filter(file => file.kind === 'database');
  const knownServices = new Set(['postgres', 'wiki-db', 'mattermost-db', 'metabase-db']);
  if (databases.some(db => !knownServices.has(db.service))) throw new Error('Bản sao có dịch vụ CSDL không thuộc DX-Desk.');
  const expected = databasePlan({ ...env, COMPOSE_PROFILES: manifest.profiles ?? '' }, new Set(databases.map(db => db.service)));
  const key = db => JSON.stringify([db.service, db.user, db.database]);
  if (databases.length !== expected.length || new Set(databases.map(key)).size !== expected.length ||
      expected.some(db => !databases.some(item => key(item) === key(db)))) {
    throw new Error('Danh sách CSDL không đầy đủ hoặc không khớp .env của project khôi phục.');
  }
  for (const kind of ['roles', 'seaweedfs']) {
    const entries = manifest.files.filter(file => file.kind === kind);
    if (entries.length !== 1 || entries[0].service !== (kind === 'roles' ? 'postgres' : 'seaweedfs') ||
        (kind === 'roles' && entries[0].user !== env.POSTGRES_USER)) throw new Error(`Bản sao thiếu hoặc sai thành phần ${kind}.`);
  }
  return databases;
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
  const stream = async (args, { output, input, inputText }) => {
    const child = spawn('docker', [...base, ...args], { cwd: ROOT, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
    const closed = new Promise((resolvePromise, reject) => {
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolvePromise()
        : reject(new Error(`docker compose ${args.slice(0, 4).join(' ')} thất bại (${code}): ${stderr.trim().slice(-400)}`)));
    });
    const work = [closed];
    if (output) work.push(pipeline(child.stdout, createWriteStream(output)));
    else child.stdout.resume();
    if (input) work.push(pipeline(createReadStream(input), child.stdin));
    else { child.stdin.on('error', () => {}); child.stdin.end(inputText); }
    try { await Promise.all(work); } catch (error) { child.kill(); throw error; }
  };
  const psql = (service, user, database, sql) =>
    run(['exec', '-T', service, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-U', user, '-d', database, '-c', sql]).trim();
  const running = () => new Set(run(['ps', '--services', '--status', 'running']).split(/\r?\n/).filter(Boolean));
  return { run, stream, psql, running };
}

function backupDir(env) {
  const dir = env.BACKUP_DIR || '.local/backups';
  return isAbsolute(dir) ? dir : resolve(ROOT, dir);
}

function childBackupPath(root, name) {
  const path = resolve(root, name);
  if (!NAME.test(name) || dirname(path) !== resolve(root)) throw new Error('Thư mục bản sao nằm ngoài BACKUP_DIR.');
  return path;
}

function gitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function log(dir, line) {
  await appendFile(resolve(dir, 'backup.log'), `${new Date().toISOString()} ${line}\n`);
}

async function operationLock(env) {
  const project = env.COMPOSE_PROJECT_NAME || process.env.COMPOSE_PROJECT_NAME || basename(ROOT).toLowerCase();
  const parent = resolve(ROOT, '.local', 'backup-locks');
  await mkdir(parent, { recursive: true });
  const path = resolve(parent, createHash('sha256').update(project).digest('hex').slice(0, 20));
  try { await mkdir(path); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Project đang có thao tác sao lưu/khôi phục; kiểm tra tiến trình trước khi gỡ khóa ${path}.`);
    throw error;
  }
  return () => rmdir(path);
}

export async function backupMain(env, args = [], options = {}) {
  const release = await operationLock(env);
  try { return await backupUnlocked(env, args, options); } finally { await release(); }
}

async function backupUnlocked(env, args, options) {
  if (args.length) throw new Error('backup không nhận tham số; đặt BACKUP_DIR, BACKUP_KEEP trong .env.');
  const keep = Number(env.BACKUP_KEEP ?? 7);
  retentionPlan([], keep);
  const ctx = options.context ?? context(env);
  const root = backupDir(env);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const started = Date.now();
  const name = backupName(options.date);
  const target = childBackupPath(root, name);
  let created = false;
  let paused = [];
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
    created = true;
    // Chặn mọi writer trong cùng cửa sổ: không để DB tham chiếu tệp vừa bị xóa khỏi SeaweedFS.
    paused = ['api', 'postgrest', 'keycloak', 'n8n', 'assistant', 'wiki-index', 'wikijs', 'mattermost', 'metabase']
      .filter(service => running.has(service));
    if (paused.length) ctx.run(['stop', ...paused]);
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
    for (const old of removed) await rm(childBackupPath(root, old), { recursive: true, force: true });

    const total = files.reduce((sum, file) => sum + file.bytes, 0);
    const seconds = Math.round((Date.now() - started) / 1000);
    await log(root, `OK ${name} ${formatBytes(total)} ${seconds}s, xóa ${removed.length} bản cũ, trống ${formatBytes(free)}`);
    console.log(`Đã sao lưu ${name} (${formatBytes(total)}, ${seconds}s) vào ${target}.`);
    if (removed.length) console.log(`Đã xóa ${removed.length} bản cũ, giữ ${keep} bản mới nhất.`);
    return { name, target, manifest, removed };
  } catch (error) {
    if (created) await rm(target, { recursive: true, force: true });
    await log(root, `LỖI ${name} ${error.message.replace(/\s+/g, ' ')}`).catch(() => {});
    throw error;
  } finally {
    if (paused.length) ctx.run(['up', '-d', '--no-deps', '--wait', ...paused]);
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

export async function restoreMain(env, args = [], options = {}) {
  const release = await operationLock(env);
  try { return await restoreUnlocked(env, args, options); } finally { await release(); }
}

async function restoreUnlocked(env, args, options) {
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
  const databases = validateRestorePlan(manifest, env);
  const ctx = options.context ?? context(env);
  // Đọc được tất cả archive trước khi stop/DROP; checksum không đủ chứng minh dump hợp lệ.
  for (const db of databases) await ctx.stream(['run', '--rm', '--no-deps', '-T', '--entrypoint', 'pg_restore', db.service, '--list'],
    { input: resolve(dir, db.name) });
  const weed = manifest.files.find(file => file.kind === 'seaweedfs');
  await ctx.stream(['run', '--rm', '--no-deps', '-T', '--entrypoint', 'tar', 'seaweedfs', 'tzf', '-'], { input: resolve(dir, weed.name) });
  const services = [...new Set(databases.map(db => db.service))];
  const project = env.COMPOSE_PROJECT_NAME || process.env.COMPOSE_PROJECT_NAME || basename(ROOT).toLowerCase();
  console.log(`Khôi phục vào project Compose "${project}": ${databases.map(db => db.service + '/' + db.database).join(', ')}, SeaweedFS.`);

  // Dừng mọi dịch vụ để không còn kết nối ghi vào CSDL hay SeaweedFS, rồi chỉ bật lại tầng dữ liệu.
  ctx.run(['stop']);
  ctx.run(['up', '-d', '--wait', ...services]);

  // Image PostgreSQL có server Unix tạm trong lúc init; pg_isready mặc định có thể báo khỏe
  // trước khi server này tắt. Chờ TCP của server chính để không restore vào quá trình init.
  for (const service of services) {
    const db = databases.find(item => item.service === service);
    for (let attempt = 0; ; attempt++) {
      try { ctx.run(['exec', '-T', service, 'pg_isready', '-h', '127.0.0.1', '-U', db.user, '-d', db.database]); break; }
      catch {
        if (attempt >= 89) throw new Error(`CSDL ${service} chưa khởi tạo xong; chưa xóa dữ liệu.`);
        await new Promise(done => setTimeout(done, options.readinessDelayMs ?? 1000));
      }
    }
  }

  const roles = manifest.files.find(file => file.kind === 'roles');
  if (roles) {
    // Chỉ bỏ qua role đã có; mọi lỗi SQL khác đều dừng trước khi xóa CSDL.
    const roleSql = (await readFile(resolve(dir, roles.name), 'utf8')).replace(/^CREATE ROLE (.+);$/gm,
      (_line, role) => `DO $dxdesk$ BEGIN CREATE ROLE ${role}; EXCEPTION WHEN duplicate_object THEN NULL; END; $dxdesk$;`);
    await ctx.stream(['exec', '-T', 'postgres', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', env.POSTGRES_USER, '-d', 'postgres'], { inputText: roleSql });
  }
  for (const db of databases) {
    ctx.psql(db.service, db.user, 'postgres', `DROP DATABASE IF EXISTS ${sqlIdent(db.database)} WITH (FORCE)`);
    await ctx.stream(['exec', '-T', db.service, 'pg_restore', '-U', db.user, '-d', 'postgres', '--create', '--exit-on-error'],
      { input: resolve(dir, db.name) });
    console.log(`  ${db.service}/${db.database}: đã khôi phục.`);
  }

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
