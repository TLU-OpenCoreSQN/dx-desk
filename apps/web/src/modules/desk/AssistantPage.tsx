// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { decideAssistantProposal, streamAssistant, type AssistantEvent, type Proposal, type WikiSource } from './assistantApi';

interface Answer {
  id: number; question: string; text: string; steps: string[]; sources: WikiSource[];
  proposal?: Proposal; status?: string; error?: string;
}
const fieldLabels: Record<string, string> = { category: 'Danh mục', title: 'Tiêu đề', description: 'Nội dung' };
const button = 'min-h-10 rounded border border-edge px-3 py-1.5 text-sm font-semibold disabled:opacity-50';

function safeSource(source: WikiSource) {
  try {
    const url = new URL(source.url);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch { return false; }
}

function updateAnswer(answer: Answer, event: AssistantEvent): Answer {
  switch (event.type) {
    case 'delta': return { ...answer, text: answer.text + event.text };
    case 'step': return { ...answer, steps: [...answer.steps, event.label] };
    case 'sources': return { ...answer, sources: event.items.filter(safeSource) };
    case 'proposal': return { ...answer, proposal: event };
    default: return answer;
  }
}

export function AssistantPage() {
  const inputId = useId();
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const next = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);

  function update(id: number, apply: (answer: Answer) => Answer) {
    setAnswers(history => history.map(answer => answer.id === id ? apply(answer) : answer));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setQuestion('');
    const id = next.current++;
    setAnswers(history => [...history.slice(-19), { id, question: text, text: '', steps: [], sources: [] }]);
    try {
      await streamAssistant(text, request.signal, message => update(id, answer => updateAnswer(answer, message)));
    } catch (error) {
      if (!request.signal.aborted) update(id, answer => ({ ...answer, error: (error as Error).message }));
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  async function decide(answer: Answer, approve: boolean) {
    if (!answer.proposal || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    try {
      await decideAssistantProposal(answer.proposal.id, approve, request.signal);
      update(answer.id, item => ({ ...item, proposal: undefined, status: approve ? 'Đã thực hiện.' : 'Đã hủy đề xuất.' }));
    } catch (error) {
      if (!request.signal.aborted) update(answer.id, item => ({ ...item, error: (error as Error).message, proposal: undefined }));
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-5 text-content">
      <h1 className="text-2xl font-semibold">Trợ lý AI</h1>
      <form onSubmit={event => void submit(event)} className="space-y-2 rounded border border-edge bg-surface p-4">
        <label htmlFor={inputId} className="block text-sm font-semibold">Câu hỏi hỗ trợ IT</label>
        <textarea id={inputId} rows={2} maxLength={1000} value={question} onChange={event => setQuestion(event.target.value)}
          className="w-full rounded border border-edge bg-surface p-2 text-sm" />
        <button className={button + ' bg-primary text-white'} disabled={busy || !question.trim()}>Gửi câu hỏi</button>
      </form>
      {busy && <p role="status" className="text-sm text-content-muted">Trợ lý đang xử lý…</p>}
      <ol className="space-y-4">
        {answers.map(answer => <li key={answer.id} className="space-y-3 rounded border border-edge bg-surface p-4 text-sm">
          <h2 className="font-semibold">{answer.question}</h2>
          {answer.steps.length > 0 && <ol aria-label="Các bước gọi công cụ" className="list-decimal space-y-1 pl-5 text-content-muted">
            {answer.steps.map((label, index) => <li key={index}>{label}</li>)}
          </ol>}
          {answer.text && <p className="whitespace-pre-wrap break-words">{answer.text}</p>}
          {answer.sources.length > 0 && <ul aria-label="Bài Wiki tham chiếu" className="space-y-1">
            {answer.sources.map(item => <li key={item.url}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{item.title}</a>
            </li>)}
          </ul>}
          {answer.proposal && <section aria-label="Hành động cần xác nhận" className="space-y-3 rounded border border-edge p-3">
            <h3 className="font-semibold">{answer.proposal.label}</h3>
            <dl className="space-y-2">
              {Object.entries(answer.proposal.fields).map(([key, value]) => <div key={key}>
                <dt className="font-medium">{fieldLabels[key] ?? key}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd>
              </div>)}
            </dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button + ' bg-primary text-white'} disabled={busy} onClick={() => void decide(answer, true)}>Xác nhận</button>
              <button type="button" className={button} disabled={busy} onClick={() => void decide(answer, false)}>Hủy đề xuất</button>
            </div>
          </section>}
          {answer.status && <p role="status">{answer.status}</p>}
          {answer.error && <p role="alert" className="text-danger">{answer.error}</p>}
        </li>)}
      </ol>
    </main>
  );
}
