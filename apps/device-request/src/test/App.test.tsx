// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CurrentUser, DeviceRequest } from '../workflow';

const rest = vi.hoisted(() => ({ listRequests: vi.fn(), createRequest: vi.fn(), transition: vi.fn(), listEvents: vi.fn(), handoverUrl: vi.fn() }));
vi.mock('../rest', () => ({ ...rest, REQUEST_PAGE_SIZE: 25 }));
vi.mock('../keycloak', () => ({ initKeycloak: vi.fn(), currentUser: vi.fn(), logout: vi.fn() }));
import { Workspace } from '../App';

const row = (patch: Partial<DeviceRequest>): DeviceRequest => ({
  id: '11111111-0000-4000-8000-000000000001', requester_id: 'employee-a', device_type: 'monitor', reason: 'Màn hình bị sọc ngang',
  quantity: 1, status: 'pending', department: 'phong-hanh-chinh', decided_by: null, decided_at: null, decision_note: null,
  prepared_at: null, handed_over_at: null, created_at: '2026-11-12T02:00:00Z', updated_at: '2026-11-12T02:00:00Z', ...patch,
});
const employee: CurrentUser = { id: 'employee-a', name: 'employee.a', department: 'phong-hanh-chinh', roles: ['Employee'] };
const manager: CurrentUser = { id: 'manager-1', name: 'manager.1', department: 'phong-hanh-chinh', roles: ['Manager'] };
const agent: CurrentUser = { id: 'agent-1', name: 'agent.1', department: 'phong-cntt', roles: ['Agent'] };

beforeEach(() => {
  vi.resetAllMocks();
  rest.listRequests.mockResolvedValue([]);
});

