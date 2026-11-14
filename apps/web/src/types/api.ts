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

/** W5-08: bài Wiki.js gợi ý theo danh mục; url null khi máy chủ chưa cấu hình Wiki.js. */
export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  url: string | null;
}

export interface SelfServiceRecord {
  id: string;
  category_id: string;
  article_id: string;
  created_at: string;
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
  assigned_team_id?: string | null;
  team_name?: string | null;
  requester_name?: string | null;
  assignee_name?: string | null;
  sla_due_at?: string | null;
  sla_paused_ms?: number | string;
  waiting_since?: string | null;
  sla_breached?: boolean;
  sla_breached_at?: string | null;
  ticket_version?: number;
  created_at: string;
  updated_at: string;
  request_fields?: Record<string, unknown>;
  resolution_note?: string | null;
}

export interface TicketEvent {
  id: string;
  ticket_id: string;
  actor_id: string | null;
  actor_type?: 'user' | 'system' | 'ai';
  actor_name?: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number | string;
  scan_status: 'pending' | 'clean' | 'infected' | 'failed';
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
  expected_version?: number;
}

export type TicketQueue = 'my_open' | 'team_unassigned' | 'team_assigned' | 'pending_approval';

export interface TicketFilters {
  queue?: TicketQueue;
  status?: string;
  team_id?: string;
  assignee_id?: string;
}

export interface Team {
  id: string;
  name: string;
  active: boolean;
  members: { user_id: string; display_name: string; active: boolean }[];
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
  total?: number;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
}
