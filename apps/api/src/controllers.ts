// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get,
  NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query,
  Req, ServiceUnavailableException, UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import { AuthRequest, JwtGuard } from './auth';
import { Database } from './database';
import { CreateDeviceRequest, CreateTicket, ListQuery, UpdateTicketStatus } from './dto';
import { TransitionViolation, validateTransition } from './state-machine';
import { activeRoles, checkRequirementFields, criticalViolation, initialStatusFor } from './rules';

@Controller('api')
export class HealthController {
  constructor(private readonly db: Database) {}
  @Get('health')
  async health() {
    try { await this.db.pool.query('SELECT 1'); }
    catch { throw new ServiceUnavailableException('Cơ sở dữ liệu chưa sẵn sàng.'); }
    return { status: 'ok', service: 'dx-desk-api', version: '0.1.0' };
  }
}

/** Map vi phạm máy trạng thái (từ state-machine.ts) sang exception HTTP. */
function transitionException(violation: TransitionViolation) {
  switch (violation.status) {
    case 403: return new ForbiddenException(violation.message);
    case 409: return new ConflictException(violation.message);
    default: return new UnprocessableEntityException(violation.message);
  }
}

/** SQLSTATE do trigger private.guard_ticket_update() raise — thông báo cố định tiếng Việt, không lộ SQL. */
export function workflowExceptionForCode(code?: string): { status: number; message: string } | null {
  if (code === '45001') {
    return { status: 422, message: 'Chuyển trạng thái không hợp lệ với quy trình xử lý yêu cầu.' };
  }
  if (code === '45002') {
    return { status: 403, message: 'Vai trò của bạn không được phép chuyển yêu cầu sang trạng thái này.' };
  }
  if (code === '45003') {
    return { status: 422, message: 'Cần ghi chú kết quả xử lý (5–2000 ký tự) trước khi đánh dấu yêu cầu đã xử lý.' };
  }
  return null;
}

