// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Snapshot only repository source (tracked + non-ignored new files), never dependencies/secrets.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, copyFile, stat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
await mkdir(resolve(root, '.local'), { recursive: true });
const destination = await mkdtemp(resolve(root, '.local/source-check-'));
const files = new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: root, encoding: 'utf8', windowsHide: true,
}).split('\0').filter(Boolean));
for (const file of files) {
  const source = resolve(root, file), target = resolve(destination, file);
  if (!source.startsWith(root + sep) || !target.startsWith(destination + sep)) throw new Error('Invalid source path');
  try { if (!(await stat(source)).isFile()) continue; } catch { continue; }
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
console.log(destination);
