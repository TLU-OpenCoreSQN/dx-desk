// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser, DeviceRequest } from '../workflow';

const keycloakMock = vi.hoisted(() => ({
  accessToken: vi.fn(),
}));

vi.mock('../keycloak', () => keycloakMock);

import { createRequest, handoverUrl, listEvents, listRequests, RestError, transition } from '../rest';

const sampleRequest: DeviceRequest = {
  id: '11111111-0000-4000-8000-000000000001',
  requester_id: 'employee-a',
  device_type: 'laptop',
  reason: 'Máy tính cũ hỏng bàn phím',
  quantity: 1,
  status: 'pending',
  department: 'phong-hanh-chinh',
  decided_by: null,
  decided_at: null,
  decision_note: null,
  prepared_at: null,
  handed_over_at: null,
  created_at: '2026-11-12T02:00:00Z',
  updated_at: '2026-11-12T02:00:00Z',
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  keycloakMock.accessToken.mockResolvedValue('tok-123');
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rest client', () => {
  it('surfaces 401 RestError when accessToken fails instead of RestError(0)', async () => {
    keycloakMock.accessToken.mockRejectedValue(new Error('unauthenticated'));
    await expect(listEvents('req-1')).rejects.toMatchObject({
      status: 401,
      message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws RestError(0) when fetch rejects due to network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listEvents('req-1')).rejects.toMatchObject({
      status: 0,
      message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
    });
  });

  it('parses PostgREST error code on non-OK responses', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: '45011' }), { status: 400 }));
    await expect(transition('req-1', 'approved')).rejects.toMatchObject({
      status: 400,
      code: '45011',
      message: 'Đề nghị đã chuyển sang bước khác. Tải lại danh sách để xem trạng thái mới.',
    });
  });

  it('guards createRequest against null or empty array responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 201 }));
    await expect(createRequest({ device_type: 'laptop', reason: 'Cần laptop mới để làm việc', quantity: 1 }))
      .rejects.toBeInstanceOf(RestError);

    fetchMock.mockResolvedValueOnce(new Response('[]', { status: 201 }));
    await expect(createRequest({ device_type: 'laptop', reason: 'Cần laptop mới để làm việc', quantity: 1 }))
      .rejects.toMatchObject({ status: 500 });
  });

  it('creates a request with trimmed reason and returns the created row', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([sampleRequest]), { status: 201 }));
    const created = await createRequest({ device_type: 'laptop', reason: '  Máy tính cũ hỏng bàn phím  ', quantity: 1 });
    expect(created).toEqual(sampleRequest);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/rest/device_requests');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ device_type: 'laptop', reason: 'Máy tính cũ hỏng bàn phím', quantity: 1 });
  });

  it('builds PostgREST filters for mine, waiting, and followed queues', async () => {
    fetchMock.mockImplementation(async () => new Response('[]', { status: 200 }));
    const employee: CurrentUser = { id: 'emp-1', name: 'emp', department: 'phong-a', roles: ['Employee'] };
    const managerAgent: CurrentUser = { id: 'mgr-1', name: 'mgr', department: 'phong-a', roles: ['Manager', 'Agent'] };

    // Employee has no actionable queue, so waiting short-circuits without fetch.
    await expect(listRequests(employee, 'waiting', 0)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    await listRequests(employee, 'mine', 1);
    const mineUrl = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(mineUrl.searchParams.get('requester_id')).toBe('eq.emp-1');
    expect(mineUrl.searchParams.get('offset')).toBe('25');

    await listRequests(managerAgent, 'waiting', 0);
    const waitingUrl = new URL(fetchMock.mock.calls[1][0], 'http://localhost');
    expect(waitingUrl.searchParams.get('requester_id')).toBe('neq.mgr-1');
    expect(waitingUrl.searchParams.get('or')).toBe('(and(status.eq.pending,department.eq.phong-a),status.in.(approved,preparing))');

    await listRequests(managerAgent, 'followed', 0);
    const followedUrl = new URL(fetchMock.mock.calls[2][0], 'http://localhost');
    expect(followedUrl.searchParams.get('not.or')).toBe('(and(status.eq.pending,department.eq.phong-a),status.in.(approved,preparing))');
  });

  it('maps 409/503 handoverUrl errors to HANDOVER_UNAVAILABLE and rethrows others', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ url: '/api/device-handovers/1/content' }), { status: 200 }));
    await expect(handoverUrl('req/1')).resolves.toBe('/api/device-handovers/1/content');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/device-requests/req%2F1/handover-url');

    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(handoverUrl('req-1')).rejects.toThrow(/Chưa tạo được biên bản bàn giao/);

    fetchMock.mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(handoverUrl('req-1')).rejects.toMatchObject({ status: 403 });
  });
});
