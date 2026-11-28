// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AssistantTurn } from '../modules/desk/AssistantTurn';

it('opens the created ticket through the SPA router instead of a full page reload', () => {
  render(
    <MemoryRouter initialEntries={['/tro-ly']}>
      <Routes>
        <Route path="/tro-ly" element={<ol><AssistantTurn busy={false} onDecide={vi.fn()} turn={{
          id: 'turn-1', question: 'Tạo phiếu VPN giúp tôi.', answer: 'Đã tạo phiếu.', status: 'complete',
          created_at: '2026-11-26T00:00:00Z',
          metadata: { steps: [], sources: [], proposal: {
            id: 'proposal-1', label: 'Tạo phiếu', fields: { title: 'VPN' }, status: 'applied',
            result: { id: 'act-1', ticket_id: 'ticket-99' },
          } },
        }} /></ol>} />
        <Route path="/tickets/:id" element={<p>Trang phiếu ticket-99</p>} />
      </Routes>
    </MemoryRouter>,
  );
  const link = screen.getByRole('link', { name: 'Xem phiếu vừa tạo' });
  expect(link).toHaveAttribute('href', '/tickets/ticket-99');
  fireEvent.click(link);
  expect(screen.getByText('Trang phiếu ticket-99')).toBeInTheDocument();
});
