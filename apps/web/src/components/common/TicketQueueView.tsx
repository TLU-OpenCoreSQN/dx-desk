// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { FormEvent, KeyboardEvent, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Kanban, LayoutList, RefreshCw, Search, SearchX, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ApiClientError, claimTicket, getTeams, getTickets, updateTicketStatus } from '../../services/api';
import { Team, Ticket, TicketQueue } from '../../types/api';
import { computeSlaSnapshot, slaRisk, SlaRisk, SlaSnapshot } from '../../lib/sla';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { PriorityBadge, StatusBadge } from './Badge';
import { TicketSlaInfo } from './TicketSlaInfo';
import { SlaRemaining } from './SlaRemaining';
import { TicketKanbanBoard } from '../workflow';

const PAGE_SIZE = 25;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const BUTTON_BASE = `min-h-11 rounded-md border px-3 py-2 text-sm font-semibold ${FOCUS} disabled:cursor-not-allowed disabled:opacity-50`;
const BUTTON = `${BUTTON_BASE} border-edge-strong bg-surface text-content hover:bg-state-hover`;
const PRIMARY = `${BUTTON_BASE} border-primary bg-primary text-white hover:bg-primary-hover`;
const FIELD = `min-h-11 w-full rounded-md border border-edge bg-surface px-3 text-sm text-content ${FOCUS}`;
const QUEUES: { key: Exclude<TicketQueue, 'pending_approval'>; label: string }[] = [
  { key: 'my_open', label: 'Đang phụ trách' },
  { key: 'team_unassigned', label: 'Nhóm của tôi · Chưa nhận' },
  { key: 'team_assigned', label: 'Nhóm của tôi · Đã nhận' },
];
const QUEUE_KEYS = QUEUES.map(item => item.key) as string[];
type QueueKey = (typeof QUEUES)[number]['key'];
type SlaFilter = 'all' | 'breached' | 'at_risk';
type SortKey = 'sla' | 'newest';

/** Thứ tự xử lý: quá hạn trước, rồi sắp quá hạn, đang chạy; tạm dừng và không có SLA xuống cuối. */
const RISK_RANK: Record<SlaRisk, number> = { breached: 0, at_risk: 1, running: 2, paused: 3, none: 4, finished: 5 };
const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
/** Lưới cột khi khung danh sách đủ rộng (container query, nên vẫn đúng khi khung xem nhanh đang mở). */
const ROW_GRID = '@3xl:grid-cols-[minmax(0,1fr)_124px_148px_minmax(0,150px)_176px_auto]';

const shortId = (id: string) => id.slice(0, 8);
const ticketHref = (ticket: Ticket) => `/tickets/${encodeURIComponent(ticket.id)}`;

