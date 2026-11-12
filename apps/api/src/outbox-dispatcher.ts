// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { Database } from './database';
import { authConfig, required } from './config';
import { AutomationClaims, validateAutomationClaims } from './service-auth';

interface Envelope {
  event_id: string; ticket_id: string; event_type: string; ticket_version: number;
  schema_version: number; payload: Record<string, unknown>;
  // W5-02: sự kiện đề nghị thiết bị mang request_id thay cho ticket_id.
  request_id?: string;
}
interface Delivery { event_id: string; destination: string; envelope: Envelope; lease_token: string; attempts: number }
interface Ack {
  event_id: string; result: string; ticket_id: string; team_id?: string; request_id?: string;
  notification?: { kind: string; team_id?: string | null; audience?: string };
}
const DEVICE_NOTICES: Record<string, { audience: string; text: string }> = {
  'device_request.created': { audience: 'manager', text: 'Đề nghị thiết bị mới — chờ quản lý trực tiếp duyệt' },
  'device_request.approved': { audience: 'it', text: 'Đề nghị thiết bị đã được duyệt — IT chuẩn bị' },
  'device_request.rejected': { audience: 'requester', text: 'Đề nghị thiết bị không được duyệt' },
  'device_request.handed_over': { audience: 'requester', text: 'Thiết bị đã bàn giao — biên bản có trong ứng dụng' },
};
export function retryDelay(attempts: number, jitter = Math.random()): number {
  return Math.min(60, 2 ** Math.min(6, Math.max(0, attempts - 1))) + Math.floor(Math.max(0, Math.min(1, jitter)) * 3);
}
export function notificationText(envelope: Envelope): string {
  const kinds: Record<string, string> = {
    'ticket.assignment_changed': 'Đã giao nhóm / nhận xử lý',
    'ticket.status_changed': 'Cập nhật trạng thái',
    'ticket.sla_warning': 'SLA đã sử dụng 80%',
    'ticket.sla_breached': 'SLA đã quá hạn — cần trưởng nhóm xem xét',
  };
  // Do not send title/description/notes, requester details, files or signed links to chat.
  const device = DEVICE_NOTICES[envelope.event_type];
  if (device) return `[DX-Desk] ${device.text} — đề nghị ${envelope.request_id} — sự kiện ${envelope.event_id}`;
  return `[DX-Desk] ${kinds[envelope.event_type] ?? 'Cập nhật phiếu'} — phiếu ${envelope.ticket_id} — sự kiện ${envelope.event_id}`;
}
export function validAck(item: Delivery, ack: Ack): boolean {
  if (item.destination === 'device_request') {
    const device = DEVICE_NOTICES[item.envelope.event_type];
    return !!device && !!item.envelope.request_id && ack.event_id === item.event_id
      && ack.request_id === item.envelope.request_id && ack.result === 'notification'
      && ack.notification?.kind === item.envelope.event_type.slice('device_request.'.length)
      && ack.notification.audience === device.audience;
  }
  if (ack.event_id !== item.event_id || ack.ticket_id !== item.envelope.ticket_id) return false;
  if (item.destination === 'automation') return ['routed','skipped','unresolved'].includes(ack.result);
  if (item.destination !== 'notification') return false;
  if (ack.result === 'skipped') return ['ticket.sla_warning','ticket.sla_breached'].includes(item.envelope.event_type);
  const kind = item.envelope.event_type === 'ticket.assignment_changed' ? 'assignment'
    : item.envelope.event_type === 'ticket.sla_warning' ? 'sla_warning'
    : item.envelope.event_type === 'ticket.sla_breached' ? 'sla_breached' : 'status';
  return ack.result === 'notification' && ack.notification?.kind === kind;
}

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;
  private identity?: { token: string; claims: AutomationClaims; expires: number };
  private keys?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly db: Database) {}

  onModuleInit() {
    if (process.env.AUTOMATION_ENABLED !== 'true') return;
    this.stopped = false;
    this.schedule(500);
  }
  private schedule(ms: number) {
    this.timer = setTimeout(() => {
      this.running = this.runOnce().catch(() => {
        // No credentials, HTTP response bodies or domain payloads in operational logs.
        console.error('Automation poll failed', { code: 'automation_unavailable' });
      }).finally(() => {
        if (!this.stopped) this.schedule(Math.max(1000, Number(process.env.OUTBOX_POLL_MS) || 2000));
      });
    }, ms);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }

  private async serviceIdentity() {
    if (this.identity && this.identity.expires > Date.now() + 30000) return this.identity;
    const response = await fetch(required('OIDC_TOKEN_URL'), {
      method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials',
        client_id: process.env.AUTOMATION_CLIENT_ID ?? 'dxdesk-automation',
        client_secret: required('AUTOMATION_CLIENT_SECRET') }), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('service_token_unavailable');
    const token = (await response.json() as { access_token?: string }).access_token;
    if (!token) throw new Error('service_token_missing');
    const config = authConfig();
    this.keys ??= createRemoteJWKSet(new URL(config.jwksUrl));
    const { payload } = await jwtVerify(token, this.keys, { issuer: config.issuer, audience: config.audience,
      algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub'] });
    const claims = validateAutomationClaims(payload);
    return this.identity = { token, claims, expires: Number(payload.exp) * 1000 };
  }

  async runOnce(): Promise<void> {
    const identity = await this.serviceIdentity();
    // DB transaction is closed before any network call; the lease survives worker death.
    await this.db.asAutomation(identity.claims, client => client.query('SELECT private.evaluate_sla()'));
    for (let count = 0; count < 4; count++) {
      // Acquire each lease immediately before its own network work; queued batch
      // members must not expire behind earlier slow deliveries.
      const batch = await this.db.asAutomation(identity.claims, async client => (await client.query(
        'SELECT * FROM private.claim_outbox($1,$2)', [1, 90],
      )).rows as Delivery[]);
      const item = batch[0];
      if (!item) break;
      try {
        const response = await fetch(required(item.destination === 'device_request' ? 'DEVICE_REQUEST_WEBHOOK_URL' : 'AUTOMATION_WEBHOOK_URL'), {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DXDesk-Webhook-Key': required('AUTOMATION_WEBHOOK_KEY') },
          body: JSON.stringify(item.envelope), signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          await response.body?.cancel();
          // n8n can answer 404 between HTTP readiness and webhook activation.
          // Keep this, timeout and rate-limit responses in the bounded retry path.
          throw Object.assign(new Error('consumer_http'), { terminal:
            response.status >= 400 && response.status < 500 && ![404,408,425,429].includes(response.status) });
        }
        const ack = await response.json() as Ack;
        if (!validAck(item, ack)) throw new Error('invalid_durable_ack');
        if (ack.result === 'unresolved') throw new Error('routing_unresolved');
        if (item.destination !== 'automation' && ack.result === 'notification') await this.notify(item, ack);
        const completed = await this.db.asAutomation(identity.claims, async client => (await client.query(
          'SELECT private.complete_outbox($1,$2) AS completed', [item.event_id, item.lease_token],
        )).rows[0]?.completed === true);
        if (!completed) throw new Error('delivery_lease_lost');
      } catch (error) {
        const terminal = (error as { terminal?: boolean })?.terminal === true;
        const deferred = await this.db.asAutomation(identity.claims, async client => (await client.query(
          'SELECT private.fail_outbox($1,$2,$3,$4,$5) AS deferred',
          [item.event_id, item.lease_token, terminal ? 'consumer_rejected' : 'delivery_unavailable', retryDelay(item.attempts), terminal],
        )).rows[0]?.deferred === true);
        console.error(deferred ? 'Outbox delivery deferred' : 'Outbox lease no longer owned', { event_id: item.event_id, attempts: item.attempts, terminal });
      }
    }
  }

  private async notify(item: Delivery, ack: Ack) {
    const channels: Record<string, string> = JSON.parse(required('MATTERMOST_TEAM_CHANNELS'));
    const teamId = ack.notification?.team_id ?? ack.team_id;
    // Tin cho quản lý/người đề nghị thiết bị không có nhóm IT: vào kênh vận hành chung.
    const channel = teamId ? channels[teamId] ?? (item.destination === 'device_request' ? channels.default : undefined) : channels.default;
    if (!channel) throw new Error('notification_channel_missing');
    // Reconcile an ambiguous prior POST before retrying. This is bounded best
    // effort, not an exactly-once promise across two independent systems.
    const recent = await fetch(required('MATTERMOST_URL').replace(/\/+$/, '') + `/api/v4/channels/${encodeURIComponent(channel)}/posts?per_page=200`, {
      headers: { Authorization: `Bearer ${required('MATTERMOST_BOT_TOKEN')}` }, signal: AbortSignal.timeout(10000),
    });
    if (!recent.ok) { await recent.body?.cancel(); throw new Error('chat_reconciliation_unavailable'); }
    const posts = (await recent.json() as {posts?:Record<string,{props?:Record<string,unknown>}>}).posts;
    if (Object.values(posts ?? {}).some(post => post.props?.dxdesk_event_id === item.event_id)) return;
    const response = await fetch(required('MATTERMOST_URL').replace(/\/+$/, '') + '/api/v4/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('MATTERMOST_BOT_TOKEN')}` },
      body: JSON.stringify({ channel_id: channel, message: notificationText(item.envelope),
        pending_post_id: item.event_id, props: { dxdesk_event_id: item.event_id, dxdesk_delivery_id: randomUUID() } }),
      signal: AbortSignal.timeout(10000),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error('chat_delivery_unavailable');
  }
}
