// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import 'reflect-metadata';
import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, Module, ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Response } from 'express';
import { JwtGuard } from './auth';
import { Database } from './database';
import { DeskController, HealthController, workflowExceptionForCode } from './controllers';

@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    const code = (error as { code?: string })?.code;
    // W3-01: trigger guard máy trạng thái raise SQLSTATE 4500x -> thông báo cố định
    // tiếng Việt, không bao giờ chuyển raw message/SQL từ PostgreSQL ra client.
    const workflow = workflowExceptionForCode(code);
    if (workflow) {
      response.status(workflow.status).json({ statusCode: workflow.status, message: workflow.message });
    } else if (code === '42501') {
      response.status(403).json({ statusCode: 403, message: 'Bạn không có quyền thực hiện thao tác này.' });
    } else if (['23503', '23514', '22P02', '23502'].includes(code ?? '')) {
      response.status(400).json({ statusCode: 400, message: 'Dữ liệu không hợp lệ. Kiểm tra danh mục và các trường bắt buộc.' });
    } else if (code === '23505') {
      response.status(409).json({ statusCode: 409, message: 'Dữ liệu đã tồn tại.' });
    } else {
      console.error('Request failed', { code: code ?? 'internal' });
      response.status(500).json({ statusCode: 500, message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' });
    }
  }
}

@Module({
  controllers: [HealthController, DeskController],
  providers: [Database, JwtGuard],
})
export class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true,
  }));
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  // All browser requests use same-origin APISIX. No wildcard CORS.
  return app;
}
