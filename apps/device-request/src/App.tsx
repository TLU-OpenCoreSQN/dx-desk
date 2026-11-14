// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react';
import { currentUser, initKeycloak, logout } from './keycloak';
import { listRequests } from './rest';
import { RequestForm } from './RequestForm';
import { RequestCard } from './RequestCard';
import { actionsFor, type CurrentUser, type DeviceRequest } from './workflow';

const ROLE_LABELS: Record<string, string> = { Employee: 'Nhân viên', Agent: 'IT', Manager: 'Quản lý' };

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    initKeycloak().then(ok => (ok ? setUser(currentUser()) : setAuthError(true))).catch(() => setAuthError(true));
  }, []);

  if (authError) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <p role="alert" className="rounded-md border border-danger-edge bg-danger-tint p-4 text-sm text-danger">
          Không kết nối được máy chủ đăng nhập. Kiểm tra Keycloak rồi tải lại trang.
        </p>
      </main>
    );
  }
  if (!user) return <p className="p-8 text-sm text-muted" role="status">Đang kiểm tra phiên đăng nhập…</p>;
  return <Workspace user={user} />;
}

export function Workspace({ user }: { user: CurrentUser }) {
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRequests(await listRequests());
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const replace = (next: DeviceRequest) => setRequests(rows => rows.map(row => (row.id === next.id ? next : row)));
  const mine = requests.filter(row => row.requester_id === user.id);
  const others = requests.filter(row => row.requester_id !== user.id);
  const waiting = others.filter(row => actionsFor(row, user).length > 0);
  const followed = others.filter(row => actionsFor(row, user).length === 0);
  const isManager = user.roles.includes('Manager');
  const isAgent = user.roles.includes('Agent');

  return (
    <div className="min-h-screen bg-surface-warm text-content">
      <header className="border-b border-edge bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Xin cấp thiết bị</h1>
            <p className="text-xs text-muted">Ứng dụng 2 trên nền tảng DX-Desk · dùng chung đăng nhập và dữ liệu</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span data-testid="identity">
              <span className="font-medium">{user.name}</span>
              <span className="text-muted"> · {user.roles.map(role => ROLE_LABELS[role]).join(', ')}
                {user.department ? ` · đơn vị ${user.department}` : ''}</span>
            </span>
            <a href="/" className="rounded-md border border-edge px-3 py-1.5 hover:bg-surface-warm">← Về DX-Desk</a>
            <button type="button" onClick={() => void logout()} className="rounded-md border border-edge px-3 py-1.5 hover:bg-surface-warm">
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-labelledby="new-request" className="self-start rounded-lg border border-edge bg-surface p-4">
          <h2 id="new-request" className="mb-3 text-base font-semibold">Đề nghị mới</h2>
          {user.department ? (
            <RequestForm onCreated={created => setRequests(rows => [created, ...rows])} />
          ) : (
            <p role="alert" className="rounded-md border border-warning-edge bg-warning-tint p-3 text-sm text-warning">
              Tài khoản chưa được gán đơn vị nên chưa gửi được đề nghị. Liên hệ quản trị hệ thống.
            </p>
          )}
        </section>

        <div className="grid content-start gap-6">
          {error && <p role="alert" className="rounded-md border border-danger-edge bg-danger-tint p-3 text-sm text-danger">{error}</p>}
          {(isManager || isAgent) && (
            <RequestSection id="waiting" title={isManager && !isAgent ? `Chờ bạn duyệt · đơn vị ${user.department ?? '—'}` : 'Chờ bạn xử lý'}
              empty="Không có đề nghị nào đang chờ bạn." loading={loading} rows={waiting} user={user} onChanged={replace} />
          )}
          <RequestSection id="mine" title="Đề nghị của tôi" empty="Bạn chưa gửi đề nghị nào." loading={loading}
            rows={mine} user={user} onChanged={replace} />
          {(isManager || isAgent) && followed.length > 0 && (
            <RequestSection id="followed" title={isManager && !isAgent ? 'Đề nghị khác của đơn vị' : 'Đề nghị đã qua tay IT'}
              empty="" loading={false} rows={followed} user={user} onChanged={replace} />
          )}
          <button type="button" onClick={() => { setLoading(true); void reload(); }}
            className="justify-self-start rounded-md border border-edge bg-surface px-3 py-1.5 text-sm hover:bg-surface-warm">
            Tải lại danh sách
          </button>
        </div>
      </main>
    </div>
  );
}

function RequestSection(props: { id: string; title: string; empty: string; loading: boolean; rows: DeviceRequest[];
  user: CurrentUser; onChanged: (request: DeviceRequest) => void }) {
  return (
    <section aria-labelledby={props.id}>
      <h2 id={props.id} className="mb-2 text-base font-semibold">
        {props.title} <span className="font-normal text-muted">({props.rows.length})</span>
      </h2>
      {props.loading ? <p className="text-sm text-muted" role="status">Đang tải…</p>
        : props.rows.length === 0 ? <p className="text-sm text-muted">{props.empty}</p>
        : (
          <ul className="grid gap-3">
            {props.rows.map(row => (
              <li key={row.id}><RequestCard request={row} user={props.user} onChanged={props.onChanged} /></li>
            ))}
          </ul>
        )}
    </section>
  );
}
