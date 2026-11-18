// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkflowDirectory, validateWorkflowDocuments } from '../infra/n8n/validate-workflows.mjs';

const workflow = id => ({ id, name: 'Workflow thử', nodes: [], connections: {} });

test('enterprise workflows retain the four stable deployment identities', async () => {
  const documents = await validateWorkflowDirectory(fileURLToPath(new URL('../config/doanh-nghiep/workflows/', import.meta.url)));
  assert.equal(documents.length, 4);
  assert.ok(documents.some(({ workflow }) => workflow.id === 'dxdeskHello001'));
  assert.equal(new Set(documents.map(({ workflow }) => workflow.id)).size, 4);
});

test('invalid and duplicate IDs fail before any workflow is published', () => {
  assert.throws(() => validateWorkflowDocuments([]), /không có tệp/);
  assert.throws(() => validateWorkflowDocuments([{ name: 'a.json', workflow: workflow('a;command') }]), /không hợp lệ/);
  assert.throws(() => validateWorkflowDocuments([
    { name: 'a.json', workflow: workflow('same') }, { name: 'b.json', workflow: workflow('same') },
  ]), /trùng ID/);
  assert.throws(() => validateWorkflowDocuments([{ name: 'a.json', workflow: { ...workflow('valid'), nodes: null } }]), /không hợp lệ/);
});

test('directory validation handles spaces and fails on empty, malformed and missing inputs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dxdesk workflow '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(validateWorkflowDirectory(directory), /không có tệp/);
  await writeFile(join(directory, 'a.json'), '{');
  await assert.rejects(validateWorkflowDirectory(directory), /a.json/);
  await writeFile(join(directory, 'a.json'), JSON.stringify(workflow('valid')));
  assert.equal((await validateWorkflowDirectory(directory))[0].workflow.id, 'valid');
  await assert.rejects(validateWorkflowDirectory(join(directory, 'missing')), { code: 'ENOENT' });
});

test('Compose uses the same enterprise directory for import and publish without exposing enterprise files', async () => {
  const compose = await readFile(new URL('../infra/compose/docker-compose.yml', import.meta.url), 'utf8');
  assert.equal((compose.match(/\.\.\/\.\.\/config\/doanh-nghiep\/workflows:\/import\/workflows:ro/g) ?? []).length, 2);
  assert.ok(compose.includes('../../config/doanh-nghiep:/etc/dxdesk/enterprise:ro'));
  assert.ok(!compose.includes('doanh-nghiep:/usr/share/nginx/html'));
  const nginx = await readFile(new URL('../apps/web/nginx.conf', import.meta.url), 'utf8');
  assert.ok(nginx.includes('alias /etc/dxdesk/enterprise/modules.json;'));
});

test('reload preflight happens before stopping n8n', async () => {
  const source = await readFile(new URL('../scripts/dxdesk.mjs', import.meta.url), 'utf8');
  const reload = source.slice(source.indexOf("} else if (action === 'n8n-reload')"));
  assert.ok(reload.indexOf('await validateWorkflowDirectory(') >= 0);
  assert.ok(reload.indexOf('await validateWorkflowDirectory(') < reload.indexOf("compose('stop', 'n8n')"));
});
