// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getAnalyticsEmbed } from '../../../services/api';
import { AccessNotice } from '../../../components/common/AccessNotice';
import { Alert } from '../../../components/common/Alert';
import { Button } from '../../../components/common/Button';
import { Skeleton } from '../../../components/common/Skeleton';

export function ManagerAnalyticsPage() {
  const { roles } = useAuth();
  const allowed = roles.includes('Manager');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ url?: string; error?: string }>({});
  // Khung Metabase tải chậm: giữ khung chờ phía trên cho tới khi iframe báo đã tải xong.
  const [frameLoaded, setFrameLoaded] = useState(false);
  useEffect(() => {
    if (!allowed) return;
    const request = new AbortController();
    setState({});
    setFrameLoaded(false);
    void getAnalyticsEmbed(request.signal).then(
      ({ url }) => { if (!request.signal.aborted) setState({ url }); },
      error => { if (!request.signal.aborted) setState({ error: error.message }); },
    );
    return () => request.abort();
  }, [allowed, attempt]);

  if (!allowed) return <AccessNotice message="Chỉ Quản lý được xem báo cáo vận hành." />;

  const reload = () => setAttempt(value => value + 1);
  const loading = !state.error && (!state.url || !frameLoaded);

  return (
    <section aria-labelledby="analytics-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="analytics-title" className="dx-page-title">Báo cáo vận hành</h1>
          <p className="mt-1 text-sm text-content-muted">Tổng hợp tình trạng phiếu, SLA và hoạt động hỗ trợ.</p>
        </div>
        <Button variant="secondary" onClick={reload} disabled={loading} leftIcon={<RefreshCw className="h-4 w-4" />}>
          Tải lại báo cáo
        </Button>
      </div>
      {state.error ? (
        <Alert type="error" title="Không tải được báo cáo">
          <p>{state.error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>Thử lại</Button>
        </Alert>
      ) : (
        <div className="relative min-h-[75vh]" aria-busy={loading}>
          {loading && (
            <div role="status" className="absolute inset-0 space-y-4 rounded-lg border border-edge bg-surface p-5">
              <span className="sr-only">Đang tải báo cáo…</span>
              <Skeleton decorative className="h-6 w-56" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[0, 1, 2, 3].map(key => <Skeleton key={key} decorative className="h-20" />)}
              </div>
              <Skeleton decorative className="h-64 w-full" />
            </div>
          )}
          {state.url && (
            <iframe src={state.url} title="Bảng báo cáo vận hành DX-Desk" referrerPolicy="no-referrer"
              onLoad={() => setFrameLoaded(true)}
              className="min-h-[75vh] w-full rounded-lg border border-edge bg-surface"
              sandbox="allow-scripts allow-same-origin allow-downloads" />
          )}
        </div>
      )}
    </section>
  );
}
