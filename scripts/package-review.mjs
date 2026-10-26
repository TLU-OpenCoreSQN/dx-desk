// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Local review snapshot only. Does not commit, tag, push or publish a release.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, copyFile, stat, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releases = resolve(root, '.local/releases');
await mkdir(releases, { recursive: true });
const directory = await mkdtemp(resolve(releases, 'review-'));
const name = 'dx-desk-week2-review';
const stage = resolve(directory, name);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const files = new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean));
async function copy(source, target) {
  await mkdir(dirname(target), { recursive: true }); await copyFile(source, target);
}
for (const file of files) {
  const source = resolve(root, file), target = resolve(stage, file);
  if (!source.startsWith(root + sep) || !target.startsWith(stage + sep)) throw new Error('Invalid source path');
  try { if (!(await stat(source)).isFile()) continue; } catch { continue; }
  await copy(source, target);
}
const evidence = ['web-tests.json', 'integration.json', 'integration.tap', 'browser.json', 'migrations.json', 'native-sso.json'];
const reportDir = resolve(root, '.local/reports');
for (const file of await readdir(reportDir)) {
  if (!evidence.includes(file) && !/^(web-|native-sso-)[a-z-]+\.png$/.test(file)) continue;
  await copy(resolve(reportDir, file), resolve(stage, 'review-evidence', file));
}
await writeFile(resolve(stage, 'REVIEW-SNAPSHOT.md'), `# Local review snapshot\n\nCreated: ${new Date().toISOString()}\nBase commit: ${git('rev-parse', 'HEAD')}\nBranch: ${git('branch', '--show-current')}\n\nContains uncommitted week-2 source and selected test evidence. This is NOT a tagged release.\nScreenshots named web-* use explicit UI fixtures. Screenshots named native-sso-* use real Keycloak and an isolated test database, with Vite proxying directly to NestJS (no APISIX).\nDocker stack, TN-05 and GitHub release acceptance remain pending. Native test results are recorded separately.\nSee docs/ke-hoach-tuan-2.md and docs/bao-cao-kiem-thu-tuan-2.md.\n`);
const archive = resolve(directory, name + '.tar.gz');
execFileSync('tar', ['-czf', archive, '-C', directory, name], { windowsHide: true });
const digest = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(archive + '.sha256', `${digest}  ${name}.tar.gz\n`);
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', windowsHide: true });
if (entries.split(/\r?\n/).some(file => /(^|\/)(node_modules|\.git|\.env|work)($|\/)/.test(file))) throw new Error('Unexpected private/generated path in archive');
console.log(`Local review archive: ${archive}\nSHA-256: ${digest}`);
