// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ApiClientError, claimTicket, getTeams, getTickets, updateTicketStatus } from '../../services/api';
import { Team, Ticket, TicketQueue } from '../../types/api';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { PriorityBadge, StatusBadge } from './Badge';
import { TicketSlaInfo } from './TicketSlaInfo';

const PAGE_SIZE = 25;
const BUTTON_BASE = 'min-h-11 rounded-md border px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50';
const BUTTON = `${BUTTON_BASE} border-edge bg-surface text-content hover:bg-surface-muted`;
const PRIMARY = `${BUTTON_BASE} border-primary bg-primary text-white hover:bg-primary-hover`;
const QUEUES: { key: TicketQueue; label: string }[] = [
  { key: 'my_open', label: 'Đang phụ trách' },
  { key: 'team_unassigned', label: 'Nhóm của tôi · Chưa nhận' },
  { key: 'team_assigned', label: 'Nhóm của tôi · Đã nhận' },
];

export function TicketQueueView({ approvals = false }: { approvals?: boolean }) {
  const { roles, profile } = useAuth();
  const isStaff = roles.includes('Agent') || roles.includes('Manager');
  const permitted = approvals ? roles.includes('Manager') : isStaff;
  const [queue, setQueue] = useState<TicketQueue>(approvals ? 'pending_approval' : 'my_open');
  const [teamId, setTeamId] = useState('');
  const [offset, setOffset] = useState(0);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [total, setTotal] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [teamsError, setTeamsError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ ticket: Ticket; to: 'assigned' | 'new' } | null>(null);
  const [note, setNote] = useState('');
  const requestRevision = useRef(0);
  const mutationInFlight = useRef(false);
  const decisionRef = useRef<HTMLTextAreaElement>(null);
  const decisionTrigger = useRef<HTMLButtonElement | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  const loadTickets = useCallback(async () => {
    if (!permitted) return;
    const revision = ++requestRevision.current;
    setLoading(true); setError(null);
    try {
      const response = await getTickets(PAGE_SIZE, offset, { queue, ...(teamId ? { team_id: teamId } : {}) });
      if (revision !== requestRevision.current) return;
      setTickets(response.data); setTotal(response.total);
    } catch (err) {
      if (revision !== requestRevision.current) return;
      setTickets([]); setTotal(undefined); setError(err);
    } finally {
      if (revision === requestRevision.current) setLoading(false);
    }
  }, [permitted, offset, queue, teamId]);

  const loadTeams = useCallback(async () => {
    if (!permitted || approvals) return;
    setTeamsError(null);
    try { setTeams((await getTeams()).data); }
    catch (err) { setTeams([]); setTeamsError(err); }
  }, [permitted, approvals]);

  useEffect(() => {
    void loadTickets();
    return () => { requestRevision.current += 1; };
  }, [loadTickets]);
  useEffect(() => { void loadTeams(); }, [loadTeams]);
  useEffect(() => { if (decision) decisionRef.current?.focus(); }, [decision]);
  useEffect(() => { if (notice) noticeRef.current?.focus(); }, [notice]);

  const myTeams = teams.filter(team => team.active && team.members.some(member => member.active && member.user_id === profile?.id));
  const canClaim = (ticket: Ticket) => roles.includes('Agent') && ticket.status === 'assigned' && !ticket.assigned_to &&
    myTeams.some(team => team.id === ticket.assigned_team_id);

  const mutate = async (ticket: Ticket, operation: () => Promise<Ticket>, success: string) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusyId(ticket.id); setMutationError(null); setNotice(null);
    try {
      await operation(); setDecision(null); setNote(''); setNotice(success);
      await loadTickets();
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setDecision(null); setNote('');
        setNotice('Phiếu vừa được người khác cập nhật. Danh sách đã được tải lại; hãy kiểm tra trước khi thao tác tiếp.');
        await loadTickets();
      } else setMutationError(err);
    } finally { mutationInFlight.current = false; setBusyId(null); }
  };

  const confirmDecision = (event: FormEvent) => {
    event.preventDefault();
    if (!decision || (decision.to === 'new' && note.trim().length < 5) || note.trim().length > 2000) return;
    const { ticket, to } = decision;
    void mutate(ticket, () => updateTicketStatus(ticket.id, {
      to,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(ticket.ticket_version !== undefined ? { expected_version: ticket.ticket_version } : {}),
    }), to === 'assigned' ? 'Đã phê duyệt phiếu và chuyển vào nhóm xử lý.' : 'Đã từ chối yêu cầu và trả phiếu về trạng thái mới.');
  };

  if (!permitted) return (
    <section className="rounded-lg border border-edge bg-surface p-6">
      <h1 className="text-xl font-bold text-content">Không có quyền truy cập</h1>
      <p className="mt-2 text-sm text-content-muted">{approvals ? 'Hàng đợi phê duyệt dành cho Quản lý.' : 'Bảng việc dành cho kỹ thuật viên và Quản lý.'}</p>
      <Link className="mt-4 inline-block text-primary underline" to="/tickets">Về danh sách phiếu</Link>
    </section>
  );

  const hasNext = total === undefined ? tickets.length === PAGE_SIZE : offset + PAGE_SIZE < total;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-edge-subtle pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-content sm:text-2xl">{approvals ? 'Phê duyệt phiếu hỗ trợ' : 'Bảng việc kỹ thuật viên'}</h1>
          <p className="mt-1 text-sm text-content-muted">{approvals ? 'Các phiếu hỗ trợ đang chờ quyết định; yêu cầu cấp thiết bị được quản lý riêng.' : 'Hàng đợi được lọc trên máy chủ theo người phụ trách và nhóm của bạn.'}</p>
        </div>
        <button type="button" className={BUTTON} disabled={loading || busyId !== null} onClick={() => { void loadTickets(); void loadTeams(); }}>Làm mới hàng đợi</button>
      </header>

      {!approvals && (
        <div className="space-y-3">
          <div role="group" aria-label="Hàng đợi công việc" className="flex flex-wrap gap-2">
            {QUEUES.map(item => <button key={item.key} type="button" aria-pressed={queue === item.key} disabled={busyId !== null}
              className={queue === item.key ? PRIMARY : BUTTON} onClick={() => { setQueue(item.key); setOffset(0); setDecision(null); setTeamId(''); setNotice(null); }}>{item.label}</button>)}
          </div>
          {queue !== 'my_open' && <label className="block max-w-sm text-xs font-semibold text-content">Nhóm xử lý
            <select className="mt-1 block min-h-11 w-full rounded-md border border-edge bg-surface px-3 text-sm text-content" value={teamId} disabled={busyId !== null}
              onChange={event => { setTeamId(event.target.value); setOffset(0); }}>
              <option value="">Tất cả nhóm của tôi</option>
              {myTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>}
          {teamsError != null && <ErrorMessage error={teamsError} title="Chưa xác minh được nhóm để nhận việc" onRetry={() => void loadTeams()} />}
        </div>
      )}

      {notice && <p ref={noticeRef} tabIndex={-1} role="status" className="rounded-md border border-primary-border bg-primary-tint p-3 text-sm text-primary-text">{notice}</p>}
      {mutationError != null && <ErrorMessage error={mutationError} title="Chưa thực hiện được thao tác" />}
      {error != null && <ErrorMessage error={error} title="Không tải được hàng đợi" onRetry={() => void loadTickets()} />}
      {loading ? <LoadingSpinner label="Đang tải hàng đợi phiếu..." /> : error == null && (
        <>
          <p className="text-xs text-content-muted" aria-live="polite">{total !== undefined ? `${total} phiếu trong hàng đợi` : `${tickets.length} phiếu trên trang này`} · Trang {Math.floor(offset / PAGE_SIZE) + 1}</p>
          {tickets.length === 0 ? <p className="rounded-lg border border-edge bg-surface p-6 text-sm text-content-muted">Không có phiếu trong hàng đợi này.</p> : (
            <ul className="grid min-w-0 gap-4 xl:grid-cols-2">
              {tickets.map(ticket => <li key={ticket.id} className="min-w-0 rounded-lg border border-edge bg-surface p-4 shadow-xs sm:p-5">
                <article aria-label={ticket.title} className="space-y-3">
                  <div className="flex flex-wrap gap-2"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div>
                  <h2 className="break-words font-bold text-content"><Link className="hover:text-primary hover:underline" to={`/tickets/${encodeURIComponent(ticket.id)}`}>{ticket.title}</Link></h2>
                  <p className="break-words text-sm text-content-muted">{ticket.description}</p>
                  <dl className="space-y-1 break-words text-xs text-content-muted">
                    <div><dt className="inline">Người yêu cầu: </dt><dd className="inline font-semibold text-content">{ticket.requester_name || ticket.requester_id}</dd></div>
                    <div><dt className="inline">Nhóm: </dt><dd className="inline font-semibold text-content">{ticket.team_name || (ticket.assigned_team_id ? `Chưa có tên nhóm (${ticket.assigned_team_id})` : 'Chưa gán nhóm')}</dd></div>
                    <div><dt className="inline">Phụ trách: </dt><dd className="inline font-semibold text-content">{ticket.assignee_name || ticket.assigned_to || 'Chưa có người nhận'}</dd></div>
                  </dl>
                  {approvals && ticket.request_fields && Object.keys(ticket.request_fields).length > 0 && <dl className="space-y-1 rounded-md border border-edge bg-surface-warm p-3 text-xs">
                    {Object.entries(ticket.request_fields).map(([key, value]) => <div key={key} className="break-words"><dt className="font-semibold text-content">{key}</dt><dd className="text-content-muted">{typeof value === 'string' || typeof value === 'number' ? String(value) : 'Dữ liệu không phải văn bản'}</dd></div>)}
                  </dl>}
                  <TicketSlaInfo ticket={ticket} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className={BUTTON} to={`/tickets/${encodeURIComponent(ticket.id)}`}>Xem chi tiết và lịch sử</Link>
                    {!approvals && canClaim(ticket) && <button type="button" className={PRIMARY} disabled={busyId !== null}
                      onClick={() => void mutate(ticket, () => claimTicket(ticket.id), 'Đã nhận phiếu. Phiếu có trong hàng đợi Đang phụ trách.')}>{busyId === ticket.id ? 'Đang nhận phiếu…' : 'Nhận xử lý'}</button>}
                    {approvals && ticket.status === 'pending_approval' && <>
                      <button type="button" className={PRIMARY} disabled={busyId !== null} onClick={event => { decisionTrigger.current = event.currentTarget; setDecision({ ticket, to: 'assigned' }); setNote(''); setMutationError(null); }}>Duyệt phiếu</button>
                      <button type="button" className={`${BUTTON} text-danger`} disabled={busyId !== null} onClick={event => { decisionTrigger.current = event.currentTarget; setDecision({ ticket, to: 'new' }); setNote(''); setMutationError(null); }}>Từ chối phiếu</button>
                    </>}
                  </div>
                  {decision?.ticket.id === ticket.id && <form onSubmit={confirmDecision} className="space-y-3 rounded-md border border-primary-border bg-surface-warm p-3" aria-label={decision.to === 'assigned' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}>
                    <p className="text-sm font-semibold text-content">{decision.to === 'assigned' ? 'Xác nhận duyệt và chuyển phiếu vào nhóm xử lý?' : 'Xác nhận từ chối và trả phiếu về trạng thái mới?'}</p>
                    <label className="block text-xs font-semibold text-content">Lý do quyết định {decision.to === 'new' ? '(bắt buộc, 5–2000 ký tự)' : '(không bắt buộc)'}
                      <textarea ref={decisionRef} value={note} maxLength={2000} required={decision.to === 'new'} aria-invalid={decision.to === 'new' && note.length > 0 && note.trim().length < 5} disabled={busyId !== null} className="mt-1 block min-h-24 w-full rounded-md border border-edge bg-surface p-2 text-sm text-content" onChange={event => setNote(event.target.value)} />
                    </label>
                    <div className="flex flex-wrap gap-2"><button type="submit" className={PRIMARY} disabled={busyId !== null || (decision.to === 'new' && note.trim().length < 5)}>{busyId === ticket.id ? 'Đang gửi quyết định…' : 'Xác nhận quyết định'}</button>
                      <button type="button" className={BUTTON} disabled={busyId !== null} onClick={() => { setDecision(null); setNote(''); decisionTrigger.current?.focus(); }}>Hủy quyết định</button></div>
                  </form>}
                </article>
              </li>)}
            </ul>
          )}
          {(offset > 0 || hasNext) && <nav aria-label="Phân trang hàng đợi" className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className={BUTTON} disabled={offset === 0 || busyId !== null} onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); setDecision(null); }}>Trang trước</button>
            <button type="button" className={BUTTON} disabled={!hasNext || busyId !== null} onClick={() => { setOffset(offset + PAGE_SIZE); setDecision(null); }}>Trang sau</button>
          </nav>}
        </>
      )}
    </div>
  );
}
