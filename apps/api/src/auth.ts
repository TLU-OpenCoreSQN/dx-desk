// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import type { Request } from 'express';
import { authConfig } from './config';

export interface UserClaims extends JWTPayload {
  sub: string;
  role: 'authenticated';
  preferred_username?: string;
  realm_access: { roles: string[] };
}
export type AuthRequest = Request & { claims: UserClaims };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateClaims(payload: JWTPayload): UserClaims {
  const roles = (payload.realm_access as { roles?: unknown } | undefined)?.roles;
  if (!payload.sub || !UUID.test(payload.sub) || payload.role !== 'authenticated'
      || !Array.isArray(roles) || !roles.every(r => typeof r === 'string')
      || !roles.some(r => ['Employee', 'Agent', 'Manager'].includes(r))) {
    throw new UnauthorizedException('Token không có định danh hoặc vai trò hợp lệ.');
  }
  return payload as UserClaims;
}

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly config = authConfig();
  private readonly keys = createRemoteJWKSet(new URL(this.config.jwksUrl), {
    timeoutDuration: 5000, cooldownDuration: 30000,
  });
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Cần đăng nhập để truy cập.');
    try {
      const { payload } = await jwtVerify(match[1], this.keys, {
        issuer: this.config.issuer, audience: this.config.audience,
        algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub'],
      });
      request.claims = validateClaims(payload);
      return true;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }
  }
}
