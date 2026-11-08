// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

const MINUTE = 60_000;
const WEEK = 7 * 24 * 60 * MINUTE;
const COHORTS = {
  before: { count: 100, minutes: 144, client42: 0 },
  after: { count: 137, minutes: 246, client42: 99 },
};
const cohortCount = COHORTS.before.count + COHORTS.after.count;
const settled = new Set(['resolved', 'closed']);

export function planVpnScenario({ weeks, categories, referenceMs, sample }) {
  const nonVpn = categories.filter(([code, weight]) => code !== 'vpn' && weight > 0);
  if (weeks < 6 || weeks > 8) throw new Error('vpn-4.2 cần 6..8 tuần.');
  if (!nonVpn.length || !categories.some(([code, weight]) => code === 'vpn' && weight > 0)) {
    throw new Error('vpn-4.2 cần trọng số VPN và ít nhất một danh mục khác.');
  }
  return index => {
    if (index >= cohortCount) return null;
    const phase = index < COHORTS.before.count ? 'before' : 'after';
    const cohort = COHORTS[phase];
    const offset = phase === 'before' ? index : index - COHORTS.before.count;
    const variation = cohort.count % 2 && offset === cohort.count - 1 ? 0 : offset % 2 ? 12 : -12;
    const weekStart = referenceMs - (phase === 'before' ? 2 : 1) * WEEK;
    return {
      phase,
      createdAt: new Date(weekStart + Math.floor(sample(`${phase}:${index}:time`) * (WEEK / MINUTE - 1440)) * MINUTE).toISOString(),
      minutes: cohort.minutes + variation,
      clientVersion: (offset * 53) % cohort.count < cohort.client42 ? '4.2' : '4.1',
    };
  };
}

export function scenarioSummary(tickets, events) {
  const resolved = new Map(events.filter(event => event.event_type === 'status_changed' && event.payload.to === 'resolved')
    .map(event => [event.ticket_id, Date.parse(event.created_at)]));
  const stats = Object.fromEntries(Object.keys(COHORTS).map(phase => {
    const rows = tickets.filter(ticket => ticket.scenario_phase === phase && ticket.category_code === 'vpn');
    if (!rows.length || rows.some(row => !resolved.has(row.id))) throw new Error(`Thiếu ticket VPN đã giải quyết ở giai đoạn ${phase}.`);
    return [phase, {
      tickets: rows.length,
      average_hours: Number((rows.reduce((sum, row) => sum + resolved.get(row.id) - Date.parse(row.created_at), 0) / rows.length / 3_600_000).toFixed(1)),
      client_4_2: rows.filter(row => row.request_fields.client_version === '4.2').length,
    }];
  }));
  const increase = Math.round(100 * (stats.after.tickets - stats.before.tickets) / stats.before.tickets);
  const share = Math.round(100 * stats.after.client_4_2 / stats.after.tickets);
  if (increase !== 37 || share !== 72 || stats.before.average_hours !== 2.4 || stats.after.average_hours !== 4.1) {
    throw new Error('Kịch bản VPN lệch số liệu mục tiêu 37%, 2,4/4,1 giờ hoặc 72%.');
  }
  return { ...stats, vpn_increase_percent: increase, client_4_2_after_percent: share };
}

export function scenarioHistory(tickets, systemId, stableId, referenceMs) {
  const events = [];
  const selfService = [];
  const deviceRequests = [];
  for (const [index, ticket] of tickets.entries()) {
    const start = Date.parse(ticket.created_at);
    const end = Math.min(referenceMs - 1, start + (ticket.resolution_minutes ?? 120 + index % 360) * MINUTE);
    const actor = ticket.assigned_to ?? ticket.requester_id;
    let state = ticket.category_code === 'access' && ticket.priority !== 'critical' ? 'pending_approval' : 'new';
    let sequence = 0;
    let lastAt = ticket.created_at;
    function record(eventType, payload, fraction, actorId, actorType = 'user') {
      lastAt = new Date(Math.min(end, start + Math.floor((end - start) * fraction))).toISOString();
      events.push({
        id: stableId(`${ticket.id}:event:${sequence++}`), ticket_id: ticket.id,
        event_type: eventType, actor_type: actorType, actor_id: actorId,
        actor_name: actorType === 'system' ? '[SYNTHETIC] Tự động hóa' : '[SYNTHETIC] Tài khoản demo',
        payload, created_at: lastAt,
      });
    }
    function transition(to, fraction, actorId, actorType) {
      record('status_changed', { from: state, to, ...(to === 'resolved' ? { resolution_note: ticket.resolution_note } : {}) },
        fraction, actorId, actorType);
      state = to;
    }
    record('created', { status: state }, 0, ticket.requester_id);
    if (ticket.status === 'cancelled') {
      transition('cancelled', 0.25, ticket.requester_id);
    } else if (!['new', 'pending_approval'].includes(ticket.status)) {
      // VPN is routed by the system; other classification is manual by default.
      const automated = ticket.category_code === 'vpn' || index % 5 === 0;
      const routeActor = automated ? systemId : actor;
      const routeType = automated ? 'system' : 'user';
      if (state === 'new') transition('triaged', 0.05, routeActor, routeType);
      if (ticket.status !== 'triaged') {
        transition('assigned', 0.10, routeActor, routeType);
        record('assignment_changed', { team_id: ticket.assigned_team_id, assignee: null }, 0.11, routeActor, routeType);
        if (ticket.status !== 'assigned') {
          record('assignment_changed', { team_id: ticket.assigned_team_id, assignee: ticket.assigned_to }, 0.20, actor);
          transition('in_progress', 0.21, actor);
          if (ticket.status === 'waiting_user') transition('waiting_user', 0.35, actor);
          if (settled.has(ticket.status)) {
            transition('resolved', 1, actor);
            ticket.resolved_at = lastAt;
          }
          if (ticket.status === 'closed') {
            // Confirmation follows resolution and uses the original requester.
            const confirmation = Math.min(referenceMs, end + MINUTE);
            record('status_changed', { from: 'resolved', to: 'closed' }, 1, ticket.requester_id);
            lastAt = new Date(confirmation).toISOString();
            events.at(-1).created_at = lastAt;
          }
        }
      }
    }
    ticket.updated_at = lastAt;
    if (ticket.status === 'waiting_user') ticket.waiting_since = lastAt;
    if (index % 12 === 0) selfService.push({ id: stableId(`${ticket.id}:self-service`), user_id: ticket.requester_id, created_at: ticket.created_at });
    if (index % 45 === 0) deviceRequests.push({
      id: stableId(`${ticket.id}:device`), requester_id: ticket.requester_id, created_at: ticket.created_at,
      device_type: ['laptop', 'monitor', 'keyboard', 'mouse'][deviceRequests.length % 4],
      reason: '[SYNTHETIC] Đề nghị thiết bị phục vụ buổi thực hành mô phỏng.', quantity: index % 3 + 1,
    });
  }
  return { events, self_service: selfService, device_requests: deviceRequests };
}
