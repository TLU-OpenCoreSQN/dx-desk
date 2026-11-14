// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W5-03: biên bản bàn giao thiết bị dạng PDF. Sinh trong API (không phải n8n) để khóa kho tệp và
// dữ liệu đề nghị không rời khỏi dịch vụ; lưu SeaweedFS và tải bằng URL ký ngắn hạn như tệp đính kèm
// (ADR 0009). Phông Noto Sans (OFL-1.1) được nhúng để hiển thị đúng tiếng Việt.
import {
  ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post,
  Query, Req, Res, ServiceUnavailableException, StreamableFile, UseGuards,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { Response } from 'express';
import type { PoolClient } from 'pg';
import PDFDocument from 'pdfkit';
import { AuthRequest, JwtGuard } from './auth';
import { required } from './config';
import { Database } from './database';
import { DOWNLOAD_TTL_SECONDS } from './downloads';
import { putObject, seaweedfsEndpoint } from './seaweedfs';

export interface HandoverData {
  id: string; device_type: string; quantity: number; department: string;
  created_at: string; decided_at: string | null; handed_over_at: string | null; handover_key: string | null;
  requester_name: string | null; approver_name: string | null; handed_over_by_name: string | null;
}
type Run = <T>(operation: (client: PoolClient) => Promise<T>) => Promise<T>;

const FONTS = join(__dirname, '..', 'assets', 'fonts');
const DEVICES: Record<string, string> = {
  laptop: 'Máy tính xách tay', monitor: 'Màn hình', keyboard: 'Bàn phím', mouse: 'Chuột', other: 'Thiết bị khác',
};
const UNKNOWN = 'Không có thông tin';
export const handoverKey = (id: string) => `device-handover/${id}.pdf`;
export const handoverCode = (id: string) => 'DX-TB-' + id.slice(0, 8).toUpperCase();
function time(value: string | null): string {
  if (!value) return UNKNOWN;
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
    .format(new Date(value)) + ' (giờ Việt Nam)';
}

/** Các dòng của biên bản; tách riêng để kiểm thử nội dung mà không phải đọc ngược tệp PDF. */
export function handoverFields(data: HandoverData): [string, string][] {
  return [
    ['Mã đề nghị', `${handoverCode(data.id)} (${data.id})`],
    ['Đơn vị', data.department],
    ['Người nhận', data.requester_name ?? UNKNOWN],
    ['Loại thiết bị', DEVICES[data.device_type] ?? data.device_type],
    ['Số lượng', String(data.quantity)],
    ['Người duyệt', data.approver_name ?? UNKNOWN],
    ['Thời điểm duyệt', time(data.decided_at)],
    ['Người bàn giao', data.handed_over_by_name ?? UNKNOWN],
    ['Thời điểm bàn giao', time(data.handed_over_at)],
  ];
}

export function renderHandover(data: HandoverData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const when = new Date(data.handed_over_at ?? data.created_at);
    const document = new PDFDocument({ size: 'A4', margin: 56, lang: 'vi-VN',
      info: { Title: `Biên bản bàn giao thiết bị ${handoverCode(data.id)}`, Author: 'DX-Desk', Creator: 'DX-Desk',
        Producer: 'DX-Desk', CreationDate: when, ModDate: when } });
    const chunks: Buffer[] = [];
    document.on('data', chunk => chunks.push(chunk as Buffer));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.registerFont('regular', join(FONTS, 'NotoSans-Regular.ttf'));
    document.registerFont('bold', join(FONTS, 'NotoSans-Bold.ttf'));

    document.font('regular').fontSize(10).fillColor('#5f5e5a').text('DX-Desk · Hệ thống hỗ trợ IT nội bộ');
    document.moveDown(1.5).font('bold').fontSize(18).fillColor('#211f1b').text('BIÊN BẢN BÀN GIAO THIẾT BỊ', { align: 'center' });
    document.moveDown(0.3).font('regular').fontSize(11).fillColor('#5f5e5a')
      .text(`Số: ${handoverCode(data.id)}`, { align: 'center' });
    document.moveDown(1.5);
    const left = document.page.margins.left;
    const width = document.page.width - left - document.page.margins.right;
    for (const [label, value] of handoverFields(data)) {
      const top = document.y;
      document.font('bold').fontSize(11).fillColor('#211f1b').text(label, left, top, { width: 150 });
      document.font('regular').text(value, left + 160, top, { width: width - 160 });
      const bottom = Math.max(document.y, top + 16) + 6;
      document.moveTo(left, bottom).lineTo(left + width, bottom).lineWidth(0.5).strokeColor('#d6d5d2').stroke();
      document.y = bottom + 6;
    }
    document.moveDown(1.5).font('regular').fontSize(11).fillColor('#211f1b').text(
      'Hai bên xác nhận thiết bị nêu trên đã được bàn giao đủ số lượng theo đề nghị đã duyệt.', left, document.y, { width });
    const signatures = document.y + 40;
    document.font('bold').text('BÊN GIAO (IT)', left, signatures, { width: width / 2, align: 'center' });
    document.text('BÊN NHẬN', left + width / 2, signatures, { width: width / 2, align: 'center' });
    document.font('regular').fontSize(10).fillColor('#5f5e5a')
      .text(data.handed_over_by_name ?? UNKNOWN, left, signatures + 70, { width: width / 2, align: 'center' });
    document.text(data.requester_name ?? UNKNOWN, left + width / 2, signatures + 70, { width: width / 2, align: 'center' });
    document.fontSize(9).text(
      'Biên bản sinh tự động từ lịch sử xử lý trong DX-Desk; người và thời điểm lấy từ nhật ký do hệ thống ghi.',
      left, document.page.height - document.page.margins.bottom - 24, { width, align: 'center' });
    document.end();
  });
}

