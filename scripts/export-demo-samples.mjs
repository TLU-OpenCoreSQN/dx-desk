// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generate } from './seed-synthetic.mjs';

const reference = '2026-11-02T00:00:00Z';
const dataset = generate('dxdesk-public-sample', reference, {}, 900, { scenario: 'vpn-4.2' });
const tickets = ['before', 'after'].flatMap(phase => dataset.tickets.filter(ticket => ticket.scenario_phase === phase).slice(0, 2));
const ids = new Map(tickets.map((ticket, index) => [ticket.id, `sample-${index + 1}`]));
const samples = {
  tickets: tickets.map(ticket => ({
    id: ids.get(ticket.id), category: ticket.category_code, status: ticket.status, created_at: ticket.created_at,
    phase: ticket.scenario_phase, client_version: ticket.request_fields.client_version,
  })),
  'ticket-events': dataset.events.filter(event => ids.has(event.ticket_id)).map(event => ({
    ticket_id: ids.get(event.ticket_id), type: event.event_type, actor_type: event.actor_type, created_at: event.created_at,
    ...(event.payload.to && { from: event.payload.from, to: event.payload.to }),
  })),
  'sla-policies': [['low', 480, 2880], ['normal', 240, 1440], ['high', 60, 480], ['critical', 15, 120]]
    .map(([priority, response_minutes, resolution_minutes]) => ({ priority, response_minutes, resolution_minutes })),
};
const directory = new URL('../apps/web/public/data/synthetic/', import.meta.url);
const check = process.argv.includes('--check');
if (!check) await mkdir(fileURLToPath(directory), { recursive: true });
for (const [name, rows] of Object.entries(samples)) {
  const file = new URL(name + '.json', directory);
  const content = JSON.stringify({
    synthetic: true, sample: true, license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    reference_time: reference, data: rows,
  }, null, 2) + '\n';
  if (check) {
    if ((await readFile(file, 'utf8')).replaceAll('\r\n', '\n') !== content) throw new Error(`Mẫu công khai không tái lập: ${name}`);
  } else await writeFile(file, content);
}
