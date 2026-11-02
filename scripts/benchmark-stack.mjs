// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Samples existing containers/host only. Never starts services, downloads models or approves a demo machine.
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, freemem, homedir, platform, release, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(done => setTimeout(done, ms));

export function parseMemoryBytes(value) {
  const match = /^\s*([0-9]+(?:\.[0-9]+)?)\s*(B|KiB|MiB|GiB|TiB|kB|KB|MB|GB|TB)\s*$/.exec(value);
  if (!match) throw new Error('Docker memory value không hợp lệ.');
  const factors = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4, kB: 1000, KB: 1000, MB: 1e6, GB: 1e9, TB: 1e12 };
  return Math.round(Number(match[1]) * factors[match[2]]);
}

function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Docker command không sẵn sàng (${result.error?.code ?? result.status ?? 'unknown'}).`);
  return result.stdout.trim();
}

export function validateMeasurementOptions({ profile = 'full', project = 'dx-desk', duration = 30, interval = 1000 } = {}) {
  if (!['full', 'demo-light'].includes(profile)) throw new Error('--profile phải là full hoặc demo-light (metadata).');
  if (typeof project !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(project)) throw new Error('--project không hợp lệ.');
  if (!Number.isFinite(duration) || duration < 1 || duration > 3600) throw new Error('--duration cần 1..3600 giây.');
  if (!Number.isInteger(interval) || interval < 250 || interval > 60000) throw new Error('--interval cần 250..60000 milliseconds.');
  if (Math.ceil(duration * 1000 / interval) > 14400) throw new Error('Tối đa 14400 mẫu mỗi lượt.');
  return { profile, project, duration, interval };
}

async function wslMemorySetting() {
  if (platform() !== 'win32') return { configured_memory: null, source: null, note: 'Current OS memory is measured; Windows host/WSL overhead is not inferred.' };
  try {
    const text = await readFile(resolve(homedir(), '.wslconfig'), 'utf8');
    const section = text.match(/^\s*\[wsl2\]\s*$([\s\S]*?)(?=^\s*\[|$(?![\s\S]))/im)?.[1] ?? '';
    const memory = section.match(/^\s*memory\s*=\s*([^;#\r\n]+)/im)?.[1]?.trim() ?? null;
    return { configured_memory: memory, source: '.wslconfig [wsl2] memory', note: 'Configured cap is metadata, not measured WSL usage or proof it was applied.' };
  } catch { return { configured_memory: null, source: null, note: '.wslconfig unavailable; Docker engine memory is reported separately.' }; }
}

function sampleProject(project) {
  const timestamp = new Date().toISOString();
  const sampleStarted = performance.now();
  const hostTotal = totalmem();
  const hostFree = freemem();
  const ids = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}']).split(/\r?\n/).filter(Boolean);
  if (!ids.length) throw new Error('Không có container thuộc compose project đã chọn; không thay bằng số đo rỗng.');
  const inspected = JSON.parse(docker(['inspect', ...ids]));
  const running = inspected.filter(item => item.State.Running);
  if (!running.length) throw new Error('Project không có container đang chạy.');
  const stats = docker(['stats', '--no-stream', '--no-trunc', '--format', '{{json .}}', ...running.map(item => item.Id)])
    .split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const measurements = new Map(stats.map(item => [item.ID, item]));
  const containers = inspected.map(item => {
    const stat = measurements.get(item.Id);
    if (item.State.Running && !stat) throw new Error('Container đổi trạng thái giữa inspect và stats; mẫu chưa đầy đủ.');
    const [used, limit] = stat ? stat.MemUsage.split('/') : [];
    return {
      id: item.Id, name: item.Name.replace(/^\//, ''), service: item.Config.Labels['com.docker.compose.service'],
      project: item.Config.Labels['com.docker.compose.project'], image: item.Config.Image,
      running: item.State.Running, health: item.State.Health?.Status ?? null, status: item.State.Status,
      memory_used_bytes: stat ? parseMemoryBytes(used) : null,
      memory_limit_bytes: stat ? parseMemoryBytes(limit) : null,
      configured_memory_limit_bytes: item.HostConfig.Memory || null,
      cpu_percent: stat ? Number.parseFloat(stat.CPUPerc.replace('%', '')) : null,
    };
  });
  return {
    timestamp, collected_at: new Date().toISOString(), collection_duration_ms: Math.round(performance.now() - sampleStarted),
    host: { total_bytes: hostTotal, available_bytes: hostFree, used_bytes: hostTotal - hostFree },
    container_total_bytes: containers.reduce((sum, item) => sum + (item.memory_used_bytes ?? 0), 0), containers,
  };
}

function csvValue(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

export async function measure(options = {}) {
  const settings = validateMeasurementOptions(options);
  const started = performance.now();
  const report = {
    schema_version: 1, started_at: new Date().toISOString(), completed: false, ...settings,
    profile_scope: 'Metadata for the services already running; this command does not create or validate a Compose profile.',
    target_machine_approved: false,
    machine: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model ?? null, logical_cpus: cpus().length, physical_ram_bytes: totalmem(), memory_scope: 'Current host OS; never add host and container totals.' },
    source_sha: null, wsl: await wslMemorySetting(), docker: {}, samples: [],
    limits: ['Sampled maxima may miss transient peaks between samples.', 'Docker/WSL memory caps are not usage or approval of the 16 GB target.', 'This measurement does not establish C23-06/W4-09B acceptance without reviewer, scenario and machine evidence.'],
  };
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 5000 });
  if (git.status === 0 && /^[a-f0-9]{40}\s*$/.test(git.stdout)) report.source_sha = git.stdout.trim();
  try {
    const info = JSON.parse(docker(['info', '--format', '{{json .}}']));
    report.docker = { server_version: info.ServerVersion, engine_memory_bytes: info.MemTotal, operating_system: info.OperatingSystem, architecture: info.Architecture };
    const deadline = started + settings.duration * 1000;
    do {
      report.samples.push(sampleProject(settings.project));
      const next = Math.min(deadline, started + report.samples.length * settings.interval);
      if (performance.now() < next) await delay(next - performance.now());
    } while (performance.now() < deadline);
    report.completed = true;
  } catch (error) { report.error = error.message; }
  report.finished_at = new Date().toISOString();
  report.actual_duration_ms = Math.round(performance.now() - started);
  report.sample_count = report.samples.length;
  report.sampled_peak = {
    host_used_bytes: report.samples.length ? Math.max(...report.samples.map(item => item.host.used_bytes)) : null,
    container_total_bytes: report.samples.length ? Math.max(...report.samples.map(item => item.container_total_bytes)) : null,
    by_service_bytes: Object.fromEntries([...new Set(report.samples.flatMap(sample => sample.containers.map(item => item.service)))].sort().map(service => [service,
      Math.max(...report.samples.map(sample => sample.containers.filter(item => item.service === service).reduce((sum, item) => sum + (item.memory_used_bytes ?? 0), 0)))])),
  };
  const directory = resolve(options.output ?? resolve(root, '.local/reports'));
  await mkdir(directory, { recursive: true });
  const stem = `stack-memory-${settings.profile}-${report.started_at.replaceAll(':', '-')}`;
  const jsonPath = resolve(directory, `${stem}.json`);
  const csvPath = resolve(directory, `${stem}.csv`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + '\n');
  const rows = [['timestamp', 'service', 'container_id', 'running', 'memory_used_bytes', 'memory_limit_bytes', 'cpu_percent', 'host_used_bytes', 'host_available_bytes', 'host_total_bytes', 'container_total_bytes']];
  for (const sample of report.samples) for (const container of sample.containers) rows.push([
    sample.timestamp, container.service, container.id, container.running, container.memory_used_bytes,
    container.memory_limit_bytes, container.cpu_percent, sample.host.used_bytes, sample.host.available_bytes,
    sample.host.total_bytes, sample.container_total_bytes,
  ]);
  await writeFile(csvPath, rows.map(row => row.map(csvValue).join(',')).join('\n') + '\n');
  return { report, jsonPath, csvPath };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match || !['profile', 'project', 'duration', 'interval', 'output'].includes(match[1])) throw new Error('Dùng --profile=full|demo-light --project=dx-desk --duration=30 --interval=1000 [--output=<dir>].');
    return [match[1], match[2]];
  }));
  const result = await measure({ ...args, ...(args.duration === undefined ? {} : { duration: Number(args.duration) }), ...(args.interval === undefined ? {} : { interval: Number(args.interval) }) });
  console.log(JSON.stringify({ completed: result.report.completed, sample_count: result.report.sample_count, json: result.jsonPath, csv: result.csvPath, target_machine_approved: false }));
  if (!result.report.completed) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
