// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W7-04: run ONLY in a fresh hosted CI VM; never replace a developer .env or volume.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { platform, release, arch } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const profile = process.argv[2];
assert.ok(['full', 'demo-light'].includes(profile), 'Choose full or demo-light');
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Use the fresh hosted CI job, not an existing developer host');
const exec = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const project = 'dxdesk-clean-' + profile;
try { await access(resolve(root, '.env')); throw new Error('Refusing to overwrite existing .env'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.equal(exec('docker', ['ps', '-aq', '--filter', 'label=com.docker.compose.project=' + project]), '', 'Project containers already exist');
assert.equal(exec('docker', ['volume', 'ls', '-q', '--filter', 'label=com.docker.compose.project=' + project]), '', 'Project volumes already exist');
const template = await readFile(resolve(root, '.env.example'), 'utf8');
await writeFile(resolve(root, '.env'), template.replace(/^COMPOSE_PROFILES=.*$/m, 'COMPOSE_PROFILES=' + profile) + '\nCOMPOSE_PROJECT_NAME=' + project + '\n', { flag: 'wx', mode: 0o600 });
const report = { sha: exec('git', ['rev-parse', 'HEAD']), tree: exec('git', ['rev-parse', 'HEAD^{tree}']),
  started_at: new Date().toISOString(), profile, project, fresh_project: true,
  host: { os: platform(), release: release(), arch: arch(), node: process.version,
    runner_image: process.env.ImageOS || null, runner_image_version: process.env.ImageVersion || null,
    docker: exec('docker', ['version', '--format', '{{.Server.Version}}']), compose: exec('docker', ['compose', 'version', '--short']) },
  environment_changes: ['COMPOSE_PROFILES', 'COMPOSE_PROJECT_NAME'],
  provider_chat: 'Not tested without a private AI key; separate local Gemini acceptance is required.', checks: [], passed: false };
const directory = resolve(root, '.local/reports'); await mkdir(directory, { recursive: true });
async function run(id, scriptArgs) {
  const started = Date.now();
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, scriptArgs, { cwd: root, stdio: 'inherit', windowsHide: true });
    child.on('error', reject); child.on('close', done);
  });
  report.checks.push({ id, command: ['node', ...scriptArgs], exit_code: code, duration_ms: Date.now() - started, passed: code === 0 });
  assert.equal(code, 0, id + ' failed');
}
try {
  await run('install', ['scripts/dxdesk.mjs', 'up']);
  await run('verify', ['scripts/dxdesk.mjs', 'verify']);
  const services = exec('docker', ['compose', '--env-file', '.env', '-f', 'infra/compose/docker-compose.yml', 'ps', '--services', '--status', 'running']).split(/\r?\n/);
  assert.ok(services.includes('wikijs'));
  for (const service of ['assistant', 'wiki-index', 'qdrant', 'metabase']) assert.equal(services.includes(service), profile === 'full', service);
  report.checks.push({ id: 'profile-services', passed: true, services }); report.passed = true;
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally {
  report.finished_at = new Date().toISOString();
  await writeFile(resolve(directory, 'clean-install-' + profile + '.json'), JSON.stringify(report, null, 2) + '\n');
}
