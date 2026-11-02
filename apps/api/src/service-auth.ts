// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import type { Request } from 'express';
import { authConfig } from './config';

export interface AutomationClaims extends JWTPayload {
  sub: string;
  role: 'ticket_automation';
  azp: 'dxdesk-automation';
  realm_access: { roles: string[] };
}
export type AutomationRequest = Request & { claims: AutomationClaims };

export function validateAutomationClaims(payload: JWTPayload): AutomationClaims {
  const roles = (payload.realm_access as { roles?: unknown } | undefined)?.roles;
  if (typeof payload.sub !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)
    || payload.role !== 'ticket_automation' || payload.azp !== 'dxdesk-automation'
    || !Array.isArray(roles) || !roles.every(role => typeof role === 'string')
    || !roles.includes('ticket-automation') || roles.some(role => ['Employee', 'Agent', 'Manager'].includes(role))) {
    throw new ForbiddenException('Danh tính dịch vụ không có quyền tự động hóa.');
  }
  return payload as AutomationClaims;
}

@Injectable()
export class AutomationGuard implements CanActivate {
  private readonly config = authConfig();
  private readonly keys = createRemoteJWKSet(new URL(this.config.jwksUrl), { timeoutDuration: 5000, cooldownDuration: 30000 });
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AutomationRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Cần danh tính dịch vụ để truy cập.');
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(match[1], this.keys, {
        issuer: this.config.issuer, audience: this.config.audience,
        algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub'],
      }));
    } catch { throw new UnauthorizedException('Token dịch vụ không hợp lệ hoặc đã hết hạn.'); }
    request.claims = validateAutomationClaims(payload);
    return true;
  }
}
