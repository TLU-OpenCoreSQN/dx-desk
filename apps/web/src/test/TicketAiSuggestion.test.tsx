// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { act, fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TicketAiSuggestion } from '../modules/desk/TicketAiSuggestion';
import { decideAiSuggestion, getAiSuggestion } from '../modules/desk/aiSuggestionApi';
import { getTeams } from '../services/api';
import { TicketTimeline } from '../components/ticket-detail/TicketTimeline';

vi.mock('../modules/desk/aiSuggestionApi', () => ({ getAiSuggestion: vi.fn(), decideAiSuggestion: vi.fn() }));
vi.mock('../services/api', () => ({ getTeams: vi.fn() }));

const suggestion = { id: 'revision-1', category_id: 'vpn', team_id: 'support', priority: 'normal' as const, summary: 'VPN không kết nối' };
const categories = [{ id: 'vpn', code: 'vpn', name: 'VPN' }, { id: 'account', code: 'account', name: 'Tài khoản' }];
const refresh = vi.fn(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAiSuggestion).mockResolvedValue(suggestion);
  vi.mocked(getTeams).mockResolvedValue({ data: [{ id: 'support', name: 'IT Support', active: true, members: [] }] });
});

it('edits a draft locally and submits exactly the reviewed fields', async () => {
  render(<TicketAiSuggestion ticketId="ticket-1" categories={categories} refresh={refresh} />);
  await screen.findByText('IT Support');
  fireEvent.click(screen.getByRole('button', { name: 'Sửa đề xuất' }));
  fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'account' } });
  fireEvent.change(screen.getByLabelText('Tóm tắt'), { target: { value: 'Cần xác minh tài khoản' } });
  expect(screen.getByLabelText('Ưu tiên')).not.toHaveTextContent(/Critical|Khẩn cấp/);
  expect(decideAiSuggestion).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận bản đã sửa' }));
  expect(await screen.findByText('Đã xác nhận đề xuất AI.')).toBeInTheDocument();
  expect(decideAiSuggestion).toHaveBeenCalledWith('ticket-1', 'revision-1', {
    category_id: 'account', team_id: 'support', priority: 'normal', summary: 'Cần xác minh tài khoản',
  });
  expect(refresh).toHaveBeenCalledOnce();
});

it.each([true, false])('supports direct confirmation or dismissal (confirm=%s)', async approve => {
  render(<TicketAiSuggestion ticketId="ticket-1" categories={categories} refresh={refresh} />);
  fireEvent.click(await screen.findByRole('button', { name: approve ? 'Xác nhận đề xuất' : 'Bỏ qua' }));
  expect(await screen.findByRole('status')).toHaveTextContent(approve ? 'Đã xác nhận đề xuất AI.' : 'Đã bỏ qua đề xuất AI.');
  const { id, ...values } = suggestion;
  expect(decideAiSuggestion).toHaveBeenCalledWith('ticket-1', id, approve ? values : null);
});

it('labels the persisted suggestion event and AI actor in ticket history', () => {
  render(<TicketTimeline events={[{ id: 'event', ticket_id: 'ticket-1', actor_id: 'manager', actor_name: 'manager.1',
    actor_type: 'ai', event_type: 'ai_suggestion_applied', created_at: '2026-11-17T00:00:00Z', payload: {} }]} />);
  expect(screen.getByText('Đã xác nhận đề xuất AI')).toBeInTheDocument();
  expect(screen.getByText('AI (manager.1)')).toBeInTheDocument();
});

it('re-fetches and clears suggestion when ticketStatus or assignedTo changes', async () => {
  const { rerender } = render(
    <TicketAiSuggestion ticketId="ticket-1" ticketStatus="assigned" assignedTo={null} categories={categories} refresh={refresh} />
  );
  await screen.findByText('IT Support');

  vi.mocked(getAiSuggestion).mockResolvedValueOnce(null);
  rerender(
    <TicketAiSuggestion ticketId="ticket-1" ticketStatus="in_progress" assignedTo="agent-1" categories={categories} refresh={refresh} />
  );
  await waitForElementToBeRemoved(() => screen.queryByRole('heading', { name: 'Đề xuất của AI' }));
  expect(getAiSuggestion).toHaveBeenCalledTimes(2);
});

it('drops an open draft when the reloaded suggestion is a different revision', async () => {
  const { rerender } = render(
    <TicketAiSuggestion ticketId="ticket-1" ticketStatus="new" assignedTo={null} categories={categories} refresh={refresh} />
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa đề xuất' }));
  fireEvent.change(screen.getByLabelText('Tóm tắt'), { target: { value: 'Bản sửa cho revision-1' } });

  vi.mocked(getAiSuggestion).mockResolvedValueOnce({ ...suggestion, id: 'revision-2', summary: 'Đề xuất mới' });
  rerender(
    <TicketAiSuggestion ticketId="ticket-1" ticketStatus="assigned" assignedTo={null} categories={categories} refresh={refresh} />
  );
  expect(await screen.findByText('Đề xuất mới')).toBeInTheDocument();
  expect(screen.queryByLabelText('Tóm tắt')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đề xuất' }));
  const { id: _id, ...values } = suggestion;
  await waitFor(() => expect(decideAiSuggestion).toHaveBeenCalledWith('ticket-1', 'revision-2', { ...values, summary: 'Đề xuất mới' }));
});

it('keeps the open draft when the reload returns the same revision', async () => {
  const { rerender } = render(
    <TicketAiSuggestion ticketId="ticket-1" ticketStatus="new" assignedTo={null} categories={categories} refresh={refresh} />
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa đề xuất' }));
  fireEvent.change(screen.getByLabelText('Tóm tắt'), { target: { value: 'Đang sửa dở' } });

  rerender(
    <TicketAiSuggestion ticketId="ticket-1" ticketStatus="assigned" assignedTo={null} categories={categories} refresh={refresh} />
  );
  await waitFor(() => expect(getAiSuggestion).toHaveBeenCalledTimes(2));
  await act(async () => {});
  expect(screen.getByLabelText('Tóm tắt')).toHaveValue('Đang sửa dở');
});
