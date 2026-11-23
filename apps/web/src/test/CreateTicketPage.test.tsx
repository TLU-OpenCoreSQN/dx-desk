// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readDraft } from '../lib/ticketDraft';
import { CreateTicketPage } from '../modules/desk/pages/CreateTicketPage';
import * as apiService from '../services/api';
import * as authContext from '../contexts/AuthContext';
import { Category } from '../types/api';

const mockCategories = [
  { id: 'cat-1111-uuid', code: 'HW', name: 'Phần cứng máy tính', description: 'Sự cố thiết bị' },
  { id: 'cat-2222-uuid', code: 'NET', name: 'Mạng nội bộ', description: 'Kết nối mạng' },
];

/** Render trong router có các trang đích để kiểm tra điều hướng sau khi hủy hoặc tự xử lý. */
const renderWithRoutes = () => {
  mockAuth();
  return render(
    <MemoryRouter initialEntries={['/tickets/new']}>
      <Routes>
        <Route path="/" element={<p>Trang chủ đích</p>} />
        <Route path="/tickets" element={<p>Danh sách phiếu đích</p>} />
        <Route path="/tickets/new" element={<CreateTicketPage />} />
      </Routes>
    </MemoryRouter>
  );
};

const mockAuth = (roles: ('Employee' | 'Agent' | 'Manager')[] = ['Employee']) => {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    isKeycloakOffline: false,
    token: 'jwt-token',
    profile: { id: 'user-1', username: 'testuser', roles },
    username: 'testuser',
    roles,
    hasRole: (r) => roles.includes(r),
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  });
};

const mockRenderWithAuth = (roles: ('Employee' | 'Agent' | 'Manager')[] = ['Employee']) => {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    isKeycloakOffline: false,
    token: 'jwt-token',
    profile: { id: 'user-1', username: 'testuser', roles },
    username: 'testuser',
    roles,
    hasRole: (r) => roles.includes(r),
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  });

  return render(
    <MemoryRouter>
      <CreateTicketPage />
    </MemoryRouter>
  );
};

describe('CreateTicketPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({ data: mockCategories });
    vi.spyOn(apiService, 'getCategoryArticles').mockResolvedValue({ data: [] });
  });

  const renderWithAuth = (roles: ('Employee' | 'Agent' | 'Manager')[] = ['Employee']) => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isKeycloakOffline: false,
      token: 'jwt-token',
      profile: { id: 'user-1', username: 'testuser', roles },
      username: 'testuser',
      roles,
      hasRole: (r) => roles.includes(r),
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    });

    return render(
      <MemoryRouter>
        <CreateTicketPage />
      </MemoryRouter>
    );
  };

  it('renders category options after loading', async () => {
    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument();
      expect(screen.getByText('Mạng nội bộ (NET)')).toBeInTheDocument();
    });
  });

  it('disables Critical priority option for non-Manager users', async () => {
    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Khẩn cấp')).toBeInTheDocument();
    });

    const criticalBtn = screen.getByText('Khẩn cấp').closest('button');
    expect(criticalBtn).toBeDisabled();
    expect(screen.getByText(/Mức "Khẩn cấp" chỉ dành riêng cho tài khoản Quản lý/i)).toBeInTheDocument();
  });

  it('enables Critical priority option for Manager users', async () => {
    renderWithAuth(['Manager']);

    await waitFor(() => {
      expect(screen.getByText('Khẩn cấp')).toBeInTheDocument();
    });

    const criticalBtn = screen.getByText('Khẩn cấp').closest('button');
    expect(criticalBtn).not.toBeDisabled();
  });

  it('validates minimum lengths on submit', async () => {
    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tiêu đề quá ngắn \(tối thiểu 5 ký tự/i)).toBeInTheDocument();
      expect(screen.getByText(/Mô tả chi tiết quá ngắn \(tối thiểu 10 ký tự/i)).toBeInTheDocument();
    });
  });

  it('submits valid ticket and renders success message with ticket ID', async () => {
    const createTicketSpy = vi.spyOn(apiService, 'createTicket').mockResolvedValue({
      id: 'ticket-created-789',
      requester_id: 'user-1',
      category_id: 'cat-1111-uuid',
      title: 'Hỏng bàn phím phòng họp',
      description: 'Bàn phím cơ bị liệt toàn bộ hàng phím số sau khi cắm lại cổng USB.',
      priority: 'normal',
      status: 'new',
      assigned_to: null,
      created_at: '2026-10-21T01:00:00Z',
      updated_at: '2026-10-21T01:00:00Z',
    });

    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/Tiêu đề phiếu/i);
    const descInput = screen.getByLabelText(/Mô tả chi tiết sự cố/i);

    fireEvent.change(titleInput, { target: { value: 'Hỏng bàn phím phòng họp' } });
    fireEvent.change(descInput, {
      target: {
        value: 'Bàn phím cơ bị liệt toàn bộ hàng phím số sau khi cắm lại cổng USB.',
      },
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createTicketSpy).toHaveBeenCalledWith({
        category_id: 'cat-1111-uuid',
        title: 'Hỏng bàn phím phòng họp',
        description: 'Bàn phím cơ bị liệt toàn bộ hàng phím số sau khi cắm lại cổng USB.',
        priority: 'normal',
      });
      expect(screen.getByText(/Tạo phiếu yêu cầu thành công!/i)).toBeInTheDocument();
      expect(screen.getByText('ticket-created-789')).toBeInTheDocument();
    });
  });
});

