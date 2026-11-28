// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  TicketStageTracker,
  DeviceWorkflowStepper,
  TicketKanbanBoard,
  SlaPauseBanner,
  AiTriageDiff,
} from '../components/workflow';
import { DeviceRequest, Ticket } from '../types/api';

const mockBaseTicket: Ticket = {
  id: '018f-test-ticket-id-1234',
  requester_id: 'user-001',
  category_id: 'cat-network',
  title: 'Mất kết nối mạng toàn tầng 3',
  description: 'Không thể truy cập gateway và mạng nội bộ',
  priority: 'high',
  status: 'in_progress',
  assigned_to: 'tech-001',
  assignee_name: 'Nguyễn Văn Kỹ Thuật',
  assigned_team_id: 'team-infra',
  team_name: 'Đội Hạ tầng',
  sla_due_at: new Date(Date.now() + 3600000 * 2).toISOString(), // 2 hours in future
  sla_paused_ms: 0,
  created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  updated_at: new Date().toISOString(),
};

describe('TicketStageTracker (Model 1)', () => {
  it('renders all 6 linear happy path stages', () => {
    render(<TicketStageTracker ticket={mockBaseTicket} />);

    expect(screen.getByText('Mới tạo')).toBeInTheDocument();
    expect(screen.getByText('Đã phân loại')).toBeInTheDocument();
    expect(screen.getByText('Đã phân công')).toBeInTheDocument();
    expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0);
    expect(screen.getByText('Đã giải quyết')).toBeInTheDocument();
    expect(screen.getByText('Đã đóng')).toBeInTheDocument();
  });

  it('marks completed and active steps properly', () => {
    render(<TicketStageTracker ticket={mockBaseTicket} />);

    // Steps before in_progress (Mới tạo, Đã phân loại, Đã phân công) are completed
    expect(screen.getByLabelText(/Mới tạo, đã hoàn thành/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Đã phân loại, đã hoàn thành/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Đã phân công, đã hoàn thành/i)).toBeInTheDocument();

    // in_progress is the active step
    const currentStep = screen.getByRole('listitem', { current: 'step' });
    expect(currentStep).toHaveTextContent('Đang xử lý');
  });

  it('renders waiting_user conditional branch callout with paused time', () => {
    const pausedTicket: Ticket = {
      ...mockBaseTicket,
      status: 'waiting_user',
      waiting_since: new Date(Date.now() - 1800000).toISOString(),
      sla_paused_ms: 1800000, // 30 minutes
    };

    const handleAction = vi.fn();
    render(<TicketStageTracker ticket={pausedTicket} onActionClick={handleAction} />);

    expect(
      screen.getByRole('heading', { name: 'Đang chờ người tạo phiếu phản hồi · SLA tạm dừng' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Thời gian đã dừng: 30 phút/i)).toBeInTheDocument();

    const replyButton = screen.getByRole('button', { name: /Phản hồi ngay/i });
    fireEvent.click(replyButton);
    expect(handleAction).toHaveBeenCalledWith('reply');
  });

  it('shows the pending_approval callout only when it carries an action', () => {
    const approvalTicket: Ticket = {
      ...mockBaseTicket,
      status: 'pending_approval',
    };

    const { rerender } = render(<TicketStageTracker ticket={approvalTicket} />);
    // Không có thao tác: trạng thái đã có ở tiêu đề phiếu, không lặp thêm khối cảnh báo.
    expect(screen.queryByRole('heading', { name: 'Chờ Quản lý phê duyệt' })).not.toBeInTheDocument();

    rerender(<TicketStageTracker ticket={approvalTicket} actionsSlot={<button type="button">Duyệt</button>} />);
    expect(screen.getByRole('heading', { name: 'Chờ Quản lý phê duyệt' })).toBeInTheDocument();
  });

  it('explains a cancelled ticket in one sentence-case line', () => {
    const cancelledTicket: Ticket = {
      ...mockBaseTicket,
      status: 'cancelled',
    };

    render(<TicketStageTracker ticket={cancelledTicket} />);
    expect(screen.getByText(/Phiếu đã hủy nên không xử lý tiếp/)).toBeInTheDocument();
    expect(screen.queryByText(/PHIẾU ĐÃ HỦY/)).not.toBeInTheDocument();
  });

  it('toggles mobile expansion view', async () => {
    const user = userEvent.setup();
    render(<TicketStageTracker ticket={mockBaseTicket} />);

    const expandBtn = screen.getByRole('button', { name: /Xem tiến trình/i });
    expect(expandBtn).toBeInTheDocument();
    await user.click(expandBtn);
    expect(screen.getByRole('button', { name: /Thu gọn/i })).toBeInTheDocument();
  });
});

