// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AssistantPage } from '../modules/desk/AssistantPage';
import { decideAssistantProposal, streamAssistant } from '../modules/desk/assistantApi';

vi.mock('../modules/desk/assistantApi', () => ({ streamAssistant: vi.fn(), decideAssistantProposal: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it.each([[true, 'Xác nhận', 'Đã thực hiện.'], [false, 'Hủy đề xuất', 'Đã hủy đề xuất.']] as const)(
  'waits for an explicit user decision before submitting approve=%s', async (approve, button, status) => {
    vi.mocked(streamAssistant).mockImplementation(async (_text, _signal, emit) => {
      emit({ type: 'step', label: 'Tìm Wiki' });
      emit({ type: 'delta', text: 'Kiểm tra ' });
      emit({ type: 'delta', text: 'VPN.' });
      emit({ type: 'sources', items: [
        { title: 'Wiki VPN', url: 'https://wiki.example.test/en/ho-tro/vpn' },
        { title: 'Liên kết sai', url: 'javascript:void(0)' },
      ] });
      emit({ type: 'proposal', id: 'proposal-1', label: 'Tạo phiếu', fields: { title: 'VPN bị lỗi' } });
      emit({ type: 'done' });
    });
    vi.mocked(decideAssistantProposal).mockResolvedValue({ status: approve ? 'applied' : 'cancelled' });
    render(<MemoryRouter><AssistantPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Câu hỏi hỗ trợ IT'), { target: { value: 'VPN không kết nối' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
    expect(await screen.findByText('Kiểm tra VPN.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Các bước gọi công cụ' })).toHaveTextContent('Tìm Wiki');
    expect(screen.getByRole('link', { name: 'Wiki VPN' })).toHaveAttribute('href', 'https://wiki.example.test/en/ho-tro/vpn');
    expect(screen.queryByText('Liên kết sai')).not.toBeInTheDocument();
    expect(decideAssistantProposal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(await screen.findByText(status)).toBeInTheDocument();
    expect(decideAssistantProposal).toHaveBeenCalledWith('proposal-1', approve, expect.any(AbortSignal));
    await waitFor(() => expect(screen.queryByRole('button', { name: button })).not.toBeInTheDocument());
  },
);

it('renders SPA router link when proposal creates a ticket', async () => {
  vi.mocked(streamAssistant).mockImplementation(async (_text, _signal, emit) => {
    emit({ type: 'proposal', id: 'proposal-2', label: 'Tạo phiếu', fields: { title: 'Lỗi mạng' } });
    emit({ type: 'done' });
  });
  vi.mocked(decideAssistantProposal).mockResolvedValue({
    status: 'applied',
    result: { id: 'act-1', ticket_id: 'ticket-99' },
  });
  render(<MemoryRouter><AssistantPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Câu hỏi hỗ trợ IT'), { target: { value: 'Mạng chậm' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
  const link = await screen.findByRole('link', { name: 'Xem phiếu vừa tạo' });
  expect(link).toHaveAttribute('href', '/tickets/ticket-99');
});
