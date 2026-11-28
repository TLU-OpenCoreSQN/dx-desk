// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { FormEvent, KeyboardEvent, ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Kanban, LayoutList, RefreshCw, Search, SearchX, X, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ApiClientError, claimTicket, getCategories, getTeams, getTickets, updateTicketStatus } from '../../services/api';
import { Category, Team, Ticket, TicketFilters, TicketQueue } from '../../types/api';
import { computeSlaSnapshot, slaRisk, SlaRisk, SlaSnapshot } from '../../lib/sla';
import { requestFieldEntries } from '../../lib/requestFields';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { CountBadge, PriorityBadge, StatusBadge } from './Badge';
import { TicketSlaInfo } from './TicketSlaInfo';
import { SlaRemaining } from './SlaRemaining';
import { Button, buttonClass } from './Button';
import { fieldClass } from './FormField';
import { AccessNotice } from './AccessNotice';
import { cellClass, DataTable, DataTableBody, DataTableHead, rowClass, TicketCode, Th } from './DataTable';
import { TicketKanbanBoard } from '../workflow';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const QUEUES: { key: Exclude<TicketQueue, 'pending_approval'>; label: string }[] = [
  { key: 'my_open', label: 'Đang phụ trách' },
  { key: 'team_unassigned', label: 'Nhóm của tôi · Chưa nhận' },
  { key: 'team_assigned', label: 'Nhóm của tôi · Đã nhận' },
];
const QUEUE_KEYS = QUEUES.map(item => item.key) as string[];
type QueueKey = (typeof QUEUES)[number]['key'];
type SlaFilter = 'all' | 'breached' | 'at_risk';
type SortKey = 'sla' | 'newest';

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

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Bảng việc kỹ thuật viên (`approvals=false`) và hàng đợi phê duyệt của Quản lý (`approvals=true`).
 * Tìm kiếm, lọc SLA và xếp "việc gấp trước" chạy phía máy chủ (GET /api/tickets ?q, ?sla, ?sort=sla_due)
 * nên đúng trên toàn bộ hàng đợi, không chỉ 25 phiếu của trang đang xem.
 */
