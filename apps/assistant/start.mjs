// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { assistantDependencies, assistantServer } from './server.mjs';

assistantServer(assistantDependencies()).listen(3000, '0.0.0.0');
