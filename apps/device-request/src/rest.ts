// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Ứng dụng 2 không có backend riêng: mọi lời gọi đi thẳng PostgREST qua APISIX (/rest/*) bằng
// token của chính người dùng, nên RLS trong PostgreSQL quyết định ai thấy và làm được gì.
import { accessToken } from './keycloak';
import { errorMessage, type DeviceRequest, type DeviceRequestEvent, type DeviceStatus, type NewRequest, type CurrentUser } from './workflow';

const base = import.meta.env.VITE_REST_BASE_URL || '/rest';

export class RestError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(errorMessage(status, code));
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new RestError(0);
  }
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* cổng trả lỗi không phải JSON */ }
  if (!response.ok) throw new RestError(response.status, (data as { code?: string } | null)?.code);
  return data as T;
}

export const REQUEST_PAGE_SIZE = 25;
export type RequestQueue = 'mine' | 'waiting' | 'followed';

/** RLS quyết định quyền đọc; mỗi danh sách có bộ lọc và phân trang riêng. */
export function listRequests(user: CurrentUser, queue: RequestQueue, page: number): Promise<DeviceRequest[]> {
  const params = new URLSearchParams({ select: '*', order: 'created_at.desc,id.desc', limit: String(REQUEST_PAGE_SIZE + 1),
    offset: String(page * REQUEST_PAGE_SIZE), requester_id: `${queue === 'mine' ? 'eq' : 'neq'}.${user.id}` });
  const actionable: string[] = [];
  if (user.roles.includes('Manager') && user.department) actionable.push(`and(status.eq.pending,department.eq.${user.department})`);
  if (user.roles.includes('Agent')) actionable.push('status.in.(approved,preparing)');
  if (queue === 'waiting' && actionable.length === 0) return Promise.resolve([]);
  if (queue !== 'mine' && actionable.length) params.set(queue === 'waiting' ? 'or' : 'not.or', `(${actionable.join(',')})`);
  return request('/device_requests?' + params);
}
export async function createRequest(input: NewRequest): Promise<DeviceRequest> {
  // Chỉ ba trường này: người đề nghị, đơn vị và trạng thái do PostgreSQL đặt từ JWT.
  const rows = await request<DeviceRequest[]>('/device_requests',
    { device_type: input.device_type, reason: input.reason.trim(), quantity: input.quantity });
  return rows[0];
}
export function transition(id: string, to: DeviceStatus, note?: string): Promise<DeviceRequest> {
  return request('/rpc/transition_device_request', { p_id: id, p_to: to, ...(note?.trim() ? { p_note: note.trim() } : {}) });
}
export function listEvents(id: string): Promise<DeviceRequestEvent[]> {
  return request(`/device_request_events?request_id=eq.${encodeURIComponent(id)}&select=*&order=created_at,id`);
}