export function TicketQueueView({ approvals = false }: { approvals?: boolean }) {
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
  const viewMode = !approvals && searchParams.get('view') === 'kanban' ? 'kanban' : 'table';
  const sortKey: SortKey = searchParams.get('sort') === 'newest' ? 'newest' : 'sla';
  const rawSla = searchParams.get('sla');
  const slaFilter: SlaFilter = rawSla === 'breached' || rawSla === 'at_risk' ? rawSla : 'all';
  const query = searchParams.get('q') ?? '';
  const serverQuery = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
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
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [total, setTotal] = useState<number | undefined>();
  const [counts, setCounts] = useState<Partial<Record<QueueKey, number>>>({});
  const [attention, setAttention] = useState<{ breached?: number; at_risk?: number }>({});
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

  /** Phạm vi hàng đợi (không gồm bộ lọc SLA), dùng chung cho danh sách và các bộ đếm. */
  const scope = useMemo<TicketFilters>(() => ({
    queue,
    ...(teamId ? { team_id: teamId } : {}),
    ...(serverQuery ? { q: serverQuery } : {}),
  }), [queue, teamId, serverQuery]);

  const loadTickets = useCallback(async () => {
    if (!permitted) return;
    const revision = ++requestRevision.current;
    setLoading(true); setError(null);
    try {
      const response = await getTickets(PAGE_SIZE, offset, {
        ...scope,
        ...(slaFilter !== 'all' ? { sla: slaFilter } : {}),
        ...(sortKey === 'sla' ? { sort: 'sla_due' } : {}),
      });
      if (revision !== requestRevision.current) return;
      setTickets(response.data); setTotal(response.total);
    } catch (err) {
      if (revision !== requestRevision.current) return;
      setTickets([]); setTotal(undefined); setError(err);
    } finally {
      if (revision === requestRevision.current) setLoading(false);
    }
  }, [permitted, offset, scope, slaFilter, sortKey]);

  // Số phiếu từng hàng đợi và số phiếu cần chú ý SLA trên TOÀN hàng đợi (không chỉ trang này).
  // Dùng chính API danh sách (limit=1, đọc `total`); lỗi ở đây chỉ làm mất con số, không chặn trang.
  const loadCounts = useCallback(async () => {
    if (!permitted) return;
    const revision = ++countRevision.current;
    const total = async (filters: TicketFilters) => {
      try { return (await getTickets(1, 0, filters)).total; } catch { return undefined; }
    };
    const [queueTotals, breached, atRisk] = await Promise.all([
      approvals ? Promise.resolve([]) : Promise.all(QUEUES.map(async item =>
        [item.key, await total({ queue: item.key, ...(teamId && item.key !== 'my_open' ? { team_id: teamId } : {}) })] as const)),
      total({ ...scope, sla: 'breached' }),
      total({ ...scope, sla: 'at_risk' }),
    ]);
    if (revision !== countRevision.current) return;
    setCounts(Object.fromEntries(queueTotals.filter(([, value]) => typeof value === 'number')));
    setAttention({ breached, at_risk: atRisk });
  }, [permitted, approvals, teamId, scope]);

  const loadTeams = useCallback(async () => {
    if (!permitted || approvals) return;
    setTeamsError(null);
    try { setTeams((await getTeams()).data); }
    catch (err) { setTeams([]); setTeamsError(err); }
  }, [permitted, approvals]);

  // Danh mục chỉ để đọc nhãn tiếng Việt của trường bổ sung; lỗi thì dùng nhãn dự phòng.
  useEffect(() => {
    if (!permitted) return;
    let active = true;
    getCategories()
      .then(response => { if (active) setCategories(Object.fromEntries((response.data ?? []).map(item => [item.id, item]))); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [permitted]);

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

  // Máy chủ đã lọc và xếp; ở đây chỉ tính ảnh chụp SLA để hiển thị thời gian còn lại theo giờ hiện tại.
  const rows: Row[] = useMemo(() => tickets.map(ticket => {
    const sla = computeSlaSnapshot(ticket, now);
    return { ticket, sla, risk: slaRisk(sla) };
  }), [tickets, now]);
  const selected = selectedId ? rows.find(row => row.ticket.id === selectedId) : undefined;
  const filtersActive = slaFilter !== 'all' || query.trim().length > 0;

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

  const startDecision = (ticket: Ticket, to: 'assigned' | 'new', trigger: HTMLButtonElement) => {
    decisionTrigger.current = trigger;
    setDecision({ ticket, to }); setNote(''); setMutationError(null);
  };
  const cancelDecision = () => {
    const to = decision?.to;
    setDecision(null); setNote('');
    // Nút Duyệt/Từ chối bị gỡ khỏi DOM khi biểu mẫu mở; sau khi vẽ lại mới có nút mới để trả tiêu điểm.
    requestAnimationFrame(() => {
      const trigger = document.querySelector<HTMLButtonElement>(`#queue-preview [data-decision-trigger="${to}"]`);
      (trigger ?? decisionTrigger.current)?.focus();
    });
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

  const openPreview = (ticket: Ticket, trigger: HTMLButtonElement) => {
    previewTrigger.current = trigger;
    if (decision && decision.ticket.id !== ticket.id) { setDecision(null); setNote(''); }
    setParams({ ticket: selectedId === ticket.id ? null : ticket.id });
  };
  const closePreview = () => {
    setDecision(null); setNote('');
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
    <AccessNotice
      message={approvals ? 'Hàng đợi phê duyệt dành cho Quản lý.' : 'Bảng việc dành cho kỹ thuật viên và Quản lý.'}
      backTo="/tickets"
      backLabel="Về danh sách phiếu"
    />
  );

  const pageCount = total !== undefined ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : undefined;
  const hasNext = total === undefined ? tickets.length === PAGE_SIZE : offset + PAGE_SIZE < total;
  const paginated = offset > 0 || hasNext;
  const countLabel = total !== undefined
    ? `${total} phiếu ${filtersActive ? 'khớp bộ lọc' : 'trong hàng đợi'}`
    : `${tickets.length} phiếu trên trang này`;
  const pageLabel = pageCount ? `Trang ${page}/${pageCount}` : `Trang ${page}`;
  const pagination = paginated && (
    <nav aria-label="Phân trang hàng đợi" className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="secondary" disabled={offset === 0 || busyId !== null} onClick={() => changePage(page - 1)}>Trang trước</Button>
      <span data-numeric className="text-[0.8125rem] text-content-muted">{pageLabel}</span>
      <Button variant="secondary" disabled={!hasNext || busyId !== null} onClick={() => changePage(page + 1)}>Trang sau</Button>
    </nav>
  );
  const feedback = <>
    {notice && <p ref={noticeRef} tabIndex={-1} role="status" className="rounded-lg border border-status-info-border bg-status-info-bg p-3 text-sm text-status-info">{notice}</p>}
    {mutationError != null && <ErrorMessage error={mutationError} title="Chưa thực hiện được thao tác" />}
    {error != null && <ErrorMessage error={error} title="Không tải được hàng đợi" onRetry={() => void loadTickets()} />}
  </>;

  const attentionButton = (key: 'breached' | 'at_risk', label: string, tone: string) => {
    const active = slaFilter === key;
    const count = attention[key];
    return (
      <button type="button" aria-pressed={active} disabled={count === 0 && !active}
        onClick={() => setParams({ sla: active ? 'all' : key, page: null, ticket: null })}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-[0.8125rem] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${
          active ? 'border-primary bg-primary text-white' : (count ?? 0) > 0 ? tone : 'border-edge bg-surface text-content-muted'}`}>
        <span data-numeric>{count ?? '–'}</span> {label}
      </button>
    );
  };

  const toolbar = (
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 basis-56 text-[0.8125rem] font-medium text-content">
        {approvals ? 'Tìm trong hàng đợi phê duyệt' : 'Tìm trong hàng đợi'}
        <span className="relative mt-1 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
          <input type="search" value={searchInput} placeholder="Tiêu đề, mã phiếu, người yêu cầu…" className={`${fieldClass(false)} pl-9`}
            onChange={event => { setSearchInput(event.target.value); setParams({ q: event.target.value, page: null, ticket: null }); }} />
        </span>
      </label>
      {!approvals && queue !== 'my_open' && <label className="w-[calc(50%-6px)] text-[0.8125rem] font-medium text-content sm:w-56">Nhóm xử lý
        <select className={`${fieldClass(false)} mt-1 block`} value={teamId} disabled={busyId !== null}
          onChange={event => setParams({ team: event.target.value, page: null, ticket: null }, false)}>
          <option value="">Tất cả nhóm của tôi</option>
          {myTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>}
      <label className="w-[calc(50%-6px)] text-[0.8125rem] font-medium text-content sm:w-48">Sắp xếp
        <select className={`${fieldClass(false)} mt-1 block`} value={sortKey} onChange={event => setParams({ sort: event.target.value, page: null })}>
          <option value="sla">Hạn SLA gần nhất</option>
          <option value="newest">Mới tạo trước</option>
        </select>
      </label>
    </div>
  );

  const summary = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-[0.8125rem] text-content-muted" aria-live="polite">{countLabel} · {pageLabel}</p>
      <div role="group" aria-label="Lọc theo SLA trên toàn hàng đợi" className="flex flex-wrap items-center gap-2">
        <span className="text-[0.8125rem] text-content-muted">Cần chú ý:</span>
        {attentionButton('breached', 'quá hạn SLA', 'border-status-danger-border bg-status-danger-bg text-status-danger hover:bg-surface')}
        {attentionButton('at_risk', 'sắp quá hạn', 'border-status-warning-border bg-status-warning-bg text-status-warning hover:bg-surface')}
      </div>
    </div>
  );

  const emptyState = tickets.length === 0 && !filtersActive ? (
    <div className="rounded-lg border border-dashed border-edge bg-surface p-6 text-sm">
      <p className="font-semibold text-content">Không có phiếu trong hàng đợi này.</p>
      <p className="mt-1 text-content-muted">{approvals
        ? 'Khi có phiếu cần Quản lý quyết định, phiếu sẽ hiện ở đây.'
        : queue === 'my_open' ? 'Bạn chưa phụ trách phiếu nào đang mở. Xem hàng đợi “Nhóm của tôi · Chưa nhận” để nhận việc.' : 'Khi có phiếu mới được chuyển vào nhóm, phiếu sẽ hiện ở đây.'}</p>
    </div>
  ) : tickets.length === 0 ? (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-edge bg-surface p-6 text-sm">
      <SearchX className="h-5 w-5 text-content-muted" aria-hidden="true" />
      <p className="flex-1 text-content-muted">Không có phiếu nào khớp từ khóa hoặc bộ lọc SLA.</p>
      <Button variant="secondary" onClick={() => setParams({ q: null, sla: null, page: null })}>Bỏ lọc</Button>
    </div>
  ) : null;

  const table = (
    <div className={`grid items-start gap-4 ${selected ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
      <DataTable label="Phiếu trong hàng đợi">
        <DataTableHead>
          <Th width="w-24">Mã</Th>
          <Th>Tiêu đề</Th>
          <Th width="w-32">Ưu tiên</Th>
          {approvals ? <Th width="w-44">Nhóm</Th> : <Th width="w-40">Trạng thái</Th>}
          {!approvals && <Th width="w-40">Phụ trách</Th>}
          <Th width="w-44">Hạn SLA</Th>
          {!approvals && <Th width="w-32" srOnly>Thao tác</Th>}
        </DataTableHead>
        <DataTableBody>
          {rows.map(row => <QueueRow key={row.ticket.id} row={row} approvals={approvals}
            selected={selected?.ticket.id === row.ticket.id} canClaim={canClaim(row.ticket)}
            busy={busyId === row.ticket.id} disabled={busyId !== null} onPreview={openPreview} onClaim={claim} />)}
        </DataTableBody>
      </DataTable>
      {selected && <PreviewPanel row={selected} category={categories[selected.ticket.category_id]} headingRef={panelHeadingRef}
        onClose={closePreview} canClaim={canClaim(selected.ticket)} busy={busyId === selected.ticket.id} disabled={busyId !== null}
        onClaim={claim}>
        {approvals && selected.ticket.status === 'pending_approval' && (
          <DecisionPanel ticket={selected.ticket} decision={decision?.ticket.id === selected.ticket.id ? decision.to : null}
            note={note} busy={busyId === selected.ticket.id} disabled={busyId !== null} noteRef={decisionRef}
            onStart={startDecision} onNote={setNote} onCancel={cancelDecision} onSubmit={confirmDecision} />
        )}
      </PreviewPanel>}
    </div>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="dx-page-title">{approvals ? 'Phê duyệt phiếu hỗ trợ' : 'Bảng việc kỹ thuật viên'}</h1>
          <p className="mt-1 text-sm text-content-muted">{approvals
            ? 'Phiếu hỗ trợ đang chờ quyết định; chọn một phiếu để xem đủ ngữ cảnh rồi duyệt hoặc từ chối. Yêu cầu cấp thiết bị được quản lý riêng.'
            : 'Phiếu quá hạn và sắp quá hạn SLA được xếp lên đầu trên toàn hàng đợi.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!approvals && <div role="group" aria-label="Chế độ xem hàng đợi" className="inline-flex rounded-md border border-edge bg-surface p-0.5">
            {([['table', 'Bảng danh sách', LayoutList], ['kanban', 'Kanban luồng việc', Kanban]] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" aria-pressed={viewMode === key} onClick={() => setParams({ view: key })}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  viewMode === key ? 'bg-primary text-white' : 'text-content-muted hover:bg-state-hover hover:text-content'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{label}
              </button>
            ))}
          </div>}
          <Button variant="secondary" disabled={loading || busyId !== null} onClick={refresh} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Làm mới hàng đợi
          </Button>
        </div>
      </header>

      {!approvals && <div className="-mx-1 overflow-x-auto overflow-y-hidden border-b border-edge px-1">
        <div role="group" aria-label="Hàng đợi công việc" className="flex min-w-max gap-1">
          {QUEUES.map(item => {
            const active = queue === item.key;
            const count = active && total !== undefined && !filtersActive ? total : counts[item.key];
            const needsOwner = item.key === 'team_unassigned' && (count ?? 0) > 0;
            return (
              <button key={item.key} type="button" aria-pressed={active} disabled={busyId !== null} onClick={() => changeQueue(item.key)}
                className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
                  active ? 'border-primary font-semibold text-content' : 'border-transparent text-content-muted hover:text-content'}`}>
                {item.label}
                {count !== undefined && <span className={needsOwner ? 'rounded-full bg-status-warning-bg px-1.5 py-0.5 text-xs font-medium tabular-nums text-status-warning' : ''}>
                  <span className="sr-only">: </span>{needsOwner ? count : <CountBadge value={count} active={active} />}<span className="sr-only"> phiếu</span>
                </span>}
              </button>
            );
          })}
        </div>
      </div>}

      {toolbar}
      {teamsError != null && <ErrorMessage error={teamsError} title="Chưa xác minh được nhóm để nhận việc" onRetry={() => void loadTeams()} />}
      {feedback}

      {loading ? <LoadingSpinner label="Đang tải hàng đợi phiếu..." /> : error == null && (
        <>
          {summary}
          {emptyState ?? (viewMode === 'kanban' ? (
            <TicketKanbanBoard tickets={tickets} ticketHref={ticketHref}
              canClaim={canClaim} busyTicketId={busyId} onClaimTicket={claim} />
          ) : table)}
          {pagination}
        </>
      )}
    </div>
  );
}

function assigneeLabel(ticket: Ticket) {
  return ticket.assignee_name || null;
}
function teamLabel(ticket: Ticket) {
  return ticket.team_name || (ticket.assigned_team_id ? 'Nhóm chưa có tên' : 'Chưa gán nhóm');
}

interface RowProps {
  row: Row; approvals: boolean; selected: boolean; canClaim: boolean; busy: boolean; disabled: boolean;
  onPreview: (ticket: Ticket, trigger: HTMLButtonElement) => void; onClaim: (ticket: Ticket) => void;
}

function QueueRow({ row, approvals, selected, canClaim, busy, disabled, onPreview, onClaim }: RowProps) {
  const { ticket, sla, risk } = row;
  const assignee = assigneeLabel(ticket);
  return (
    <tr className={rowClass(selected)}>
      <td className={`${cellClass()} order-2 @3xl:order-none`}><TicketCode id={ticket.id} /></td>
      <td className={`${cellClass({ span: true })} order-1 @3xl:order-none`}>
        <button type="button" aria-expanded={selected} aria-controls="queue-preview" onClick={event => onPreview(ticket, event.currentTarget)}
          className="block max-w-full rounded-sm text-left text-sm font-semibold text-content hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span className="break-words">{ticket.title}</span>
        </button>
        <p className="mt-0.5 truncate text-xs text-content-muted">{ticket.requester_name || 'Người yêu cầu chưa có tên'}</p>
      </td>
      <td className={`${cellClass()} order-3 @3xl:order-none`}><PriorityBadge priority={ticket.priority} /></td>
      {approvals ? (
        <td className={`${cellClass()} order-4 truncate text-[0.8125rem] text-content @3xl:order-none`}>{teamLabel(ticket)}</td>
      ) : (
        <td className={`${cellClass()} order-4 @3xl:order-none`}><StatusBadge status={ticket.status} /></td>
      )}
      {!approvals && <td className={`${cellClass()} order-5 @3xl:order-none`}>
        <p className={`truncate text-[0.8125rem] ${assignee ? 'font-medium text-content' : 'font-semibold text-status-warning'}`}>{assignee ?? 'Chưa có người nhận'}</p>
        <p className="truncate text-xs text-content-muted">{teamLabel(ticket)}</p>
      </td>}
      <td className={`${cellClass()} order-6 @3xl:order-none`}><SlaRemaining snapshot={sla} risk={risk} /></td>
      {!approvals && <td className={`${cellClass({ align: 'right', span: !canClaim ? false : true })} order-7 @3xl:order-none`}>
        {canClaim && <Button size="sm" disabled={disabled} onClick={() => onClaim(ticket)}>
          {busy ? 'Đang nhận phiếu…' : 'Nhận xử lý'}</Button>}
      </td>}
    </tr>
  );
}

interface DecisionProps {
  ticket: Ticket; decision: 'assigned' | 'new' | null; note: string; busy: boolean; disabled: boolean;
  noteRef: RefObject<HTMLTextAreaElement>;
  onStart: (ticket: Ticket, to: 'assigned' | 'new', trigger: HTMLButtonElement) => void;
  onNote: (value: string) => void; onCancel: () => void; onSubmit: (event: FormEvent) => void;
}

/** Quyết định phê duyệt trong khung xem nhanh: xác nhận hai bước, từ chối bắt buộc lý do 5–2000 ký tự. */
function DecisionPanel({ ticket, decision, note, busy, disabled, noteRef, onStart, onNote, onCancel, onSubmit }: DecisionProps) {
  if (!decision) return (
    <div className="flex flex-wrap gap-2">
      <Button data-decision-trigger="assigned" disabled={disabled} leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={event => onStart(ticket, 'assigned', event.currentTarget)}>Duyệt phiếu</Button>
      <Button data-decision-trigger="new" variant="dangerOutline" disabled={disabled} leftIcon={<XCircle className="h-4 w-4" />} onClick={event => onStart(ticket, 'new', event.currentTarget)}>Từ chối phiếu</Button>
    </div>
  );
  const rejecting = decision === 'new';
  const tooShort = rejecting && note.trim().length < 5;
  return (
    <form onSubmit={onSubmit} aria-label={rejecting ? 'Xác nhận từ chối' : 'Xác nhận phê duyệt'}
      className="space-y-3 rounded-lg border border-edge bg-surface-muted p-3">
      <p className="text-sm font-semibold text-content">{rejecting ? 'Xác nhận từ chối và trả phiếu về trạng thái mới?' : 'Xác nhận duyệt và chuyển phiếu vào nhóm xử lý?'}</p>
      <label className="block text-[0.8125rem] font-medium text-content">Lý do quyết định {rejecting ? '(bắt buộc, 5–2000 ký tự)' : '(không bắt buộc)'}
        <textarea ref={noteRef} value={note} maxLength={2000} required={rejecting}
          aria-invalid={rejecting && note.length > 0 && tooShort} disabled={disabled}
          className={`${fieldClass(rejecting && note.length > 0 && tooShort)} mt-1 block min-h-24`} onChange={event => onNote(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={rejecting ? 'danger' : 'primary'} disabled={disabled || tooShort}>{busy ? 'Đang gửi quyết định…' : 'Xác nhận quyết định'}</Button>
        <Button variant="secondary" disabled={disabled} onClick={onCancel}>Hủy quyết định</Button>
      </div>
    </form>
  );
}

interface PanelProps {
  row: Row; category?: Category; headingRef: RefObject<HTMLHeadingElement>; onClose: () => void;
  canClaim: boolean; busy: boolean; disabled: boolean; onClaim: (ticket: Ticket) => void; children?: ReactNode;
}

function PreviewPanel({ row, category, headingRef, onClose, canClaim, busy, disabled, onClaim, children }: PanelProps) {
  const { ticket, sla, risk } = row;
  const fields = requestFieldEntries(ticket.request_fields, category);
  const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
  const when = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN'); };
  return (
    <aside id="queue-preview" aria-labelledby="queue-preview-title" onKeyDown={onKeyDown}
      className="order-first min-w-0 rounded-lg border border-edge bg-surface xl:sticky xl:top-20 xl:order-none xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b border-edge px-4 py-3">
        <div className="min-w-0">
          <TicketCode id={ticket.id} />
          <h2 id="queue-preview-title" ref={headingRef} tabIndex={-1} className="dx-section-title mt-0.5 break-words focus-visible:outline-none">{ticket.title}</h2>
        </div>
        <button type="button" aria-label="Đóng xem nhanh" onClick={onClose} className="-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-content-muted hover:bg-surface-muted hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2"><PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /></div>
        {children}
        <div className="flex flex-wrap gap-2">
          {canClaim && <Button disabled={disabled} onClick={() => onClaim(ticket)}>{busy ? 'Đang nhận phiếu…' : 'Nhận xử lý'}</Button>}
          <Link className={`${buttonClass('secondary')} gap-1.5`} to={ticketHref(ticket)}>
            Mở chi tiết và lịch sử<ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <section aria-label="Thời hạn SLA" className="space-y-2 border-t border-edge pt-4">
          <SlaRemaining snapshot={sla} risk={risk} size="md" />
          <TicketSlaInfo ticket={ticket} />
        </section>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-edge pt-4 text-sm">
          <dt className="text-content-muted">Người yêu cầu</dt><dd className="break-words text-content">{ticket.requester_name || 'Người yêu cầu chưa có tên'}</dd>
          <dt className="text-content-muted">Phụ trách</dt><dd className="break-words text-content">{assigneeLabel(ticket) ?? 'Chưa có người nhận'}</dd>
          <dt className="text-content-muted">Nhóm</dt><dd className="break-words text-content">{teamLabel(ticket)}</dd>
          {category && <><dt className="text-content-muted">Danh mục</dt><dd className="break-words text-content">{category.name}</dd></>}
          <dt className="text-content-muted">Tạo lúc</dt><dd data-numeric className="text-content">{when(ticket.created_at)}</dd>
          <dt className="text-content-muted">Cập nhật</dt><dd data-numeric className="text-content">{when(ticket.updated_at)}</dd>
        </dl>
        <section aria-labelledby="queue-preview-description" className="border-t border-edge pt-4">
          <h3 id="queue-preview-description" className="text-[0.8125rem] font-semibold text-content-muted">Mô tả</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-content">{ticket.description || 'Không có mô tả.'}</p>
        </section>
        {fields.length > 0 && <section aria-labelledby="queue-preview-fields" className="border-t border-edge pt-4">
          <h3 id="queue-preview-fields" className="text-[0.8125rem] font-semibold text-content-muted">Thông tin bổ sung</h3>
          <dl className="mt-1.5 space-y-1.5 text-sm">
            {fields.map(field => <div key={field.key} className="break-words">
              <dt className="text-xs font-medium text-content-muted">{field.label}</dt>
              <dd className="text-content">{field.value}</dd>
            </div>)}
          </dl>
        </section>}
      </div>
    </aside>
  );
}
