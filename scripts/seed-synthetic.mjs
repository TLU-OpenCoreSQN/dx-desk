// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Dry-run by default; never creates Keycloak identities or scanned files.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { planVpnScenario, scenarioHistory, scenarioSummary } from './seed-scenario.mjs';
import { importDemoHistory } from './import-demo-history.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = ['Employee', 'Agent', 'Manager'];
const STATUSES = ['new', 'triaged', 'assigned', 'in_progress', 'waiting_user', 'resolved', 'closed', 'cancelled', 'pending_approval'];
const WEIGHTS = { account: 35, vpn: 25, hardware: 20, software: 12, access: 5, 'system-error': 3 };
const DEPARTMENTS = ['Phòng hành chính', 'Phòng nhân sự', 'Phòng kế toán', 'Phòng kinh doanh', 'Phòng vận hành', 'Phòng CNTT'];
const MINUTE = 60_000;
const WEEK = 7 * 24 * 60 * MINUTE;
const TEAM_NAMES = { vpn: 'Network Team', account: 'Identity Team', access: 'Identity Team', hardware: 'IT Support', software: 'IT Support', 'system-error': 'IT Support' };
const TITLES = { vpn: 'Không kết nối được VPN', account: 'Cần hỗ trợ tài khoản thử nghiệm', hardware: 'Màn hình thiết bị thử nghiệm bị nháy', software: 'Phần mềm mô phỏng cần cài đặt lại', access: 'Đề nghị quyền truy cập hệ thống giả lập', 'system-error': 'Hệ thống thử nghiệm phản hồi chậm' };
const digest = value => createHash('sha256').update(value).digest('hex');
const sample = key => Number.parseInt(digest(key).slice(0, 8), 16) / 2 ** 32;

function weighted(values, position) {
  let remaining = position * values.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of values) {
    remaining -= weight;
    if (remaining < 0) return value;
  }
  throw new Error('Phân bố trọng số không hợp lệ.');
}

function seedParameters(options) {
  const { weeks = 6, users = 100, scenario = 'baseline', weights = {} } = options;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) throw new Error('weeks phải là số nguyên 1..52.');
  if (!Number.isInteger(users) || users < 1 || users > 10000) throw new Error('users phải là số nguyên 1..10000.');
  if (!['baseline', 'vpn-4.2'].includes(scenario)) throw new Error('scenario chỉ nhận baseline hoặc vpn-4.2.');
  if (Object.entries(weights).some(([key, value]) =>
    !Object.hasOwn(WEIGHTS, key) || !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error('Trọng số danh mục phải nằm trong 0..100 và dùng mã danh mục hiện có.');
  }
  const categories = Object.entries({ ...WEIGHTS, ...weights });
  if (!categories.some(([, weight]) => weight > 0)) throw new Error('Cần ít nhất một trọng số dương.');
  return { weeks, users, scenario, categories };
}

