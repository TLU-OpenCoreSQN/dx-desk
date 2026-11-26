// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { requestResponse } from '../../services/api';

export interface Proposal {
  id: string;
  label: string;
  fields: Record<string, string>;
  expires_at?: string;
  status?: 'pending' | 'applied' | 'cancelled';
  result?: { id: string; ticket_id: string | null };
}
export interface WikiSource {
  title: string;
  url: string;
}
export interface AssistantSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
export interface AssistantTurn {
  id: string;
  ordinal?: string;
  question: string;
  answer: string;
  created_at: string;
  status: 'pending' | 'complete' | 'error' | 'interrupted';
  metadata: { steps: string[]; sources: WikiSource[]; proposal?: Proposal; error?: string };
}
export interface SessionDetail {
  session: AssistantSession;
  turns: AssistantTurn[];
  has_more: boolean;
}
export type AssistantEvent =
  | { type: 'turn'; id: string; session_id: string; title?: string; ordinal?: string }
  | { type: 'delta'; text: string }
  | { type: 'step'; label: string }
  | { type: 'sources'; items: WikiSource[] }
  | ({ type: 'proposal' } & Proposal)
  | { type: 'done' }
  | { type: 'error'; message: string };

export async function streamAssistant(
  question: string,
  signal: AbortSignal,
  receive: (event: AssistantEvent) => void,
  conversation?: { session_id: string; request_id: string },
) {
  const response = await requestResponse('/assistant/chat', {
    method: 'POST',
    headers: { Accept: 'application/x-ndjson' },
    body: JSON.stringify({ question, ...conversation }),
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

export async function decideAssistantProposal(id: string, approve: boolean, signal: AbortSignal) {
  const response = await requestResponse('/assistant/confirm', {
    method: 'POST',
    body: JSON.stringify({ id, approve }),
    signal,
  });
  return (await response.json()) as {
    status: 'applied' | 'cancelled';
    result?: { id: string; ticket_id: string | null };
  };
}

export async function listAssistantSessions(signal?: AbortSignal, offset = 0) {
  return (await requestResponse('/assistant-sessions?offset=' + offset, { signal })).json() as Promise<{
    data: AssistantSession[];
    has_more: boolean;
  }>;
}
export async function createAssistantSession(signal?: AbortSignal) {
  return (
    await requestResponse('/assistant-sessions', { method: 'POST', body: '{}', signal })
  ).json() as Promise<AssistantSession>;
}
export async function getAssistantSession(id: string, signal?: AbortSignal, before?: string) {
  return (
    await requestResponse(
      '/assistant-sessions/' + encodeURIComponent(id) + (before ? '?before=' + before : ''),
      { signal },
    )
  ).json() as Promise<SessionDetail>;
}
export async function renameAssistantSession(id: string, title: string) {
  return (
    await requestResponse('/assistant-sessions/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    })
  ).json() as Promise<AssistantSession>;
}
export async function deleteAssistantSession(id: string) {
  await requestResponse('/assistant-sessions/' + encodeURIComponent(id), { method: 'DELETE' });
}
