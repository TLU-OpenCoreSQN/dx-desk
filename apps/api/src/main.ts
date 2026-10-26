// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { createApp } from './app';
async function main() {
  const app = await createApp();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
main().catch(error => {
  console.error('API startup failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
