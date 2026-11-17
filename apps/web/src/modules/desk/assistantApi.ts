// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { requestResponse } from '../../services/api';

export interface Proposal { id: string; label: string; fields: Record<string, string> }
export interface WikiSource { title: string; url: string }
export type AssistantEvent =
  | { type: 'delta'; text: string }
  | { type: 'step'; label: string }
  | { type: 'sources'; items: WikiSource[] }
  | ({ type: 'proposal' } & Proposal)
  | { type: 'done' }
  | { type: 'error'; message: string };

export async function streamAssistant(question: string, signal: AbortSignal, receive: (event: AssistantEvent) => void) {
  const response = await requestResponse('/assistant/chat', {
    method: 'POST', headers: { Accept: 'application/x-ndjson' }, body: JSON.stringify({ question }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(240000)]),
  });
  if (!response.body || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    throw new Error('Không nhận được phản hồi từ trợ lý.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let completed = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AssistantEvent;
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'done') completed = true;
    receive(event);
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) consume(line);
    }
    consume(pending + decoder.decode());
    if (!completed) throw new Error('Luồng trả lời bị ngắt. Vui lòng thử lại.');
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function decideAssistantProposal(id: string, approve: boolean, signal: AbortSignal) {
  return requestResponse('/assistant/confirm', { method: 'POST', body: JSON.stringify({ id, approve }), signal });
}
