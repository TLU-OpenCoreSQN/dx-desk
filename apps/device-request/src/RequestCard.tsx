// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useState } from 'react';
import { handoverUrl, listEvents, transition } from './rest';
import { actionsFor, DEVICE_LABELS, formatTime, shortId, STATUS_LABELS, STEPS, validateNote,
  type Action, type CurrentUser, type DeviceRequest, type DeviceRequestEvent, type DeviceStatus } from './workflow';

const STATUS_STYLES: Record<DeviceStatus, string> = {
  pending: 'border-warning-edge bg-warning-tint text-warning',
  approved: 'border-primary-edge bg-primary-tint text-primary-text',
  preparing: 'border-primary-edge bg-primary-tint text-primary-text',
  handed_over: 'border-success-edge bg-success-tint text-success',
  rejected: 'border-danger-edge bg-danger-tint text-danger',
};

export function RequestCard({ request, user, onChanged }: { request: DeviceRequest; user: CurrentUser;
  onChanged: (request: DeviceRequest) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<DeviceRequestEvent[] | null>(null);
  const actions = actionsFor(request, user);
  const step = STEPS.indexOf(request.status);

  async function run(action: Action, reason?: string) {
    setBusy(true);
    setFailure(null);
    try {
      onChanged(await transition(request.id, action.to, reason));
      setRejecting(false);
      setNote('');
      if (events) setEvents(await listEvents(request.id));
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function choose(action: Action) {
    if (!action.needsNote) return void run(action);
    if (!rejecting) return setRejecting(true);
    const problem = validateNote(note);
    setNoteError(problem);
    if (!problem) void run(action, note);
  }
  async function download() {
    setBusy(true);
    setFailure(null);
    try {
      window.location.assign(await handoverUrl(request.id));
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleHistory() {
    if (events) return setEvents(null);
    try { setEvents(await listEvents(request.id)); } catch (error) { setFailure((error as Error).message); }
  }

  return (
    <article aria-label={`Đề nghị ${shortId(request.id)}`} className="rounded-lg border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{DEVICE_LABELS[request.device_type]} × {request.quantity}</h3>
          <p className="text-xs text-muted">
            Mã {shortId(request.id)} · gửi {formatTime(request.created_at)} · đơn vị {request.department}
          </p>
        </div>
        <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[request.status]}`}>
          {STATUS_LABELS[request.status]}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{request.reason}</p>
      {request.status === 'rejected' && request.decision_note && (
        <p className="mt-2 rounded-md bg-danger-tint p-2 text-sm text-danger">Lý do từ chối: {request.decision_note}</p>
      )}
      {request.status !== 'rejected' && (
        <ol className="mt-3 grid grid-cols-4 gap-1 text-[11px]" aria-label="Tiến trình">
          {['Gửi đề nghị', 'Quản lý duyệt', 'IT chuẩn bị', 'Bàn giao'].map((label, index) => (
            <li key={label} aria-current={index === step ? 'step' : undefined}
              className={`border-t-2 pt-1 ${index <= step ? 'border-primary text-content' : 'border-edge text-muted'}`}>
              {label}
            </li>
          ))}
        </ol>
      )}

      {rejecting && (
        <div className="mt-3">
          <label htmlFor={`note-${request.id}`} className="text-sm font-medium">Lý do từ chối</label>
          <textarea id={`note-${request.id}`} rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)}
            aria-invalid={!!noteError} aria-describedby={noteError ? `note-error-${request.id}` : undefined}
            className="mt-1 w-full rounded-md border border-edge px-3 py-2 text-sm" />
          {noteError && <p id={`note-error-${request.id}`} className="mt-1 text-xs text-danger">{noteError}</p>}
        </div>
      )}
      {failure && <p role="alert" className="mt-3 rounded-md border border-danger-edge bg-danger-tint p-2 text-sm text-danger">{failure}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.filter(action => !rejecting || action.needsNote).map(action => (
          <button key={action.to} type="button" disabled={busy} onClick={() => choose(action)}
            className={action.to === 'rejected'
              ? 'rounded-md border border-danger-edge px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger-tint disabled:opacity-60'
              : 'rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60'}>
            {rejecting && action.needsNote ? 'Xác nhận từ chối' : action.label}
          </button>
        ))}
        {rejecting && (
          <button type="button" onClick={() => { setRejecting(false); setNoteError(null); }}
            className="rounded-md border border-edge px-3 py-1.5 text-sm hover:bg-surface-warm">Hủy</button>
        )}
        {request.status === 'handed_over' && (request.requester_id === user.id || request.decided_by === user.id || user.roles.includes('Agent')) && (
          <button type="button" disabled={busy} onClick={() => void download()}
            className="rounded-md border border-primary-edge bg-primary-tint px-3 py-1.5 text-sm font-semibold text-primary-text hover:bg-surface disabled:opacity-60">
            Tải biên bản (PDF)
          </button>
        )}
        <button type="button" onClick={() => void toggleHistory()} aria-expanded={!!events}
          className="rounded-md border border-edge px-3 py-1.5 text-sm hover:bg-surface-warm">
          {events ? 'Ẩn lịch sử' : 'Lịch sử'}
        </button>
      </div>
      {events && (
        <ul className="mt-3 grid gap-1 border-t border-edge pt-3 text-xs text-muted" aria-label="Lịch sử xử lý">
          {events.map(event => (
            <li key={event.id}>
              {formatTime(event.created_at)} — {event.from_status ? STATUS_LABELS[event.to_status] : 'Gửi đề nghị'} —{' '}
              {event.actor_type === 'user' ? event.actor_name || 'Người dùng' : 'Hệ thống'}
              {event.note ? ` — ${event.note}` : ''}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
