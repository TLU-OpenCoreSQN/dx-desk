// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/common/Button';
import { AiTriageDiff } from '../../components/workflow';
import { getTeams } from '../../services/api';
import type { Category, Team, Ticket } from '../../types/api';
import { decideAiSuggestion, getAiSuggestion, type AiSuggestion, type SuggestionValues } from './aiSuggestionApi';

const priorities = { low: 'Thấp', normal: 'Bình thường', high: 'Cao' };
const input = 'block w-full rounded-md border border-edge bg-surface p-2 text-sm text-content focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

interface Props {
  ticketId: string;
  ticketStatus?: string;
  assignedTo?: string | null;
  categories: Category[];
  refresh: () => Promise<void>;
  /** Giá trị hiện tại của phiếu để so sánh với đề xuất. */
  ticket?: Pick<Ticket, 'category_id' | 'priority' | 'assigned_team_id' | 'team_name'>;
}

export function TicketAiSuggestion({ ticketId, ticketStatus, assignedTo, categories, refresh, ticket }: Props) {
  const heading = useId();
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [draft, setDraft] = useState<SuggestionValues | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const suggestionId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const request = new AbortController();
    void getAiSuggestion(ticketId, request.signal).then(async result => {
      if (request.signal.aborted) return;
      setError('');
      // Bản đang sửa chỉ hợp lệ cho đúng đề xuất đã tạo ra nó.
      if (suggestionId.current !== result?.id) setDraft(null);
      suggestionId.current = result?.id;
      setSuggestion(result);
      if (!result) return;
      const { data } = await getTeams();
      if (!request.signal.aborted) setTeams(data.filter(team => team.active));
    }).catch(() => { if (!request.signal.aborted) setError('Không tải được thông tin đề xuất AI.'); });
    return () => request.abort();
  }, [ticketId, ticketStatus, assignedTo]);

  function edit() {
    if (!suggestion) return;
    const { id: _id, ...values } = suggestion;
    setDraft(values);
  }

  async function decide(approve: boolean) {
    if (!suggestion || busy) return;
    const { id, ...original } = suggestion;
    const values = draft ?? original;
    if (approve && (!Object.hasOwn(priorities, values.priority) ||
      !values.category_id || !values.team_id || !values.summary.trim() || values.summary.trim().length > 2000)) {
      setError('Kiểm tra danh mục, nhóm xử lý, mức ưu tiên và tóm tắt trước khi xác nhận.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await decideAiSuggestion(ticketId, id, approve ? { ...values, summary: values.summary.trim() } : null);
      setNotice(approve ? 'Đã xác nhận đề xuất AI.' : 'Đã bỏ qua đề xuất AI.');
      suggestionId.current = undefined;
      setSuggestion(null);
      setDraft(null);
      await refresh();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!suggestion && !error && !notice) return null;
  const categoryName = categories.find(item => item.id === suggestion?.category_id)?.name;
  const teamName = teams.find(item => item.id === suggestion?.team_id)?.name;
  const currentCategory = categories.find(item => item.id === ticket?.category_id)?.name ?? 'Chưa phân loại';
  const currentTeam = ticket?.team_name
    ?? teams.find(item => item.id === ticket?.assigned_team_id)?.name
    ?? 'Chưa gán nhóm';
  const proposedPriority = suggestion && Object.hasOwn(priorities, suggestion.priority) ? suggestion.priority : 'Không hợp lệ';

  return (
    <div className="space-y-3">
      {suggestion && !draft && (
        <AiTriageDiff
          currentCategory={currentCategory}
          currentPriority={ticket?.priority ?? 'Chưa phân loại'}
          currentTeam={currentTeam}
          proposedCategory={categoryName ?? 'Không xác định'}
          proposedPriority={proposedPriority}
          proposedTeam={teamName ?? 'Không xác định'}
          summary={suggestion.summary}
          onAccept={() => void decide(true)}
          onCustomize={edit}
          onReject={() => void decide(false)}
          isBusy={busy}
          acceptLabel="Xác nhận đề xuất"
          customizeLabel="Sửa đề xuất"
          rejectLabel="Bỏ qua"
        />
      )}

      {draft && (
        <section aria-labelledby={heading} className="space-y-3 rounded-lg border border-edge bg-surface p-4 text-sm shadow-2xs">
          <h2 id={heading} className="font-semibold text-content">Chỉnh sửa đề xuất của AI</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-content">Danh mục
              <select className={input} value={draft.category_id} onChange={event => setDraft({ ...draft, category_id: event.target.value })}>
                {categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-content">Nhóm xử lý
              <select className={input} value={draft.team_id} onChange={event => setDraft({ ...draft, team_id: event.target.value })}>
                {teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-content">Ưu tiên
              <select className={input} value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value as SuggestionValues['priority'] })}>
                {Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2 text-xs font-semibold text-content">Tóm tắt
              <textarea className={input} maxLength={2000} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button disabled={busy} onClick={() => void decide(true)}>Xác nhận bản đã sửa</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setDraft(null)}>Hủy sửa</Button>
            <Button variant="ghost" disabled={busy} onClick={() => void decide(false)}>Bỏ qua</Button>
          </div>
        </section>
      )}

      {notice && <p role="status" className="rounded-md border border-status-success-border bg-status-success-bg p-3 text-sm text-status-success">{notice}</p>}
      {error && <p role="alert" className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-sm text-status-danger">{error}</p>}
    </div>
  );
}
