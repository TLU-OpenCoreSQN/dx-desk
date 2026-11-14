// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react';
import { currentUser, initKeycloak, logout } from './keycloak';
import { listRequests, REQUEST_PAGE_SIZE, type RequestQueue } from './rest';
import { RequestForm } from './RequestForm';
import { RequestCard } from './RequestCard';
import type { CurrentUser, DeviceRequest } from './workflow';

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
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(value => value + 1);
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
            <RequestForm onCreated={reload} />
          ) : (
            <p role="alert" className="rounded-md border border-warning-edge bg-warning-tint p-3 text-sm text-warning">
              Tài khoản chưa được gán đơn vị nên chưa gửi được đề nghị. Liên hệ quản trị hệ thống.
            </p>
          )}
        </section>

        <div className="grid content-start gap-6">
          {(isManager || isAgent) && (
            <RequestSection id="waiting" title={isManager && !isAgent ? `Chờ bạn duyệt · đơn vị ${user.department ?? '—'}` : 'Chờ bạn xử lý'}
              empty="Không có đề nghị nào đang chờ bạn." revision={revision} user={user} onChanged={reload} />
          )}
          <RequestSection id="mine" title="Đề nghị của tôi" empty="Bạn chưa gửi đề nghị nào." revision={revision}
            user={user} onChanged={reload} />
          {(isManager || isAgent) && (
            <RequestSection id="followed" title={isManager && !isAgent ? 'Đề nghị khác của đơn vị' : 'Đề nghị đã qua tay IT'}
              empty="Không có đề nghị nào để theo dõi." revision={revision} user={user} onChanged={reload} />
          )}
          <button type="button" onClick={reload}
            className="justify-self-start rounded-md border border-edge bg-surface px-3 py-1.5 text-sm hover:bg-surface-warm">
            Tải lại danh sách
          </button>
        </div>
      </main>
    </div>
  );
}

function RequestSection(props: { id: RequestQueue; title: string; empty: string; revision: number;
  user: CurrentUser; onChanged: () => void }) {
  const { id, user, revision } = props;
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ rows: DeviceRequest[]; more: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void listRequests(user, id, page).then(rows => {
      if (!current) return;
      if (rows.length === 0 && page > 0) {
        setPage(page - 1);
        return;
      }
      setResult({ rows: rows.slice(0, REQUEST_PAGE_SIZE), more: rows.length > REQUEST_PAGE_SIZE });
      setError(null);
    }).catch(reason => { if (current) setError((reason as Error).message); });
    return () => { current = false; };
  }, [id, page, revision, user]);

  function changePage(next: number) {
    setResult(null);
    setError(null);
    setPage(next);
  }

  return (
    <section aria-labelledby={props.id}>
      <h2 id={props.id} className="mb-2 text-base font-semibold">
        {props.title}
      </h2>
      {error && <p role="alert" className="rounded-md border border-danger-edge bg-danger-tint p-3 text-sm text-danger">{error}</p>}
      {!result ? !error && <p className="text-sm text-muted" role="status">Đang tải…</p>
        : result.rows.length === 0 ? <p className="text-sm text-muted">{props.empty}</p>
        : (
          <ul className="grid gap-3">
            {result.rows.map(row => (
              <li key={row.id}><RequestCard request={row} user={props.user} onChanged={props.onChanged} /></li>
            ))}
          </ul>
        )}
      {(page > 0 || result?.more) && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button type="button" disabled={page === 0} onClick={() => changePage(page - 1)}
            className="rounded-md border border-edge bg-surface px-3 py-1.5 disabled:opacity-50">Trang trước</button>
          <span>Trang {page + 1}</span>
          <button type="button" disabled={!result?.more} onClick={() => changePage(page + 1)}
            className="rounded-md border border-edge bg-surface px-3 py-1.5 disabled:opacity-50">Trang sau</button>
        </div>
      )}
    </section>
  );
}
