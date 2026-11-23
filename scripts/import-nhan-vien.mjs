// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W6-15: nhập nhân viên hàng loạt từ CSV vào Keycloak và nhóm xử lý.
//
// Mặc định chạy thử: chỉ đọc Keycloak/API, in kế hoạch từng dòng, không ghi gì. `--thuc-hien` mới tạo người
// dùng (mật khẩu tạm ngẫu nhiên, bắt đổi ở lần đăng nhập đầu), gán vai trò realm và đưa Agent/Manager vào
// nhóm qua `POST /api/system/roster` bằng token dịch vụ. Chạy lại an toàn: người đã có thì bỏ qua, chỉ bổ
// sung vai trò còn thiếu hoặc thành viên nhóm còn thiếu; `private.sync_roster` chỉ thêm/cập nhật, không xóa
// thành viên hiện có. Mật khẩu tạm không bao giờ in ra màn hình; muốn giao cho người dùng thì ghi ra tệp riêng
// bằng `--xuat-mat-khau` (ngoài thư mục kho, quyền 600, không ghi đè tệp có sẵn).
import { randomInt } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { adminApi, DEPARTMENT_ATTRIBUTE, DEPARTMENT_PATTERN, json } from './setup-directory.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const COLUMNS = ['tai_khoan', 'ho_ten', 'email', 'vai_tro', 'nhom_xu_ly'];
/** Cột tùy chọn: mã đơn vị (thuộc tính `department`, W5-02) để Manager duyệt đề nghị của đơn vị mình. */
export const OPTIONAL_COLUMNS = ['don_vi'];
export const ROLES = ['Employee', 'Agent', 'Manager'];
/** Vai trò được đưa vào nhóm xử lý: cùng tập "staff" mà setup-automation đưa vào roster. */
export const TEAM_ROLES = ['Agent', 'Manager'];
export const ROSTER_BATCH = 100;
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** CSV theo RFC 4180: dấu phẩy, ngoặc kép (""), xuống dòng CRLF/LF, bỏ BOM. Trả về [{ line, cells }]. */
export function parseCsv(text) {
  const source = text.replace(/^﻿/, '');
  const records = [];
  let cells = [], cell = '', quoted = false, line = 1, start = 1, touched = false;
  const push = () => {
    cells.push(cell);
    if (touched || cells.length > 1 || cell !== '') records.push({ line: start, cells });
    cells = []; cell = ''; touched = false;
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else { if (char === '\n') line++; cell += char; }
      continue;
    }
    if (char === '"' && cell === '') { quoted = true; touched = true; }
    else if (char === ',') { cells.push(cell); cell = ''; touched = true; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index++;
      push(); line++; start = line;
    } else cell += char;
  }
  if (quoted) throw new Error(`Dòng ${start}: thiếu dấu ngoặc kép đóng.`);
  push();
  return records;
}

/** Tách họ tên Việt Nam: họ là từ đầu (lastName), phần còn lại là tên (firstName). */
export function splitName(fullName) {
  const words = fullName.trim().split(/\s+/);
  if (words.length === 1) return { firstName: words[0], lastName: words[0] };
  return { lastName: words[0], firstName: words.slice(1).join(' ') };
}

