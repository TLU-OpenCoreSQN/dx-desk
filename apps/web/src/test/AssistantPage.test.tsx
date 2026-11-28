// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AssistantPage } from '../modules/desk/AssistantPage';
import * as api from '../modules/desk/assistantApi';

vi.mock('../modules/desk/assistantApi', () => ({
  streamAssistant: vi.fn(),
  decideAssistantProposal: vi.fn(),
  listAssistantSessions: vi.fn(),
  createAssistantSession: vi.fn(),
  getAssistantSession: vi.fn(),
  renameAssistantSession: vi.fn(),
  deleteAssistantSession: vi.fn(),
}));
const original = '10000000-0000-4000-8000-000000000001';
const created = '10000000-0000-4000-8000-000000000002';
let sessions: api.AssistantSession[];
let histories: Record<string, api.AssistantTurn[]>;
const row = (id: string, title: string): api.AssistantSession => ({
  id,
  title,
  created_at: '2026-11-23T10:00:00Z',
  updated_at: '2026-11-23T10:00:00Z',
});
function mount(id?: string) {
  return render(
    <MemoryRouter initialEntries={[id ? '/tro-ly?chat=' + id : '/tro-ly']}>
      <AssistantPage />
    </MemoryRouter>,
  );
}
async function send(text: string) {
  const input = screen.getByLabelText('Câu hỏi hỗ trợ IT');
  fireEvent.change(input, { target: { value: text } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
}
function saveResponse(
  question: string,
  conversation: { session_id: string; request_id: string },
  metadata: api.AssistantTurn['metadata'],
  answer = 'Kiểm tra VPN.',
) {
  histories[conversation.session_id].push({
    id: conversation.request_id,
    question,
    answer,
    status: 'complete',
    metadata,
    created_at: '2026-11-23T10:00:00Z',
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  sessions = [row(original, 'VPN cá nhân')];
  histories = { [original]: [], [created]: [] };
  vi.mocked(api.listAssistantSessions).mockImplementation(async () => ({
    data: [...sessions],
    has_more: false,
  }));
  vi.mocked(api.getAssistantSession).mockImplementation(async (id) => ({
    session: sessions.find((item) => item.id === id)!,
    turns: [...histories[id]],
    has_more: false,
  }));
  vi.mocked(api.createAssistantSession).mockImplementation(async () => {
    const session = row(created, 'Cuộc trò chuyện mới');
    sessions.unshift(session);
    return session;
  });
  vi.mocked(api.renameAssistantSession).mockImplementation(async (id, title) => {
    const session = sessions.find((item) => item.id === id)!;
    session.title = title;
    return { ...session };
  });
  vi.mocked(api.deleteAssistantSession).mockImplementation(async (id) => {
    sessions = sessions.filter((item) => item.id !== id);
    delete histories[id];
  });
  vi.mocked(api.streamAssistant).mockImplementation(async (question, _signal, emit, conversation) => {
    const metadata = { steps: [], sources: [] };
    saveResponse(question, conversation!, metadata);
    emit({ type: 'delta', text: 'Kiểm tra VPN.' });
    emit({ type: 'done' });
  });
});

it('creates a conversation on the first send and keeps later messages in the same session', async () => {
  mount();
  await screen.findByRole('button', { name: 'VPN cá nhân' });
  await send('Máy tôi dùng Windows.');
  await waitFor(() => expect(screen.getByText('Kiểm tra VPN.')).toBeInTheDocument());
  await send('Tôi cần làm gì tiếp?');
  await waitFor(() => expect(api.streamAssistant).toHaveBeenCalledTimes(2));
  expect(api.createAssistantSession).toHaveBeenCalledTimes(1);
  for (const call of vi.mocked(api.streamAssistant).mock.calls)
    expect(call[3]).toEqual({ session_id: created, request_id: expect.any(String) });
  expect(screen.getByRole('heading', { name: 'Máy tôi dùng Windows.' })).toBeInTheDocument();
});

it('loads persisted history and separates a newly created conversation', async () => {
  histories[original] = [
    {
      id: 'turn-1',
      question: 'Mật khẩu VPN của tôi bị khóa.',
      answer: 'Hãy kiểm tra tài khoản.',
      status: 'complete',
      metadata: { steps: [], sources: [] },
      created_at: '2026-11-23T10:00:00Z',
    },
  ];
  mount(original);
  expect(await screen.findByText('Hãy kiểm tra tài khoản.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cuộc trò chuyện mới' }));
  await waitFor(() => expect(screen.queryByText('Hãy kiểm tra tài khoản.')).not.toBeInTheDocument());
  await send('Wi-Fi văn phòng bị mất kết nối.');
  await waitFor(() =>
    expect(api.streamAssistant).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(AbortSignal),
      expect.any(Function),
      { session_id: created, request_id: expect.any(String) },
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'VPN cá nhân' }));
  expect(await screen.findByText('Hãy kiểm tra tài khoản.')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Wi-Fi văn phòng bị mất kết nối.' })).not.toBeInTheDocument();
});

it('renames a conversation and requires confirmation before deleting its history', async () => {
  mount(original);
  await screen.findByRole('button', { name: 'VPN cá nhân' });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi tên VPN cá nhân' }));
  fireEvent.change(screen.getByLabelText('Tên cuộc trò chuyện'), { target: { value: 'VPN làm việc từ xa' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tên cuộc trò chuyện' }));
  expect(await screen.findByRole('button', { name: 'VPN làm việc từ xa' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa VPN làm việc từ xa' }));
  const dialog = await screen.findByRole('dialog');
  expect(api.deleteAssistantSession).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa cuộc trò chuyện' }));
  await waitFor(() => expect(api.deleteAssistantSession).toHaveBeenCalledWith(original));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'VPN làm việc từ xa' })).not.toBeInTheDocument(),
  );
});

it.each([
  [true, 'Xác nhận', 'Đã thực hiện.'],
  [false, 'Hủy đề xuất', 'Đã hủy đề xuất.'],
] as const)(
  'retains explicit human approval for approve=%s in a saved conversation',
  async (approve, button, status) => {
    vi.mocked(api.streamAssistant).mockImplementation(async (question, _signal, emit, conversation) => {
      const proposal = { id: 'proposal-1', label: 'Tạo phiếu', fields: { title: 'VPN bị lỗi' } };
      const sources = [
        { title: 'Wiki VPN', url: 'https://wiki.example.test/en/ho-tro/vpn' },
        { title: 'Liên kết sai', url: 'javascript:void(0)' },
      ];
      saveResponse(question, conversation!, { steps: ['Tìm Wiki'], sources, proposal });
      emit({ type: 'step', label: 'Tìm Wiki' });
      emit({ type: 'delta', text: 'Kiểm tra VPN.' });
      emit({ type: 'sources', items: sources });
      emit({ type: 'proposal', ...proposal });
      emit({ type: 'done' });
    });
    vi.mocked(api.decideAssistantProposal).mockResolvedValue({ status: approve ? 'applied' : 'cancelled' });
    mount(original);
    await screen.findByRole('button', { name: 'VPN cá nhân' });
    await send('VPN không kết nối.');
    await waitFor(() => expect(screen.getByText('Kiểm tra VPN.')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Wiki VPN' })).toHaveAttribute(
      'href',
      'https://wiki.example.test/en/ho-tro/vpn',
    );
    expect(screen.queryByText('Liên kết sai')).not.toBeInTheDocument();
    expect(api.decideAssistantProposal).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: button })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(await screen.findByText(status)).toBeInTheDocument();
    expect(api.decideAssistantProposal).toHaveBeenCalledWith('proposal-1', approve, expect.any(AbortSignal));
  },
);

it('aborts the live stream when switching conversations and ignores its late output', async () => {
  let signal: AbortSignal | undefined;
  let late: ((event: api.AssistantEvent) => void) | undefined;
  vi.mocked(api.streamAssistant).mockImplementation(async (_text, current, emit) => {
    signal = current;
    late = emit;
    await new Promise<void>((resolve) => current.addEventListener('abort', () => resolve(), { once: true }));
  });
  mount(original);
  await screen.findByRole('button', { name: 'VPN cá nhân' });
  await send('Câu hỏi đang chạy.');
  await screen.findByRole('button', { name: 'Dừng trả lời' });
  fireEvent.click(screen.getByRole('button', { name: 'Cuộc trò chuyện mới' }));
  await waitFor(() => expect(signal?.aborted).toBe(true));
  late?.({ type: 'delta', text: 'Nội dung của cuộc chat cũ' });
  expect(screen.queryByText('Nội dung của cuộc chat cũ')).not.toBeInTheDocument();
});

it('keeps the draft when a send fails before the server saves the message', async () => {
  vi.mocked(api.streamAssistant).mockRejectedValue(new Error('Kết nối bị ngắt.'));
  mount(original);
  await screen.findByRole('button', { name: 'VPN cá nhân' });
  await send('Tin nhắn cần giữ lại.');
  await waitFor(() =>
    expect(screen.getByLabelText('Câu hỏi hỗ trợ IT')).toHaveValue('Tin nhắn cần giữ lại.'),
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Kết nối bị ngắt.');
});

it('ignores an older history refresh that arrives after a newer message', async () => {
  const read = vi.mocked(api.getAssistantSession).getMockImplementation()!;
  let resolveOld: ((detail: api.SessionDetail) => void) | undefined;
  let old: api.SessionDetail | undefined;
  let reads = 0;
  vi.mocked(api.getAssistantSession).mockImplementation(async (...args) => {
    reads++;
    if (reads === 2) {
      old = { session: sessions[0], turns: [...histories[original]], has_more: false };
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    }
    return read(...args);
  });
  mount(original);
  await screen.findByRole('button', { name: 'VPN cá nhân' });
  await send('Tin đầu tiên.');
  await waitFor(() => expect(resolveOld).toBeDefined());
  await send('Tin tiếp theo.');
  await waitFor(() => expect(reads).toBe(3));
  await act(async () => resolveOld!(old!));
  expect(screen.getByRole('heading', { name: 'Tin tiếp theo.' })).toBeInTheDocument();
});

it('retries a failed pending-turn poll and unlocks sending when the next poll completes', async () => {
  const pending: api.AssistantTurn = {
    id: 'remote-turn', question: 'Một tab khác đang hỏi.', answer: '', status: 'pending',
    metadata: { steps: [], sources: [] }, created_at: '2026-11-28T10:00:00Z',
  };
  vi.mocked(api.getAssistantSession)
    .mockResolvedValueOnce({ session: sessions[0], turns: [pending], has_more: false })
    .mockRejectedValueOnce(new Error('Mạng tạm thời gián đoạn.'))
    .mockResolvedValueOnce({ session: sessions[0], turns: [{ ...pending, answer: 'Đã trả lời xong.', status: 'complete' }], has_more: false });
  vi.useFakeTimers();
  let view: ReturnType<typeof mount> | undefined;
  try {
    await act(async () => { view = mount(original); });
    fireEvent.change(screen.getByLabelText('Câu hỏi hỗ trợ IT'), { target: { value: 'Câu hỏi tiếp theo.' } });
    expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByRole('alert')).toHaveTextContent('Mạng tạm thời gián đoạn.');
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByText('Đã trả lời xong.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.getAssistantSession).toHaveBeenCalledTimes(3);
  } finally { view?.unmount(); vi.useRealTimers(); }
});

it('aborts a pending history poll and cancels retry timers after leaving the page', async () => {
  histories[original] = [{ id: 'pending', question: 'Đang chờ.', answer: '', status: 'pending', metadata: { steps: [], sources: [] }, created_at: '2026-11-28T10:00:00Z' }];
  let signal: AbortSignal | undefined;
  vi.mocked(api.getAssistantSession).mockImplementationOnce(async () => ({ session: sessions[0], turns: histories[original], has_more: false }))
    .mockImplementationOnce(async (_id, current) => {
      signal = current;
      return new Promise<api.SessionDetail>(() => {});
    });
  vi.useFakeTimers();
  let view: ReturnType<typeof mount> | undefined;
  try {
    await act(async () => { view = mount(original); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(signal).toBeDefined();
    view!.unmount();
    expect(signal!.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(api.getAssistantSession).toHaveBeenCalledTimes(2);
  } finally { view?.unmount(); vi.useRealTimers(); }
});
