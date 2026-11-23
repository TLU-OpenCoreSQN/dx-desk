// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateTicketPage } from '../modules/desk/pages/CreateTicketPage';
import { draftStorageKey } from '../lib/ticketDraft';
import * as apiService from '../services/api';
import * as authContext from '../contexts/AuthContext';
import { UserRole } from '../types/api';

const DRAFT_STORAGE_KEY = draftStorageKey('user-1');

const mockCategories = [
  { id: 'cat-1111-uuid', code: 'HW', name: 'Phần cứng máy tính', description: 'Sự cố thiết bị' },
  { id: 'cat-2222-uuid', code: 'NET', name: 'Mạng nội bộ', description: 'Kết nối mạng' },
];

describe('CreateTicketPage Draft Auto-Save & Restore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(apiService, 'getCategories').mockResolvedValue({ data: mockCategories });
    vi.spyOn(apiService, 'getCategoryArticles').mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderWithAuth = (roles: UserRole[] = ['Employee']) => {
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

  it('auto-saves form input to localStorage with 800ms debounce', async () => {
    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/Tiêu đề phiếu/i);
    const descInput = screen.getByLabelText(/Mô tả chi tiết sự cố/i);

    fireEvent.change(titleInput, { target: { value: 'Bàn phím cơ bị liệt' } });
    fireEvent.change(descInput, {
      target: { value: 'Hàng phím số không bấm được sau khi cắm lại cáp.' },
    });

    // Before debounce timer fires
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();

    // After 800ms debounce window
    await waitFor(
      () => {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        expect(saved).not.toBeNull();
        const parsed = JSON.parse(saved!);
        expect(parsed.title).toBe('Bàn phím cơ bị liệt');
        expect(parsed.description).toBe('Hàng phím số không bấm được sau khi cắm lại cáp.');
        expect(parsed.savedAt).toBeDefined();
      },
      { timeout: 1500 }
    );
  });

  it('automatically restores saved draft on mount', async () => {
    const draftData = {
      categoryId: 'cat-2222-uuid',
      title: 'Mạng WiFi chập chờn tầng 4',
      description: 'Cứ mỗi 15 phút lại bị ngắt kết nối WiFi khu vực phòng họp lớn.',
      priority: 'high',
      fieldValues: {},
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));

    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText(/Đã khôi phục nội dung nháp chưa gửi/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Mạng WiFi chập chờn tầng 4')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('Cứ mỗi 15 phút lại bị ngắt kết nối WiFi khu vực phòng họp lớn.')
      ).toBeInTheDocument();
    });
  });

  it('falls back critical priority draft to normal for non-manager', async () => {
    const draftData = {
      categoryId: 'cat-1111-uuid',
      title: 'Hệ thống server sập',
      description: 'Toàn bộ máy chủ không thể truy cập từ sáng.',
      priority: 'critical',
      fieldValues: {},
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));

    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText(/Đã khôi phục nội dung nháp chưa gửi/i)).toBeInTheDocument();
      const priorityGroup = screen.getByRole('group', { name: 'Mức độ ưu tiên' });
      const normalBtn = within(priorityGroup).getByText('Bình thường').closest('button');
      expect(normalBtn).toHaveAttribute('aria-pressed', 'true');
      const criticalBtn = within(priorityGroup).getByText('Khẩn cấp').closest('button');
      expect(criticalBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('restores critical priority draft successfully for Manager', async () => {
    const draftData = {
      categoryId: 'cat-1111-uuid',
      title: 'Sập cổng thanh toán ngân hàng',
      description: 'Lỗi 500 diện rộng từ phía đối tác thanh toán cần IT giải quyết gấp.',
      priority: 'critical',
      fieldValues: {},
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));

    renderWithAuth(['Manager']);

    await waitFor(() => {
      expect(screen.getByText(/Đã khôi phục nội dung nháp chưa gửi/i)).toBeInTheDocument();
      const priorityGroup = screen.getByRole('group', { name: 'Mức độ ưu tiên' });
      const criticalBtn = within(priorityGroup).getByText('Khẩn cấp').closest('button');
      expect(criticalBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clears draft from localStorage immediately on successful submission', async () => {
    vi.spyOn(apiService, 'createTicket').mockResolvedValue({
      id: 'ticket-created-999',
      requester_id: 'user-1',
      category_id: 'cat-1111-uuid',
      title: 'Chuột quang bị đơ con trỏ',
      description: 'Con trỏ chuột nhảy lung tung không điều khiển được.',
      priority: 'normal',
      status: 'new',
      assigned_to: null,
      created_at: '2026-10-21T01:00:00Z',
      updated_at: '2026-10-21T01:00:00Z',
    });

    const draftData = {
      categoryId: 'cat-1111-uuid',
      title: 'Chuột quang bị đơ con trỏ',
      description: 'Con trỏ chuột nhảy lung tung không điều khiển được.',
      priority: 'normal',
      fieldValues: {},
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));

    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Chuột quang bị đơ con trỏ')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Gửi phiếu hỗ trợ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('ticket-created-999')).toBeInTheDocument();
      expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    });
  });

  it('clears draft and resets form fields on "Xóa nháp" click', async () => {
    const draftData = {
      categoryId: 'cat-1111-uuid',
      title: 'Tiêu đề cần bỏ',
      description: 'Mô tả cần bỏ đi không dùng nữa.',
      priority: 'high',
      fieldValues: {},
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));

    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText(/Đã khôi phục nội dung nháp chưa gửi/i)).toBeInTheDocument();
    });

    const deleteDraftBtn = screen.getByRole('button', { name: 'Xóa nháp' });
    fireEvent.click(deleteDraftBtn);

    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText(/Đã khôi phục nội dung nháp chưa gửi/i)).not.toBeInTheDocument();
    const titleInput = screen.getByLabelText(/Tiêu đề phiếu/i);
    expect(titleInput).toHaveValue('');
  });

  it('does not restore a draft saved by another user', async () => {
    localStorage.setItem(
      draftStorageKey('user-2'),
      JSON.stringify({
        categoryId: 'cat-1111-uuid',
        title: 'Nháp của người khác',
        description: 'Nội dung không được lộ sang tài khoản khác.',
        priority: 'normal',
        fieldValues: {},
        savedAt: new Date().toISOString(),
      })
    );

    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Đã khôi phục nội dung nháp chưa gửi/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Tiêu đề phiếu/i)).toHaveValue('');
  });

  it('ignores malformed draft fields instead of crashing', async () => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ title: 123, description: 'Mô tả vẫn hợp lệ.', priority: 'urgent', fieldValues: { a: 1 } })
    );

    renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Mô tả vẫn hợp lệ.')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Tiêu đề phiếu/i)).toHaveValue('');
  });

  it('saves the pending draft immediately when leaving the page', async () => {
    const { unmount } = renderWithAuth(['Employee']);

    await waitFor(() => {
      expect(screen.getByText('Phần cứng máy tính (HW)')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/i), {
      target: { value: 'Gõ xong rời trang ngay' },
    });
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();

    unmount();

    expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!).title).toBe('Gõ xong rời trang ngay');
  });
});
