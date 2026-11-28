// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W7-04: sequential acceptance with source/host identity and sanitized evidence.
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { platform, release, arch } from 'node:os';
import { parseEnv } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const allowed = ['verify', 'week4-stack', 'week4-browser', 'week5-wiki', 'week5-metabase', 'stack-browser', 'week5-device', 'csv-import-live', 'assistant-conversations', 'week6-assistant', 'requester-reopen', 'assistant-topics'];
if (args.includes('--help')) {
  console.log('node tools/testing/regression.mjs --allow-demo-writes [--only=verify,week4-stack,...]\n' +
    'Runs sequentially on the configured demo stack. Requires a clean Git checkout. Creates synthetic records; some checks restart n8n or temporarily change SLA policy.\nChecks: ' + allowed.join(', '));
  process.exit(0);
}
if (!args.includes('--allow-demo-writes')) throw new Error('Pass --allow-demo-writes only for a demo stack; read --help first.');
if (args.some(a => a !== '--allow-demo-writes' && !a.startsWith('--only='))) throw new Error('Unknown argument');
const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',') ?? allowed;
if (!only.length || new Set(only).size !== only.length || only.some(id => !allowed.includes(id))) throw new Error('Invalid/duplicate check ID');
const git = (...values) => execFileSync('git', values, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
if (git('status', '--porcelain')) throw new Error('Commit the reviewed source first: acceptance requires a clean checkout.');
const env = parseEnv(await readFile(resolve(root, '.env'), 'utf8'));
const secrets = Object.entries(env).filter(([key, value]) => /PASSWORD|SECRET|TOKEN|API_KEY|ACCESS_KEY|ACTION_KEY/.test(key) && value.length >= 4)
  .map(([, value]) => value).sort((a, b) => b.length - a.length);
const sanitize = text => secrets.reduce((result, value) => result.replaceAll(value, '[REDACTED]'), String(text))
  .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const directory = resolve(root, '.local/reports/regression-' + stamp);
await mkdir(directory, { recursive: true });
const report = { sha: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'),
  started_at: new Date().toISOString(), host: { os: platform(), release: release(), arch: arch(), node: process.version },
  clean_machine: false, clean_machine_note: 'Existing development host; clean VM installation is a separate gate.',
  profile: env.COMPOSE_PROFILES || 'default', project: env.COMPOSE_PROJECT_NAME || 'Compose default', checks: [], passed: false };
try { report.host.docker = execFileSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8', windowsHide: true, timeout: 20000 }).trim(); }
catch { report.host.docker = 'unavailable'; }
await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let exitCode = 0;
for (const id of only) {
  if (git('rev-parse', 'HEAD') !== report.sha || git('status', '--porcelain')) throw new Error('Source changed during acceptance.');
  const scriptArgs = id === 'verify' ? ['scripts/dxdesk.mjs', 'verify'] : ['tools/testing/' + id + '.mjs'];
  const started = Date.now();
  console.log('RUN ' + id);
  const result = await new Promise(done => {
    const child = spawn(process.execPath, scriptArgs, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', timedOut = false, spawnError;
    const capture = chunk => { output += chunk; if (output.length > 16 * 1024 * 1024) output = '[Earlier output truncated]\n' + output.slice(-8 * 1024 * 1024); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    child.on('error', error => { spawnError = error.message; });
    // Each existing acceptance script owns its service-recovery finally blocks.
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 20 * 60 * 1000);
    child.on('close', code => { clearTimeout(timer); done({ code, timedOut, output: sanitize(output), ...(spawnError && { error: sanitize(spawnError) }) }); });
  });
  const passed = result.code === 0 && !result.timedOut && !result.error;
  await writeFile(resolve(directory, id + '.log'), result.output);
  report.checks.push({ id, command: [process.execPath, ...scriptArgs], duration_ms: Date.now() - started,
    exit_code: result.code, passed, timed_out: result.timedOut, log: id + '.log', ...(result.error && { error: result.error }) });
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log((passed ? 'PASS ' : 'FAIL ') + id);
  if (!passed) exitCode = 1;
}
report.finished_at = new Date().toISOString(); report.passed = exitCode === 0;
await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Evidence: ' + directory); process.exitCode = exitCode;
