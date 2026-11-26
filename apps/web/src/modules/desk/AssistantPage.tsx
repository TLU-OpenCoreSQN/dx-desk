// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Check,
  LoaderCircle,
  MessageSquare,
  PanelLeft,
  Pencil,
  Plus,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { ApiClientError } from '../../services/api';
import { AssistantTurn } from './AssistantTurn';
import {
  createAssistantSession,
  decideAssistantProposal,
  deleteAssistantSession,
  getAssistantSession,
  listAssistantSessions,
  renameAssistantSession,
  streamAssistant,
  type AssistantEvent,
  type AssistantSession,
  type AssistantTurn as Turn,
} from './assistantApi';

const iconButton =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-content-muted hover:bg-surface-muted hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40';

function applyEvent(turn: Turn, event: AssistantEvent): Turn {
  switch (event.type) {
    case 'delta':
      return { ...turn, answer: turn.answer + event.text };
    case 'step':
      return { ...turn, metadata: { ...turn.metadata, steps: [...turn.metadata.steps, event.label] } };
    case 'sources':
      return { ...turn, metadata: { ...turn.metadata, sources: event.items } };
    case 'proposal':
      return { ...turn, metadata: { ...turn.metadata, proposal: event } };
    case 'done':
      return { ...turn, status: 'complete' };
    default:
      return turn;
  }
}