/** Đọc và kiểm tra tệp: lỗi định dạng, vai trò sai, tài khoản/email trùng trong tệp. Không cần mạng. */
export function readEmployees(text) {
  const records = parseCsv(text);
  if (!records.length) throw new Error('Tệp CSV rỗng.');
  const header = records[0].cells.map(cell => cell.trim().toLowerCase());
  const missing = COLUMNS.filter(column => !header.includes(column));
  if (missing.length) throw new Error(`Thiếu cột: ${missing.join(', ')}. Cần đúng tiêu đề: ${COLUMNS.join(',')}.`);
  const unknown = header.filter(column => !COLUMNS.includes(column) && !OPTIONAL_COLUMNS.includes(column));
  if (unknown.length) throw new Error(`Cột không được hỗ trợ: ${unknown.join(', ')}.`);
  const seenUsername = new Map(), seenEmail = new Map();
  const rows = records.slice(1).map(({ line, cells }) => {
    const value = column => (cells[header.indexOf(column)] ?? '').trim();
    const row = {
      line,
      username: value('tai_khoan').toLowerCase(),
      fullName: value('ho_ten').replace(/\s+/g, ' '),
      email: value('email').toLowerCase(),
      role: value('vai_tro'),
      teams: value('nhom_xu_ly').split(';').map(team => team.trim()).filter(Boolean),
      department: header.includes('don_vi') ? value('don_vi') : '',
      errors: [], warnings: [],
    };
    // Excel hay để thừa dấu phẩy cuối dòng: bỏ qua ô trống thừa, chỉ báo lỗi khi thiếu cột hoặc thừa dữ liệu.
    const extra = cells.slice(header.length).some(cell => cell.trim());
    if (cells.length < header.length || extra) row.errors.push(`có ${cells.length} cột, tiêu đề có ${header.length} cột`);
    if (!row.username) row.errors.push('thiếu tài khoản');
    else if (!USERNAME_PATTERN.test(row.username)) row.errors.push(`tài khoản "${row.username}" chỉ được gồm chữ thường không dấu, số, dấu chấm, gạch nối, gạch dưới (tối đa 64 ký tự)`);
    if (!row.fullName) row.errors.push('thiếu họ tên');
    else if (row.fullName.length > 255) row.errors.push('họ tên dài quá 255 ký tự');
    if (!row.email) row.errors.push('thiếu email');
    else if (!EMAIL_PATTERN.test(row.email)) row.errors.push(`email "${row.email}" không hợp lệ`);
    const role = ROLES.find(name => name.toLowerCase() === row.role.toLowerCase());
    if (!role) row.errors.push(`vai trò "${row.role}" không hợp lệ (chỉ ${ROLES.join(', ')})`);
    else row.role = role;
    if (row.teams.length && role && !TEAM_ROLES.includes(role)) row.errors.push(`vai trò ${role} không được đưa vào nhóm xử lý`);
    if (row.department && !new RegExp(DEPARTMENT_PATTERN).test(row.department)) {
      row.errors.push(`mã đơn vị "${row.department}" chỉ gồm chữ thường, số và dấu gạch nối`);
    }
    if (row.username) {
      if (seenUsername.has(row.username)) row.errors.push(`tài khoản trùng với dòng ${seenUsername.get(row.username)}`);
      else seenUsername.set(row.username, line);
    }
    if (row.email) {
      if (seenEmail.has(row.email)) row.errors.push(`email trùng với dòng ${seenEmail.get(row.email)}`);
      else seenEmail.set(row.email, line);
    }
    return row;
  });
  if (!rows.length) throw new Error('Tệp CSV chỉ có dòng tiêu đề.');
  return rows;
}

/** Khớp tên nhóm (không phân biệt hoa thường) hoặc UUID với danh sách nhóm từ `/api/system/teams`. */
export function resolveTeam(spec, teams) {
  const key = spec.toLowerCase();
  return teams.find(team => (UUID_PATTERN.test(spec) ? team.id.toLowerCase() === key : team.name.toLowerCase() === key));
}

/**
 * Lập kế hoạch cho từng dòng hợp lệ dựa trên thư mục người dùng hiện có. Không ghi gì.
 * `directory`: { findByUsername(name), findByEmail(email), realmRoles(id) }; `teams`: null nếu chưa tra được.
 */
export async function planImport(rows, directory, teams) {
  for (const row of rows) {
    row.action = 'error';
    row.addRole = false; row.addTeams = []; row.setDepartment = false;
    if (teams) {
      row.teamRefs = [];
      for (const spec of row.teams) {
        const team = resolveTeam(spec, teams);
        if (!team) row.errors.push(`nhóm "${spec}" không tồn tại`);
        else if (!team.active) row.errors.push(`nhóm "${team.name}" đang ngừng hoạt động`);
        else if (!row.teamRefs.includes(team)) row.teamRefs.push(team);
      }
    }
    if (row.errors.length) continue;
    const user = await directory.findByUsername(row.username);
    const owner = await directory.findByEmail(row.email);
    if (owner && owner.username !== row.username) {
      row.errors.push(`email đã dùng cho tài khoản Keycloak khác "${owner.username}"`);
      continue;
    }
    if (!user) {
      row.action = 'create';
      row.addRole = true;
      row.setDepartment = Boolean(row.department);
      row.addTeams = row.teamRefs ?? [];
      continue;
    }
    row.userId = user.id;
    if ((user.email ?? '').toLowerCase() !== row.email) row.warnings.push(`Keycloak đang lưu email khác (${user.email || 'trống'}), không đổi`);
    const current = (await directory.realmRoles(user.id)).map(role => role.name).filter(name => ROLES.includes(name));
    const others = current.filter(name => name !== row.role);
    if (others.length) {
      row.errors.push(`tài khoản đã có vai trò ${others.join(', ')} trong Keycloak, script không tự đổi vai trò`);
      continue;
    }
    row.addRole = !current.includes(row.role);
    const existingDepartment = user.attributes?.[DEPARTMENT_ATTRIBUTE]?.[0];
    if (row.department && !existingDepartment) row.setDepartment = true;
    else if (row.department && existingDepartment !== row.department) {
      row.warnings.push(`đơn vị đang là "${existingDepartment}", không ghi đè`);
    }
    row.addTeams = (row.teamRefs ?? []).filter(team => !(team.members ?? []).includes(user.id));
    row.action = row.addRole || row.setDepartment || row.addTeams.length ? 'update' : 'skip';
  }
  return rows;
}

