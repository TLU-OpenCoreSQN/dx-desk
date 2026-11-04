// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W5-08: gợi ý bài Wiki.js theo danh mục và ghi lượt "Đã tự xử lý được".
import {
  Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Req,
  UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { AuthRequest, JwtGuard } from './auth';
import { Database } from './database';

export class CreateSelfService {
  @IsUUID() category_id!: string;
  @IsUUID() article_id!: string;
}

/** Gốc URL Wiki.js mà trình duyệt mở; chỉ nhận http(s), bỏ dấu "/" cuối. */
export function wikiBaseUrl(value = process.env.WIKI_PUBLIC_URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** Ghép đường dẫn bài (đã ràng buộc bằng CHECK ở DB) với gốc Wiki.js; null khi chưa cấu hình. */
export function articleUrl(base: string | null, wikiPath: string): string | null {
  if (!base || !/^[a-z0-9][a-z0-9/-]{0,199}$/.test(wikiPath)) return null;
  return `${base}/${wikiPath}`;
}

type ArticleRow = { id: string; slug: string; title: string; summary: string; wiki_path: string };

export function presentArticles(rows: ArticleRow[], base = wikiBaseUrl()) {
  return rows.map(row => ({
    id: row.id, slug: row.slug, title: row.title, summary: row.summary, url: articleUrl(base, row.wiki_path),
  }));
}

@Controller('api')
@UseGuards(JwtGuard)
export class KnowledgeController {
  constructor(private readonly db: Database) {}

  @Get('categories/:id/articles')
  articles(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.db.asUser(request.claims, async client => {
      const category = await client.query('SELECT id FROM public.categories WHERE id=$1 AND active', [id]);
      if (!category.rowCount) throw new NotFoundException('Không tìm thấy danh mục.');
      const rows = (await client.query<ArticleRow>(
        `SELECT a.id,a.slug,a.title,a.summary,a.wiki_path FROM public.category_articles ca
         JOIN public.knowledge_articles a ON a.id=ca.article_id
         WHERE ca.category_id=$1 AND a.active ORDER BY ca.sort_order,a.slug`, [id],
      )).rows;
      return { data: presentArticles(rows) };
    });
  }

  @Post('self-service')
  @HttpCode(201)
  record(@Req() request: AuthRequest, @Body() body: CreateSelfService) {
    return this.db.asUser(request.claims, async client => {
      const suggested = await client.query(
        `SELECT 1 FROM public.category_articles ca JOIN public.knowledge_articles a ON a.id=ca.article_id
         JOIN public.categories c ON c.id=ca.category_id
         WHERE ca.category_id=$1 AND ca.article_id=$2 AND a.active AND c.active`,
        [body.category_id, body.article_id],
      );
      if (!suggested.rowCount) throw new UnprocessableEntityException('Bài viết không thuộc gợi ý của danh mục đã chọn.');
      return (await client.query(
        `INSERT INTO public.self_service_resolutions(category_id,article_id) VALUES ($1,$2)
         RETURNING id,category_id,article_id,created_at`, [body.category_id, body.article_id],
      )).rows[0];
    });
  }
}
