// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAnalyticsEmbed } from '../services/api';

export function ManagerAnalyticsPage() {
  const { roles } = useAuth();
  const allowed = roles.includes('Manager');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ url?: string; error?: string }>({});
  useEffect(() => {
    if (!allowed) return;
    const request = new AbortController();
    setState({});
    void getAnalyticsEmbed(request.signal).then(
      ({ url }) => { if (!request.signal.aborted) setState({ url }); },
      error => { if (!request.signal.aborted) setState({ error: error.message }); },
    );
    return () => request.abort();
  }, [allowed, attempt]);

  return (
    <section aria-labelledby="analytics-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="analytics-title" className="text-2xl font-bold text-content">Báo cáo vận hành</h1>
          <p className="text-sm text-content-muted">Tổng hợp tình trạng phiếu, SLA và hoạt động hỗ trợ.</p>
        </div>
        {allowed && <button type="button" onClick={() => setAttempt(value => value + 1)}
          className="rounded-md border border-edge px-4 py-2 text-sm font-semibold text-content">Tải lại báo cáo</button>}
      </div>
      {!allowed ? <p role="alert">Chỉ quản lý được xem báo cáo.</p>
        : state.error ? <p role="alert" className="rounded-md border border-edge bg-surface p-4">{state.error}</p>
          : state.url ? <iframe src={state.url} title="Dashboard Metabase DX-Desk" referrerPolicy="no-referrer"
            className="min-h-[75vh] w-full rounded-lg border border-edge bg-surface"
            sandbox="allow-scripts allow-same-origin allow-downloads" />
            : <p role="status">Đang tải báo cáo…</p>}
    </section>
  );
}