const vpnCategory: Category = {
  id: 'cat-vpn',
  code: 'VPN',
  name: 'Truy cập VPN',
  description: null,
  requirement_fields: [
    { key: 'reason', label: 'Lý do cần VPN', required: true },
    { key: 'valid_until', label: 'Ngày hết hạn mong muốn', required: true },
    { key: 'device_note', label: 'Ghi chú thiết bị', required: false },
  ],
};

const emptyCategory: Category = {
  id: 'cat-empty',
  code: 'OTHER',
  name: 'Khác',
  description: null,
  requirement_fields: [],
};

describe('CreateTicketPage — trường động theo requirement_fields (W3-04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({ data: [vpnCategory, emptyCategory] });
    vi.spyOn(apiService, 'getCategoryArticles').mockResolvedValue({ data: [] });
  });

  it('render input động khi chọn danh mục; key chứa "until" dùng input date', async () => {
    mockRenderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument();
    });

    const reasonInput = screen.getByLabelText(/Lý do cần VPN/);
    expect(reasonInput).toHaveAttribute('type', 'text');
    expect(reasonInput).toHaveAttribute('aria-required', 'true');

    const untilInput = screen.getByLabelText(/Ngày hết hạn mong muốn/);
    expect(untilInput).toHaveAttribute('type', 'date');

    const optionalInput = screen.getByLabelText(/Ghi chú thiết bị/);
    expect(optionalInput).toHaveAttribute('aria-required', 'false');
  });

  it('placeholder/hint trong cấu hình được ưu tiên hơn gợi ý dự phòng và nối qua aria-describedby', async () => {
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({
      data: [{
        ...vpnCategory,
        requirement_fields: [
          { key: 'reason', label: 'Lý do cần VPN', required: true, placeholder: 'VD: Làm việc từ xa', hint: 'Ghi rõ dự án.' },
          { key: 'valid_until', label: 'Ngày hết hạn mong muốn', required: true, hint: 'Hạn theo hợp đồng.' },
          { key: 'device_note', label: 'Ghi chú thiết bị', required: false },
        ],
      }],
    });
    mockRenderWithAuth(['Employee']);
    const reason = await screen.findByLabelText(/Lý do cần VPN/);
    expect(reason).toHaveAttribute('placeholder', 'VD: Làm việc từ xa');
    expect(reason).toHaveAccessibleDescription('Ghi rõ dự án.');
    // Cấu hình thay thế gợi ý dự phòng của khóa valid_until.
    expect(screen.getByLabelText(/Ngày hết hạn mong muốn/)).toHaveAccessibleDescription('Hạn theo hợp đồng.');
    // Khóa không có cấu hình và không có bản dự phòng: dùng câu chung, không có dòng giải thích.
    const note = screen.getByLabelText(/Ghi chú thiết bị/);
    expect(note).toHaveAttribute('placeholder', 'Nhập ghi chú thiết bị');
    expect(note).not.toHaveAttribute('aria-describedby');
  });

  it('khóa nút Gửi và liệt kê trường động bắt buộc còn thiếu bằng tiếng Việt', async () => {
    mockRenderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i });
    expect(submitBtn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Chưa thể gửi phiếu/i)).toBeInTheDocument();
    expect(screen.getByText('Lý do cần VPN (bắt buộc theo danh mục)')).toBeInTheDocument();
    expect(screen.getByText('Ngày hết hạn mong muốn (bắt buộc theo danh mục)')).toBeInTheDocument();
    expect(screen.queryByText(/Ghi chú thiết bị \(bắt buộc/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/i), {
      target: { value: 'Cần VPN để làm việc từ xa' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết sự cố/i), {
      target: { value: 'Tôi cần truy cập hệ thống nội bộ từ nhà trong tháng 11.' },
    });

    expect(submitBtn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('Tiêu đề phiếu (từ 5 đến 200 ký tự)')).not.toBeInTheDocument();
    expect(screen.getByText('Lý do cần VPN (bắt buộc theo danh mục)')).toBeInTheDocument();
  });

  it('mở khóa nút Gửi và gửi kèm object fields khi điền đủ trường bắt buộc', async () => {
    const createTicketSpy = vi.spyOn(apiService, 'createTicket').mockResolvedValue({
      id: 'ticket-vpn-1',
      requester_id: 'user-1',
      category_id: 'cat-vpn',
      title: 'Cần VPN để làm việc từ xa',
      description: 'Tôi cần truy cập hệ thống nội bộ từ nhà trong tháng 11.',
      priority: 'normal',
      status: 'new',
      assigned_to: null,
      created_at: '2026-10-26T01:00:00Z',
      updated_at: '2026-10-26T01:00:00Z',
    });

    mockRenderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/i), {
      target: { value: 'Cần VPN để làm việc từ xa' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết sự cố/i), {
      target: { value: 'Tôi cần truy cập hệ thống nội bộ từ nhà trong tháng 11.' },
    });
    fireEvent.change(screen.getByLabelText(/Lý do cần VPN/), {
      target: { value: 'Làm việc từ xa cho dự án DX-Desk' },
    });
    fireEvent.change(screen.getByLabelText(/Ngày hết hạn mong muốn/), {
      target: { value: '2026-11-30' },
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createTicketSpy).toHaveBeenCalledWith({
        category_id: 'cat-vpn',
        title: 'Cần VPN để làm việc từ xa',
        description: 'Tôi cần truy cập hệ thống nội bộ từ nhà trong tháng 11.',
        priority: 'normal',
        fields: { reason: 'Làm việc từ xa cho dự án DX-Desk', valid_until: '2026-11-30' },
      });
    });
  });

  it('danh mục không có requirement_fields thì gửi payload cơ bản, không có fields', async () => {
    const createTicketSpy = vi.spyOn(apiService, 'createTicket').mockResolvedValue({
      id: 'ticket-other-1',
      requester_id: 'user-1',
      category_id: 'cat-empty',
      title: 'Sự cố linh tinh cần IT hỗ trợ',
      description: 'Chuột máy tính phòng 202 lúc nhận lúc không, đã thử đổi cổng USB.',
      priority: 'normal',
      status: 'new',
      assigned_to: null,
      created_at: '2026-10-26T01:00:00Z',
      updated_at: '2026-10-26T01:00:00Z',
    });

    mockRenderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Khác (OTHER)')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Danh mục sự cố/), { target: { value: 'cat-empty' } });
    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/i), {
      target: { value: 'Sự cố linh tinh cần IT hỗ trợ' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết sự cố/i), {
      target: { value: 'Chuột máy tính phòng 202 lúc nhận lúc không, đã thử đổi cổng USB.' },
    });

    expect(screen.queryAllByLabelText(/Lý do cần VPN/)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i }));

    await waitFor(() => {
      expect(createTicketSpy).toHaveBeenCalledWith({
        category_id: 'cat-empty',
        title: 'Sự cố linh tinh cần IT hỗ trợ',
        description: 'Chuột máy tính phòng 202 lúc nhận lúc không, đã thử đổi cổng USB.',
        priority: 'normal',
      });
    });
  });

  it('ẩn chọn mức Khẩn cấp với Employee, mở với Manager', async () => {
    const { unmount } = mockRenderWithAuth(['Employee']);
    await waitFor(() => expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument());
    const criticalBtn = screen.getByText('Khẩn cấp').closest('button');
    expect(criticalBtn).toBeDisabled();
    unmount();

    mockRenderWithAuth(['Manager']);
    await waitFor(() => expect(screen.getByText('Truy cập VPN (VPN)')).toBeInTheDocument());
    expect(screen.getByText('Khẩn cấp').closest('button')).not.toBeDisabled();
  });
});

