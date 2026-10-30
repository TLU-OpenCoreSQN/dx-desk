// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import {
  Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res,
  ForbiddenException, NotFoundException, ServiceUnavailableException, StreamableFile, UseGuards,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import type { Response } from 'express';
import { AuthRequest, JwtGuard } from './auth';
import { Database } from './database';
import { required } from './config';
import { seaweedfsEndpoint } from './seaweedfs';

export const DOWNLOAD_TTL_SECONDS = 120;
function signingKey(): string {
  const key = required('ATTACHMENT_SIGNING_KEY');
  if (Buffer.byteLength(key) < 32) throw new Error('ATTACHMENT_SIGNING_KEY must have at least 32 bytes.');
  return key;
}
export function downloadSignature(id: string, expires: string): string {
  return createHmac('sha256', signingKey()).update(`dxdesk-download-v1\n${id}\n${expires}`).digest('hex');
}
export function validDownload(id: string, expires: unknown, signature: unknown, now = Date.now()): boolean {
  if (typeof expires !== 'string' || !/^\d{10}$/.test(expires)
      || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const remaining = Number(expires) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > DOWNLOAD_TTL_SECONDS) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(downloadSignature(id, expires), 'hex'));
}

@Controller('api')
@UseGuards(JwtGuard)
export class AttachmentLinksController {
  constructor(private readonly db: Database) {}

  @Get('tickets/:id/attachments')
  list(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.db.asUser(request.claims, async client => {
      if (!(await client.query('SELECT 1 FROM public.tickets WHERE id=$1', [id])).rowCount) {
        throw new NotFoundException('Không tìm thấy yêu cầu.');
      }
      return { data: (await client.query(
        `SELECT id,ticket_id,uploaded_by,file_name,content_type,size_bytes,scan_status,created_at
         FROM public.attachments WHERE ticket_id=$1 ORDER BY created_at,id`, [id],
      )).rows };
    });
  }

  @Post('attachments/:id/download-url')
  async issue(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response) {
    await this.db.asUser(request.claims, async client => {
      const row = (await client.query('SELECT scan_status FROM public.attachments WHERE id=$1', [id])).rows[0];
      if (!row) throw new NotFoundException('Không tìm thấy tệp đính kèm.');
      if (row.scan_status !== 'clean') throw new ForbiddenException('Tệp chưa được xác nhận an toàn để tải.');
    });
    const expires = String(Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_SECONDS);
    response.setHeader('Cache-Control', 'no-store');
    return { url: `/api/attachments/${id}/content?expires=${expires}&signature=${downloadSignature(id, expires)}`,
      expires_at: new Date(Number(expires) * 1000).toISOString() };
  }
}

// The signature is a short-lived bearer capability issued only after an RLS check.
// No JWT is put in a browser URL. Filer and volume ports remain private.
@Controller('api')
export class AttachmentContentController {
  constructor(private readonly db: Database) {}

  @Get('attachments/:id/content')
  async content(@Param('id', ParseUUIDPipe) id: string,
    @Query('expires') expires: unknown, @Query('signature') signature: unknown,
    @Res({ passthrough: true }) response: Response) {
    if (!validDownload(id, expires, signature)) throw new ForbiddenException('Liên kết tải không hợp lệ hoặc đã hết hạn.');
    const row = (await this.db.pool.query('SELECT * FROM private.clean_attachment_for_download($1)', [id])).rows[0];
    if (!row) throw new NotFoundException('Tệp không còn sẵn sàng để tải.');
    let upstream;
    try {
      upstream = await fetch(`${seaweedfsEndpoint()}/${row.object_key}`, { signal: AbortSignal.timeout(30000) });
    } catch { throw new ServiceUnavailableException('Kho tệp chưa sẵn sàng. Vui lòng thử lại.'); }
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      throw new ServiceUnavailableException('Không đọc được tệp đính kèm.');
    }
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    // Always download as an attachment, including client-declared text/pdf/image types.
    const filename = encodeURIComponent(String(row.file_name)).replace(/['()*]/g,
      value => `%${value.charCodeAt(0).toString(16).toUpperCase()}`);
    return new StreamableFile(Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream), {
      type: 'application/octet-stream', length: Number(row.size_bytes),
      disposition: `attachment; filename="download"; filename*=UTF-8''${filename}`,
    });
  }
}