@Controller('api')
@UseGuards(JwtGuard)
export class DeskController {
  constructor(private readonly db: Database) {}
  @Get('me')
  me(@Req() request: AuthRequest) {
    return {
      id: request.claims.sub, username: request.claims.preferred_username ?? '',
      roles: request.claims.realm_access.roles.filter(r => ['Employee', 'Agent', 'Manager'].includes(r)),
    };
  }
  @Get('categories')
  categories(@Req() request: AuthRequest) {
    return this.db.asUser(request.claims, async client => ({
      data: (await client.query(
        'SELECT id, code, name, description, requirement_fields FROM public.categories WHERE active ORDER BY code',
      )).rows,
    }));
  }
  @Get('tickets')
  tickets(@Req() request: AuthRequest, @Query() query: ListQuery) {
    return this.db.asUser(request.claims, async client => ({
      data: (await client.query(
        'SELECT * FROM public.tickets ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
        [query.limit, query.offset],
      )).rows,
      limit: query.limit, offset: query.offset,
    }));
  }
  @Get('tickets/:id')
  ticket(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.db.asUser(request.claims, async client => {
      const result = await client.query('SELECT * FROM public.tickets WHERE id = $1', [id]);
      if (!result.rows[0]) throw new NotFoundException('Không tìm thấy yêu cầu.');
      return result.rows[0];
    });
  }
  @Get('tickets/:id/events')
  events(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.db.asUser(request.claims, async client => {
      const ticket = await client.query('SELECT id FROM public.tickets WHERE id = $1', [id]);
      if (!ticket.rowCount) throw new NotFoundException('Không tìm thấy yêu cầu.');
      return { data: (await client.query(
        'SELECT * FROM public.ticket_events WHERE ticket_id = $1 ORDER BY created_at, id', [id],
      )).rows };
    });
  }
  @Post('tickets')
  createTicket(@Req() request: AuthRequest, @Body() body: CreateTicket) {
    const roles = activeRoles(request.claims.realm_access.roles);
    return this.db.asUser(request.claims, async client => {
      // W3-02 rule 2: critical chỉ Manager (API layer; RLS vẫn là lớp phòng thủ cuối).
      const critical = criticalViolation(roles, body.priority);
      if (critical) throw new ForbiddenException(critical);
      const category = (await client.query(
        'SELECT code, requirement_fields FROM public.categories WHERE id = $1 AND active',
        [body.category_id],
      )).rows[0] as { code: string; requirement_fields: unknown } | undefined;
      if (!category) {
        throw new ForbiddenException('Danh mục không tồn tại hoặc không khả dụng.');
      }
      // W3-02 rule 5: trường bắt buộc theo danh mục (categories.requirement_fields).
      const check = checkRequirementFields(category.requirement_fields, body.fields);
      if (!check.ok) {
        if (check.kind === 'missing') {
          throw new UnprocessableEntityException(`Thiếu trường bắt buộc: ${check.labels.join(', ')}.`);
        }
        if (check.kind === 'unknown') {
          throw new BadRequestException('Biểu mẫu chứa trường không thuộc danh mục đã chọn.');
        }
        throw new BadRequestException('Giá trị trường biểu mẫu không hợp lệ (cần chuỗi 1–500 ký tự).');
      }
      // W3-02 rule 3: Employee tạo ticket loại 'access' vào hàng chờ phê duyệt.
      const status = initialStatusFor(category.code, roles);
      return (await client.query(
        `INSERT INTO public.tickets(category_id, title, description, priority, status, request_fields)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [body.category_id, body.title, body.description, body.priority ?? 'normal',
          status, JSON.stringify(check.values)],
      )).rows[0];
    });
  }
  /**
   * W3-01: PATCH /api/tickets/:id/status. Một giao dịch qua db.asUser (RLS áp dụng):
   * khóa dòng (FOR UPDATE) → kiểm tra máy trạng thái + vai trò (state-machine.ts) →
   * set_config app.status_note → UPDATE. Trigger DB kiểm tra lại cạnh/vai trò,
   * quản lý waiting_since + sla_paused_ms và ghi ticket_events 'status_changed'
   * {from,to,note} trong cùng giao dịch.
   */
  @Patch('tickets/:id/status')
  updateTicketStatus(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTicketStatus,
  ) {
    const roles = activeRoles(request.claims.realm_access.roles);
    return this.db.asUser(request.claims, async client => {
      const ticket = (await client.query(
        'SELECT status, requester_id FROM public.tickets WHERE id = $1 FOR UPDATE', [id],
      )).rows[0] as { status: string; requester_id: string } | undefined;
      if (!ticket) throw new NotFoundException('Không tìm thấy yêu cầu.');
      const result = validateTransition(ticket.status, body.to, {
        roles,
        isRequester: ticket.requester_id === request.claims.sub,
        resolutionNote: body.resolution_note,
      });
      if (!result.ok) throw transitionException(result);
      await client.query("SELECT set_config('app.status_note', $1, true)", [body.note ?? '']);
      const updated = await client.query(
        `UPDATE public.tickets
         SET status = $2, resolution_note = COALESCE($3, resolution_note)
         WHERE id = $1`,
        [id, body.to, body.to === 'resolved' ? body.resolution_note ?? null : null],
      );
      if (!updated.rowCount) {
        throw new ForbiddenException('Bạn không có quyền chuyển trạng thái yêu cầu này.');
      }
      return (await client.query('SELECT * FROM public.tickets WHERE id = $1', [id])).rows[0];
    });
  }
  @Get('device-requests')
  devices(@Req() request: AuthRequest, @Query() query: ListQuery) {
    return this.db.asUser(request.claims, async client => ({
      data: (await client.query(
        'SELECT * FROM public.device_requests ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
        [query.limit, query.offset],
      )).rows, limit: query.limit, offset: query.offset,
    }));
  }
  @Post('device-requests')
  createDevice(@Req() request: AuthRequest, @Body() body: CreateDeviceRequest) {
    return this.db.asUser(request.claims, async client => (await client.query(
      `INSERT INTO public.device_requests(device_type, reason, quantity)
       VALUES ($1, $2, $3) RETURNING *`,
      [body.device_type, body.reason, body.quantity ?? 1],
    )).rows[0]);
  }
}
