// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// TN-05, round 1. Never substitutes estimated/fake data when Docker/Ollama are absent.
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { cpus, totalmem, platform, arch } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = ['compose', '--env-file', resolve(root, '.env'), '-f', resolve(root, 'infra/compose/docker-compose.yml')];
const required = ['postgres', 'postgrest', 'keycloak', 'apisix', 'seaweedfs', 'clamav', 'n8n'];
const modelArg = process.argv.find(arg => arg.startsWith('--models='));
const models = (modelArg?.split('=')[1] ?? 'qwen2.5:1.5b,qwen2.5:3b,qwen3:4b').split(',');
const ollama = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const prompt = 'Nhân viên không kết nối được VPN của công ty. Nêu ba bước kiểm tra cơ bản, trả lời ngắn gọn bằng tiếng Việt.';
const report = {
  measured_at: new Date().toISOString(),
  machine: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logical_cpus: cpus().length, total_ram_bytes: totalmem() },
  prompt, options: { temperature: 0, num_predict: 128, num_ctx: 2048, seed: 42 },
  baseline: [], measurements: [], completed: false,
};
function docker(...args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr.trim());
  return result.stdout.trim();
}
function stats() {
  const ids = docker(...base, 'ps', '-q', ...required).split(/\r?\n/).filter(Boolean);
  if (ids.length !== required.length) throw new Error('Cần đủ 7 dịch vụ Tầng 1 đang chạy trước khi đo.');
  const inspect = JSON.parse(docker('inspect', ...ids));
  if (inspect.some(item => item.State.Health?.Status !== 'healthy')) throw new Error('Tầng 1 chưa healthy.');
  return docker('stats', '--no-stream', '--format', '{{json .}}', ...ids).split(/\r?\n/).map(line => JSON.parse(line));
}
function ollamaStats() {
  const id = docker(...base, '--profile', 'benchmark', 'ps', '-q', 'ollama');
  if (!id) throw new Error('Cần container Ollama của profile benchmark để đo RAM cùng Tầng 1.');
  return JSON.parse(docker('stats', '--no-stream', '--format', '{{json .}}', id));
}
async function json(path, body) {
  const response = await fetch(ollama + path, {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(600000),
  });
  if (!response.ok) throw new Error(`Ollama ${path}: HTTP ${response.status}`);
  return response.json();
}
try {
  const env = parseEnv(await readFile(resolve(root, '.env'), 'utf8'));
  report.image_versions = Object.fromEntries(Object.entries(env).filter(([key]) => key.endsWith('_VERSION')));
  report.docker_memory_bytes = Number(docker('info', '--format', '{{.MemTotal}}'));
  // Unload any model left by previous experiments so the idle baseline is comparable.
  const previouslyLoaded = await json('/api/ps');
  for (const model of previouslyLoaded.models ?? []) await json('/api/generate', { model: model.name, keep_alive: 0 });
  report.baseline = stats();
  report.ollama_idle = ollamaStats();
  report.docker_version = docker('version', '--format', '{{.Server.Version}}');
  report.ollama_version = await json('/api/version');
  const installed = await json('/api/tags');
  for (const model of models) {
    const metadata = installed.models.find(item => item.name === model);
    if (!metadata) throw new Error(`Model ${model} chưa cài. Chạy docker compose ... exec ollama ollama pull ${model} rồi đo lại.`);
    await json('/api/generate', { model, prompt, stream: false, options: report.options, keep_alive: '5m' });
    for (let run = 1; run <= 3; run++) {
      const output = await json('/api/generate', { model, prompt, stream: false, options: report.options, keep_alive: '5m' });
      if (!(output.eval_count > 0 && output.eval_duration > 0)) throw new Error(`Model ${model} không trả token timing hợp lệ.`);
      report.measurements.push({
        model, digest: metadata.digest, parameter_size: metadata.details?.parameter_size,
        quantization_level: metadata.details?.quantization_level, run,
        tokens: output.eval_count, eval_duration_ns: output.eval_duration,
        tokens_per_second: output.eval_count / output.eval_duration * 1e9,
        total_duration_ns: output.total_duration, load_duration_ns: output.load_duration,
        tier1_after_generation: stats(), ollama_container_after_generation: ollamaStats(),
        loaded_models: await json('/api/ps'),
      });
    }
    await json('/api/generate', { model, keep_alive: 0 });
  }
  report.completed = true;
} catch (error) { report.error = error.message; console.error(error.message); process.exitCode = 1; }
finally {
  const directory = resolve(root, '.local/reports');
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  await writeFile(resolve(directory, `tn05-${stamp}.json`), JSON.stringify(report, null, 2) + '\n');
  const rows = ['model,run,tokens,tokens_per_second,total_duration_ns',
    ...report.measurements.map(m => [m.model, m.run, m.tokens, m.tokens_per_second, m.total_duration_ns].join(','))];
  await writeFile(resolve(directory, `tn05-${stamp}.csv`), rows.join('\n') + '\n');
  console.log(`Saved measured data to ${directory}; completed=${report.completed}`);
}