describe('DeviceWorkflowStepper (Model 2)', () => {
  const mockDeviceRequest: DeviceRequest = {
    id: '018f-device-req-0042',
    requester_id: 'user-emp-01',
    device_type: 'laptop',
    reason: 'Phục vụ dự án chuyển đổi số tại Chi nhánh Đà Nẵng',
    quantity: 1,
    status: 'preparing',
    department: 'Phòng Kế hoạch',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    decided_by: 'Trần Văn C (Trưởng phòng)',
    decided_at: new Date(Date.now() - 43200000).toISOString(),
    prepared_at: new Date(Date.now() - 3600000).toISOString(),
  };

  it('renders 4 linear stages and indicates current progress', () => {
    render(<DeviceWorkflowStepper request={mockDeviceRequest} />);

    expect(screen.getByText('Gửi đề nghị')).toBeInTheDocument();
    expect(screen.getByText('Quản lý duyệt')).toBeInTheDocument();
    expect(screen.getByText('IT Chuẩn bị')).toBeInTheDocument();
    expect(screen.getByText('Bàn giao thiết bị')).toBeInTheDocument();

    const currentStep = screen.getByRole('listitem', { current: 'step' });
    expect(currentStep).toHaveTextContent('IT Chuẩn bị');
  });

  it('renders rejection off-ramp callout with decision note and decider', () => {
    const rejectedRequest: DeviceRequest = {
      ...mockDeviceRequest,
      status: 'rejected',
      decision_note: 'Phòng ban đã vượt định mức thiết bị quý 4.',
      decided_by: 'Trần Văn C',
      decided_at: new Date().toISOString(),
    };

    render(<DeviceWorkflowStepper request={rejectedRequest} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Quản lý đã từ chối yêu cầu');
    expect(alert).toHaveTextContent('Phòng ban đã vượt định mức thiết bị quý 4.');
    expect(alert).toHaveTextContent('Trần Văn C');
  });

  it('renders SeaweedFS PDF handover chip when handed over', () => {
    const handedOverRequest: DeviceRequest = {
      ...mockDeviceRequest,
      status: 'handed_over',
      handed_over_at: new Date().toISOString(),
    };

    const handleDownload = vi.fn();
    render(
      <DeviceWorkflowStepper
        request={handedOverRequest}
        onDownloadHandover={handleDownload}
      />
    );

    expect(screen.getByText(/Đã bàn giao lúc/)).toBeInTheDocument();
    const downloadBtn = screen.getByRole('button', {
      name: /Tải biên bản bàn giao \(\.PDF\)/i,
    });
    expect(downloadBtn).toBeInTheDocument();
    fireEvent.click(downloadBtn);
    expect(handleDownload).toHaveBeenCalled();
  });
});

describe('TicketKanbanBoard (Model 3)', () => {
  const tickets: Ticket[] = [
    {
      ...mockBaseTicket,
      id: 'tk-01',
      title: 'Sập mạng toàn chi nhánh',
      priority: 'critical',
      status: 'new',
      assigned_to: null,
    },
    {
      ...mockBaseTicket,
      id: 'tk-02',
      title: 'Yêu cầu cấp chuột mới',
      priority: 'low',
      status: 'assigned',
      assigned_to: null,
    },
    {
      ...mockBaseTicket,
      id: 'tk-03',
      title: 'Cài đặt máy in tầng 2',
      priority: 'normal',
      status: 'in_progress',
      assigned_to: 'tech-001',
    },
    {
      ...mockBaseTicket,
      id: 'tk-04',
      title: 'Chờ người dùng gửi ảnh lỗi',
      priority: 'normal',
      status: 'waiting_user',
      assigned_to: 'tech-001',
    },
    {
      ...mockBaseTicket,
      id: 'tk-05',
      title: 'Khắc phục xong sự cố email',
      priority: 'high',
      status: 'resolved',
      assigned_to: 'tech-001',
    },
  ];

  const renderBoard = (props: Partial<React.ComponentProps<typeof TicketKanbanBoard>> = {}) =>
    render(
      <MemoryRouter>
        <TicketKanbanBoard tickets={tickets} {...props} />
      </MemoryRouter>
    );

  it('renders 5 operational columns and classifies tickets into them', () => {
    renderBoard();

    expect(screen.getAllByText('Mới tiếp nhận').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hàng đợi nhóm').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chờ phản hồi / duyệt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đã giải quyết').length).toBeGreaterThan(0);

    expect(screen.getByText('Sập mạng toàn chi nhánh')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu cấp chuột mới')).toBeInTheDocument();
    expect(screen.getByText('Cài đặt máy in tầng 2')).toBeInTheDocument();
  });

  it('renders Vietnamese-only urgent and standard lanes with ordered headings', () => {
    renderBoard({ groupBySwimlanes: true });

    expect(screen.getByRole('heading', { level: 2, name: 'Kanban luồng việc' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Khẩn cấp hoặc đã quá hạn SLA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Các phiếu còn lại' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Sập mạng toàn chi nhánh' })).toBeInTheDocument();
    expect(screen.queryByText(/SWIMLANE|KANBAN VẬN HÀNH|CRITICAL|LOW/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tách làn khẩn cấp' }));
    expect(screen.queryByRole('heading', { level: 3, name: 'Các phiếu còn lại' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Sập mạng toàn chi nhánh' })).toBeInTheDocument();
  });

  it('card titles are real links and the board has no duplicate filter bar', () => {
    renderBoard({ ticketHref: (t) => `/tickets/${t.id}` });

    expect(screen.getByRole('link', { name: 'Cài đặt máy in tầng 2' })).toHaveAttribute('href', '/tickets/tk-03');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('supports 1-click claim button affordance', () => {
    const handleClaim = vi.fn();
    renderBoard({ canClaim: (t) => t.id === 'tk-01', onClaimTicket: handleClaim });

    const claimButton = screen.getByRole('button', { name: /Nhận xử lý ngay/i });
    expect(claimButton).toBeInTheDocument();
    fireEvent.click(claimButton);
    expect(handleClaim).toHaveBeenCalledWith(expect.objectContaining({ id: 'tk-01' }));
  });
});

describe('SlaPauseBanner (Model 4)', () => {
  it('renders active SLA countdown and progress bar', () => {
    render(<SlaPauseBanner ticket={mockBaseTicket} />);

    expect(screen.getByText(/Cam kết thời hạn xử lý \(SLA\)/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders paused callout when status is waiting_user', () => {
    const pausedTicket: Ticket = {
      ...mockBaseTicket,
      status: 'waiting_user',
      waiting_since: new Date(Date.now() - 1200000).toISOString(),
      sla_paused_ms: 0,
    };

    render(<SlaPauseBanner ticket={pausedTicket} />);

    const statusBanner = screen.getByRole('status');
    expect(statusBanner).toHaveTextContent(/SLA tạm dừng · chờ người tạo phiếu phản hồi/i);
    expect(statusBanner).toHaveTextContent(/Thời gian đã dừng: 20 phút/i);
  });

  it('renders alert when SLA is breached', () => {
    const breachedTicket: Ticket = {
      ...mockBaseTicket,
      sla_breached: true,
      sla_due_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };

    render(<SlaPauseBanner ticket={breachedTicket} />);

    const alertBanner = screen.getByRole('status');
    expect(alertBanner).toHaveTextContent(/Quá hạn SLA/i);
    expect(alertBanner).toHaveTextContent(/Trễ hạn:/i);
    expect(alertBanner).not.toHaveTextContent(/leo thang/i);
    // Quá hạn là trạng thái kéo dài, không phải sự kiện mới: không nhấp nháy,
    // và tiêu đề là h2 ngay dưới h1 của trang.
    expect(alertBanner.className).not.toMatch(/animate-pulse/);
    expect(screen.getByRole('heading', { level: 2, name: /Quá hạn SLA/i })).toBeInTheDocument();
  });

  it('tells the requester calmly that a breached ticket is late, without SLA jargon', () => {
    const breachedTicket: Ticket = {
      ...mockBaseTicket,
      sla_breached: true,
      sla_due_at: new Date(Date.now() - 3600000).toISOString(),
    };

    render(<SlaPauseBanner ticket={breachedTicket} audience="requester" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Phiếu đang chậm hơn dự kiến');
    expect(banner).toHaveTextContent('bạn không cần gửi lại yêu cầu');
    expect(banner).not.toHaveTextContent(/SLA|leo thang|Trễ hạn/);
  });

  it('tells the requester the clock is paused while waiting for them', () => {
    const pausedTicket: Ticket = {
      ...mockBaseTicket,
      status: 'waiting_user',
      waiting_since: new Date(Date.now() - 1200000).toISOString(),
      sla_paused_ms: 0,
    };

    render(<SlaPauseBanner ticket={pausedTicket} audience="requester" />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Đang chờ bạn phản hồi');
    expect(banner).not.toHaveTextContent(/SLA/);
  });

  it('renders success notice when resolved on time', () => {
    const resolvedTicket: Ticket = {
      ...mockBaseTicket,
      status: 'resolved',
      sla_breached: false,
    };

    render(<SlaPauseBanner ticket={resolvedTicket} />);

    expect(screen.getByText(/ĐẠT CAM KẾT SLA/i)).toBeInTheDocument();
  });
});

describe('AiTriageDiff (Model 5)', () => {
  it('renders side-by-side comparison of ticket attributes and AI proposals', () => {
    render(
      <AiTriageDiff
        currentCategory="Danh mục chung"
        currentPriority="normal"
        currentTeam="Chưa gán nhóm"
        proposedCategory="Mạng & VPN"
        proposedPriority="high"
        proposedTeam="Đội Hạ tầng mạng"
        confidenceScore={94}
        rationale="Mất kết nối diện rộng tại chi nhánh, phù hợp quy tắc KB-0142"
        summary="Sự cố rớt mạng chi nhánh"
        onAccept={vi.fn()}
        onCustomize={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Đề xuất phân loại từ trợ lý AI' })
    ).toBeInTheDocument();
    // Nhãn chỉ tiếng Việt, không có lý do tự bịa khi mô hình không trả về.
    expect(screen.getByRole('row', { name: /Mức ưu tiên Bình thường Cao Thay đổi/ })).toBeInTheDocument();
    expect(screen.queryByText(/\(High\)|\(Normal\)|Khớp nội dung|Định tuyến tự động/)).not.toBeInTheDocument();
    expect(screen.getByText('Độ tin cậy: 94%')).toBeInTheDocument();
    expect(screen.getByText('Danh mục sự cố')).toBeInTheDocument();
    expect(screen.getByText('Danh mục chung')).toBeInTheDocument();
    expect(screen.getByText('Mạng & VPN')).toBeInTheDocument();
    expect(screen.getByText(/Mất kết nối diện rộng tại chi nhánh/i)).toBeInTheDocument();
  });

  it('triggers action buttons', () => {
    const handleAccept = vi.fn();
    const handleCustomize = vi.fn();
    const handleReject = vi.fn();

    render(
      <AiTriageDiff
        proposedCategory="Mạng & VPN"
        onAccept={handleAccept}
        onCustomize={handleCustomize}
        onReject={handleReject}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Xác nhận đề xuất' })
    );
    expect(handleAccept).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa đề xuất' }));
    expect(handleCustomize).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Bỏ qua đề xuất/i }));
    expect(handleReject).toHaveBeenCalledTimes(1);
  });
});