interface Row { ticket: Ticket; sla: SlaSnapshot; risk: SlaRisk }

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function TicketQueueView({ approvals = false }: { approvals?: boolean }) {
  const navigate = useNavigate();
  const { roles, profile } = useAuth();
  const isStaff = roles.includes('Agent') || roles.includes('Manager');
  const permitted = approvals ? roles.includes('Manager') : isStaff;

  // Bộ lọc, trang, chế độ xem và phiếu đang xem nhanh nằm trong URL: quay lại từ trang chi tiết
  // (nút Back) trả đúng hàng đợi, nhóm, trang và phiếu người dùng đang xem.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawQueue = searchParams.get('queue') ?? '';
  const queue: TicketQueue = approvals ? 'pending_approval' : (QUEUE_KEYS.includes(rawQueue) ? rawQueue as QueueKey : 'my_open');
  const teamId = !approvals && queue !== 'my_open' ? searchParams.get('team') ?? '' : '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const viewMode = searchParams.get('view') === 'kanban' ? 'kanban' : 'table';
  const sortKey: SortKey = searchParams.get('sort') === 'newest' ? 'newest' : 'sla';
  const rawSla = searchParams.get('sla');
  const slaFilter: SlaFilter = rawSla === 'breached' || rawSla === 'at_risk' ? rawSla : 'all';
  const query = searchParams.get('q') ?? '';
  const selectedId = searchParams.get('ticket');

  const setParams = useCallback((updates: Record<string, string | number | null>, replace = true) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        const isDefault = value === null || value === '' || (key === 'page' && Number(value) <= 1)
          || (key === 'queue' && value === 'my_open') || (key === 'view' && value === 'table')
          || (key === 'sort' && value === 'sla') || (key === 'sla' && value === 'all');
        if (isDefault) next.delete(key); else next.set(key, String(value));
      }
      return next;
    }, { replace });
  }, [setSearchParams]);

  const [searchInput, setSearchInput] = useState(query);
  useEffect(() => { setSearchInput(query); }, [query]);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [total, setTotal] = useState<number | undefined>();
  const [counts, setCounts] = useState<Partial<Record<QueueKey, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [teamsError, setTeamsError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ ticket: Ticket; to: 'assigned' | 'new' } | null>(null);
  const [note, setNote] = useState('');
  const requestRevision = useRef(0);
  const countRevision = useRef(0);
  const mutationInFlight = useRef(false);
  const decisionRef = useRef<HTMLTextAreaElement>(null);
  const decisionTrigger = useRef<HTMLButtonElement | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const now = useNow();

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

  // Số phiếu ở từng hàng đợi, để thấy ngay nhóm có phiếu chưa ai nhận mà không phải bấm qua từng tab.
  // Dùng chính API danh sách (limit=1, đọc `total`); lỗi ở đây chỉ làm mất con số, không chặn trang.
  const loadCounts = useCallback(async () => {
    if (!permitted || approvals) return;
    const revision = ++countRevision.current;
    const results = await Promise.all(QUEUES.map(async item => {
      try {
        const response = await getTickets(1, 0, { queue: item.key, ...(teamId && item.key !== 'my_open' ? { team_id: teamId } : {}) });
        return [item.key, response.total] as const;
      } catch { return [item.key, undefined] as const; }
    }));
    if (revision !== countRevision.current) return;
    setCounts(Object.fromEntries(results.filter(([, value]) => typeof value === 'number')));
  }, [permitted, approvals, teamId]);

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
  useEffect(() => {
    void loadCounts();
    return () => { countRevision.current += 1; };
  }, [loadCounts]);
  useEffect(() => { void loadTeams(); }, [loadTeams]);
  useEffect(() => { if (decision) decisionRef.current?.focus(); }, [decision]);
  useEffect(() => { if (notice) noticeRef.current?.focus(); }, [notice]);

  const myTeams = teams.filter(team => team.active && team.members.some(member => member.active && member.user_id === profile?.id));
  const canClaim = (ticket: Ticket) => roles.includes('Agent') && ticket.status === 'assigned' && !ticket.assigned_to &&
    myTeams.some(team => team.id === ticket.assigned_team_id);

  const rows: Row[] = useMemo(() => tickets.map(ticket => {
    const sla = computeSlaSnapshot(ticket, now);
    return { ticket, sla, risk: slaRisk(sla) };
  }), [tickets, now]);
  const breachedCount = rows.filter(row => row.risk === 'breached').length;
  const atRiskCount = rows.filter(row => row.risk === 'at_risk').length;
  const needle = query.trim().toLocaleLowerCase('vi');
  const visibleRows = useMemo(() => {
    const filtered = rows.filter(row => {
      if (slaFilter !== 'all' && row.risk !== slaFilter) return false;
      if (!needle) return true;
      const { ticket } = row;
      return [ticket.title, ticket.id, ticket.requester_name, ticket.assignee_name, ticket.team_name]
        .some(value => value?.toLocaleLowerCase('vi').includes(needle));
    });
    if (sortKey === 'newest') return filtered;
    return [...filtered].sort((a, b) =>
      RISK_RANK[a.risk] - RISK_RANK[b.risk]
      || (a.sla.hasSla && b.sla.hasSla ? a.sla.effectiveDue - b.sla.effectiveDue : 0)
      || (PRIORITY_RANK[a.ticket.priority] ?? 9) - (PRIORITY_RANK[b.ticket.priority] ?? 9));
  }, [rows, slaFilter, needle, sortKey]);
  const selected = selectedId ? rows.find(row => row.ticket.id === selectedId) : undefined;
  const filtersActive = slaFilter !== 'all' || needle.length > 0;

  useEffect(() => { if (selected) panelHeadingRef.current?.focus(); }, [selected?.ticket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutate = async (ticket: Ticket, operation: () => Promise<Ticket>, success: string) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusyId(ticket.id); setMutationError(null); setNotice(null);
    try {
      await operation(); setDecision(null); setNote(''); setNotice(success);
      await loadTickets(); void loadCounts();
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setDecision(null); setNote('');
        setNotice('Phiếu vừa được người khác cập nhật. Danh sách đã được tải lại; hãy kiểm tra trước khi thao tác tiếp.');
        await loadTickets(); void loadCounts();
      } else setMutationError(err);
    } finally { mutationInFlight.current = false; setBusyId(null); }
  };
  const claim = (ticket: Ticket) => void mutate(ticket, () => claimTicket(ticket.id), 'Đã nhận phiếu. Phiếu có trong hàng đợi Đang phụ trách.');

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

  const openPreview = (ticket: Ticket, trigger: HTMLButtonElement) => {
    previewTrigger.current = trigger;
    setParams({ ticket: selectedId === ticket.id ? null : ticket.id });
  };
  const closePreview = () => {
    setParams({ ticket: null });
    previewTrigger.current?.focus();
  };
  const changeQueue = (key: QueueKey) => {
    setDecision(null); setNotice(null);
    setParams({ queue: key, team: null, page: null, ticket: null, sla: null }, false);
  };
  const changePage = (nextPage: number) => {
    setDecision(null);
    setParams({ page: nextPage, ticket: null }, false);
  };
  const refresh = () => { void loadTickets(); void loadCounts(); void loadTeams(); };

  if (!permitted) return (
    <section className="rounded-lg border border-edge bg-surface p-6">
      <h1 className="dx-page-title">Không có quyền truy cập</h1>
      <p className="mt-2 text-sm text-content-muted">{approvals ? 'Hàng đợi phê duyệt dành cho Quản lý.' : 'Bảng việc dành cho kỹ thuật viên và Quản lý.'}</p>
      <Link className="mt-4 inline-block text-[var(--color-primary-ink)] underline" to="/tickets">Về danh sách phiếu</Link>
    </section>
  );

  const hasNext = total === undefined ? tickets.length === PAGE_SIZE : offset + PAGE_SIZE < total;
  const paginated = offset > 0 || hasNext;
  const countLabel = total !== undefined ? `${total} phiếu trong hàng đợi` : `${tickets.length} phiếu trên trang này`;
  const pagination = paginated && (
    <nav aria-label="Phân trang hàng đợi" className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className={BUTTON} disabled={offset === 0 || busyId !== null} onClick={() => changePage(page - 1)}>Trang trước</button>
      <button type="button" className={BUTTON} disabled={!hasNext || busyId !== null} onClick={() => changePage(page + 1)}>Trang sau</button>
    </nav>
  );
  const feedback = <>
    {notice && <p ref={noticeRef} tabIndex={-1} role="status" className="rounded-md border border-primary-border bg-primary-tint p-3 text-sm text-primary-text">{notice}</p>}
    {mutationError != null && <ErrorMessage error={mutationError} title="Chưa thực hiện được thao tác" />}
    {error != null && <ErrorMessage error={error} title="Không tải được hàng đợi" onRetry={() => void loadTickets()} />}
  </>;

  if (approvals) return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-edge-subtle pb-4">
        <div className="min-w-0">
          <h1 className="dx-page-title">Phê duyệt phiếu hỗ trợ</h1>
          <p className="mt-1 text-sm text-content-muted">Các phiếu hỗ trợ đang chờ quyết định; yêu cầu cấp thiết bị được quản lý riêng.</p>
        </div>
        <button type="button" className={BUTTON} disabled={loading || busyId !== null} onClick={refresh}>Làm mới hàng đợi</button>
      </header>
      {feedback}
      {loading ? <LoadingSpinner label="Đang tải hàng đợi phiếu..." /> : error == null && (
        <>
          <p className="text-[13px] text-content-muted" aria-live="polite">{countLabel} · Trang {page}</p>
          {tickets.length === 0 ? <p className="rounded-lg border border-edge bg-surface p-6 text-sm text-content-muted">Không có phiếu trong hàng đợi này.</p> : (
            <ul className="grid min-w-0 gap-4 xl:grid-cols-2">
              {tickets.map(ticket => <li key={ticket.id} className="min-w-0 rounded-lg border border-edge bg-surface p-4 shadow-xs sm:p-5">
                <article aria-label={ticket.title} className="space-y-3">
                  <div className="flex flex-wrap gap-2"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div>
                  <h2 className="break-words font-bold text-content"><Link className="hover:text-[var(--color-primary-ink)] hover:underline" to={ticketHref(ticket)}>{ticket.title}</Link></h2>
                  <p className="break-words text-sm text-content-muted">{ticket.description}</p>
                  <dl className="space-y-1 break-words text-xs text-content-muted">
                    <div><dt className="inline">Người yêu cầu: </dt><dd className="inline font-semibold text-content">{ticket.requester_name || ticket.requester_id}</dd></div>
                    <div><dt className="inline">Nhóm: </dt><dd className="inline font-semibold text-content">{ticket.team_name || (ticket.assigned_team_id ? `Chưa có tên nhóm (${ticket.assigned_team_id})` : 'Chưa gán nhóm')}</dd></div>
                    <div><dt className="inline">Phụ trách: </dt><dd className="inline font-semibold text-content">{ticket.assignee_name || ticket.assigned_to || 'Chưa có người nhận'}</dd></div>
                  </dl>
                  {ticket.request_fields && Object.keys(ticket.request_fields).length > 0 && <dl className="space-y-1 rounded-md border border-edge bg-surface-warm p-3 text-xs">
                    {Object.entries(ticket.request_fields).map(([key, value]) => <div key={key} className="break-words"><dt className="font-semibold text-content">{key}</dt><dd className="text-content-muted">{typeof value === 'string' || typeof value === 'number' ? String(value) : 'Dữ liệu không phải văn bản'}</dd></div>)}
                  </dl>}
                  <TicketSlaInfo ticket={ticket} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className={BUTTON} to={ticketHref(ticket)}>Xem chi tiết và lịch sử</Link>
                    {ticket.status === 'pending_approval' && <>
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
          {pagination}
        </>
      )}
    </div>
  );

  const scopeNote = paginated ? 'trên trang đang xem' : 'trong hàng đợi';
  const attentionButton = (key: 'breached' | 'at_risk', count: number, label: string, tone: string) => {
    const active = slaFilter === key;
    return (
      <button type="button" aria-pressed={active} disabled={count === 0 && !active}
        onClick={() => setParams({ sla: active ? 'all' : key, ticket: null })}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-semibold ${FOCUS} disabled:cursor-not-allowed disabled:opacity-60 ${
          active ? 'border-primary bg-primary text-white' : count > 0 ? tone : 'border-edge bg-surface text-content-muted'}`}>
        <span className="tabular-nums">{count}</span> {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="dx-page-title">Bảng việc kỹ thuật viên</h1>
          <p className="mt-1 text-sm text-content-muted">Phiếu quá hạn và sắp quá hạn SLA được xếp lên đầu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Chế độ xem hàng đợi" className="inline-flex rounded-md border border-edge bg-surface p-0.5">
            {([['table', 'Bảng danh sách', LayoutList], ['kanban', 'Kanban luồng việc', Kanban]] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" aria-pressed={viewMode === key} onClick={() => setParams({ view: key })}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-[4px] px-3 text-sm font-medium transition-colors ${FOCUS} ${
                  viewMode === key ? 'bg-primary text-white' : 'text-content-muted hover:bg-state-hover hover:text-content'}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <button type="button" className={`${BUTTON} inline-flex items-center gap-1.5`} disabled={loading || busyId !== null} onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Làm mới hàng đợi
          </button>
        </div>
      </header>

      <div className="relative -mx-1 overflow-x-auto overflow-y-hidden border-b border-edge-subtle px-1">
        <div role="group" aria-label="Hàng đợi công việc" className="flex min-w-max gap-1">
          {QUEUES.map(item => {
            const active = queue === item.key;
            const count = active && total !== undefined ? total : counts[item.key];
            const needsOwner = item.key === 'team_unassigned' && (count ?? 0) > 0;
            return (
              <button key={item.key} type="button" aria-pressed={active} disabled={busyId !== null} onClick={() => changeQueue(item.key)}
                className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm ${FOCUS} disabled:opacity-50 ${
                  active ? 'border-primary font-semibold text-content' : 'border-transparent text-content-muted hover:text-content'}`}>
                {item.label}
                {count !== undefined && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  needsOwner ? 'bg-status-warning-bg text-status-warning' : 'bg-surface-muted text-content-muted'}`}>
                  <span className="sr-only">: </span>{count}<span className="sr-only"> phiếu</span>
                </span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-56 text-[13px] font-medium text-content">Tìm trong hàng đợi
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
            <input type="search" value={searchInput} placeholder="Tiêu đề, mã phiếu, người yêu cầu…" className={`${FIELD} pl-9`}
              onChange={event => { setSearchInput(event.target.value); setParams({ q: event.target.value, ticket: null }); }} />
          </span>
        </label>
        {queue !== 'my_open' && <label className="w-[calc(50%-6px)] text-[13px] font-medium text-content sm:w-56">Nhóm xử lý
          <select className={`${FIELD} mt-1 block`} value={teamId} disabled={busyId !== null}
            onChange={event => setParams({ team: event.target.value, page: null, ticket: null }, false)}>
            <option value="">Tất cả nhóm của tôi</option>
            {myTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>}
        <label className="w-[calc(50%-6px)] text-[13px] font-medium text-content sm:w-48">Sắp xếp
          <select className={`${FIELD} mt-1 block`} value={sortKey} onChange={event => setParams({ sort: event.target.value })}>
            <option value="sla">Hạn SLA gần nhất</option>
            <option value="newest">Mới tạo trước</option>
          </select>
        </label>
      </div>
      {teamsError != null && <ErrorMessage error={teamsError} title="Chưa xác minh được nhóm để nhận việc" onRetry={() => void loadTeams()} />}
      {feedback}

      {loading ? <LoadingSpinner label="Đang tải hàng đợi phiếu..." /> : error == null && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[13px] text-content-muted" aria-live="polite">
              {filtersActive ? `${visibleRows.length}/${tickets.length} phiếu khớp bộ lọc · ` : ''}{countLabel} · Trang {page}
            </p>
            {tickets.length > 0 && <div role="group" aria-label={`Lọc theo SLA ${scopeNote}`} className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-content-muted">Cần chú ý {scopeNote}:</span>
              {attentionButton('breached', breachedCount, 'quá hạn SLA', 'border-status-danger-border bg-status-danger-bg text-status-danger hover:brightness-95')}
              {attentionButton('at_risk', atRiskCount, 'sắp quá hạn', 'border-status-warning-border bg-status-warning-bg text-status-warning hover:brightness-95')}
            </div>}
          </div>

          {tickets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-edge bg-surface p-6 text-sm">
              <p className="font-semibold text-content">Không có phiếu trong hàng đợi này.</p>
              <p className="mt-1 text-content-muted">{queue === 'my_open' ? 'Bạn chưa phụ trách phiếu nào đang mở. Xem hàng đợi “Nhóm của tôi · Chưa nhận” để nhận việc.' : 'Khi có phiếu mới được chuyển vào nhóm, phiếu sẽ hiện ở đây.'}</p>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-edge bg-surface p-6 text-sm">
              <SearchX className="h-5 w-5 text-content-muted" aria-hidden="true" />
              <p className="flex-1 text-content-muted">Không có phiếu nào {scopeNote} khớp từ khóa hoặc bộ lọc SLA.</p>
              <button type="button" className={BUTTON} onClick={() => setParams({ q: null, sla: null })}>Bỏ lọc</button>
            </div>
          ) : viewMode === 'kanban' ? (
            <TicketKanbanBoard tickets={visibleRows.map(row => row.ticket)} onTicketClick={ticket => navigate(ticketHref(ticket))}
              canClaim={canClaim} busyTicketId={busyId} onClaimTicket={claim} />
          ) : (
            <div className={`grid items-start gap-4 ${selected ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
              <div className="@container min-w-0 overflow-clip rounded-lg border border-edge bg-surface">
                <div aria-hidden="true" className={`hidden gap-x-4 border-b border-edge bg-surface-warm px-4 py-2.5 text-xs font-semibold text-content-muted @3xl:grid ${ROW_GRID}`}>
                  <span>Phiếu</span><span>Ưu tiên</span><span>Trạng thái</span><span>Phụ trách</span><span>SLA</span><span className="sr-only">Thao tác</span>
                </div>
                <ul aria-label="Phiếu trong hàng đợi" className="divide-y divide-edge-subtle">
                  {visibleRows.map(row => <QueueRow key={row.ticket.id} row={row} selected={selected?.ticket.id === row.ticket.id}
                    canClaim={canClaim(row.ticket)} busy={busyId === row.ticket.id} disabled={busyId !== null}
                    onPreview={openPreview} onClaim={claim} />)}
                </ul>
              </div>
              {selected && <PreviewPanel row={selected} headingRef={panelHeadingRef} onClose={closePreview}
                canClaim={canClaim(selected.ticket)} busy={busyId === selected.ticket.id} disabled={busyId !== null} onClaim={claim} />}
            </div>
          )}
          {pagination}
        </>
      )}
    </div>
  );
}

