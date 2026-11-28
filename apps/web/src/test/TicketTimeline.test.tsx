// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TicketTimeline } from '../components/ticket-detail/TicketTimeline';
import { TicketEvent } from '../types/api';

const events: TicketEvent[] = [
  {
    id: 'e1', ticket_id: 't1', event_type: 'created', actor_id: 'uuid-actor-1', actor_type: 'user',
    actor_name: null, payload: {}, created_at: '2026-11-20T02:00:00Z',
  },
  {
    id: 'e2', ticket_id: 't1', event_type: 'status_changed', actor_id: 'uuid-actor-2', actor_type: 'user',
    actor_name: 'Kỹ thuật viên A', payload: { from: 'new', to: 'assigned' }, created_at: '2026-11-20T03:00:00Z',
  },
  {
    id: 'e3', ticket_id: 't1', event_type: 'internal_unknown_kind', actor_id: null, actor_type: 'system',
    actor_name: null, payload: {}, created_at: '2026-11-20T04:00:00Z',
  },
] as TicketEvent[];

const headings = () =>
  within(screen.getByRole('region', { name: /Sự kiện ngày/ }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('p')?.textContent);

describe('TicketTimeline', () => {
  it('switches between oldest-first and newest-first without exposing ids or event codes', () => {
    render(<TicketTimeline events={events} />);

    expect(screen.getByRole('button', { name: 'Cũ nhất trước' })).toHaveAttribute('aria-pressed', 'true');
    expect(headings()[0]).toBe('Đã tiếp nhận phiếu');

    fireEvent.click(screen.getByRole('button', { name: 'Mới nhất trước' }));
    expect(screen.getByRole('button', { name: 'Mới nhất trước' })).toHaveAttribute('aria-pressed', 'true');
    expect(headings()[0]).toBe('Cập nhật phiếu');
    expect(headings()[2]).toBe('Đã tiếp nhận phiếu');

    expect(screen.queryByText(/uuid-actor/)).not.toBeInTheDocument();
    expect(screen.queryByText('internal_unknown_kind')).not.toBeInTheDocument();
    expect(screen.getByText('người dùng chưa có tên hiển thị')).toBeInTheDocument();
  });
});
