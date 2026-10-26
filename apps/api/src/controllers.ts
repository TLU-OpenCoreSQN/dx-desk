// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import {
  Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query,
  Req, ServiceUnavailableException, UseGuards,
} from '@nestjs/common';
import { AuthRequest, JwtGuard } from './auth';
import { Database } from './database';
import { CreateDeviceRequest, CreateTicket, ListQuery } from './dto';

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
      data: (await client.query('SELECT id, code, name, description FROM public.categories WHERE active ORDER BY code')).rows,
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
    return this.db.asUser(request.claims, async client => (await client.query(
      `INSERT INTO public.tickets(category_id, title, description, priority)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.category_id, body.title, body.description, body.priority ?? 'normal'],
    )).rows[0]);
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