describe('employee', () => {
  it('validates locally, then sends only device type, reason and quantity', async () => {
    const created = row({ id: '22222222-0000-4000-8000-000000000002', quantity: 2 });
    rest.createRequest.mockImplementation(async () => {
      rest.listRequests.mockResolvedValue([created]);
      return created;
    });
    render(<Workspace user={employee} />);
    await screen.findByText('Bạn chưa gửi đề nghị nào.');
    expect(screen.queryByRole('heading', { name: /Chờ bạn/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Gửi đề nghị' }));
    expect(screen.getByText('Lý do cần ít nhất 10 ký tự.')).toBeInTheDocument();
    expect(rest.createRequest).not.toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText('Loại thiết bị'), 'monitor');
    await userEvent.clear(screen.getByLabelText('Số lượng'));
    await userEvent.type(screen.getByLabelText('Số lượng'), '2');
    await userEvent.type(screen.getByLabelText('Lý do'), 'Màn hình bị sọc ngang');
    await userEvent.click(screen.getByRole('button', { name: 'Gửi đề nghị' }));
    await screen.findByText('Đã gửi đề nghị, chờ quản lý duyệt.');
    expect(rest.createRequest).toHaveBeenCalledWith({ device_type: 'monitor', reason: 'Màn hình bị sọc ngang', quantity: 2 });
    const mine = screen.getByRole('region', { name: /Đề nghị của tôi/ });
    expect(await within(mine).findByText('Màn hình × 2')).toBeInTheDocument();
    expect(within(mine).queryByRole('button', { name: 'Duyệt' })).toBeNull();
  });

  it('shows the fixed message when the account has no unit and hides the form', async () => {
    render(<Workspace user={{ ...employee, department: null }} />);
    expect(await screen.findByText(/chưa được gán đơn vị/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gửi đề nghị' })).toBeNull();
  });

  it('surfaces a server refusal without clearing what was typed', async () => {
    rest.createRequest.mockRejectedValue(new Error('Tài khoản chưa được gán đơn vị nên chưa gửi được đề nghị. Liên hệ quản trị hệ thống.'));
    render(<Workspace user={employee} />);
    await userEvent.type(screen.getByLabelText('Lý do'), 'Cần bàn phím thay thế');
    await userEvent.click(screen.getByRole('button', { name: 'Gửi đề nghị' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/chưa được gán đơn vị/);
    expect(screen.getByLabelText('Lý do')).toHaveValue('Cần bàn phím thay thế');
  });
});

describe('manager', () => {
  it('approves a pending request of the unit and needs a reason to reject', async () => {
    const second = row({ id: '33333333-0000-4000-8000-000000000003', device_type: 'mouse', reason: 'Chuột hỏng nút trái' });
    let requests = [row({}), second];
    rest.listRequests.mockImplementation(async (_user, queue) => queue === 'mine' ? [] :
      requests.filter(request => (request.status === 'pending') === (queue === 'waiting')));
    rest.transition.mockImplementation(async (id: string, to: string, note?: string) => {
      const changed = { ...requests.find(request => request.id === id)!, status: to as DeviceRequest['status'], decision_note: note ?? null };
      requests = requests.map(request => request.id === id ? changed : request);
      return changed;
    });
    render(<Workspace user={manager} />);
    const waiting = await screen.findByRole('region', { name: /Chờ bạn duyệt · đơn vị phong-hanh-chinh/ });
    await waitFor(() => expect(within(waiting).getAllByRole('article')).toHaveLength(2));
    // Đề nghị của chính quản lý không có nút duyệt.
    const mine = screen.getByRole('region', { name: /Đề nghị của tôi/ });
    expect(within(mine).queryByRole('button', { name: 'Duyệt' })).toBeNull();

    const mouse = within(waiting).getByRole('article', { name: 'Đề nghị 33333333' });
    await userEvent.click(within(mouse).getByRole('button', { name: 'Từ chối' }));
    await userEvent.click(within(mouse).getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(within(mouse).getByText('Lý do từ chối cần ít nhất 5 ký tự.')).toBeInTheDocument();
    expect(rest.transition).not.toHaveBeenCalled();
    await userEvent.type(within(mouse).getByLabelText('Lý do từ chối'), 'Kho đơn vị còn chuột dự phòng');
    await userEvent.click(within(mouse).getByRole('button', { name: 'Xác nhận từ chối' }));
    await waitFor(() => expect(rest.transition).toHaveBeenCalledWith(second.id, 'rejected', 'Kho đơn vị còn chuột dự phòng'));

    const monitor = within(waiting).getByRole('article', { name: 'Đề nghị 11111111' });
    await userEvent.click(within(monitor).getByRole('button', { name: 'Duyệt' }));
    await waitFor(() => expect(rest.transition).toHaveBeenCalledWith('11111111-0000-4000-8000-000000000001', 'approved', undefined));
    // Sau khi xử lý, cả hai rời hàng chờ và hiện ở mục theo dõi của đơn vị.
    const followed = await screen.findByRole('region', { name: /Đề nghị khác của đơn vị/ });
    expect(await within(followed).findByText('Đã duyệt, chờ IT')).toBeInTheDocument();
    expect(within(followed).getByText('Lý do từ chối: Kho đơn vị còn chuột dự phòng')).toBeInTheDocument();
  });

  it('paginates actionable requests independently of history', async () => {
    const rows = Array.from({ length: 26 }, (_, i) => row({ id: `${i}-0000-4000-8000-000000000001`, reason: `Yêu cầu số ${i}` }));
    rest.listRequests.mockImplementation(async (_user, queue, page) => queue !== 'waiting' ? [] : page === 0 ? rows : rows.slice(25));
    render(<Workspace user={manager} />);
    const waiting = screen.getByRole('region', { name: /Chờ bạn duyệt/ });
    await userEvent.click(await within(waiting).findByRole('button', { name: 'Trang sau' }));
    expect(await within(waiting).findByText('Yêu cầu số 25')).toBeInTheDocument();
    expect(rest.listRequests).toHaveBeenCalledWith(manager, 'waiting', 1);
    expect(rest.listRequests).toHaveBeenCalledWith(manager, 'followed', 0);
  });
});

describe('IT', () => {
  it('prepares, hands over and shows the server message when a step was already taken', async () => {
    let current = row({ status: 'approved' });
    rest.listRequests.mockImplementation(async (_user, queue) => queue === 'waiting' ? [current] : []);
    rest.transition.mockImplementationOnce(async () => current = row({ status: 'preparing' }))
      .mockRejectedValueOnce(new Error('Đề nghị đã chuyển sang bước khác. Tải lại danh sách để xem trạng thái mới.'));
    rest.listEvents.mockResolvedValue([
      { id: 'e1', request_id: 'r', actor_id: 'employee-a', actor_type: 'user', actor_name: 'employee.a', from_status: null, to_status: 'pending', note: null, created_at: '2026-11-12T02:00:00Z' },
      { id: 'e2', request_id: 'r', actor_id: 'manager-1', actor_type: 'user', actor_name: 'manager.1', from_status: 'pending', to_status: 'approved', note: null, created_at: '2026-11-12T03:00:00Z' },
    ]);
    render(<Workspace user={agent} />);
    const card = await screen.findByRole('article', { name: 'Đề nghị 11111111' });
    await userEvent.click(within(card).getByRole('button', { name: 'Bắt đầu chuẩn bị' }));
    await within(card).findByRole('button', { name: 'Xác nhận đã bàn giao' });
    expect(rest.transition).toHaveBeenCalledWith('11111111-0000-4000-8000-000000000001', 'preparing', undefined);
    await userEvent.click(within(card).getByRole('button', { name: 'Xác nhận đã bàn giao' }));
    expect(await within(card).findByRole('alert')).toHaveTextContent(/đã chuyển sang bước khác/);

    await userEvent.click(within(card).getByRole('button', { name: 'Lịch sử' }));
    const history = await within(card).findByRole('list', { name: 'Lịch sử xử lý' });
    expect(within(history).getAllByRole('listitem')).toHaveLength(2);
    expect(history).toHaveTextContent('Gửi đề nghị — employee.a');
    expect(history).toHaveTextContent('Đã duyệt, chờ IT — manager.1');
  });
});

describe('handover document (W5-03)', () => {
  it('does not offer the PDF to a department manager who did not approve it', async () => {
    rest.listRequests.mockImplementation(async (_user, queue) => queue === 'followed'
      ? [row({ status: 'handed_over', decided_by: 'another-manager' })] : []);
    render(<Workspace user={manager} />);
    const done = await screen.findByRole('article', { name: 'Đề nghị 11111111' });
    expect(within(done).queryByRole('button', { name: 'Tải biên bản (PDF)' })).toBeNull();
  });

  it('offers the PDF only for handed-over requests and follows the signed URL', async () => {
    rest.listRequests.mockResolvedValue([row({ status: 'handed_over' }), row({ id: '55555555-0000-4000-8000-000000000005', status: 'approved' })]);
    rest.handoverUrl.mockResolvedValueOnce('/api/device-handovers/x/content?expires=1&signature=s')
      .mockRejectedValueOnce(new Error('Chưa tạo được biên bản bàn giao. Vui lòng thử lại sau ít phút.'));
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    try {
      render(<Workspace user={employee} />);
      const done = await screen.findByRole('article', { name: 'Đề nghị 11111111' });
      const open = screen.getByRole('article', { name: 'Đề nghị 55555555' });
      expect(within(open).queryByRole('button', { name: 'Tải biên bản (PDF)' })).toBeNull();
      await userEvent.click(within(done).getByRole('button', { name: 'Tải biên bản (PDF)' }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith('/api/device-handovers/x/content?expires=1&signature=s'));
      expect(rest.handoverUrl).toHaveBeenCalledWith('11111111-0000-4000-8000-000000000001');
      await userEvent.click(within(done).getByRole('button', { name: 'Tải biên bản (PDF)' }));
      expect(await within(done).findByRole('alert')).toHaveTextContent(/Chưa tạo được biên bản/);
      expect(assign).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
