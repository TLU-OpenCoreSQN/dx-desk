// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { render, screen, fireEvent } from '@testing-library/react';
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

    expect(screen.getByText('Tiếp nhận')).toBeInTheDocument();
    expect(screen.getByText('Phân loại')).toBeInTheDocument();
    expect(screen.getByText('Phân công')).toBeInTheDocument();
    expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0);
    expect(screen.getByText('Giải quyết')).toBeInTheDocument();
    expect(screen.getByText('Đóng phiếu')).toBeInTheDocument();
  });

  it('marks completed and active steps properly', () => {
    render(<TicketStageTracker ticket={mockBaseTicket} />);

    // Steps before in_progress (Tiếp nhận, Phân loại, Phân công) are completed
    expect(screen.getByLabelText(/Tiếp nhận đã hoàn thành/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phân loại đã hoàn thành/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phân công đã hoàn thành/i)).toBeInTheDocument();

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
      screen.getByText(/ĐANG CHỜ PHẢN HỒI TỪ NGƯỜI DÙNG · SLA TẠM DỪNG/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Thời gian đã dừng: 30 phút/i)).toBeInTheDocument();

    const replyButton = screen.getByRole('button', { name: /Phản hồi ngay/i });
    fireEvent.click(replyButton);
    expect(handleAction).toHaveBeenCalledWith('reply');
  });

  it('renders pending_approval branch callout', () => {
    const approvalTicket: Ticket = {
      ...mockBaseTicket,
      status: 'pending_approval',
    };

    render(<TicketStageTracker ticket={approvalTicket} />);
    expect(
      screen.getByText(/CHỜ PHÊ DUYỆT TỪ QUẢN LÝ DỊCH VỤ/i)
    ).toBeInTheDocument();
  });

  it('renders cancelled branch alert callout', () => {
    const cancelledTicket: Ticket = {
      ...mockBaseTicket,
      status: 'cancelled',
    };

    render(<TicketStageTracker ticket={cancelledTicket} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/PHIẾU ĐÃ BỊ HỦY BỎ/i);
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
    expect(alert).toHaveTextContent(/YÊU CẦU ĐÃ BỊ TỪ CHỐI BỞI QUẢN LÝ/i);
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

    expect(screen.getByText(/ĐÃ BÀN GIAO THÀNH CÔNG/i)).toBeInTheDocument();
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

  it('renders 5 operational columns and classifies tickets into them', () => {
    render(<TicketKanbanBoard tickets={tickets} />);

    expect(screen.getAllByText('Mới tiếp nhận').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hàng đợi nhóm').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chờ phản hồi / duyệt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đã giải quyết').length).toBeGreaterThan(0);

    expect(screen.getByText('Sập mạng toàn chi nhánh')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu cấp chuột mới')).toBeInTheDocument();
    expect(screen.getByText('Cài đặt máy in tầng 2')).toBeInTheDocument();
  });

  it('renders Critical and Standard swimlanes when enabled', () => {
    render(<TicketKanbanBoard tickets={tickets} groupBySwimlanes={true} />);

    expect(screen.getByText(/HÀNG ĐỢI KHẨN CẤP \/ CRITICAL SWIMLANE/i)).toBeInTheDocument();
    expect(screen.getByText(/HÀNG ĐỢI TIÊU CHUẨN \/ STANDARD SWIMLANE/i)).toBeInTheDocument();
  });

  it('supports 1-click claim button affordance', () => {
    const handleClaim = vi.fn();
    render(
      <TicketKanbanBoard
        tickets={tickets}
        canClaim={(t) => t.id === 'tk-01'}
        onClaimTicket={handleClaim}
      />
    );

    const claimButton = screen.getByRole('button', { name: /Nhận xử lý ngay/i });
    expect(claimButton).toBeInTheDocument();
    fireEvent.click(claimButton);
    expect(handleClaim).toHaveBeenCalledWith(expect.objectContaining({ id: 'tk-01' }));
  });

  it('filters cards by search query', async () => {
    const user = userEvent.setup();
    render(<TicketKanbanBoard tickets={tickets} />);

    const searchInput = screen.getByPlaceholderText(/Tìm theo tiêu đề, mã.../i);
    await user.type(searchInput, 'máy in');

    expect(screen.getByText('Cài đặt máy in tầng 2')).toBeInTheDocument();
    expect(screen.queryByText('Sập mạng toàn chi nhánh')).not.toBeInTheDocument();
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
    expect(statusBanner).toHaveTextContent(/ĐỒNG HỒ SLA TẠM DỪNG/i);
    expect(statusBanner).toHaveTextContent(/Thời gian đã dừng: 20 phút/i);
  });

  it('renders alert when SLA is breached', () => {
    const breachedTicket: Ticket = {
      ...mockBaseTicket,
      sla_breached: true,
      sla_due_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };

    render(<SlaPauseBanner ticket={breachedTicket} />);

    const alertBanner = screen.getByRole('alert');
    expect(alertBanner).toHaveTextContent(/VI PHẠM THỜI HẠN SLA/i);
    expect(alertBanner).toHaveTextContent(/Trễ hạn:/i);
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
      screen.getByText(/ĐỀ XUẤT PHÂN LOẠI & GÁN NHÓM TỰ ĐỘNG TỪ AI TRỢ LÝ/i)
    ).toBeInTheDocument();
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
      screen.getByRole('button', { name: /Chấp nhận toàn bộ & Chuyển giao/i })
    );
    expect(handleAccept).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Tùy chỉnh chi tiết/i }));
    expect(handleCustomize).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Bỏ qua đề xuất/i }));
    expect(handleReject).toHaveBeenCalledTimes(1);
  });
});