export function AssistantPage() {
  const inputId = useId();
  const [params, setParams] = useSearchParams();
  const routeSession = params.get('chat');
  const [selected, setSelected] = useState(routeSession);
  const selection = useRef(selected);
  selection.current = selected;
  const skipInitialLoad = useRef<string | null>(null);
  const [sessions, setSessions] = useState<AssistantSession[]>([]);
  const [moreSessions, setMoreSessions] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [moreTurns, setMoreTurns] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingTurns, setLoadingTurns] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [removing, setRemoving] = useState<AssistantSession | null>(null);
  const stream = useRef<AbortController | null>(null);
  const listRevision = useRef(0);
  const turnRevision = useRef(0);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const question = drafts[selected ?? 'new'] ?? '';
  const session = sessions.find((item) => item.id === selected);
  const remotePending = turns.some((turn) => turn.status === 'pending');

  useEffect(() => setSelected(routeSession), [routeSession]);

  function selectConversation(id: string | null) {
    selection.current = id;
    setSelected(id);
    setParams(id ? { chat: id } : {});
  }

  const refreshSessions = useCallback(async () => {
    const revision = ++listRevision.current;
    const response = await listAssistantSessions();
    if (revision !== listRevision.current) return;
    setSessions(response.data);
    setMoreSessions(response.has_more);
  }, []);

  useEffect(() => {
    let mounted = true;
    refreshSessions()
      .catch((failure) => {
        if (mounted) setError(failure.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      listRevision.current++;
      stream.current?.abort();
      stream.current = null;
    };
  }, [refreshSessions]);

  useEffect(() => {
    if (skipInitialLoad.current === selected && selected) {
      skipInitialLoad.current = null;
      return;
    }
    turnRevision.current++;
    stream.current?.abort();
    stream.current = null;
    setBusy(false);
    setConfirming(false);
    setTurns([]);
    setMoreTurns(false);
    setError('');
    setSidebarOpen(false);
    follow.current = true;
    if (!selected) {
      setLoadingTurns(false);
      return;
    }
    const request = new AbortController();
    setLoadingTurns(true);
    getAssistantSession(selected, request.signal)
      .then((detail) => {
        if (request.signal.aborted) return;
        setTurns(detail.turns);
        setMoreTurns(detail.has_more);
        setSessions((items) =>
          items.some((item) => item.id === detail.session.id) ? items : [detail.session, ...items],
        );
      })
      .catch((failure) => {
        if (!request.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!request.signal.aborted) setLoadingTurns(false);
      });
    return () => request.abort();
  }, [selected]);

  useEffect(() => {
    if (!selected || busy || !remotePending) return;
    const request = new AbortController();
    const timer = window.setTimeout(() => {
      getAssistantSession(selected, request.signal)
        .then((detail) => {
          if (!request.signal.aborted) {
            setTurns(detail.turns);
            setMoreTurns(detail.has_more);
          }
        })
        .catch((failure) => {
          if (!request.signal.aborted) setError(failure.message);
        });
    }, 1500);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [selected, busy, remotePending, turns]);

  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [turns, busy]);

  function update(id: string, change: (turn: Turn) => Turn) {
    setTurns((items) => items.map((turn) => (turn.id === id ? change(turn) : turn)));
  }

  async function newConversation() {
    if (mutating) return;
    const previous = selection.current;
    setMutating(true);
    setError('');
    try {
      const created = await createAssistantSession();
      setSessions((items) => [created, ...items]);
      if (selection.current === previous) selectConversation(created.id);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setMutating(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || stream.current || remotePending || mutating || loadingTurns) return;
    let id = selected;
    if (!id) {
      setMutating(true);
      try {
        const created = await createAssistantSession();
        setSessions((items) => [created, ...items]);
        if (selection.current !== null) {
          setDrafts((items) => ({ ...items, [created.id]: text }));
          return;
        }
        id = created.id;
        skipInitialLoad.current = id;
        selection.current = id;
        selectConversation(id);
      } catch (failure) {
        setError((failure as Error).message);
        return;
      } finally {
        setMutating(false);
      }
    }
    const request = new AbortController();
    const requestId = crypto.randomUUID();
    const revision = ++turnRevision.current;
    stream.current = request;
    setBusy(true);
    setError('');
    setSidebarOpen(false);
    setDrafts((items) => ({ ...items, [id]: '', ...(selected ? {} : { new: '' }) }));
    follow.current = true;
    setTurns((items) => [
      ...items,
      {
        id: requestId,
        question: text,
        answer: '',
        status: 'pending',
        created_at: new Date().toISOString(),
        metadata: { steps: [], sources: [] },
      },
    ]);
    let sendFailure: string | undefined;
    try {
      await streamAssistant(
        text,
        request.signal,
        (event) => {
          if (selection.current !== id) return;
          if (event.type === 'turn' && event.title)
            setSessions((items) =>
              items.map((item) => (item.id === id ? { ...item, title: event.title! } : item)),
            );
          update(requestId, (turn) => applyEvent(turn, event));
        },
        { session_id: id, request_id: requestId },
      );
    } catch (failure) {
      sendFailure = (failure as Error).message;
      if (selection.current === id)
        update(requestId, (turn) => ({
          ...turn,
          status: request.signal.aborted ? 'interrupted' : 'error',
          metadata: {
            ...turn.metadata,
            ...(!request.signal.aborted ? { error: (failure as Error).message } : {}),
          },
        }));
    } finally {
      if (stream.current === request) {
        stream.current = null;
        setBusy(false);
        if (selection.current === id) {
          try {
            const detail = await getAssistantSession(id);
            if (selection.current === id && turnRevision.current === revision) {
              setTurns(detail.turns);
              setMoreTurns(detail.has_more);
              if (sendFailure && !detail.turns.some((turn) => turn.id === requestId)) {
                setDrafts((items) => ({ ...items, [id]: items[id] || text }));
                if (!request.signal.aborted) setError(sendFailure);
              }
            }
          } catch (failure) {
            if (selection.current === id) setError((failure as Error).message);
          }
        }
        refreshSessions().catch(() => undefined);
      }
    }
  }

  const decide = useCallback(
    async (turn: Turn, approve: boolean) => {
      const proposal = turn.metadata.proposal;
      if (!proposal || busy || mutating) return;
      turnRevision.current++;
      const request = new AbortController();
      stream.current = request;
      setBusy(true);
      setConfirming(true);
      try {
        const decision = await decideAssistantProposal(proposal.id, approve, request.signal);
        update(turn.id, (item) => ({
          ...item,
          metadata: {
            ...item.metadata,
            error: undefined,
            proposal: {
              ...proposal,
              status: decision.status === 'cancelled' ? 'cancelled' : 'applied',
              result: decision.result,
            },
          },
        }));
      } catch (failure) {
        if (!request.signal.aborted) {
          const expired = failure instanceof ApiClientError && [404, 409, 410].includes(failure.statusCode);
          update(turn.id, (item) => ({
            ...item,
            metadata: {
              ...item.metadata,
              error: (failure as Error).message,
              proposal: expired ? { ...proposal, expires_at: new Date(0).toISOString() } : proposal,
            },
          }));
        }
      } finally {
        if (stream.current === request) {
          stream.current = null;
          setBusy(false);
          setConfirming(false);
        }
      }
    },
    [busy, mutating],
  );

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (!editing || !title.trim() || mutating) return;
    setMutating(true);
    try {
      const renamed = await renameAssistantSession(editing, title.trim());
      setSessions((items) => items.map((item) => (item.id === renamed.id ? renamed : item)));
      setEditing(null);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setMutating(false);
    }
  }

  async function remove() {
    if (!removing || mutating) return;
    setMutating(true);
    try {
      await deleteAssistantSession(removing.id);
      if (selection.current === removing.id) {
        stream.current?.abort();
        selection.current = null;
        selectConversation(null);
      }
      setSessions((items) => items.filter((item) => item.id !== removing.id));
      setDrafts((items) => {
        const next = { ...items };
        delete next[removing.id];
        return next;
      });
      setRemoving(null);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setMutating(false);
    }
  }

  async function olderTurns() {
    if (!selected || !turns[0]?.ordinal || mutating) return;
    setMutating(true);
    try {
      const height = scroll.current?.scrollHeight ?? 0;
      const detail = await getAssistantSession(selected, undefined, turns[0].ordinal);
      if (selection.current !== selected) return;
      follow.current = false;
      setTurns((items) => [...detail.turns, ...items]);
      setMoreTurns(detail.has_more);
      requestAnimationFrame(() => {
        if (scroll.current) scroll.current.scrollTop += scroll.current.scrollHeight - height;
      });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setMutating(false);
    }
  }

  async function olderSessions() {
    if (mutating) return;
    setMutating(true);
    try {
      const response = await listAssistantSessions(undefined, sessions.length);
      setSessions((items) => [
        ...items,
        ...response.data.filter((item) => !items.some((old) => old.id === item.id)),
      ]);
      setMoreSessions(response.has_more);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setMutating(false);
    }
  }

  return (
    <section
      aria-label="Trợ lý AI"
      className="relative flex h-[calc(100dvh-9rem)] min-h-[32rem] overflow-hidden rounded-2xl border border-edge bg-surface text-content shadow-sm"
    >
      {sidebarOpen && (
        <button
          aria-label="Đóng lịch sử hội thoại"
          onClick={() => setSidebarOpen(false)}
          className="absolute inset-0 z-10 bg-black/20 lg:hidden"
        />
      )}
      <aside
        aria-label="Lịch sử hội thoại"
        className={`${sidebarOpen ? 'absolute inset-y-0 left-0 z-20 flex' : 'hidden'} w-64 shrink-0 flex-col border-r border-edge bg-surface lg:static lg:flex`}
      >
        <div className="flex items-center justify-between gap-2 p-3">
          <button
            onClick={() => void newConversation()}
            disabled={mutating}
            className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-edge px-3 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50"
          >
            <Plus size={18} />
            Cuộc trò chuyện mới
          </button>
          <button
            className={iconButton + ' lg:hidden'}
            aria-label="Đóng lịch sử hội thoại"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Các cuộc trò chuyện" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {loading && (
            <p role="status" className="p-3 text-xs text-content-muted">
              Đang tải hội thoại…
            </p>
          )}
          {!loading && !sessions.length && (
            <p className="px-3 py-6 text-sm text-content-muted">Chưa có cuộc trò chuyện nào.</p>
          )}
          {sessions.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center gap-1 rounded-xl p-1 ${selected === item.id ? 'bg-primary-tint' : 'hover:bg-surface-muted'}`}
            >
              {editing === item.id ? (
                <form onSubmit={(event) => void rename(event)} className="flex min-w-0 flex-1 gap-1">
                  <input
                    autoFocus
                    aria-label="Tên cuộc trò chuyện"
                    maxLength={100}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setEditing(null);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-2 text-sm"
                  />
                  <button
                    className={iconButton}
                    aria-label="Lưu tên cuộc trò chuyện"
                    disabled={mutating || !title.trim()}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label="Hủy đổi tên"
                    onClick={() => setEditing(null)}
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <>
                  <button
                    aria-current={selected === item.id ? 'page' : undefined}
                    title={item.title}
                    onClick={() => selectConversation(item.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-sm"
                  >
                    <MessageSquare size={15} className="shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </button>
                  <button
                    className={iconButton}
                    aria-label={'Đổi tên ' + item.title}
                    onClick={() => {
                      setEditing(item.id);
                      setTitle(item.title);
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className={iconButton}
                    aria-label={'Xóa ' + item.title}
                    onClick={() => setRemoving(item)}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
          {moreSessions && (
            <button
              onClick={() => void olderSessions()}
              disabled={mutating}
              className="w-full rounded-lg p-3 text-xs text-primary"
            >
              Tải thêm hội thoại
            </button>
          )}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-2 border-b border-edge px-4">
          <button
            className={iconButton + ' lg:hidden'}
            aria-label="Mở lịch sử hội thoại"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{session?.title ?? 'Trợ lý AI'}</h1>
            {selected && <p className="text-xs text-content-muted">Trợ lý AI</p>}
          </div>
        </header>
        {error && (
          <p role="alert" className="mx-4 mt-3 rounded-lg border border-edge px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div
          ref={scroll}
          onScroll={() => {
            const area = scroll.current;
            if (area) follow.current = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
          }}
          className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6"
        >
          <div className="mx-auto max-w-3xl">
            {loadingTurns ? (
              <p
                role="status"
                className="flex items-center justify-center gap-2 py-16 text-sm text-content-muted"
              >
                <LoaderCircle size={18} className="animate-spin" />
                Đang tải tin nhắn…
              </p>
            ) : (
              <>
                {moreTurns && (
                  <button
                    onClick={() => void olderTurns()}
                    disabled={mutating}
                    className="mx-auto mt-4 block rounded-lg border border-edge px-4 py-2 text-xs text-primary"
                  >
                    Tải tin nhắn cũ
                  </button>
                )}
                {!turns.length && (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 py-12 text-center">
                    <MessageSquare size={28} className="text-primary" />
                    <h2 className="text-xl font-semibold">Bạn cần hỗ trợ việc gì?</h2>
                    <p className="max-w-sm text-sm leading-6 text-content-muted">
                      Hỏi về sự cố IT hoặc tiếp tục trao đổi trong cuộc trò chuyện của bạn.
                    </p>
                  </div>
                )}
                <ol aria-label="Tin nhắn trong cuộc trò chuyện" className="divide-y divide-edge/50">
                  {turns.map((turn) => (
                    <AssistantTurn
                      key={turn.id}
                      turn={turn}
                      busy={busy || mutating || remotePending}
                      onDecide={decide}
                    />
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-edge bg-surface px-4 py-3 sm:px-6">
          <form
            onSubmit={(event) => void submit(event)}
            className="mx-auto max-w-3xl rounded-2xl border border-edge bg-background p-3 focus-within:border-primary"
          >
            <label htmlFor={inputId} className="sr-only">
              Câu hỏi hỗ trợ IT
            </label>
            <textarea
              id={inputId}
              placeholder="Nhập tin nhắn…"
              rows={2}
              maxLength={8000}
              value={question}
              onChange={(event) =>
                setDrafts((items) => ({ ...items, [selected ?? 'new']: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="max-h-48 min-h-14 w-full resize-y bg-transparent text-sm leading-6 outline-none"
            />
            <div className="flex items-center justify-between gap-3">
              <p role="status" className="text-xs text-content-muted">
                {confirming
                  ? 'Đang xác nhận hành động…'
                  : busy
                    ? 'Trợ lý đang xử lý…'
                    : remotePending
                      ? 'Đang chờ phiên trả lời hiện tại kết thúc…'
                      : 'Enter để gửi · Shift + Enter để xuống dòng'}
              </p>
              {confirming ? (
                <button
                  disabled
                  aria-label="Đang xác nhận hành động"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white"
                >
                  <LoaderCircle size={17} className="animate-spin" />
                </button>
              ) : busy ? (
                <button
                  type="button"
                  aria-label="Dừng trả lời"
                  onClick={() => stream.current?.abort()}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-content text-surface"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  aria-label="Gửi câu hỏi"
                  disabled={!question.trim() || mutating || remotePending || loadingTurns}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-40"
                >
                  <Send size={17} />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      <Modal
        isOpen={Boolean(removing)}
        onClose={() => {
          if (!mutating) setRemoving(null);
        }}
        title="Xóa cuộc trò chuyện?"
        size="sm"
      >
        <p className="text-sm leading-6">Xóa “{removing?.title}” cùng toàn bộ tin nhắn và ngữ cảnh đã lưu?</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            disabled={mutating}
            onClick={() => setRemoving(null)}
            className="min-h-10 rounded-lg border border-edge px-4 text-sm"
          >
            Hủy
          </button>
          <button
            disabled={mutating}
            onClick={() => void remove()}
            className="min-h-10 rounded-lg bg-danger px-4 text-sm font-semibold text-white"
          >
            Xóa cuộc trò chuyện
          </button>
        </div>
      </Modal>
    </section>
  );
}
