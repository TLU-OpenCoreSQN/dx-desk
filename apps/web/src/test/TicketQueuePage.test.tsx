// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkQueuePage } from '../modules/desk/pages/WorkQueuePage';
import { ManagerApprovalsPage } from '../modules/desk/pages/ManagerApprovalsPage';
import * as api from '../services/api';
import * as auth from '../contexts/AuthContext';
import { PaginatedResponse, Ticket, UserRole } from '../types/api';

const ticket: Ticket = {
  id: 'ticket-queue', requester_id: 'employee-1', requester_name: 'Nhân viên đề nghị',
  category_id: 'vpn', title: 'Không kết nối được VPN', description: 'VPN báo lỗi khi xác thực.',
  priority: 'high', status: 'assigned', assigned_to: null, assigned_team_id: 'team-network',
  team_name: 'Hạ tầng mạng', assignee_name: null, ticket_version: 7,
  sla_due_at: '2026-11-04T03:00:00Z', sla_paused_ms: 120000, sla_breached: true,
  created_at: '2026-11-02T03:00:00Z', updated_at: '2026-11-02T03:00:00Z',
};
const response = (data: Ticket[] = [ticket], total = data.length): PaginatedResponse<Ticket> => ({ data, total, limit: 25, offset: 0 });

function authorize(roles: UserRole[]) {
  vi.spyOn(auth, 'useAuth').mockReturnValue({ roles, profile: { id: 'agent-1', username: 'agent.one', roles } } as ReturnType<typeof auth.useAuth>);
}
function mount(approvals = false) { return render(<MemoryRouter>{approvals ? <ManagerApprovalsPage /> : <WorkQueuePage />}</MemoryRouter>); }
/** Lời gọi tải danh sách (limit 25); lời gọi limit 1 là đếm số phiếu từng hàng đợi. */
function lastList() { return vi.mocked(api.getTickets).mock.calls.filter(([limit]) => limit === 25).at(-1); }
function listMock(list: () => Promise<PaginatedResponse<Ticket>> | PaginatedResponse<Ticket>, counts: Record<string, number> = {}) {
  vi.mocked(api.getTickets).mockImplementation(async (limit, _offset, filters) =>
    limit === 1 ? response([], counts[filters?.queue ?? ''] ?? 0) : list());
}