/** Mật khẩu tạm 20 ký tự từ CSPRNG, luôn có chữ hoa, chữ thường, số và ký hiệu; bỏ ký tự dễ nhầm. */
export function generatePassword(length = 20) {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*-_=+?'];
  const all = groups.join('');
  const chars = groups.map(group => group[randomInt(group.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let index = chars.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [chars[index], chars[other]] = [chars[other], chars[index]];
  }
  return chars.join('');
}

export function userRepresentation(row, password) {
  return {
    username: row.username, email: row.email, ...splitName(row.fullName), enabled: true, emailVerified: false,
    requiredActions: ['UPDATE_PASSWORD'],
    credentials: [{ type: 'password', value: password, temporary: true }],
    ...(row.department ? { attributes: { [DEPARTMENT_ATTRIBUTE]: [row.department] } } : {}),
  };
}

/** Thành viên roster còn thiếu, chia lô tối đa 100 người như giới hạn của `SyncRoster`. */
export function rosterBatches(rows) {
  const members = rows.filter(row => row.userId && row.action !== 'error')
    .flatMap(row => row.addTeams.map(team => ({ team_id: team.id, user_id: row.userId, display_name: row.fullName, active: true })));
  const batches = [];
  for (let index = 0; index < members.length; index += ROSTER_BATCH) batches.push(members.slice(index, index + ROSTER_BATCH));
  return batches;
}

/** Thực hiện kế hoạch. `writePassword(row, password)` được gọi ngay sau khi tạo người dùng. */
export async function applyPlan(rows, { admin, roster, writePassword, password = generatePassword }) {
  const roleCache = new Map();
  const roleRepresentation = async name => {
    if (!roleCache.has(name)) roleCache.set(name, await admin('/roles/' + encodeURIComponent(name)));
    return roleCache.get(name);
  };
  for (const row of rows) {
    if (row.action !== 'create' && row.action !== 'update') continue;
    try {
      if (row.action === 'create') {
        const secret = password();
        await admin('/users', 'POST', userRepresentation(row, secret));
        const [user] = await admin('/users?exact=true&username=' + encodeURIComponent(row.username));
        if (!user) throw new Error('Keycloak không trả về người dùng vừa tạo');
        row.userId = user.id;
        await writePassword(row, secret);
      } else if (row.setDepartment) {
        const user = await admin('/users/' + row.userId);
        await admin('/users/' + row.userId, 'PUT', { ...user, attributes: { ...user.attributes, [DEPARTMENT_ATTRIBUTE]: [row.department] } });
      }
      if (row.addRole) await admin('/users/' + row.userId + '/role-mappings/realm', 'POST', [await roleRepresentation(row.role)]);
      row.done = true;
    } catch (error) {
      row.action = 'error';
      row.errors.push(error.status === 409 ? 'Keycloak báo tài khoản hoặc email đã tồn tại' : `Keycloak lỗi: ${error.message}`);
    }
  }
  let updated = 0;
  for (const batch of rosterBatches(rows)) {
    if (!roster) throw new Error('Cần token dịch vụ để đưa kỹ thuật viên vào nhóm.');
    updated += (await roster(batch)).updated ?? 0;
  }
  return { updated };
}

const LABELS = { valid: 'hợp lệ', create: 'tạo mới', update: 'bổ sung', skip: 'đã có, bỏ qua', error: 'LỖI' };
export function describe(row) {
  const parts = [];
  if (row.action === 'create' || row.action === 'valid') parts.push(`vai trò ${row.role}`);
  else if (row.addRole) parts.push(`thêm vai trò ${row.role}`);
  if (row.setDepartment) parts.push(`đơn vị ${row.department}`);
  if (row.addTeams?.length) parts.push(`vào nhóm ${row.addTeams.map(team => team.name).join(', ')}`);
  else if (row.teams.length && !row.teamRefs && row.action !== 'error') parts.push(`nhóm ${row.teams.join(', ')} (chưa kiểm tra)`);
  const detail = row.action === 'error' ? row.errors.join('; ') : parts.join(', ');
  const warnings = row.warnings.length ? ` [cảnh báo: ${row.warnings.join('; ')}]` : '';
  return `Dòng ${row.line} ${row.username || '(trống)'}: ${LABELS[row.action]}${detail ? ' – ' + detail : ''}${warnings}`;
}

export function summarize(rows) {
  const count = action => rows.filter(row => row.action === action).length;
  return { total: rows.length, create: count('create'), update: count('update'), skip: count('skip'), error: count('error'),
    memberships: rows.reduce((sum, row) => sum + (row.action === 'error' ? 0 : row.addTeams?.length ?? 0), 0) };
}

/** Thư mục người dùng Keycloak qua Admin API (chỉ đọc). */
export function keycloakDirectory(admin) {
  return {
    findByUsername: async username => (await admin('/users?exact=true&username=' + encodeURIComponent(username)))
      .find(user => user.username === username),
    findByEmail: async email => (await admin('/users?exact=true&email=' + encodeURIComponent(email)))
      .find(user => (user.email ?? '').toLowerCase() === email),
    realmRoles: id => admin('/users/' + id + '/role-mappings/realm'),
  };
}

/** Token client_credentials của dxdesk-automation, dùng cho `/api/system/teams` và `/api/system/roster`. */
export async function automationApi(env) {
  if (!env.AUTOMATION_CLIENT_SECRET) throw new Error('Thiếu AUTOMATION_CLIENT_SECRET trong .env: cần stack có AUTOMATION_ENABLED=true để tra nhóm xử lý.');
  const issuer = env.KEYCLOAK_PUBLIC_URL.replace(/\/+$/, '') + '/realms/' + env.KEYCLOAK_REALM;
  const service = await json(issuer + '/protocol/openid-connect/token', { method: 'POST', body: new URLSearchParams({
    grant_type: 'client_credentials', client_id: env.AUTOMATION_CLIENT_ID || 'dxdesk-automation', client_secret: env.AUTOMATION_CLIENT_SECRET,
  }) });
  const gateway = (env.DXDESK_GATEWAY_URL || 'http://localhost:' + (env.APISIX_PORT || '9080')).replace(/\/+$/, '');
  const headers = { Authorization: 'Bearer ' + service.access_token, 'Content-Type': 'application/json' };
  return {
    teams: async () => (await json(gateway + '/api/system/teams', { headers })).data,
    roster: members => json(gateway + '/api/system/roster', { method: 'POST', headers, body: JSON.stringify({ members }) }),
  };
}

/** Mở tệp mật khẩu: ngoài kho, chưa tồn tại, quyền 600. Trả về hàm ghi từng dòng. */
export async function openPasswordFile(path, root = ROOT) {
  const target = resolve(path);
  const inside = relative(root, target);
  if (!inside.startsWith('..') && !isAbsolute(inside)) {
    throw new Error('Tệp mật khẩu phải nằm ngoài thư mục kho để không lọt vào commit.');
  }
  let handle;
  try { handle = await open(target, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Tệp ${target} đã tồn tại; chọn tên khác để không ghi đè mật khẩu cũ.`);
    throw error;
  }
  await handle.write('tai_khoan,email,mat_khau_tam\n');
  return {
    path: target,
    write: async (row, password) => { await handle.write(`${row.username},${row.email},"${password.replaceAll('"', '""')}"\n`); },
    close: () => handle.close(),
  };
}

export const USAGE = `Cách dùng: node scripts/import-nhan-vien.mjs <tệp.csv> [tùy chọn]
  (mặc định)                chạy thử: đọc Keycloak/API, in kế hoạch, không ghi gì
  --thuc-hien               tạo người dùng, gán vai trò, đưa vào nhóm
  --xuat-mat-khau <tệp>     ghi mật khẩu tạm của người mới tạo ra tệp riêng (ngoài kho); bắt buộc khi có người cần tạo
  --bo-qua-dong-loi         vẫn chạy thật các dòng hợp lệ khi tệp có dòng lỗi
  --offline                 chỉ kiểm tra tệp CSV, không gọi Keycloak/API
Cột CSV: ${COLUMNS.join(',')} (tùy chọn: ${OPTIONAL_COLUMNS.join(',')}). Nhiều nhóm cách nhau bằng dấu chấm phẩy.`;

export async function importMain(argv, env, { log = console.log, root = ROOT } = {}) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    'thuc-hien': { type: 'boolean' }, 'xuat-mat-khau': { type: 'string' }, 'bo-qua-dong-loi': { type: 'boolean' },
    offline: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) { log(USAGE); return 0; }
  if (positionals.length !== 1) throw new Error(USAGE);
  const apply = Boolean(values['thuc-hien']);
  if (apply && values.offline) throw new Error('--offline chỉ dùng cho chạy thử.');
  const rows = readEmployees(await readFile(resolve(positionals[0]), 'utf8'));

  let admin, automation;
  if (!values.offline) {
    admin = await adminApi(env);
    const needsTeams = rows.some(row => row.teams.length);
    if (needsTeams) automation = await automationApi(env);
    await planImport(rows, keycloakDirectory(admin), automation ? await automation.teams() : null);
  } else {
    for (const row of rows) { row.action = row.errors.length ? 'error' : 'valid'; row.addTeams = []; }
  }

  log(`${apply ? 'CHẠY THẬT' : 'CHẠY THỬ (không ghi gì)'}${values.offline ? ', chỉ kiểm tra tệp' : ''}: ${rows.length} dòng.`);
  for (const row of rows) log(describe(row));
  let summary = summarize(rows);
  if (values.offline) log(`Hợp lệ ${rows.length - summary.error}/${rows.length} dòng; chưa đối chiếu với Keycloak và danh sách nhóm.`);
  else log(`Kế hoạch: tạo mới ${summary.create}, bổ sung ${summary.update}, bỏ qua ${summary.skip}, lỗi ${summary.error}, thêm ${summary.memberships} thành viên nhóm.`);
  if (!apply) {
    if (summary.error) log('Sửa các dòng lỗi rồi chạy lại; dòng lỗi không được ghi khi chạy thật.');
    else log(values.offline ? 'Bỏ --offline để đối chiếu với Keycloak, rồi chạy với --thuc-hien để ghi.' : 'Chạy lại với --thuc-hien để ghi.');
    return summary.error ? 1 : 0;
  }
  if (summary.error && !values['bo-qua-dong-loi']) {
    throw new Error('Tệp còn dòng lỗi, không ghi gì. Sửa tệp hoặc thêm --bo-qua-dong-loi để chỉ ghi các dòng hợp lệ.');
  }
  if (summary.create && !values['xuat-mat-khau']) {
    throw new Error('Có người dùng mới cần mật khẩu tạm: thêm --xuat-mat-khau <tệp ngoài kho> để giao mật khẩu cho họ. Không ghi gì.');
  }
  const passwords = summary.create ? await openPasswordFile(values['xuat-mat-khau'], root) : null;
  let result;
  try {
    result = await applyPlan(rows, { admin, roster: automation?.roster, writePassword: (row, secret) => passwords.write(row, secret) });
  } finally { await passwords?.close(); }
  const failed = rows.filter(row => row.action === 'error' && row.errors.some(message => message.startsWith('Keycloak')));
  for (const row of failed) log(describe(row));
  const done = rows.filter(row => row.done);
  log(`Đã ghi: tạo ${done.filter(row => row.action === 'create').length}, bổ sung ${done.filter(row => row.action === 'update').length}, ` +
    `roster cập nhật ${result.updated} dòng, lỗi ${rows.filter(row => row.action === 'error').length}.`);
  if (passwords) log(`Mật khẩu tạm ở ${passwords.path} (quyền 600). Giao riêng cho từng người rồi xóa tệp.`);
  summary = summarize(rows);
  return summary.error ? 1 : 0;
}

export async function loadEnv(root = ROOT) {
  let file = {};
  try { file = parseEnv(await readFile(resolve(root, '.env'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const env = { ...file };
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(KEYCLOAK_|AUTOMATION_CLIENT_|APISIX_PORT$|DXDESK_GATEWAY_URL$)/.test(key)) env[key] = value;
  }
  return env;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    process.exitCode = await importMain(args, args.includes('--offline') || args.includes('--help') || args.includes('-h') ? {} : await loadEnv());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
