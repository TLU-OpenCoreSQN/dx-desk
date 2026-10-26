// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import {
  Category,
  CreateDeviceRequestPayload,
  CreateTicketPayload,
  DeviceRequest,
  HealthResponse,
  PaginatedResponse,
  Ticket,
  TicketEvent,
  UpdateTicketStatusPayload,
  UserProfile,
} from '../types/api';
import { ensureFreshToken, getAccessToken, expireSession } from './keycloak';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiClientError extends Error {
  statusCode: number;
  messages: string[];

  constructor(statusCode: number, message: string | string[]) {
    const messages = Array.isArray(message) ? message : [message];
    super(messages.join(', ') || `HTTP ${statusCode}`);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.messages = messages;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isPublic = false
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (!isPublic) {
    // Refresh token if within 30 seconds of expiry
    const valid = await ensureFreshToken(30);
    const token = getAccessToken();
    if (!valid || !token) {
      expireSession();
      throw new ApiClientError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(15000),
      headers,
    });
  } catch (error) {
    throw new ApiClientError(0, `Không thể kết nối đến máy chủ API: ${(error as Error).message}`);
  }

  if (!response.ok) {
    if (response.status === 401) expireSession();
    let errorData: unknown = null;
    try {
      errorData = await response.json();
    } catch {
      // response is not json
    }

    if (errorData && typeof errorData === 'object' && 'message' in errorData) {
      const err = errorData as { statusCode?: number; message: string | string[] };
      throw new ApiClientError(response.status, err.message);
    }

    let defaultMsg = `Yêu cầu thất bại với mã trạng thái ${response.status}.`;
    if (response.status === 400) defaultMsg = 'Dữ liệu gửi lên không hợp lệ.';
    if (response.status === 401) defaultMsg = 'Chưa xác thực hoặc phiên làm việc đã hết hạn.';
    if (response.status === 403) defaultMsg = 'Bạn không có quyền thực hiện thao tác này.';
    if (response.status === 404) defaultMsg = 'Tài nguyên yêu cầu không tồn tại.';
    if (response.status === 500) defaultMsg = 'Lỗi hệ thống nội bộ máy chủ.';

    throw new ApiClientError(response.status, defaultMsg);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ----------------------------------------------------------------------------
// API Endpoints
// ----------------------------------------------------------------------------

/**
 * Public health check endpoint
 * GET /api/health
 */
export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health', { method: 'GET' }, true);
}

/**
 * User profile endpoint
 * GET /api/me
 */
export async function getMe(): Promise<UserProfile> {
  return request<UserProfile>('/me', { method: 'GET' });
}

/**
 * Categories endpoint
 * GET /api/categories
 */
export async function getCategories(): Promise<{ data: Category[] }> {
  return request<{ data: Category[] }>('/categories', { method: 'GET' });
}

/**
 * Tickets list endpoint
 * GET /api/tickets?limit=25&offset=0
 */
export async function getTickets(
  limit = 25,
  offset = 0
): Promise<PaginatedResponse<Ticket>> {
  return request<PaginatedResponse<Ticket>>(
    `/tickets?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    { method: 'GET' }
  );
}

/**
 * Single ticket detail endpoint
 * GET /api/tickets/:id
 */
export async function getTicketById(id: string): Promise<Ticket> {
  return request<Ticket>(`/tickets/${encodeURIComponent(id)}`, { method: 'GET' });
}

/**
 * Ticket event timeline endpoint
 * GET /api/tickets/:id/events
 */
export async function getTicketEvents(id: string): Promise<{ data: TicketEvent[] }> {
  return request<{ data: TicketEvent[] }>(
    `/tickets/${encodeURIComponent(id)}/events`,
    { method: 'GET' }
  );
}

/**
 * Create ticket endpoint
 * POST /api/tickets
 */
export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  return request<Ticket>('/tickets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Ticket status transition endpoint
 * PATCH /api/tickets/:id/status
 */
export async function updateTicketStatus(
  id: string,
  payload: UpdateTicketStatusPayload
): Promise<Ticket> {
  return request<Ticket>(`/tickets/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Device requests list endpoint
 * GET /api/device-requests?limit=25&offset=0
 */
export async function getDeviceRequests(
  limit = 25,
  offset = 0
): Promise<PaginatedResponse<DeviceRequest>> {
  return request<PaginatedResponse<DeviceRequest>>(
    `/device-requests?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    { method: 'GET' }
  );
}

/**
 * Create device request endpoint
 * POST /api/device-requests
 */
export async function createDeviceRequest(
  payload: CreateDeviceRequestPayload
): Promise<DeviceRequest> {
  return request<DeviceRequest>('/device-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
