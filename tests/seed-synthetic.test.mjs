// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, assertDemoTarget } from '../scripts/seed-synthetic.mjs';
import { parseMemoryBytes, validateMeasurementOptions } from '../scripts/benchmark-stack.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const now = '2026-11-02T00:00:00.000Z';
// These UUIDs are test fixtures, never exported as real Keycloak identities by the CLI.
const employee = '00000000-0000-4000-8000-000000000001';
const agent = '00000000-0000-4000-8000-000000000002';
const manager = '00000000-0000-4000-8000-000000000003';
const identityMap = {
  users: [{ sub: employee, roles: ['Employee'] }, { sub: agent, roles: ['Agent'] }, { sub: manager, roles: ['Manager'] }],
  teams: ['Network Team', 'Identity Team', 'IT Support'].map((name, index) => ({
    id: `10000000-0000-4000-8000-00000000000${index + 1}`, name, members: [agent],
  })),
};

test('fixed seed/time/identity mapping yields identical 500-row dataset and hash', () => {
  const first = generate('w4', now, identityMap, 500);
  assert.deepEqual(first, generate('w4', now, structuredClone(identityMap), 500));
  assert.equal(first.tickets.length, 500);
  assert.equal(new Set(first.tickets.map(row => row.id)).size, 500);
  assert.equal(first.manifest.mapping_required, false);
  assert.deepEqual(first.manifest.role_counts, { Employee: 1, Agent: 1, Manager: 1 });
  assert.equal(first.manifest.synthetic, true);
  assert.equal(Object.values(first.manifest.status_counts).reduce((a, b) => a + b, 0), 500);
  assert.equal(Object.keys(first.manifest.status_counts).length, 9);
  assert.match(first.manifest.dataset_sha256, /^[a-f0-9]{64}$/);
});

test('seed, clock and identity map alter dataset; growing count preserves prefix', () => {
  const base = generate('w4', now, identityMap, 500);
  assert.notEqual(base.manifest.dataset_sha256, generate('other', now, identityMap, 500).manifest.dataset_sha256);
  assert.notEqual(base.manifest.dataset_sha256, generate('w4', '2026-11-03T00:00:00Z', identityMap, 500).manifest.dataset_sha256);
  assert.deepEqual(generate('w4', now, identityMap, 700).tickets.slice(0, 500), base.tickets);
  const reversed = { users: [...identityMap.users].reverse(), teams: [...identityMap.teams].reverse() };
  assert.deepEqual(generate('w4', now, reversed, 500), base, 'map ordering is not an identity change');
});

test('all subjects come only from verified map, synthetic text cannot be mistaken for real data', () => {
  const { tickets } = generate('w4', now, identityMap, 500);
  const known = new Set(identityMap.users.map(user => user.sub));
  for (const row of tickets) {
    assert.equal(known.has(row.requester_id), true);
    if (row.assigned_to) assert.equal(row.assigned_to, agent);
    assert.equal(row.title.startsWith('[SYNTHETIC]'), true);
    assert.equal(row.description.startsWith('[SYNTHETIC]'), true);
    assert.ok(Date.parse(row.created_at) < Date.parse(now));
    if (row.priority === 'critical') assert.equal(row.requester_id, manager);
    if (row.status === 'pending_approval') assert.equal(row.category_code, 'access');
    if (row.status === 'waiting_user') assert.equal(row.waiting_since, row.created_at);
    if (['resolved', 'closed'].includes(row.status)) assert.ok(row.resolution_note.length >= 5);
    if (['assigned', 'in_progress', 'waiting_user', 'resolved', 'closed'].includes(row.status)) assert.ok(row.assigned_team_id);
    assert.equal(Object.hasOwn(row, 'scan_status'), false);
    assert.equal(Object.hasOwn(row, 'actor_type'), false);
  }
});

test('unmapped dry-run invents no identities and clearly blocks application', () => {
  const planned = generate('w4', now, {}, 500);
  assert.equal(planned.manifest.mapping_required, true);
  assert.deepEqual(planned.manifest.role_counts, { Employee: 0, Agent: 0, Manager: 0 });
  assert.ok(planned.tickets.every(row => row.requester_id === null && row.assigned_to === null));
});

test('enterprise profiles, weeks and category weights are reproducible', () => {
  const options = { weeks: 8, users: 10, weights: { vpn: 100, account: 0, hardware: 0, software: 0, access: 0, 'system-error': 0 } };
  const dataset = generate('campus', now, identityMap, 500, options);
  assert.deepEqual(dataset, generate('campus', now, identityMap, 500, options));
  assert.equal(dataset.profiles.length, 10);
  assert.ok(dataset.profiles.every(profile => profile.audience === 'Nhân viên'));
  assert.equal(new Set(dataset.profiles.map(profile => profile.unit)).size, 6);
  assert.deepEqual(dataset.manifest.category_counts, { vpn: 500 });
  assert.ok(dataset.tickets.every(row => row.request_fields.client_version === '4.1' && row.description.includes(row.profile_code)));
  assert.ok(dataset.tickets.some(row => Date.parse(row.created_at) < Date.parse(now) - 42 * 86_400_000));
  for (const invalid of [{ weeks: 0 }, { users: 10_001 }, { scenario: 'unknown' }, { weights: { vpn: -1 } }]) {
    assert.throws(() => generate('campus', now, identityMap, 500, invalid));
  }
});