describe('server-side ticket queues', () => {
  beforeEach(() => {
    vi.restoreAllMocks(); authorize(['Agent']);
    vi.spyOn(api, 'getTickets').mockResolvedValue(response());
    vi.spyOn(api, 'getTeams').mockResolvedValue({ data: [
      { id: 'team-network', name: 'Hạ tầng mạng', active: true, members: [{ user_id: 'agent-1', display_name: 'Kỹ thuật viên Một', active: true }] },
      { id: 'team-other', name: 'Nhóm khác', active: true, members: [] },
    ] });
  });

  it('denies Employees and Agent-only manager approval routes without fetching staff data', () => {
    authorize(['Employee']); const view = mount();
    expect(screen.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument();
    expect(api.getTickets).not.toHaveBeenCalled(); expect(api.getTeams).not.toHaveBeenCalled();
    view.unmount(); authorize(['Agent']); mount(true);
    expect(screen.getByText('Hàng đợi phê duyệt dành cho Quản lý.')).toBeInTheDocument();
    expect(api.getTickets).not.toHaveBeenCalled();
  });

  it('uses server queue, team and pagination filters and resets pagination on a new queue', async () => {
    vi.mocked(api.getTickets).mockResolvedValue(response([ticket], 51)); mount();
    await screen.findByRole('button', { name: ticket.title });
    expect(api.getTickets).toHaveBeenCalledWith(25, 0, { queue: 'my_open' });
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(lastList()).toEqual([25, 25, { queue: 'my_open' }]));
    await screen.findByText(/51 phiếu trong hàng đợi · Trang 2/);
    fireEvent.click(screen.getByRole('button', { name: /^Nhóm của tôi · Chưa nhận/ }));
    await waitFor(() => expect(lastList()).toEqual([25, 0, { queue: 'team_unassigned' }]));
    const team = screen.getByRole('combobox', { name: 'Nhóm xử lý' });
    expect(within(team).queryByRole('option', { name: 'Nhóm khác' })).not.toBeInTheDocument();
    fireEvent.change(team, { target: { value: 'team-network' } });
    await waitFor(() => expect(lastList()).toEqual([25, 0, { queue: 'team_unassigned', team_id: 'team-network' }]));
  });

  it('shows per-queue counts from the list API so unclaimed work is visible from any queue', async () => {
    listMock(() => response([ticket]), { my_open: 1, team_unassigned: 3, team_assigned: 0 }); mount();
    await screen.findByRole('button', { name: ticket.title });
    expect(await screen.findByRole('button', { name: /Nhóm của tôi · Chưa nhận\s*: 3 phiếu/ })).toBeInTheDocument();
    expect(api.getTickets).toHaveBeenCalledWith(1, 0, { queue: 'team_unassigned' });
  });

  it('sorts breached and at-risk tickets first and filters by SLA attention', async () => {
    const now = Date.now();
    const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
    const calm = { ...ticket, id: 'calm', title: 'Cài phần mềm', sla_breached: false, sla_paused_ms: 0, created_at: iso(-3600e3), sla_due_at: iso(20 * 3600e3) };
    const risky = { ...ticket, id: 'risky', title: 'Máy in hỏng', sla_breached: false, sla_paused_ms: 0, created_at: iso(-9 * 3600e3), sla_due_at: iso(3600e3) };
    const late = { ...ticket, id: 'late', title: 'Mất mạng tầng 3', sla_breached: true, sla_paused_ms: 0, created_at: iso(-9 * 3600e3), sla_due_at: iso(-3600e3 - 60e3) };
    listMock(() => response([calm, risky, late])); mount();
    await screen.findByRole('button', { name: calm.title });
    const list = screen.getByRole('list', { name: 'Phiếu trong hàng đợi' });
    const titles = within(list).getAllByRole('button', { expanded: false }).map(button => button.textContent);
    expect(titles).toEqual([late.title, risky.title, calm.title]);
    expect(screen.getByText(/Quá hạn 1 giờ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /1 sắp quá hạn/ }));
    expect(screen.queryByRole('button', { name: calm.title })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: risky.title })).toBeInTheDocument();
  });

  it('opens a quick view with full context and a link to the detail page', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: ticket.title }));
    const panel = await screen.findByRole('complementary', { name: ticket.title });
    expect(within(panel).getByText(ticket.description)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /Mở chi tiết và lịch sử/ })).toHaveAttribute('href', `/tickets/${ticket.id}`);
    expect(within(panel).getByRole('heading', { name: ticket.title })).toHaveFocus();
    fireEvent.click(within(panel).getByRole('button', { name: 'Đóng xem nhanh' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('restores queue, team, page and the open ticket from the URL', async () => {
    vi.mocked(api.getTickets).mockResolvedValue(response([ticket], 60));
    render(<MemoryRouter initialEntries={[`/work-queue?queue=team_assigned&team=team-network&page=2&ticket=${ticket.id}`]}><WorkQueuePage /></MemoryRouter>);
    await screen.findByRole('complementary', { name: ticket.title });
    expect(api.getTickets).toHaveBeenCalledWith(25, 25, { queue: 'team_assigned', team_id: 'team-network' });
  });

  it('only offers claim for active members and refreshes a 409 without overwriting the winner', async () => {
    let call = 0;
    listMock(() => ++call === 1
      ? response([ticket, { ...ticket, id: 'outside', title: 'Phiếu nhóm khác', assigned_team_id: 'team-other' }])
      : response([{ ...ticket, assigned_to: 'other-agent', assignee_name: 'Kỹ thuật viên khác' }]));
    const claim = vi.spyOn(api, 'claimTicket').mockRejectedValue(new api.ApiClientError(409, 'Phiếu đã được nhận'));
    mount(); await screen.findByRole('button', { name: 'Nhận xử lý' });
    expect(screen.getAllByRole('button', { name: 'Nhận xử lý' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Nhận xử lý' }));
    await screen.findByText(/Phiếu vừa được người khác cập nhật/);
    await screen.findByText('Kỹ thuật viên khác');
    expect(claim).toHaveBeenCalledExactlyOnceWith(ticket.id);
    expect(screen.queryByRole('button', { name: 'Nhận xử lý' })).not.toBeInTheDocument();
  });

  it('keeps claim disabled while in flight and does not repeat a mutation on duplicate clicks', async () => {
    let finish!: (value: Ticket) => void;
    const claim = vi.spyOn(api, 'claimTicket').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mount(); const button = await screen.findByRole('button', { name: 'Nhận xử lý' });
    fireEvent.click(button); fireEvent.click(button); expect(claim).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Đang nhận phiếu…' })).toBeDisabled();
    await act(async () => finish({ ...ticket, assigned_to: 'agent-1' }));
    expect(await screen.findByText(/Đã nhận phiếu/)).toBeInTheDocument();
  });

  it('allows Manager-only members to read queues without offering Agent claim actions', async () => {
    authorize(['Manager']); mount();
    await screen.findByRole('button', { name: ticket.title });
    await waitFor(() => expect(api.getTeams).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Nhận xử lý' })).not.toBeInTheDocument();
  });

  it('ignores a late response from the previous queue', async () => {
    let finish!: (value: PaginatedResponse<Ticket>) => void;
    let call = 0;
    listMock(() => ++call === 1 ? new Promise(resolve => { finish = resolve; }) : response([]));
    mount(); expect(screen.getByRole('status')).toHaveTextContent('Đang tải hàng đợi phiếu...');
    fireEvent.click(screen.getByRole('button', { name: /^Nhóm của tôi · Đã nhận/ }));
    await screen.findByText('Không có phiếu trong hàng đợi này.');
    await act(async () => finish(response()));
    expect(screen.queryByRole('button', { name: ticket.title })).not.toBeInTheDocument();
  });

  it('shows server errors with retry instead of retaining inaccessible records', async () => {
    let call = 0;
    listMock(() => ++call === 1 ? Promise.reject(new api.ApiClientError(403, 'Denied')) : response());
    mount(); await screen.findByText('HTTP 403');
    expect(screen.queryByRole('button', { name: ticket.title })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    await screen.findByRole('button', { name: ticket.title });
  });

  it('requires confirmation and a rejection reason, submitting the observed version', async () => {
    authorize(['Manager']); vi.mocked(api.getTickets).mockResolvedValueOnce(response([{ ...ticket, status: 'pending_approval', request_fields: { reason: 'Cần quyền VPN làm việc từ xa' } }])).mockResolvedValue(response([]));
    const update = vi.spyOn(api, 'updateTicketStatus').mockResolvedValue({ ...ticket, status: 'new' });
    mount(true); await screen.findByText('Cần quyền VPN làm việc từ xa');
    expect(api.getTickets).toHaveBeenCalledWith(25, 0, { queue: 'pending_approval' });
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối phiếu' }));
    const confirm = screen.getByRole('button', { name: 'Xác nhận quyết định' }); expect(confirm).toBeDisabled();
    const note = screen.getByRole('textbox', { name: /Lý do quyết định/ }); expect(note).toHaveFocus();
    fireEvent.change(note, { target: { value: 'Thiếu thông tin phạm vi quyền truy cập' } });
    expect(update).not.toHaveBeenCalled(); fireEvent.click(confirm);
    await waitFor(() => expect(update).toHaveBeenCalledExactlyOnceWith(ticket.id, { to: 'new', note: 'Thiếu thông tin phạm vi quyền truy cập', expected_version: 7 }));
    await screen.findByText(/Đã từ chối yêu cầu/); expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('refreshes stale approval decisions without replaying the decision', async () => {
    authorize(['Manager']); vi.mocked(api.getTickets).mockResolvedValueOnce(response([{ ...ticket, status: 'pending_approval' }])).mockResolvedValue(response([]));
    const update = vi.spyOn(api, 'updateTicketStatus').mockRejectedValue(new api.ApiClientError(409, 'Version changed'));
    mount(true); fireEvent.click(await screen.findByRole('button', { name: 'Duyệt phiếu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận quyết định' }));
    await screen.findByText(/Phiếu vừa được người khác cập nhật/);
    expect(update).toHaveBeenCalledExactlyOnceWith(ticket.id, { to: 'assigned', expected_version: 7 });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});
