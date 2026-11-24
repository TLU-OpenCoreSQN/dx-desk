// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Headers, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AuthRequest, JwtGuard } from './auth';
import { createUserTicket } from './controllers';
import { Database } from './database';

const ticketTools = ['ticket_statistics', 'similar_tickets', 'create_ticket'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const code = /^[a-z][a-z0-9-]{1,39}$/;
const limit = (body: unknown, fields: Record<string, [number, number]>) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== Object.keys(fields).length) {
    throw new BadRequestException('Tham số công cụ không hợp lệ.');
  }
  const args: Record<string, string> = {};
  for (const [field, [min, max]] of Object.entries(fields)) {
    const raw = (body as Record<string, unknown>)[field];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value.length < min || value.length > max) throw new BadRequestException('Tham số công cụ không hợp lệ.');
    args[field] = value;
  }
  return args;
};

function actionProof(owner: string, kind: string, id: string, proof: string | undefined, args: Record<string, string>, sessionId?: string) {
  const key = process.env.ASSISTANT_ACTION_KEY;
  if (!key || key.length < 32 || !proof || !/^[0-9a-f]{64}$/.test(proof)) return false;
  const canonical = Object.fromEntries(Object.entries(args).sort(([a], [b]) => a.localeCompare(b)));
  const payload = sessionId ? [owner, kind, id, canonical, sessionId] : [owner, kind, id, canonical];
  const expected = createHmac('sha256', key).update(JSON.stringify(payload)).digest();
  return timingSafeEqual(expected, Buffer.from(proof, 'hex'));
}

@Controller('api/assistant-tools')
@UseGuards(JwtGuard)
export class AssistantToolsController {
  constructor(private readonly db: Database) {}

  @Get()
  list(@Req() request: AuthRequest) {
    const manager = request.claims.realm_access.roles.includes('Manager');
    const canWrite = (process.env.ASSISTANT_ACTION_KEY?.length ?? 0) >= 32;
    return { tools: [...ticketTools.slice(0, canWrite ? 3 : 2), ...(manager && canWrite ? ['create_task'] : [])] };
  }

  @Post('ticket_statistics')
  @HttpCode(200)
  statistics(@Req() request: AuthRequest, @Body() body: unknown) {
    const { category } = limit(body, { category: [2, 40] });
    if (!code.test(category)) throw new BadRequestException('Mã danh mục không hợp lệ.');
    return this.db.asUser(request.claims, async client => (await client.query(
      `WITH periods AS (
        SELECT date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AS start, now() AS stop
      )
      SELECT $1::text AS category, p.start AS week_start,
        count(t.id) FILTER (WHERE t.created_at >= p.start)::int AS current_week,
        count(t.id) FILTER (WHERE t.created_at < p.start AND t.created_at < p.stop - interval '7 days')::int AS previous_week
      FROM periods p CROSS JOIN public.categories c LEFT JOIN public.tickets t
        ON t.category_id=c.id AND t.created_at >= p.start - interval '7 days' AND t.created_at < p.stop
      WHERE c.code=$1 GROUP BY p.start`, [category])).rows[0] ?? { category, current_week: 0, previous_week: 0 });
  }

  @Get('tasks/:id')
  task(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.db.asUser(request.claims, async client => {
      const task = (await client.query(`SELECT id,args->>'title' AS title,args->>'description' AS description,actor_type,created_at
        FROM private.assistant_actions WHERE id=$1 AND kind='create_task'`, [id])).rows[0];
      if (!task) throw new NotFoundException();
      return task;
    });
  }

  @Post('similar_tickets')
  @HttpCode(200)
  similar(@Req() request: AuthRequest, @Body() body: unknown) {
    const { query } = limit(body, { query: [2, 500] });
    return this.db.asUser(request.claims, async client => ({ data: (await client.query(
      `SELECT id,title,status FROM public.tickets
       WHERE strpos(lower(title),lower($1))>0 OR strpos(lower(description),lower($1))>0
       ORDER BY created_at DESC,id LIMIT 5`, [query])).rows }));
  }