test('VPN rollout has two complete cohorts with the published rates and historical events', () => {
  const verified = { ...identityMap, system: '00000000-0000-4000-8000-000000000004' };
  for (const weeks of [6, 7, 8]) {
    const dataset = generate('vpn-check', now, verified, 900, { weeks, scenario: 'vpn-4.2' });
    assert.equal(dataset.manifest.mapping_required, false);
    assert.deepEqual(dataset.manifest.scenario_summary, {
      before: { tickets: 100, average_hours: 2.4, client_4_2: 0 },
      after: { tickets: 137, average_hours: 4.1, client_4_2: 99 },
      vpn_increase_percent: 37, client_4_2_after_percent: 72,
    });
    const events = dataset.events.filter(event => event.ticket_id === dataset.tickets[0].id);
    assert.deepEqual(events.map(event => event.payload.to ?? event.event_type),
      ['created', 'triaged', 'assigned', 'assignment_changed', 'assignment_changed', 'in_progress', 'resolved']);
    assert.ok(events.slice(1, 4).every(event => event.actor_type === 'system' && event.actor_id === verified.system));
    assert.ok(events.slice(4).every(event => event.actor_type === 'user' && event.actor_id === agent));
    assert.ok(events.every((event, index) => index === 0 || event.created_at > events[index - 1].created_at));
    assert.equal(dataset.self_service.length, 75);
    assert.equal(dataset.device_requests.length, 20);
    assert.deepEqual(dataset, generate('vpn-check', now, verified, 900, { weeks, scenario: 'vpn-4.2' }));
  }
  assert.throws(() => generate('vpn-check', now, verified, 900, { weeks: 5, scenario: 'vpn-4.2' }), /6\.\.8/);
});

test('invalid size, clock, duplicate subjects, roles and foreign roster members are rejected', () => {
  for (const size of [0, 499, 50001, 500.5, NaN]) assert.throws(() => generate('w4', now, identityMap, size));
  assert.throws(() => generate('', now, identityMap));
  assert.throws(() => generate('w4', '2026-11-02', identityMap));
  assert.throws(() => generate('w4', '2026-02-30T00:00:00Z', identityMap));
  assert.throws(() => generate('w4', now, { users: [{ sub: 'invented-user', roles: ['Employee'] }] }));
  assert.throws(() => generate('w4', now, { users: [identityMap.users[0], identityMap.users[0]] }));
  assert.throws(() => generate('w4', now, { users: [{ sub: employee, roles: ['Automation'] }] }));
  assert.throws(() => generate('w4', now, { users: identityMap.users, teams: [{ ...identityMap.teams[0], members: ['ffffffff-ffff-4fff-8fff-ffffffffffff'] }] }));
});

test('database writes require explicit double opt-in and a narrowly named isolated database', () => {
  const safe = 'postgresql://migration_owner:secret@localhost:5432/dxdesk_demo_w4';
  assert.throws(() => assertDemoTarget(safe));
  assert.throws(() => assertDemoTarget(safe, { apply: true }));
  assert.throws(() => assertDemoTarget(safe, { confirmDemo: true }));
  assert.throws(() => assertDemoTarget(safe, { apply: 'false', confirmDemo: 'false' }));
  assert.equal(assertDemoTarget(safe, { apply: true, confirmDemo: true }), 'dxdesk_demo_w4');
  const opts = { apply: true, confirmDemo: true };
  for (const name of ['dxdesk', 'production', 'dxdesk_prod', 'dxdesk_demo/production', 'other_dxdesk_demo']) {
    assert.throws(() => assertDemoTarget(`postgresql://owner@localhost/${encodeURIComponent(name)}`, opts));
  }
  for (const login of ['api_login', 'authenticator', 'authenticated', 'anon']) {
    assert.throws(() => assertDemoTarget(`postgresql://${login}@localhost/dxdesk_test`, opts));
  }
  assert.throws(() => assertDemoTarget('https://localhost/dxdesk_test', opts));
});

test('memory sampler preserves binary/decimal units and rejects invalid or unbounded options', () => {
  assert.equal(parseMemoryBytes('10 MiB'), 10 * 1024 * 1024);
  assert.equal(parseMemoryBytes('1.5GiB'), Math.round(1.5 * 1024 ** 3));
  assert.equal(parseMemoryBytes('20MB'), 20 * 1e6);
  assert.throws(() => parseMemoryBytes('unknown'));
  assert.deepEqual(validateMeasurementOptions(), { profile: 'full', project: 'dx-desk', duration: 30, interval: 1000 });
  for (const invalid of [{ profile: 'production' }, { project: 'other;rm' }, { duration: 0 }, { duration: 3601 }, { interval: 1 }, { interval: NaN }]) {
    assert.throws(() => validateMeasurementOptions(invalid));
  }
});

test('CLI defaults to a reproducible offline dry-run even with an unusable database URL', async () => {
  const output = await mkdtemp(join(tmpdir(), 'dxdesk-synthetic-test-'));
  const result = spawnSync(process.execPath, ['scripts/seed-synthetic.mjs', `--output=${output}`], {
    cwd: root, encoding: 'utf8', windowsHide: true,
    env: { ...process.env, DATABASE_URL: 'postgresql://unreachable.invalid/production' },
  });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.mode, 'dry-run');
  assert.equal(summary.applied, false);
  assert.equal(summary.mapping_required, true);
  const manifest = JSON.parse(await readFile(summary.manifest, 'utf8'));
  assert.equal(manifest.ticket_count, 500);
  assert.equal(manifest.reference_time, now);
  assert.equal(JSON.stringify(manifest).includes('unreachable.invalid'), false);
});
