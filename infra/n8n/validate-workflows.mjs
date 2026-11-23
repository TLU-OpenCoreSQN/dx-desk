// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateWorkflowDocuments(documents) {
  if (!documents.length) throw new Error('Thư mục workflow không có tệp JSON.');
  const ids = new Set();
  for (const { name, workflow } of documents) {
    if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)
      || typeof workflow.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(workflow.id)
      || typeof workflow.name !== 'string' || !workflow.name.trim()
      || !Array.isArray(workflow.nodes) || !workflow.connections || typeof workflow.connections !== 'object'
      || Array.isArray(workflow.connections)) {
      throw new Error(`Workflow không hợp lệ: ${name}.`);
    }
    if (ids.has(workflow.id)) throw new Error(`Workflow trùng ID: ${workflow.id}.`);
    ids.add(workflow.id);
  }
  return documents;
}

export async function validateWorkflowDirectory(directory) {
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => entry.name).sort();
  const documents = [];
  for (const name of names) {
    let workflow;
    try { workflow = JSON.parse(await readFile(resolve(directory, name), 'utf8')); }
    catch { throw new Error(`Không đọc được JSON workflow: ${name}.`); }
    documents.push({ name, workflow });
  }
  return validateWorkflowDocuments(documents);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const directory = resolve(process.argv[2] ?? 'config/doanh-nghiep/workflows');
    const workflows = await validateWorkflowDirectory(directory);
    console.log(`PASS ${workflows.length} workflow JSON, ID duy nhất và cấu trúc hợp lệ.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