describe('W5-08 gợi ý bài Wiki và lượt tự phục vụ', () => {
  const vpnArticle = {
    id: 'art-vpn', slug: 'vpn', title: 'Kết nối VPN từ xa vào mạng nội bộ',
    summary: 'Cài OpenVPN và xử lý lỗi xác thực.', url: 'http://localhost:18030/ho-tro/vpn',
  };
  const passwordArticle = {
    id: 'art-pass', slug: 'mat-khau', title: 'Đổi và khôi phục mật khẩu', summary: '', url: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({ data: mockCategories });
    vi.spyOn(apiService, 'getCategoryArticles').mockImplementation(async (categoryId: string) => ({
      data: categoryId === 'cat-2222-uuid' ? [vpnArticle] : [passwordArticle],
    }));
  });

  it('hiện đúng bài theo danh mục đang chọn, liên kết mở Wiki ở tab mới', async () => {
    mockRenderWithAuth(['Employee']);
    await waitFor(() => expect(screen.getByText('Đổi và khôi phục mật khẩu')).toBeInTheDocument());
    expect(apiService.getCategoryArticles).toHaveBeenCalledWith('cat-1111-uuid');
    // Bài chưa có URL (Wiki.js chưa cấu hình) chỉ hiện tiêu đề, không có liên kết hỏng.
    expect(screen.queryByRole('link', { name: /Đổi và khôi phục mật khẩu/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Danh mục sự cố/), { target: { value: 'cat-2222-uuid' } });
    const link = await screen.findByRole('link', { name: /Kết nối VPN từ xa vào mạng nội bộ/ });
    expect(link).toHaveAttribute('href', 'http://localhost:18030/ho-tro/vpn');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.queryByText('Đổi và khôi phục mật khẩu')).not.toBeInTheDocument();
  });

  it('bấm "Đã tự xử lý được" ghi đúng một lượt và không tạo phiếu', async () => {
    const record = vi.spyOn(apiService, 'recordSelfService').mockResolvedValue({
      id: 'ss-1', category_id: 'cat-2222-uuid', article_id: 'art-vpn', created_at: '2026-11-04T00:00:00Z',
    });
    const create = vi.spyOn(apiService, 'createTicket');
    mockRenderWithAuth(['Employee']);
    await waitFor(() => expect(screen.getByText('Đổi và khôi phục mật khẩu')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Danh mục sự cố/), { target: { value: 'cat-2222-uuid' } });
    const button = await screen.findByRole('button', { name: 'Đã tự xử lý được' });
    fireEvent.click(button);
    fireEvent.click(button);
    const confirm = await screen.findByRole('heading', { name: /Đã ghi nhận bạn tự xử lý được/ });
    // Nút vừa bấm biến mất nên focus phải chuyển tới thẻ xác nhận.
    await waitFor(() => expect(confirm).toHaveFocus());
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith('cat-2222-uuid', 'art-vpn');
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Đã tự xử lý được' })).not.toBeInTheDocument();
  });

  it('lỗi tải gợi ý không chặn biểu mẫu', async () => {
    vi.spyOn(apiService, 'getCategoryArticles').mockRejectedValue(new Error('offline'));
    mockRenderWithAuth(['Employee']);
    await waitFor(() => expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument());
    expect(screen.queryByText('Thử tự xử lý trước khi gửi phiếu')).not.toBeInTheDocument();
  });

  it('"Hủy bỏ" khi form trống chuyển thẳng về danh sách phiếu, không hỏi lại', async () => {
    renderWithRoutes();
    await waitFor(() => expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    expect(await screen.findByText('Danh sách phiếu đích')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Hủy bỏ" khi đã nhập hỏi lại; "Tiếp tục điền" giữ nguyên trang', async () => {
    renderWithRoutes();
    await waitFor(() => expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/), { target: { value: 'Máy in không chạy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hủy tạo phiếu?' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục điền' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Tiêu đề phiếu/)).toHaveValue('Máy in không chạy');
  });

  it('"Hủy bỏ" khi chỉ chọn tệp: không có lựa chọn giữ nháp, "Bỏ tệp và rời trang" về danh sách', async () => {
    renderWithRoutes();
    await waitFor(() => expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument());
    const input = screen.getByLabelText(/Ảnh hoặc tệp đính kèm/);
    fireEvent.change(input, { target: { files: [new File(['x'], 'anh.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    expect(await screen.findByText('Bạn đã chọn tệp đính kèm nhưng chưa gửi phiếu.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Giữ nháp và rời trang' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ tệp và rời trang' }));
    expect(await screen.findByText('Danh sách phiếu đích')).toBeInTheDocument();
  });

  it('"Giữ nháp và rời trang" lưu nháp; "Xóa nháp và rời trang" xóa nháp', async () => {
    const first = renderWithRoutes();
    await waitFor(() => expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/), { target: { value: 'Nháp cần giữ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Giữ nháp và rời trang' }));
    expect(await screen.findByText('Danh sách phiếu đích')).toBeInTheDocument();
    expect(readDraft('user-1')?.title).toBe('Nháp cần giữ');
    first.unmount();

    renderWithRoutes();
    await waitFor(() => expect(screen.getByLabelText(/Tiêu đề phiếu/)).toHaveValue('Nháp cần giữ'));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa nháp và rời trang' }));
    expect(await screen.findByText('Danh sách phiếu đích')).toBeInTheDocument();
    expect(readDraft('user-1')).toBeNull();
  });

  it('sau khi tự xử lý: "Về trang chủ" xóa nháp và chuyển trang, "Tôi vẫn cần gửi phiếu" ở lại', async () => {
    vi.spyOn(apiService, 'recordSelfService').mockResolvedValue({
      id: 'ss-1', category_id: 'cat-2222-uuid', article_id: 'art-vpn', created_at: '2026-11-04T00:00:00Z',
    });
    const first = renderWithRoutes();
    await waitFor(() => expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Danh mục sự cố/), { target: { value: 'cat-2222-uuid' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Đã tự xử lý được' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tôi vẫn cần gửi phiếu' }));
    const note = await screen.findByText('Bạn có thể tiếp tục điền phiếu bên dưới.');
    await waitFor(() => expect(note).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Về trang chủ' })).not.toBeInTheDocument();
    first.unmount();

    renderWithRoutes();
    await waitFor(() => expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Danh mục sự cố/), { target: { value: 'cat-2222-uuid' } });
    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/), { target: { value: 'VPN lỗi' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Đã tự xử lý được' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Về trang chủ' }));
    expect(await screen.findByText('Trang chủ đích')).toBeInTheDocument();
    expect(readDraft('user-1')).toBeNull();
  });
});

describe('Vùng kéo thả tệp đính kèm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({ data: mockCategories });
    vi.spyOn(apiService, 'getCategoryArticles').mockResolvedValue({ data: [] });
  });

  const dropZone = async () => {
    mockRenderWithAuth(['Employee']);
    await waitFor(() => expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument());
    const input = screen.getByLabelText(/Ảnh hoặc tệp đính kèm/) as HTMLInputElement;
    return { input, zone: input.closest('label') as HTMLLabelElement };
  };
  const png = (name: string) => new File(['x'], name, { type: 'image/png' });

  it('thả tệp hợp lệ thì hiện tên tệp và xóa giá trị ô chọn tệp cũ', async () => {
    const { input, zone } = await dropZone();
    const reset = vi.spyOn(input, 'value', 'set');
    // dragover phải chặn mặc định để trình duyệt không mở tệp thay vì thả vào vùng.
    expect(fireEvent.dragOver(zone, { dataTransfer: { files: [], dropEffect: 'copy' } })).toBe(false);
    fireEvent.drop(zone, { dataTransfer: { files: [png('anh-loi.png')] } });
    expect(screen.getByText('anh-loi.png')).toBeInTheDocument();
    expect(reset).toHaveBeenCalledWith('');
  });

  it('kéo thả chữ (không có tệp) giữ nguyên tệp đang chọn', async () => {
    const { zone } = await dropZone();
    fireEvent.drop(zone, { dataTransfer: { files: [png('giu-lai.png')] } });
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(screen.getByText('giu-lai.png')).toBeInTheDocument();
  });

  it('thả tệp sai định dạng thì báo lỗi và không chọn tệp', async () => {
    const { zone } = await dropZone();
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(['x'], 'macro.exe', { type: 'application/x-msdownload' })] },
    });
    expect(await screen.findByText(/Chỉ nhận PNG, JPEG, GIF, WebP, PDF hoặc TXT/)).toBeInTheDocument();
    expect(screen.queryByText('macro.exe')).not.toBeInTheDocument();
  });
});