function stableId(value) {
  const hex = digest(value).slice(0, 32).split('');
  hex[12] = '5'; hex[16] = '8';
  const id = hex.join('');
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

function normalizeIdentities(identityMap = {}) {
  if (!identityMap || typeof identityMap !== 'object' || Array.isArray(identityMap)) throw new Error('Identity map phải là object {users, teams}.');
  const users = identityMap.users ?? [];
  const teams = identityMap.teams ?? [];
  if (!Array.isArray(users) || !Array.isArray(teams)) throw new Error('users/teams phải là mảng.');
  const known = new Set();
  const normalizedUsers = users.map(user => {
    if (!user || !UUID.test(user.sub ?? '') || known.has(user.sub.toLowerCase())) throw new Error('Mỗi user cần sub UUID Keycloak thật, không trùng.');
    if (!Array.isArray(user.roles) || !user.roles.length || user.roles.some(role => !ROLES.includes(role))) throw new Error('Role chỉ nhận Employee, Agent hoặc Manager.');
    const sub = user.sub.toLowerCase(); known.add(sub);
    return { sub, roles: [...new Set(user.roles)].sort() };
  }).sort((a, b) => a.sub.localeCompare(b.sub));
  const seenTeams = new Set();
  const normalizedTeams = teams.map(team => {
    if (!team || !UUID.test(team.id ?? '') || !Object.values(TEAM_NAMES).includes(team.name) || seenTeams.has(team.name)) throw new Error('Team cần id UUID thật và tên routing duy nhất.');
    if (!Array.isArray(team.members) || team.members.some(sub => !known.has(String(sub).toLowerCase()))) throw new Error('Team member phải tham chiếu sub trong users.');
    if (team.members.some(sub => !normalizedUsers.find(user => user.sub === String(sub).toLowerCase())?.roles.some(role => role === 'Agent' || role === 'Manager'))) throw new Error('Roster xử lý chỉ nhận Agent/Manager đã được ánh xạ.');
    seenTeams.add(team.name);
    return { id: team.id.toLowerCase(), name: team.name, members: [...new Set(team.members.map(sub => sub.toLowerCase()))].sort() };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const system = identityMap.system ?? null;
  if (system !== null && (!UUID.test(system) || known.has(system.toLowerCase()))) throw new Error('System cần sub UUID riêng của service account.');
  return { users: normalizedUsers, teams: normalizedTeams, system: system?.toLowerCase() ?? null };
}

/** Same seed/time/verified identity map => same rows and manifest, including their hash. */
export function generate(seed = 'dxdesk-w4', now = '2026-11-02T00:00:00.000Z', identityMap = {}, count = 500, options = {}) {
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 128) throw new Error('seed cần chuỗi 1..128 ký tự.');
  if (!Number.isInteger(count) || count < 500 || count > 50000) throw new Error('count phải là số nguyên 500..50000.');
  if (typeof now !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(now) || !Number.isFinite(Date.parse(now))) throw new Error('--now phải là timestamp UTC ISO-8601 cố định.');
  const referenceTime = new Date(now).toISOString();
  if (referenceTime.slice(0, 19) !== now.slice(0, 19)) throw new Error('--now có ngày/giờ không hợp lệ.');
  const referenceMs = Date.parse(referenceTime);
  const { weeks, users, scenario, categories } = seedParameters(options);
  const identities = normalizeIdentities(identityMap);
  const employees = identities.users.filter(user => user.roles.includes('Employee'));
  const managers = identities.users.filter(user => user.roles.includes('Manager'));
  const agents = identities.users.filter(user => user.roles.includes('Agent'));
  const identityHash = digest(JSON.stringify(identities));
  const parameters = { weeks, users, scenario, weights: Object.fromEntries(categories) };
  const vpnPlan = scenario === 'vpn-4.2' ? planVpnScenario({ weeks, categories, referenceMs, sample: key => sample(seed + ':' + key) }) : null;
  const schemaVersion = vpnPlan ? 3 : 2;
  const namespace = stableId(`dxdesk-synthetic:v${schemaVersion}:enterprise:${seed}:${referenceTime}:${identityHash}:${JSON.stringify(parameters)}:${vpnPlan ? count : ''}`);
  const profiles = Array.from({ length: users }, (_, index) => {
    return { code: `SYNTH-${String(index + 1).padStart(4, '0')}`, audience: 'Nhân viên', unit: DEPARTMENTS[index % DEPARTMENTS.length] };
  });
  const weekWeights = Array.from({ length: weeks }, (_, index) => [index, index < 2 ? 2.5 : 1]);
  const tickets = Array.from({ length: count }, (_, index) => {
    const key = `${seed}:${index}`;
    const cohort = vpnPlan?.(index);
    const week = weighted(weekWeights, sample(key + ':week'));
    const weekCategories = vpnPlan && week >= weeks - 2 ? categories.filter(([code]) => code !== 'vpn') : categories;
    const category = cohort ? 'vpn' : weighted(weekCategories, sample(key + ':category'));
    const proposedStatus = STATUSES[index % STATUSES.length];
    let status = cohort ? 'resolved' : proposedStatus === 'pending_approval' && category !== 'access' ? 'new' : proposedStatus;
    if (vpnPlan && category === 'access' && ['new', 'triaged', 'cancelled'].includes(status)) status = 'pending_approval';
    const critical = managers.length > 0 && index % 17 === 0 && status !== 'pending_approval';
    const requesters = critical ? managers : employees;
    const profileIndex = index % profiles.length;
    const profile = profiles[profileIndex];
    const requester = requesters.length ? requesters[profileIndex % requesters.length] : null;
    const teamName = TEAM_NAMES[category];
    const team = identities.teams.find(item => item.name === teamName);
    const teamAgents = agents.filter(agent => team?.members.includes(agent.sub));
    const assigned = ['assigned', 'in_progress', 'waiting_user', 'resolved', 'closed'].includes(status);
    const claimed = ['in_progress', 'waiting_user', 'resolved', 'closed'].includes(status);
    const assignee = claimed && teamAgents.length ? teamAgents[index % teamAgents.length].sub : null;
    const createdAt = cohort?.createdAt ?? new Date(referenceMs - (weeks - week) * WEEK + Math.floor(sample(key + ':minute') * (WEEK / MINUTE - 1)) * MINUTE).toISOString();
    const clientVersion = cohort?.clientVersion ?? '4.1';
    const requestFields = {
      vpn: { client_version: clientVersion, error_message: '[SYNTHETIC] Kết nối thử nghiệm hết thời gian', device_os: 'Windows thử nghiệm' },
      account: { account_name: `synthetic.user.${index % 25 + 1}`, issue_type: '[SYNTHETIC] Không đăng nhập được' },
      hardware: { device_code: `SYNTH-${String(index + 1).padStart(5, '0')}`, location: '[SYNTHETIC] Phòng thử nghiệm' },
      software: { software_name: '[SYNTHETIC] Ứng dụng văn phòng', error_message: 'Lỗi mô phỏng để kiểm thử' },
      access: { system_name: '[SYNTHETIC] Kho tài liệu thử nghiệm', permission_level: 'Đọc dữ liệu giả lập', valid_until: referenceTime.slice(0, 10) },
      'system-error': { system_name: '[SYNTHETIC] Dịch vụ thử nghiệm', error_message: 'Phản hồi mô phỏng quá chậm', occurred_at: createdAt },
    }[category];
    return {
      id: stableId(`${namespace}:ticket:${index}`), requester_id: requester?.sub ?? null,
      category_code: category, title: `[SYNTHETIC] ${TITLES[category]} #${index + 1}`,
      description: `[SYNTHETIC] Phiếu ${index + 1}. ${profile.code} · ${profile.audience} · ${profile.unit} (mô phỏng).`,
      profile_code: profile.code,
      priority: critical ? 'critical' : ['low', 'normal', 'high'][index % 3], status,
      assigned_team_id: assigned ? team?.id ?? null : null, team_name: assigned ? teamName : null,
      assigned_to: assignee, request_fields: requestFields, created_at: createdAt, updated_at: createdAt,
      waiting_since: status === 'waiting_user' ? createdAt : null, sla_paused_ms: 0,
      resolution_note: ['resolved', 'closed'].includes(status) ? '[SYNTHETIC] Đã khắc phục bằng quy trình thử nghiệm và xác minh dữ liệu giả lập.' : null,
      ...(cohort && { scenario_phase: cohort.phase, resolution_minutes: cohort.minutes }),
    };
  });
  const counts = field => Object.fromEntries([...new Set(tickets.map(row => row[field]))].sort().map(value => [value, tickets.filter(row => row[field] === value).length]));
  const mappingRequired = Boolean(vpnPlan && !identities.system) || tickets.some(row => !row.requester_id || (row.team_name && !row.assigned_team_id) || (['in_progress', 'waiting_user', 'resolved', 'closed'].includes(row.status) && !row.assigned_to));
  const roster = identities.teams.flatMap(team => team.members.map((sub, index) => ({
    team_id: team.id, team_name: team.name, user_id: sub,
    display_name: `[SYNTHETIC] Kỹ thuật viên thử nghiệm ${index + 1}`, active: true,
  })));
  const history = vpnPlan ? scenarioHistory(tickets, identities.system, stableId, referenceMs) : null;
  const manifest = {
    schema_version: schemaVersion, synthetic: true, seed, namespace, reference_time: referenceTime, timezone: 'UTC',
    parameters, assumptions: 'Dữ liệu demo doanh nghiệp, sử dụng tham số giả định của đội.',
    ticket_count: count, role_counts: Object.fromEntries(ROLES.map(role => [role, identities.users.filter(user => user.roles.includes(role)).length])),
    status_counts: counts('status'), category_counts: counts('category_code'),
    roster_count: roster.length, identity_mapping_sha256: identityHash, dataset_sha256: digest(JSON.stringify(history ? { tickets, profiles, ...history } : tickets)),
    mapping_required: mappingRequired, evidence_scope: 'Synthetic snapshots only; not operational KPI, lifecycle audit, antivirus or M3 E2E evidence.',
    ...(history && { scenario_summary: scenarioSummary(tickets, history.events), event_count: history.events.length,
      self_service_count: history.self_service.length, device_request_count: history.device_requests.length,
      evidence_scope: 'Synthetic lifecycle fixtures only; not real operational data or E2E evidence.' }),
  };
  return { manifest, tickets, roster, profiles, ...history };
}

export function assertDemoTarget(databaseUrl, { apply = false, confirmDemo = false } = {}) {
  if (apply !== true || confirmDemo !== true) throw new Error('Ghi DB cần cả --apply và --confirm-demo.');
  let target;
  try { target = new URL(databaseUrl); } catch { throw new Error('Cần DATABASE_URL PostgreSQL cho DB demo cô lập.'); }
  const database = decodeURIComponent(target.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !/^dxdesk_(?:demo|test)[a-z0-9_]*$/.test(database)) throw new Error('Chỉ cho phép database dxdesk_demo* hoặc dxdesk_test*, không production.');
  if (['api_login', 'authenticator', 'authenticated', 'anon'].includes(decodeURIComponent(target.username))) throw new Error('Nạp snapshot cần migration owner trên DB demo, không application login.');
  return database;
}

export async function applyDataset(dataset, databaseUrl, options = {}) {
  const expectedDatabase = assertDemoTarget(databaseUrl, options);
  if (dataset.manifest.mapping_required) throw new Error('Identity/team mapping chưa đủ; chỉ được dry-run.');
  const require = createRequire(resolve(root, 'apps/api/package.json'));
  const { Client } = require('pg');
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
  let started = false;
  try {
    await client.connect();
    await client.query('BEGIN'); started = true;
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const { rows: [context] } = await client.query("SELECT current_database() AS database, current_user AS username, pg_has_role(current_user, c.relowner, 'USAGE') AS owns_tickets FROM pg_class c WHERE c.oid = 'public.tickets'::regclass");
    if (context?.database !== expectedDatabase || !context.owns_tickets || ['api_login', 'authenticator', 'authenticated', 'anon'].includes(context.username)) throw new Error('Kết nối thực tế phải là migration owner trong đúng DB demo đã xác nhận.');
    const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tickets'");
    const hasTeamColumn = columns.rows.some(row => row.column_name === 'assigned_team_id');
    if (!hasTeamColumn) throw new Error('Cần migration W4 assigned_team_id trước khi nạp snapshot có team.');
    for (const member of dataset.roster) {
      const team = await client.query('SELECT id FROM public.teams WHERE id=$1 AND name=$2 AND active', [member.team_id, member.team_name]);
      if (!team.rowCount) throw new Error('Mapping team không khớp DB demo đang hoạt động.');
      await client.query(`INSERT INTO private.team_members(team_id,user_id,display_name,active)
        VALUES($1,$2,$3,true) ON CONFLICT(team_id,user_id) DO NOTHING`, [member.team_id, member.user_id, member.display_name]);
    }
    const assignments = new Map(dataset.tickets.filter(row => row.assigned_to)
      .map(row => [`${row.assigned_team_id}:${row.assigned_to}`, [row.assigned_team_id, row.assigned_to]]));
    for (const assignment of assignments.values()) {
      const member = await client.query('SELECT 1 FROM private.team_members WHERE team_id=$1 AND user_id=$2 AND active', assignment);
      if (!member.rowCount) throw new Error('Assignee phải thuộc roster active của team demo.');
    }
    if (dataset.events) {
      const result = await importDemoHistory(client, dataset);
      await client.query('COMMIT'); started = false;
      return { ...result, already_present: dataset.tickets.length - result.inserted, database: expectedDatabase };
    }
    const categories = await client.query('SELECT id,code FROM public.categories WHERE active');
    const ids = new Map(categories.rows.map(row => [row.code, row.id]));
    let inserted = 0;
    // Historical snapshots intentionally use the migration owner in this isolated DB.
    // Database INSERT triggers still run; we neither backdate/generated audit nor seed clean files.
    for (const ticket of dataset.tickets) {
      const categoryId = ids.get(ticket.category_code);
      if (!categoryId) throw new Error(`Thiếu danh mục active ${ticket.category_code}.`);
      const result = await client.query(`INSERT INTO public.tickets
        (id,requester_id,category_id,title,description,priority,status,assigned_to,assigned_team_id,
         created_at,updated_at,request_fields,waiting_since,sla_paused_ms,resolution_note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING RETURNING id`,
      [ticket.id, ticket.requester_id, categoryId, ticket.title, ticket.description, ticket.priority, ticket.status,
        ticket.assigned_to, ticket.assigned_team_id, ticket.created_at, ticket.updated_at, JSON.stringify(ticket.request_fields),
        ticket.waiting_since, ticket.sla_paused_ms, ticket.resolution_note]);
      inserted += result.rowCount;
    }
    await client.query('COMMIT'); started = false;
    return { inserted, already_present: dataset.tickets.length - inserted, database: expectedDatabase };
  } catch (error) {
    if (started) await client.query('ROLLBACK').catch(() => {});
    // Never print a connection string, password, SQL text or a PostgreSQL detail field.
    throw new Error(`Không nạp dữ liệu giả lập; transaction đã rollback nếu đang mở (${error.code ?? 'validation'}).`);
  } finally { await client.end().catch(() => {}); }
}

export async function seedMain(args = process.argv.slice(2), env = process.env, getIdentities) {
  const options = Object.fromEntries(args.map(arg => {
    if (!arg.startsWith('--')) throw new Error('Dùng --seed=... --now=... --count=500 --identities=<file> [--apply --confirm-demo].');
    const at = arg.indexOf('='); return at === -1 ? [arg.slice(2), true] : [arg.slice(2, at), arg.slice(at + 1)];
  }));
  const allowed = ['seed', 'now', 'count', 'weeks', 'users', 'weights', 'scenario', 'identities', 'offline', 'output', 'apply', 'confirm-demo', 'help'];
  if (Object.keys(options).some(key => !allowed.includes(key))) throw new Error('Tham số không được hỗ trợ.');
  if (options.help) { console.log('node scripts/dxdesk.mjs seed [--seed=...] [--now=<UTC ISO-8601>] [--weeks=6] [--users=100] [--weights=vpn:25,account:35] [--scenario=baseline|vpn-4.2] [--count=900] [--offline|--identities=<map.json>] [--apply --confirm-demo]\nMặc định dry-run; DATABASE_URL chỉ dùng khi --apply.'); return; }
  for (const key of ['apply', 'confirm-demo', 'offline']) {
    if (options[key] !== undefined && options[key] !== true) throw new Error(`--${key} là cờ, không nhận giá trị.`);
  }
  if (options.offline && options.identities) throw new Error('Chọn --offline hoặc --identities.');
  if (options.apply) assertDemoTarget(env.DATABASE_URL, { apply: true, confirmDemo: options['confirm-demo'] });
  const weights = Object.fromEntries(String(options.weights ?? '').split(',').filter(Boolean).map(entry => {
    const [key, value, extra] = entry.split(':');
    if (extra !== undefined || !value?.trim()) throw new Error('Dùng --weights=vpn:25,account:35.');
    return [key, Number(value)];
  }));
  const weeks = Number(options.weeks ?? 6);
  const count = Number(options.count ?? (getIdentities || options.weeks !== undefined ? Math.max(500, weeks * 150) : 500));
  const identityMap = options.identities ? JSON.parse(await readFile(resolve(String(options.identities)), 'utf8'))
    : options.offline || !getIdentities ? {} : await getIdentities();
  const dataset = generate(options.seed ?? 'dxdesk-w4', options.now ?? '2026-11-02T00:00:00.000Z', identityMap, count,
    { weeks, users: Number(options.users ?? 100), scenario: options.scenario ?? 'baseline', weights });
  let application = { mode: 'dry-run', applied: false };
  if (options.apply) application = { mode: 'apply', applied: true, ...await applyDataset(dataset, env.DATABASE_URL, { apply: true, confirmDemo: options['confirm-demo'] === true }) };
  const directory = resolve(options.output ?? resolve(root, '.local/reports'));
  await mkdir(directory, { recursive: true });
  const stem = `synthetic-${dataset.manifest.namespace}`;
  await writeFile(resolve(directory, `${stem}.json`), JSON.stringify(dataset, null, 2) + '\n');
  await writeFile(resolve(directory, `${stem}.manifest.json`), JSON.stringify({ ...dataset.manifest, application }, null, 2) + '\n');
  console.log(JSON.stringify({ ...application, manifest: resolve(directory, `${stem}.manifest.json`), ticket_count: dataset.manifest.ticket_count,
    dataset_sha256: dataset.manifest.dataset_sha256, mapping_required: dataset.manifest.mapping_required,
    scenario_summary: dataset.manifest.scenario_summary }));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  seedMain().catch(error => { console.error(error.message); process.exitCode = 1; });
}