function assigneeLabel(ticket: Ticket) {
  return ticket.assignee_name || ticket.assigned_to || null;
}
function teamLabel(ticket: Ticket) {
  return ticket.team_name || (ticket.assigned_team_id ? 'Nhóm chưa có tên' : 'Chưa gán nhóm');
}

interface RowProps {
  row: Row; selected: boolean; canClaim: boolean; busy: boolean; disabled: boolean;
  onPreview: (ticket: Ticket, trigger: HTMLButtonElement) => void; onClaim: (ticket: Ticket) => void;
}

function QueueRow({ row, selected, canClaim, busy, disabled, onPreview, onClaim }: RowProps) {
  const { ticket, sla, risk } = row;
  const assignee = assigneeLabel(ticket);
  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3 @3xl:items-center @3xl:gap-x-4 ${ROW_GRID} ${
      selected ? 'bg-state-selected' : 'hover:bg-state-hover'}`}>
      <div className="col-span-2 min-w-0 @3xl:col-span-1">
        <button type="button" aria-expanded={selected} aria-controls="queue-preview" onClick={event => onPreview(ticket, event.currentTarget)}
          className={`block max-w-full rounded-sm text-left text-sm font-semibold text-content hover:text-[var(--color-primary-ink)] hover:underline ${FOCUS}`}>
          <span className="break-words">{ticket.title}</span>
        </button>
        <p className="mt-0.5 truncate text-xs text-content-muted">
          <span className="tabular-nums" title={ticket.id}>#{shortId(ticket.id)}</span> · {ticket.requester_name || 'Người yêu cầu chưa có tên'}
        </p>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-2 @3xl:contents">
        <div><PriorityBadge priority={ticket.priority} /></div>
        <div><StatusBadge status={ticket.status} /></div>
      </div>
      <div className="min-w-0">
        <p className={`truncate text-[13px] ${assignee ? 'font-medium text-content' : 'font-semibold text-status-warning'}`}>{assignee ?? 'Chưa có người nhận'}</p>
        <p className="truncate text-xs text-content-muted">{teamLabel(ticket)}</p>
      </div>
      <div className="min-w-0 text-right @3xl:text-left"><SlaRemaining snapshot={sla} risk={risk} /></div>
      {canClaim && <div className="col-span-2 flex justify-end @3xl:col-span-1">
        <button type="button" className={PRIMARY} disabled={disabled} onClick={() => onClaim(ticket)}>
          {busy ? 'Đang nhận phiếu…' : 'Nhận xử lý'}</button>
      </div>}
    </li>
  );
}

interface PanelProps {
  row: Row; headingRef: RefObject<HTMLHeadingElement>; onClose: () => void;
  canClaim: boolean; busy: boolean; disabled: boolean; onClaim: (ticket: Ticket) => void;
}

function PreviewPanel({ row, headingRef, onClose, canClaim, busy, disabled, onClaim }: PanelProps) {
  const { ticket, sla, risk } = row;
  const fields = ticket.request_fields ? Object.entries(ticket.request_fields) : [];
  const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
  const when = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN'); };
  return (
    <aside id="queue-preview" aria-labelledby="queue-preview-title" onKeyDown={onKeyDown}
      className="order-first min-w-0 rounded-lg border border-edge bg-surface xl:sticky xl:top-20 xl:order-none xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b border-edge-subtle px-4 py-3">
        <div className="min-w-0">
          <p className="tabular-nums text-xs text-content-muted" title={ticket.id}>#{shortId(ticket.id)}</p>
          <h2 id="queue-preview-title" ref={headingRef} tabIndex={-1} className="dx-section-title mt-0.5 break-words focus:outline-none">{ticket.title}</h2>
        </div>
        <button type="button" aria-label="Đóng xem nhanh" onClick={onClose} className={`-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-content-muted hover:bg-surface-muted hover:text-content ${FOCUS}`}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2"><PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /></div>
        <div className="flex flex-wrap gap-2">
          {canClaim && <button type="button" className={PRIMARY} disabled={disabled} onClick={() => onClaim(ticket)}>{busy ? 'Đang nhận phiếu…' : 'Nhận xử lý'}</button>}
          <Link className={`${BUTTON} inline-flex items-center gap-1.5`} to={ticketHref(ticket)}>
            Mở chi tiết và lịch sử<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <section aria-label="Thời hạn SLA" className="space-y-2 border-t border-edge-subtle pt-4">
          <SlaRemaining snapshot={sla} risk={risk} size="md" />
          <TicketSlaInfo ticket={ticket} />
        </section>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-edge-subtle pt-4 text-sm">
          <dt className="text-content-muted">Người yêu cầu</dt><dd className="break-words text-content">{ticket.requester_name || ticket.requester_id}</dd>
          <dt className="text-content-muted">Phụ trách</dt><dd className="break-words text-content">{assigneeLabel(ticket) ?? 'Chưa có người nhận'}</dd>
          <dt className="text-content-muted">Nhóm</dt><dd className="break-words text-content">{teamLabel(ticket)}</dd>
          <dt className="text-content-muted">Tạo lúc</dt><dd className="text-content">{when(ticket.created_at)}</dd>
          <dt className="text-content-muted">Cập nhật</dt><dd className="text-content">{when(ticket.updated_at)}</dd>
        </dl>
        <section aria-label="Mô tả" className="border-t border-edge-subtle pt-4">
          <h3 className="text-[13px] font-semibold text-content-muted">Mô tả</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-content">{ticket.description || 'Không có mô tả.'}</p>
        </section>
        {fields.length > 0 && <dl className="space-y-1.5 border-t border-edge-subtle pt-4 text-sm">
          {fields.map(([key, value]) => <div key={key} className="break-words">
            <dt className="text-xs font-semibold text-content-muted">{key}</dt>
            <dd className="text-content">{typeof value === 'string' || typeof value === 'number' ? String(value) : 'Dữ liệu không phải văn bản'}</dd>
          </div>)}
        </dl>}
      </div>
    </aside>
  );
}
