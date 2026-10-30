// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

export type UserRole = 'Employee' | 'Agent' | 'Manager';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export interface UserProfile {
  id: string;
  username: string;
  roles: UserRole[];
}

export interface RequirementField {
  key: string;
  label: string;
  required: boolean;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  requirement_fields?: RequirementField[] | null;
}

export type TicketPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Ticket {
  id: string;
  requester_id: string;
  category_id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  request_fields?: Record<string, unknown>;
  resolution_note?: string | null;
}

export interface TicketEvent {
  id: string;
  ticket_id: string;
  actor_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateTicketPayload {
  category_id: string;
  title: string;
  description: string;
  priority?: TicketPriority;
  fields?: Record<string, string>;
}

export interface UpdateTicketStatusPayload {
  to: string;
  note?: string;
  resolution_note?: string;
}

export type DeviceType = 'laptop' | 'monitor' | 'keyboard' | 'mouse' | 'other';

export interface DeviceRequest {
  id: string;
  requester_id: string;
  device_type: DeviceType;
  reason: string;
  quantity: number;
  status: string;
  created_at: string;
}

export interface CreateDeviceRequestPayload {
  device_type: DeviceType;
  reason: string;
  quantity?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  limit: number;
  offset: number;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
}