/**
 * Bảo đảm biên bản đã có trong kho tệp. `run` chạy truy vấn dưới vai trò của người gọi (người dùng hoặc
 * dịch vụ tự động hóa); giao dịch CSDL đóng trước khi gọi kho tệp. Gọi lặp an toàn: khóa tệp xác định theo
 * mã đề nghị và chỉ được ghi một lần.
 */
export async function ensureHandover(run: Run, id: string): Promise<string> {
  const data = await run(async client =>
    (await client.query('SELECT private.device_handover_data($1) AS data', [id])).rows[0].data as HandoverData);
  if (data.handover_key) return data.handover_key;
  const pdf = await renderHandover(data);
  const key = handoverKey(id);
  try {
    await putObject(key, 'application/pdf', pdf);
  } catch {
    throw new ServiceUnavailableException('Kho tệp chưa sẵn sàng nên chưa tạo được biên bản. Vui lòng thử lại.');
  }
  await run(client => client.query('SELECT private.set_device_handover($1,$2,$3)', [id, key, pdf.length]));
  return key;
}

function signature(id: string, expires: string): string {
  const key = required('ATTACHMENT_SIGNING_KEY');
  if (Buffer.byteLength(key) < 32) throw new Error('ATTACHMENT_SIGNING_KEY must have at least 32 bytes.');
  // Tiền tố riêng: chữ ký của tệp đính kèm không dùng được cho biên bản và ngược lại.
  return createHmac('sha256', key).update(`dxdesk-handover-v1\n${id}\n${expires}`).digest('hex');
}
export function handoverUrl(id: string, now = Date.now()): { url: string; expires_at: string } {
  const expires = String(Math.floor(now / 1000) + DOWNLOAD_TTL_SECONDS);
  return { url: `/api/device-handovers/${id}/content?expires=${expires}&signature=${signature(id, expires)}`,
    expires_at: new Date(Number(expires) * 1000).toISOString() };
}
export function validHandover(id: string, expires: unknown, signed: unknown, now = Date.now()): boolean {
  if (typeof expires !== 'string' || !/^\d{10}$/.test(expires)
      || typeof signed !== 'string' || !/^[a-f0-9]{64}$/.test(signed)) return false;
  const remaining = Number(expires) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > DOWNLOAD_TTL_SECONDS) return false;
  return timingSafeEqual(Buffer.from(signed, 'hex'), Buffer.from(signature(id, expires), 'hex'));
}

@Controller('api')
@UseGuards(JwtGuard)
export class DeviceHandoverController {
  constructor(private readonly db: Database) {}

  // RLS quyết định ai lấy được liên kết: người đề nghị, Manager của đơn vị và IT.
  @Post('device-requests/:id/handover-url')
  @HttpCode(200)
  async issue(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response) {
    const row = await this.db.asUser(request.claims, async client =>
      (await client.query('SELECT status FROM public.device_requests WHERE id=$1', [id])).rows[0]);
    if (!row) throw new NotFoundException('Không tìm thấy đề nghị thiết bị.');
    if (row.status !== 'handed_over') throw new ConflictException('Đề nghị chưa được bàn giao nên chưa có biên bản.');
    // Thường biên bản đã được tạo ngay sau sự kiện bàn giao; nhánh này phục vụ khi tự động hóa tắt.
    await ensureHandover(operation => this.db.asUser(request.claims, operation), id);
    response.setHeader('Cache-Control', 'no-store');
    return handoverUrl(id);
  }
}

// Chữ ký là quyền tải ngắn hạn, chỉ cấp sau khi qua RLS; không đặt JWT vào URL của trình duyệt.
@Controller('api')
export class DeviceHandoverContentController {
  constructor(private readonly db: Database) {}

  @Get('device-handovers/:id/content')
  async content(@Param('id', ParseUUIDPipe) id: string, @Query('expires') expires: unknown,
    @Query('signature') signed: unknown, @Res({ passthrough: true }) response: Response) {
    if (!validHandover(id, expires, signed)) throw new ForbiddenException('Liên kết tải không hợp lệ hoặc đã hết hạn.');
    const row = (await this.db.pool.query('SELECT * FROM private.device_handover_for_download($1)', [id])).rows[0];
    if (!row) throw new NotFoundException('Biên bản không còn sẵn sàng để tải.');
    let upstream;
    try {
      upstream = await fetch(`${seaweedfsEndpoint()}/${row.object_key}`, { signal: AbortSignal.timeout(30000) });
    } catch { throw new ServiceUnavailableException('Kho tệp chưa sẵn sàng. Vui lòng thử lại.'); }
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      throw new ServiceUnavailableException('Không đọc được biên bản.');
    }
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream), {
      type: 'application/pdf', length: Number(row.size_bytes),
      disposition: `attachment; filename="bien-ban-ban-giao-${handoverCode(id)}.pdf"`,
    });
  }
}
