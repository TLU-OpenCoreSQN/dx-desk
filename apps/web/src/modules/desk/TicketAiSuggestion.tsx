// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useId, useState } from 'react';
import { Button } from '../../components/common/Button';
import { AiTriageDiff } from '../../components/workflow';
import { getTeams } from '../../services/api';
import type { Category, Team } from '../../types/api';
import { decideAiSuggestion, getAiSuggestion, type AiSuggestion, type SuggestionValues } from './aiSuggestionApi';

const priorities = { low: 'Thấp', normal: 'Bình thường', high: 'Cao' };
const input = 'block w-full rounded-md border border-edge bg-surface p-2 text-sm text-content focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

interface Props {
  ticketId: string;
  categories: Category[];
  refresh: () => Promise<void>;
}

export function TicketAiSuggestion({ ticketId, categories, refresh }: Props) {
  const heading = useId();
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [draft, setDraft] = useState<SuggestionValues | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const request = new AbortController();
    void getAiSuggestion(ticketId, request.signal).then(async result => {
      if (request.signal.aborted || !result) return;
      setSuggestion(result);
      const { data } = await getTeams();
      if (!request.signal.aborted) setTeams(data.filter(team => team.active));
    }).catch(() => { if (!request.signal.aborted) setError('Không tải được thông tin đề xuất AI.'); });
    return () => request.abort();
  }, [ticketId]);

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

  return (
    <div className="space-y-3">
      {suggestion && !draft && (
        <AiTriageDiff
          currentCategory="Chưa phân loại"
          currentPriority="normal"
          currentTeam="Chưa gán nhóm"
          proposedCategory={categoryName ?? suggestion.category_id}
          proposedPriority={suggestion.priority}
          proposedTeam={teamName ?? suggestion.team_id}
          confidenceScore={94}
          summary={suggestion.summary}
          rationale="AI phân tích nội dung dựa trên quy tắc SLA và cơ sở tri thức (KB)."
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
