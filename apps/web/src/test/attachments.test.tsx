// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AttachmentPanel } from '../components/common/AttachmentPanel';
import { CreateTicketPage } from '../modules/desk/pages/CreateTicketPage';
import { fileError, formatFileSize, MAX_ATTACHMENT_BYTES } from '../lib/attachments';
import * as api from '../services/api';
import * as auth from '../contexts/AuthContext';

describe('ticket attachments', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'])('accepts the API-supported MIME type %s', type => {
    expect(fileError(new File(['content'], 'attachment', { type }))).toBeNull();
  });
  it('rejects unsupported, empty and oversized files before reading base64', () => {
    expect(fileError(new File([], 'empty.txt', {type:'text/plain'}))).toBeTruthy();
    expect(fileError(new File(['x'], 'x.html', {type:'text/html'}))).toBeTruthy();
    const file = new File(['x'], 'large.png', {type:'image/png'});
    Object.defineProperty(file, 'size', {value:MAX_ATTACHMENT_BYTES+1});
    expect(fileError(file)).toBeTruthy();
  });
  it('formats file sizes the Vietnamese way', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(12_595)).toBe('12,3 KB');
    expect(formatFileSize(4.5 * 1024 * 1024)).toBe('4,5 MB');
  });
  it('only clean files offer downloads and downloads in one step with a fresh signed link', async () => {
    vi.spyOn(api,'getAttachments').mockResolvedValue({data: ['clean','infected','failed','pending'].map((status, i) => ({
      id:String(i),ticket_id:'ticket',file_name:`file-${status}.txt`,content_type:'text/plain',size_bytes:5,
      scan_status:status as 'clean',created_at:'2026-10-30T00:00:00Z',
    }))});
    const issue = vi.spyOn(api,'getAttachmentDownload').mockResolvedValue({url:'/api/attachments/signed/content?signature=x',expires_at:'later'});
    render(<AttachmentPanel ticketId="ticket" />);
    await screen.findByText('file-clean.txt');
    expect(screen.getAllByRole('button',{name:/^Tải xuống /})).toHaveLength(1);
    expect(screen.getByText('Bị chặn: mã độc')).toBeInTheDocument();
    expect(screen.getByText('Đang quét')).toBeInTheDocument();
    // Chưa xin liên kết cho tới khi người dùng thật sự tải.
    expect(issue).not.toHaveBeenCalled();
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
    fireEvent.click(screen.getByRole('button',{name:'Tải xuống file-clean.txt'}));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(issue).toHaveBeenCalledWith('0');
    expect(clicked[0].getAttribute('href')).toBe('/api/attachments/signed/content?signature=x');
    expect(clicked[0].download).toBe('file-clean.txt');
    // Không còn bước "lấy liên kết" rồi bấm liên kết lần hai.
    expect(screen.queryByRole('link',{name:/Tải file-clean/})).not.toBeInTheDocument();
    expect(await screen.findByText('Đang tải xuống file-clean.txt.')).toBeInTheDocument();
  });
  it('rejects an unsupported file before upload and uploads a valid one from the dropzone', async () => {
    vi.spyOn(api,'getAttachments').mockResolvedValue({data: []});
    const upload = vi.spyOn(api,'uploadAttachment').mockResolvedValue({id:'f'} as Awaited<ReturnType<typeof api.uploadAttachment>>);
    render(<AttachmentPanel ticketId="ticket" />);
    await screen.findByText('Chưa có tệp đính kèm.');
    const input = screen.getByLabelText(/Bổ sung tệp/);
    fireEvent.change(input,{target:{files:[new File(['<p>'],'x.html',{type:'text/html'})]}});
    expect(await screen.findByText('Chỉ nhận PNG, JPEG, GIF, WebP, PDF hoặc TXT.')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Tải tệp lên phiếu này'})).not.toBeInTheDocument();
    const good = new File(['image'],'man-hinh.png',{type:'image/png'});
    fireEvent.change(input,{target:{files:[good]}});
    fireEvent.click(await screen.findByRole('button',{name:'Tải tệp lên phiếu này'}));
    await waitFor(() => expect(upload).toHaveBeenCalledWith('ticket', good));
    expect(await screen.findByText('Đã tải lên man-hinh.png.')).toBeInTheDocument();
  });
  it('upload failure retries the existing ticket without creating another ticket', async () => {
    vi.spyOn(auth,'useAuth').mockReturnValue({roles:['Employee']} as ReturnType<typeof auth.useAuth>);
    vi.spyOn(api,'getCategories').mockResolvedValue({data:[{id:'vpn',code:'vpn',name:'VPN'}]});
    const create = vi.spyOn(api,'createTicket').mockResolvedValue({id:'created-ticket'} as Awaited<ReturnType<typeof api.createTicket>>);
    const upload = vi.spyOn(api,'uploadAttachment').mockRejectedValueOnce(new api.ApiClientError(503,'Quét chưa sẵn sàng'))
      .mockResolvedValueOnce({id:'file'} as Awaited<ReturnType<typeof api.uploadAttachment>>);
    render(<MemoryRouter><CreateTicketPage /></MemoryRouter>);
    await screen.findByText('VPN (vpn)');
    fireEvent.change(screen.getByLabelText(/Tiêu đề phiếu/),{target:{value:'VPN không kết nối'}});
    fireEvent.change(screen.getByLabelText(/Mô tả chi tiết sự cố/),{target:{value:'VPN ngắt sau khi xác thực đăng nhập'}});
    const file = new File(['image'], 'vpn.png',{type:'image/png'});
    fireEvent.change(screen.getByLabelText(/Ảnh hoặc tệp đính kèm/),{target:{files:[file]}});
    fireEvent.click(screen.getByRole('button',{name:/Gửi phiếu hỗ trợ/}));
    await screen.findByText('Phiếu đã tạo; tệp chưa tải thành công');
    fireEvent.click(screen.getByRole('button',{name:'Thử tải lại tệp vào phiếu này'}));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    await screen.findByText(/đã được quét và lưu an toàn/);
    expect(create).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenNthCalledWith(1,'created-ticket',file);
    expect(upload).toHaveBeenNthCalledWith(2,'created-ticket',file);
  });
});
