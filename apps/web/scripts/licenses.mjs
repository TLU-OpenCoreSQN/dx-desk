// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Preserve installed runtime dependency notices alongside the distributed browser bundle.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seen = new Set(), sections = [];
async function locate(name, from) {
  let directory = from;
  for (;;) {
    const path = resolve(directory, 'node_modules', name, 'package.json');
    try { return { path, pkg: JSON.parse(await readFile(path, 'utf8')) }; } catch { /* look at parent node_modules */ }
    if (directory === parse(directory).root) throw new Error(`Missing runtime dependency ${name}`);
    directory = dirname(directory);
  }
}
async function visit(name, from) {
  const { path, pkg } = await locate(name, from);
  if (seen.has(path)) return;
  seen.add(path);
  const directory = dirname(path);
  const files = (await readdir(directory)).filter(file => /^(licen[cs]e|notice|copying)([.-]|$)/i.test(file));
  if (!files.length) throw new Error(`Missing license/notice for ${name}; review before distribution`);
  const notices = [];
  for (const file of files) notices.push(`${file}\n${await readFile(resolve(directory, file), 'utf8')}`);
  sections.push(`${pkg.name} ${pkg.version} (${pkg.license ?? 'see notice'})\n${notices.join('\n\n')}`);
  for (const child of Object.keys(pkg.dependencies ?? {})) await visit(child, directory);
}
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
for (const name of Object.keys(pkg.dependencies)) await visit(name, root);
await writeFile(resolve(root, 'dist/THIRD-PARTY-LICENSES.txt'),
  'DX-Desk browser bundle — third-party runtime licenses and notices\n\n' + sections.join('\n\n' + '='.repeat(72) + '\n\n'));
console.log(`Preserved runtime notices for ${sections.length} packages.`);
