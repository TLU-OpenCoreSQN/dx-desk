// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import Markdown from 'react-markdown';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { Check, ExternalLink, LoaderCircle, Pause, Play, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { AssistantTurn as Turn, WikiSource } from './assistantApi';
import type { PlaybackPhase } from './useAssistantVoice';

const fieldLabels: Record<string, string> = {
  category: 'Danh mục',
  title: 'Tiêu đề',
  description: 'Nội dung',
};
function safeSource(source: WikiSource) {
  try {
    const url = new URL(source.url);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const AssistantTurn = memo(function AssistantTurn({
  turn,
  busy,
  onDecide,
  onRead,
  speechSupported = false,
  playbackPhase = 'idle',
  onToggleRead,
  onStopRead,
}: {
  turn: Turn;
  busy: boolean;
  onDecide: (turn: Turn, approve: boolean) => void;
  onRead?: (turn: Turn) => void;
  speechSupported?: boolean;
  playbackPhase?: PlaybackPhase;
  onToggleRead?: () => void;
  onStopRead?: () => void;
}) {
  const proposal = turn.metadata.proposal;
  const expired = proposal?.expires_at && Date.parse(proposal.expires_at) <= Date.now();
  const pending = proposal && (!proposal.status || proposal.status === 'pending') && !expired;
  const result = proposal?.result;
  const sources = (turn.metadata.sources ?? []).filter(safeSource);
  return (
    <li className="space-y-6 py-6">
      <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-primary-tint px-4 py-3 sm:max-w-[80%]">
        <h2 className="sr-only">{turn.question}</h2>
        <p className="whitespace-pre-wrap break-words text-sm leading-7">{turn.question}</p>
      </div>
      <div className="flex min-w-0 gap-3">
        <span
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white"
          aria-hidden="true"
        >
          <Sparkles size={15} />
        </span>
        <div className="min-w-0 flex-1 space-y-3 text-sm">
          <p className="font-semibold">Trợ lý AI</p>
          {turn.status !== 'pending' && turn.metadata.steps?.length > 0 && (
            <details className="text-xs text-content-muted">
              <summary className="cursor-pointer">Các bước xử lý</summary>
              <ol aria-label="Các bước gọi công cụ" className="mt-2 list-decimal space-y-1 pl-5">
                {turn.metadata.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </details>
          )}
          {turn.answer && (
            <div className="assistant-response overflow-x-auto break-words leading-7">
              <Markdown
                disallowedElements={['img']}
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-2 pl-5">{children}</ol>,
                  ul: ({ children }) => <ul className="mb-3 list-disc space-y-2 pl-5">{children}</ul>,
                  h1: ({ children }) => <h3 className="mb-3 text-lg font-semibold">{children}</h3>,
                  h2: ({ children }) => <h3 className="mb-3 text-base font-semibold">{children}</h3>,
                  h3: ({ children }) => <h3 className="mb-2 font-semibold">{children}</h3>,
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-primary-ink)] underline"
                    >
                      {children}
                    </a>
                  ),
                  pre: ({ children }) => (
                    <pre className="my-3 overflow-x-auto rounded-lg border border-edge bg-surface-muted p-4 text-xs">
                      {children}
                    </pre>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-surface-muted px-1 font-mono text-[0.9em]">{children}</code>
                  ),
                  table: ({ children }) => (
                    <table className="my-3 w-full border-collapse text-left text-xs">{children}</table>
                  ),
                  th: ({ children }) => (
                    <th className="border border-edge bg-surface-muted p-2">{children}</th>
                  ),
                  td: ({ children }) => <td className="border border-edge p-2">{children}</td>,
                }}
              >
                {turn.answer}
              </Markdown>
            </div>
          )}
          {turn.status === 'pending' && !turn.answer && (
            <p role="status" aria-label="Thinking" className="inline-flex items-center gap-2 text-content-muted">
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Thinking<span className="animate-pulse" aria-hidden="true">…</span>
            </p>
          )}
          {turn.status !== 'pending' && sources.length > 0 && (
            <ul aria-label="Bài Wiki tham chiếu" className="flex flex-wrap gap-2">
              {sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1.5 text-xs text-[var(--color-primary-ink)]"
                  >
                    {source.title}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          {speechSupported && onRead && turn.answer && turn.status !== 'pending' && (
            <div className="flex flex-wrap items-center gap-2">
              {playbackPhase === 'idle' ? <button type="button" disabled={busy} aria-label="Đọc câu trả lời" onClick={() => onRead(turn)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-edge px-3 text-xs disabled:opacity-40">
                <Volume2 size={15} aria-hidden="true" />Nghe câu trả lời
              </button> : <>
                <button type="button" aria-label={playbackPhase === 'paused' ? 'Tiếp tục đọc câu trả lời' : 'Tạm dừng đọc câu trả lời'} onClick={onToggleRead}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-edge px-3 text-xs">
                  {playbackPhase === 'paused' ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
                  {playbackPhase === 'paused' ? 'Tiếp tục đọc' : 'Tạm dừng đọc'}
                </button>
                <button type="button" aria-label="Dừng đọc câu trả lời" onClick={onStopRead}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-edge px-3 text-xs">
                  <VolumeX size={15} aria-hidden="true" />Dừng đọc
                </button>
              </>}
            </div>
          )}
          {pending && (
            <section
              aria-label="Hành động cần xác nhận"
              className="space-y-3 rounded-xl border border-edge p-4"
            >
              <h3 className="font-semibold">{proposal.label}</h3>
              <dl className="space-y-2">
                {Object.entries(proposal.fields).map(([key, value]) => (
                  <div key={key}>
                    <dt className="font-medium">{fieldLabels[key] ?? key}</dt>
                    <dd className="whitespace-pre-wrap break-words text-content-muted">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(turn, true)}
                  className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Xác nhận
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(turn, false)}
                  className="min-h-10 rounded-lg border border-edge px-4 text-sm disabled:opacity-50"
                >
                  Hủy đề xuất
                </button>
              </div>
            </section>
          )}
          {proposal && !pending && (
            <p role="status" className="flex items-center gap-2 text-xs text-content-muted">
              <Check size={14} />
              {expired && proposal.status === 'pending'
                ? 'Đề xuất đã hết hạn.'
                : proposal.status === 'cancelled'
                  ? 'Đã hủy đề xuất.'
                  : result?.ticket_id
                    ? 'Đã tạo phiếu.'
                    : result
                      ? `Đã tạo công việc ${result.id}.`
                      : 'Đã thực hiện.'}
            </p>
          )}
          {result?.ticket_id && (
            <Link
              className="inline-block text-[var(--color-primary-ink)] underline"
              to={'/tickets/' + encodeURIComponent(result.ticket_id)}
            >
              Xem phiếu vừa tạo
            </Link>
          )}
          {turn.metadata.error && (
            <p role="alert" className="rounded-lg border border-edge p-3 text-danger">
              {turn.metadata.error}
            </p>
          )}
          {turn.status === 'interrupted' && !turn.metadata.error && (
            <p className="text-xs text-content-muted">Đã dừng trả lời. Bạn có thể gửi tiếp tin nhắn.</p>
          )}
        </div>
      </div>
    </li>
  );
});
