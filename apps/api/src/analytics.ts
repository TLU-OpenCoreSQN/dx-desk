// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Controller, ForbiddenException, Get, Header, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { SignJWT } from 'jose';
import { JwtGuard, type AuthRequest } from './auth';

@Controller('api/analytics')
@UseGuards(JwtGuard)
export class AnalyticsController {
  @Get('embed')
  @Header('Cache-Control', 'no-store')
  async embed(@Req() request: AuthRequest) {
    if (!request.claims.realm_access.roles.includes('Manager')) {
      throw new ForbiddenException('Chỉ quản lý được xem báo cáo.');
    }
    const dashboard = Number(process.env.METABASE_DASHBOARD_ID);
    const secret = process.env.METABASE_EMBED_SECRET ?? '';
    const base = URL.parse(process.env.METABASE_PUBLIC_URL ?? '');
    const loopback = base && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if (!(process.env.METABASE_PROFILES ?? '').split(',').some(profile => profile.trim() === 'full') ||
        !base || (base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) ||
        base.username || base.password || base.search || base.hash ||
        !Number.isSafeInteger(dashboard) || dashboard < 1 || !/^[a-f0-9]{64}$/i.test(secret)) {
      throw new ServiceUnavailableException('Báo cáo Metabase chưa sẵn sàng. Cần chạy hồ sơ full và hoàn tất cài đặt.');
    }
    const token = await new SignJWT({ resource: { dashboard }, params: {} })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m')
      .sign(new TextEncoder().encode(secret));
    const prefix = base.href.replace(/\/+$/, '');
    return { url: `${prefix}/embed/dashboard/${token}#titled=true` };
  }
}
