// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { syncKnowledge, wikiKnowledge } from './knowledge.mjs';

const config = wikiKnowledge();
const interval = 60000;
do {
  try {
    console.log('Wiki knowledge index', await syncKnowledge(config));
  } catch (error) {
    console.error('Wiki knowledge synchronization failed:', error.message);
    if (process.argv.includes('--once')) process.exit(1);
  }
  if (process.argv.includes('--once')) break;
  await new Promise(resolve => setTimeout(resolve, interval));
} while (true);