  @Post(':kind')
  @HttpCode(200)
  write(@Req() request: AuthRequest, @Param('kind') kind: string, @Headers('idempotency-key') id: string | undefined,
    @Headers('x-dxdesk-assistant-proof') proof: string | undefined, @Body() body: unknown,
    @Headers('x-dxdesk-assistant-session') sessionId?: string) {
    if (kind !== 'create_ticket' && kind !== 'create_task') throw new BadRequestException('Công cụ không hợp lệ.');
    if (kind === 'create_task' && !request.claims.realm_access.roles.includes('Manager')) {
      throw new ForbiddenException('Chỉ quản lý tạo được công việc điều tra.');
    }
    const lengths: Record<string, [number, number]> = { title: [5, 150], description: [10, 2000] };
    if (kind === 'create_ticket') lengths.category = [2, 40];
    const args = limit(body, lengths);
    if (!id || !UUID.test(id) || (sessionId && !UUID.test(sessionId)) || !actionProof(request.claims.sub, kind, id, proof, args, sessionId)) {
      throw new ForbiddenException('Cần xác nhận hành động qua trợ lý.');
    }
    return this.db.asUser(request.claims, async client => {
      let sessionTurn: {id:string;metadata:{proposal:{status:string;expires_at:string}}} | undefined;
      if (sessionId) {
        const session=await client.query('SELECT id FROM private.assistant_sessions WHERE id=$1 FOR UPDATE',[sessionId]);
        if (!session.rowCount) throw new NotFoundException('Cuộc trò chuyện không tồn tại.');
        sessionTurn=(await client.query(`SELECT id,metadata FROM private.assistant_turns WHERE session_id=$1 AND status='complete'
          AND metadata->'proposal'->>'id'=$2 AND metadata->'proposal'->>'tool'=$3
          AND metadata->'proposal'->'fields'=$4::jsonb`,[sessionId,id,kind,JSON.stringify(args)])).rows[0];
        const proposal=sessionTurn?.metadata.proposal;
        if (!proposal || proposal.status==='cancelled' || (proposal.status==='pending' && Date.parse(proposal.expires_at)<=Date.now())) {
          throw new ConflictException('Đề xuất đã hết hạn hoặc đã được xử lý.');
        }
      }
      const insert = await client.query(`INSERT INTO private.assistant_actions(id,kind,args)
        VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id`, [id, kind, JSON.stringify(args)]);
      let result: {id:string;ticket_id:string|null};
      if (!insert.rowCount) {
        const existing = await client.query(`SELECT id,ticket_id FROM private.assistant_actions
          WHERE id=$1 AND kind=$2 AND args=$3::jsonb`, [id, kind, JSON.stringify(args)]);
        if (!existing.rowCount) throw new ConflictException('Mã hành động đã được sử dụng.');
        result=existing.rows[0];
      } else if (kind === 'create_task') {
        result={id,ticket_id:null};
      } else {
      const category = (await client.query(`SELECT id FROM public.categories WHERE code=$1 AND active`, [args.category])).rows[0];
      if (!category) throw new BadRequestException('Danh mục công cụ không hợp lệ.');
      // VPN drafts retain the user's description. Missing diagnostic values remain explicitly unknown.
      const fields: Record<string,string> = {};
      if (args.category === 'vpn') {
        fields.client_version = 'Chưa cung cấp';
        fields.error_message = args.description.slice(0,500);
      }
      await client.query("SELECT set_config('app.assistant_action','create_ticket',true)");
      const ticket = await createUserTicket(client, request.claims, {
        category_id: category.id, title: args.title, description: args.description, fields,
      });
      await client.query('UPDATE private.assistant_actions SET ticket_id=$2 WHERE id=$1', [id, ticket.id]);
        result={id,ticket_id:ticket.id};
      }
      if (sessionTurn) await client.query(`UPDATE private.assistant_turns SET metadata=jsonb_set(metadata,'{proposal}',
        (metadata->'proposal') || jsonb_build_object('status','applied','result',$2::jsonb)) WHERE id=$1`,[sessionTurn.id,JSON.stringify(result)]);
      return result;
    });
  }
}
