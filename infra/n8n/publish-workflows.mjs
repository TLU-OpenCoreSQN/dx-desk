// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// n8n 2.44 removed publish:workflow --all. Publish every imported explicit ID.
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const file of (await readdir('/import/workflows')).filter(file=>file.endsWith('.json')).sort()) {
  const workflow=JSON.parse(await readFile('/import/workflows/'+file,'utf8'));
  if(workflow.id!=='dxdeskHello001' && process.env.DXDESK_AUTOMATION_ENABLED!=='true')continue;
  if(typeof workflow.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(workflow.id))throw new Error('Workflow requires a stable safe ID.');
  const result=spawnSync('n8n',['publish:workflow','--id='+workflow.id],{stdio:'inherit'});
  if(result.status!==0)throw new Error('Workflow publication failed: '+workflow.id);
}
