// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthRequest, JwtGuard } from './auth';
import { Database } from './database';

export function requireAssistantProof(
  owner: string,
  scope: string,
  body: unknown,
  proof: string | undefined,
) {
  const key = process.env.ASSISTANT_ACTION_KEY;
  if (!key || key.length < 32 || !proof || !/^[a-f0-9]{64}$/.test(proof))
    throw new ForbiddenException('Yêu cầu phải qua dịch vụ trợ lý.');
  const expected = createHmac('sha256', key)
    .update(JSON.stringify([owner, scope, body]))
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(proof, 'hex')))
    throw new ForbiddenException('Chữ ký trợ lý không hợp lệ.');
}

async function lockSession(client: PoolClient, id: string) {
  const session = (
    await client.query('SELECT * FROM private.assistant_sessions WHERE id=$1 FOR UPDATE', [id])
  ).rows[0];
  if (!session) throw new NotFoundException('Cuộc trò chuyện không tồn tại.');
  await client.query(
    `UPDATE private.assistant_turns SET status='interrupted',finished_at=now(),
    metadata=jsonb_build_object('error','Phiên trả lời đã bị gián đoạn. Bạn có thể gửi tiếp tin nhắn.')
    WHERE session_id=$1 AND status='pending' AND lease_until<=now()`,
    [id],
  );
  return session;
}

function offsetValue(raw: string | undefined) {
  if (raw === undefined) return 0;
  if (!/^\d{1,9}$/.test(raw)) throw new BadRequestException('Vị trí trang không hợp lệ.');
  return Number(raw);
}

