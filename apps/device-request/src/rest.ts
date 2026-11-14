// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Ứng dụng 2 không có backend riêng: mọi lời gọi đi thẳng PostgREST qua APISIX (/rest/*) bằng
// token của chính người dùng, nên RLS trong PostgreSQL quyết định ai thấy và làm được gì.
import { accessToken } from './keycloak';
import { errorMessage, type DeviceRequest, type DeviceRequestEvent, type DeviceStatus, type NewRequest } from './workflow';

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

/** RLS trả đúng phần người dùng được xem: của mình, của đơn vị (Manager) hoặc đã duyệt (IT). */
export function listRequests(): Promise<DeviceRequest[]> {
  return request('/device_requests?select=*&order=created_at.desc,id.desc&limit=200');
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
