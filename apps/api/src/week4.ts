// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthRequest, JwtGuard } from './auth';
import { Database } from './database';
import { EmptyBody, ProcessEvent, SyncRoster } from './dto-week4';
import { AutomationGuard, AutomationRequest } from './service-auth';

// Public projection is intentional: future private columns do not silently change the API.
export const TICKET_SELECT = `t.id,t.requester_id,t.category_id,t.title,t.description,t.priority,t.status,
 t.assigned_to,t.created_at,t.updated_at,t.sla_due_at,t.sla_paused_ms,t.waiting_since,t.resolution_note,t.request_fields,
 t.assigned_team_id,t.sla_breached,t.sla_breached_at,t.ticket_version::float8 AS ticket_version,
 private.team_name(t.assigned_team_id) AS team_name,private.assignee_name(t.assigned_to) AS assignee_name,
 (SELECT nullif(e.actor_name,'') FROM public.ticket_events e WHERE e.ticket_id=t.id AND e.event_type='created'
 ORDER BY e.created_at,e.id LIMIT 1) AS requester_name`;

@Controller('api')
@UseGuards(JwtGuard)
export class WorkQueueController {
  constructor(private readonly db: Database) {}
  @Get('teams')
  teams(@Req() request: AuthRequest) {
    return this.db.asUser(request.claims, async client => ({
      data: (await client.query('SELECT private.staff_teams() AS data')).rows[0].data,
    }));
  }
  @Post('tickets/:id/claim')
  @HttpCode(200)
  claim(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string, @Body() _body: EmptyBody) {
    return this.db.asUser(request.claims, async client => {
      await client.query('SELECT private.claim_ticket($1)', [id]);
      return (await client.query(`SELECT ${TICKET_SELECT} FROM public.tickets t WHERE t.id=$1`, [id])).rows[0];
    });
  }
}

@Controller('api/system')
@UseGuards(AutomationGuard)
export class AutomationController {
  constructor(private readonly db: Database) {}
  @Get('teams')
  teams(@Req() request: AutomationRequest) {
    return this.db.asAutomation(request.claims, async client => ({
      data: (await client.query('SELECT private.automation_teams() AS data')).rows[0].data,
    }));
  }
  @Get('outbox')
  outbox(@Req() request: AutomationRequest) {
    return this.db.asAutomation(request.claims, async client =>
      (await client.query('SELECT private.outbox_status() AS result')).rows[0].result);
  }
  @Post('outbox/:id/replay')
  @HttpCode(200)
  replay(@Req() request: AutomationRequest, @Param('id', ParseUUIDPipe) id: string, @Body() _body: EmptyBody) {
    return this.db.asAutomation(request.claims, async client => ({
      replayed: (await client.query('SELECT private.replay_outbox($1) AS replayed', [id])).rows[0].replayed,
    }));
  }
  @Post('events/:id/process')
  @HttpCode(200)
  process(@Req() request: AutomationRequest, @Param('id', ParseUUIDPipe) id: string, @Body() _body: ProcessEvent) {
    return this.db.asAutomation(request.claims, async client =>
      (await client.query('SELECT private.process_event($1) AS result', [id])).rows[0].result);
  }
  @Post('sla/evaluate')
  @HttpCode(200)
  evaluate(@Req() request: AutomationRequest, @Body() _body: EmptyBody) {
    return this.db.asAutomation(request.claims, async client => ({
      queued: (await client.query('SELECT private.evaluate_sla() AS queued')).rows[0].queued,
    }));
  }
  @Post('roster')
  @HttpCode(200)
  roster(@Req() request: AutomationRequest, @Body() body: SyncRoster) {
    return this.db.asAutomation(request.claims, async client => ({
      updated: (await client.query('SELECT private.sync_roster($1::jsonb) AS updated', [JSON.stringify(body.members)])).rows[0].updated,
    }));
  }
}