@Controller('api/assistant-sessions')
@UseGuards(JwtGuard)
export class AssistantSessionsController {
  constructor(private readonly db: Database) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest, @Query('offset') raw?: string) {
    const offset = offsetValue(raw);
    return this.db.asUser(request.claims, async (client) => {
      const rows = (
        await client.query(
          `SELECT id,title,created_at,updated_at FROM private.assistant_sessions
        ORDER BY updated_at DESC,id LIMIT 51 OFFSET $1`,
          [offset],
        )
      ).rows;
      return { data: rows.slice(0, 50), has_more: rows.length > 50 };
    });
  }

  @Post()
  create(@Req() request: AuthRequest, @Body() body: Record<string, unknown>) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)
      throw new BadRequestException('Cuộc trò chuyện mới nhận nội dung rỗng.');
    return this.db.asUser(
      request.claims,
      async (client) =>
        (
          await client.query(`INSERT INTO private.assistant_sessions DEFAULT VALUES
      RETURNING id,title,created_at,updated_at`)
        ).rows[0],
    );
  }

  @Get('proposals/:proposalId')
  @Header('Cache-Control', 'no-store')
  proposal(@Req() request: AuthRequest, @Param('proposalId', ParseUUIDPipe) id: string) {
    return this.db.asUser(request.claims, async (client) => {
      const row = (
        await client.query(
          `SELECT session_id,metadata->'proposal' AS proposal FROM private.assistant_turns
        WHERE metadata->'proposal'->>'id'=$1 AND status='complete'`,
          [id],
        )
      ).rows[0];
      if (!row || row.proposal.status !== 'pending' || Date.parse(row.proposal.expires_at) <= Date.now()) {
        throw new NotFoundException('Đề xuất đã hết hạn hoặc đã được xử lý.');
      }
      return { id, session_id: row.session_id, tool: row.proposal.tool, args: row.proposal.fields };
    });
  }

  @Post('proposals/:proposalId/cancel')
  @HttpCode(200)
  cancel(@Req() request: AuthRequest, @Param('proposalId', ParseUUIDPipe) id: string) {
    return this.db.asUser(request.claims, async (client) => {
      // Serialize cancellation with approval on the same conversation row.
      const row = (
        await client.query(
          `SELECT session_id FROM private.assistant_turns
        WHERE metadata->'proposal'->>'id'=$1`,
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException();
      await lockSession(client, row.session_id);
      const changed = await client.query(
        `UPDATE private.assistant_turns SET metadata=jsonb_set(metadata,'{proposal,status}','"cancelled"')
        WHERE metadata->'proposal'->>'id'=$1 AND metadata->'proposal'->>'status'='pending'`,
        [id],
      );
      if (!changed.rowCount) throw new ConflictException('Đề xuất đã được xử lý.');
      return { status: 'cancelled' };
    });
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before?: string,
  ) {
    if (before && !/^\d{1,18}$/.test(before)) throw new BadRequestException('Mốc lịch sử không hợp lệ.');
    return this.db.asUser(request.claims, async (client) => {
      const session = await lockSession(client, id);
      const rows = (
        await client.query(
          `SELECT id,ordinal,question,answer,status,metadata,created_at FROM private.assistant_turns
        WHERE session_id=$1 AND ($2::bigint IS NULL OR ordinal<$2) ORDER BY ordinal DESC LIMIT 41`,
          [id, before ?? null],
        )
      ).rows;
      return {
        session: { id, title: session.title, created_at: session.created_at, updated_at: session.updated_at },
        turns: rows.slice(0, 40).reverse(),
        has_more: rows.length > 40,
      };
    });
  }

  @Patch(':id')
  rename(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { title?: unknown },
  ) {
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 100 || Object.keys(body).length !== 1)
      throw new BadRequestException('Tên hội thoại cần từ 1 đến 100 ký tự.');
    return this.db.asUser(request.claims, async (client) => {
      const row = (
        await client.query(
          `UPDATE private.assistant_sessions SET title=$2,automatic_title=false,updated_at=now()
        WHERE id=$1 RETURNING id,title,created_at,updated_at`,
          [id, title],
        )
      ).rows[0];
      if (!row) throw new NotFoundException();
      return row;
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    await this.db.asUser(request.claims, async (client) => {
      if (!(await client.query('DELETE FROM private.assistant_sessions WHERE id=$1', [id])).rowCount)
        throw new NotFoundException();
    });
  }

  @Post(':id/turns/start')
  @HttpCode(200)
  begin(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-dxdesk-assistant-proof') proof: string | undefined,
    @Body() body: { request_id?: unknown; question?: unknown },
  ) {
    requireAssistantProof(request.claims.sub, 'start:' + id, body, proof);
    if (
      typeof body.request_id !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(body.request_id) ||
      typeof body.question !== 'string' ||
      !body.question.trim() ||
      body.question.length > 8000 ||
      Object.keys(body).length !== 2
    ) {
      throw new BadRequestException('Tin nhắn không hợp lệ.');
    }
    const question = body.question;
    const requestId = body.request_id;
    return this.db.asUser(request.claims, async (client) => {
      const session = await lockSession(client, id);
      const existing = (
        await client.query('SELECT * FROM private.assistant_turns WHERE id=$1 AND session_id=$2', [
          requestId,
          id,
        ])
      ).rows[0];
      if (existing) {
        if (existing.question !== question) throw new ConflictException('Mã tin nhắn đã được sử dụng.');
        if (existing.status === 'pending') throw new ConflictException('Tin nhắn này đang được xử lý.');
        return { replay: existing };
      }
      const pending = await client.query(
        "SELECT id FROM private.assistant_turns WHERE session_id=$1 AND status='pending'",
        [id],
      );
      if (pending.rowCount)
        throw new ConflictException(
          'Cuộc trò chuyện đang có câu trả lời. Vui lòng chờ hoặc dừng trước khi gửi tiếp.',
        );
      const history = (
        await client.query(
          `SELECT ordinal,question,answer,status,metadata FROM private.assistant_turns
        WHERE session_id=$1 AND ordinal>$2 ORDER BY ordinal`,
          [id, session.summarized_through],
        )
      ).rows;
      const turn = (
        await client.query(
          `INSERT INTO private.assistant_turns(id,session_id,question) VALUES($1,$2,$3)
        RETURNING id,ordinal,created_at`,
          [requestId, id, question],
        )
      ).rows[0];
      if (session.automatic_title && !history.length && Number(session.summarized_through) === 0) {
        session.title = question.trim().replace(/\s+/g, ' ').slice(0, 80);
      }
      await client.query('UPDATE private.assistant_sessions SET title=$2,updated_at=now() WHERE id=$1', [
        id,
        session.title,
      ]);
      return {
        turn,
        session: { id, title: session.title },
        history,
        summary: session.context_summary,
        summarized_through: session.summarized_through,
      };
    });
  }

  @Post(':id/turns/:turnId/finish')
  @HttpCode(200)
  finish(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('turnId', ParseUUIDPipe) turnId: string,
    @Headers('x-dxdesk-assistant-proof') proof: string | undefined,
    @Body()
    body: {
      answer?: unknown;
      status?: unknown;
      metadata?: unknown;
      summary?: unknown;
      summarized_through?: unknown;
    },
  ) {
    requireAssistantProof(request.claims.sub, 'finish:' + id + ':' + turnId, body, proof);
    if (
      typeof body.answer !== 'string' ||
      body.answer.length > 16000 ||
      !['complete', 'error', 'interrupted'].includes(String(body.status)) ||
      !body.metadata ||
      typeof body.metadata !== 'object' ||
      Array.isArray(body.metadata) ||
      JSON.stringify(body.metadata).length > 32000 ||
      (body.summary !== undefined && (typeof body.summary !== 'string' || body.summary.length > 12000)) ||
      (body.summarized_through !== undefined && !/^\d{1,18}$/.test(String(body.summarized_through)))
    ) {
      throw new BadRequestException('Phản hồi trợ lý không hợp lệ.');
    }
    return this.db.asUser(request.claims, async (client) => {
      await lockSession(client, id);
      const turn = (
        await client.query('SELECT * FROM private.assistant_turns WHERE id=$1 AND session_id=$2', [
          turnId,
          id,
        ])
      ).rows[0];
      if (!turn) throw new NotFoundException();
      if (turn.status !== 'pending') {
        if (turn.status === body.status && turn.answer === body.answer) return { status: turn.status };
        throw new ConflictException('Lượt trả lời đã kết thúc.');
      }
      await client.query(
        `UPDATE private.assistant_turns SET answer=$2,status=$3,metadata=$4::jsonb,finished_at=now()
        WHERE id=$1`,
        [turnId, body.answer, body.status, JSON.stringify(body.metadata)],
      );
      if (body.summary !== undefined && body.summarized_through !== undefined) {
        await client.query(
          `UPDATE private.assistant_sessions SET context_summary=$2,summarized_through=$3
          WHERE id=$1 AND summarized_through<=$3 AND $3::bigint<$4::bigint`,
          [id, body.summary, String(body.summarized_through), turn.ordinal],
        );
      }
      await client.query('UPDATE private.assistant_sessions SET updated_at=now() WHERE id=$1', [id]);
      return { status: body.status };
    });
  }
}
