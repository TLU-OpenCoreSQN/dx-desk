// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import { validateWorkflowDirectory } from './validate-workflows.mjs';

const workflows = await validateWorkflowDirectory('/import/workflows');
for (const { workflow } of workflows) {
  if (workflow.id !== 'dxdeskHello001' && process.env.DXDESK_AUTOMATION_ENABLED !== 'true') continue;
  const result = spawnSync('n8n', ['publish:workflow', '--id=' + workflow.id], { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Workflow publication failed: ' + workflow.id);
}
