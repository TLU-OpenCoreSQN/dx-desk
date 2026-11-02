// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as keycloakService from '../services/keycloak';
import {
  getHealth,
  getMe,
  getTickets,
  createTicket,
  createDeviceRequest,
  claimTicket,
  getTeams,
  updateTicketStatus,
  ApiClientError,
} from '../services/api';

describe('API Service Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(keycloakService, 'ensureFreshToken').mockResolvedValue(true);
    vi.spyOn(keycloakService, 'getAccessToken').mockReturnValue('mock-jwt-token');
  });

  it('getHealth calls public health endpoint without Authorization header', async () => {
    const mockHealth = { status: 'ok', service: 'dx-desk-api', version: '0.1.0' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockHealth,
    } as Response);

    const result = await getHealth();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/health');
    const headers = options?.headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
    expect(result).toEqual(mockHealth);
  });

  it('attaches Bearer token to authenticated endpoints', async () => {
    const mockTickets = { data: [], limit: 25, offset: 0 };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockTickets,
    } as Response);

    const result = await getTickets(25, 0);

    expect(keycloakService.ensureFreshToken).toHaveBeenCalledWith(30);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/tickets?limit=25&offset=0');
    const headers = options?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer mock-jwt-token');
    expect(result).toEqual(mockTickets);
  });

  it('serializes server-side queue filters without changing the legacy list request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [], total: 0, limit: 25, offset: 25 })));
    await getTickets(25, 25, { queue: 'team_unassigned', team_id: 'team/one', status: 'assigned', assignee_id: 'me' });
    const url = new URL(String(fetchSpy.mock.calls[0][0]), 'http://fixture');
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: '25', offset: '25', queue: 'team_unassigned', team_id: 'team/one', status: 'assigned', assignee_id: 'me' });
  });

  it('claims using only the ticket path and empty body; identity stays server-derived', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
    await claimTicket('ticket/one');
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/tickets/ticket%2Fone/claim');
    expect(options?.method).toBe('POST'); expect(options?.body).toBe('{}');
    expect((options?.headers as Headers).get('Authorization')).toBe('Bearer mock-jwt-token');
    await getTeams(); expect(fetchSpy.mock.calls[1][0]).toBe('/api/teams');
  });

  it('sends the observed ticket version with approval decisions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await updateTicketStatus('ticket-1', { to: 'new', note: 'Thông tin chưa đầy đủ', expected_version: 7 });
    expect(fetchSpy.mock.calls[0][1]?.body).toBe(JSON.stringify({ to: 'new', note: 'Thông tin chưa đầy đủ', expected_version: 7 }));
  });

  it('throws ApiClientError(401) when access token is missing', async () => {
    vi.spyOn(keycloakService, 'getAccessToken').mockReturnValue(null);

    await expect(getMe()).rejects.toThrow(ApiClientError);
    await expect(getMe()).rejects.toMatchObject({ statusCode: 401 });
  });

  it('does not send a stale token after failed refresh', async () => {
    vi.spyOn(keycloakService, 'ensureFreshToken').mockResolvedValue(false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const expired = vi.spyOn(keycloakService, 'expireSession');
    await expect(getTickets()).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(expired).toHaveBeenCalled();
  });

  it('expires session when the server rejects the access token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    const expired = vi.spyOn(keycloakService, 'expireSession');
    await expect(getTickets()).rejects.toMatchObject({ statusCode: 401 });
    expect(expired).toHaveBeenCalled();
  });

  it('parses structured backend errors with statusCode and message array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        statusCode: 400,
        message: ['title must be at least 5 characters', 'category_id must be a UUID'],
      }),
    } as Response);

    try {
      await createTicket({
        category_id: 'invalid-id',
        title: 'bad',
        description: 'short',
      });
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.statusCode).toBe(400);
      expect(apiErr.messages).toHaveLength(2);
      expect(apiErr.messages[0]).toContain('title must be at least 5 characters');
    }
  });

  it('handles 403 forbidden error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        statusCode: 403,
        message: 'Only managers can create critical tickets',
      }),
    } as Response);

    await expect(
      createTicket({
        category_id: 'cat-uuid',
        title: 'Valid ticket title',
        description: 'Valid ticket description at least 10 chars',
        priority: 'critical',
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      messages: ['Only managers can create critical tickets'],
    });
  });

  it('createTicket posts exact payload required by contract', async () => {
    const mockCreated = {
      id: 'ticket-123',
      requester_id: 'user-1',
      category_id: 'cat-1',
      title: 'Valid title',
      description: 'Valid description that is longer than 10 characters',
      priority: 'normal',
      status: 'new',
      assigned_to: null,
      created_at: '2026-10-21T00:00:00Z',
      updated_at: '2026-10-21T00:00:00Z',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockCreated,
    } as Response);

    const payload = {
      category_id: 'cat-1',
      title: 'Valid title',
      description: 'Valid description that is longer than 10 characters',
      priority: 'normal' as const,
    };

    const res = await createTicket(payload);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/tickets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    expect(res).toEqual(mockCreated);
  });

  it('createDeviceRequest posts device_type, reason, and quantity', async () => {
    const mockCreated = {
      id: 'req-456',
      requester_id: 'user-1',
      device_type: 'laptop',
      reason: 'Need laptop for mobile development work',
      quantity: 1,
      status: 'pending',
      created_at: '2026-10-21T00:00:00Z',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockCreated,
    } as Response);

    const payload = {
      device_type: 'laptop' as const,
      reason: 'Need laptop for mobile development work',
      quantity: 1,
    };

    const res = await createDeviceRequest(payload);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/device-requests',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    expect(res).toEqual(mockCreated);
  });
});
