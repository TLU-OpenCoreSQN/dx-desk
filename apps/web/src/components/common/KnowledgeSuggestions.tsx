// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, ExternalLink, Home, PenLine } from 'lucide-react';
import { getCategoryArticles, recordSelfService } from '../../services/api';
import { KnowledgeArticle } from '../../types/api';
import { ErrorMessage } from './ErrorMessage';

/**
 * W5-08: gợi ý bài Wiki.js theo danh mục đang chọn. Ánh xạ danh mục -> bài đến từ API
 * (dữ liệu tham chiếu), không viết cứng ở giao diện. Nút "Đã tự xử lý được" ghi đúng
 * một lượt tự phục vụ và không tạo ticket.
 */
export interface KnowledgeSuggestionsProps {
  categoryId: string;
  /** Sau khi ghi nhận tự xử lý: người dùng chọn rời trang (trang cha xóa nháp và điều hướng). */
  onGoHome?: () => void;
}

export const KnowledgeSuggestions: React.FC<KnowledgeSuggestionsProps> = ({ categoryId, onGoHome }) => {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [recordedFor, setRecordedFor] = useState<string | null>(null);
  // Người dùng vẫn muốn gửi phiếu sau khi đã ghi nhận tự xử lý.
  const [continueTicket, setContinueTicket] = useState(false);
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null);
  const continueNoteRef = useRef<HTMLParagraphElement>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    setArticles([]);
    setRecordedFor(null);
    setContinueTicket(false);
    setError(null);
    if (!categoryId) return undefined;
    getCategoryArticles(categoryId)
      .then((response) => { if (active) setArticles(response.data || []); })
      // Gợi ý là phần phụ: lỗi tải không được chặn việc tạo phiếu.
      .catch(() => { if (active) setArticles([]); });
    return () => { active = false; };
  }, [categoryId]);

  // Nút vừa bấm biến mất sau mỗi bước: đưa focus tới nội dung mới để người dùng bàn phím
  // và trình đọc màn hình biết chuyện gì xảy ra (không dùng thêm role="status" để khỏi đọc hai lần).
  useEffect(() => {
    if (!recordedFor) return;
    (continueTicket ? continueNoteRef : confirmHeadingRef).current?.focus();
  }, [recordedFor, continueTicket]);

  if (articles.length === 0) return null;

  const markResolved = async (articleId: string) => {
    if (saving || recordedFor) return;
    setSaving(articleId);
    setError(null);
    try {
      await recordSelfService(categoryId, articleId);
      setRecordedFor(articleId);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section
      aria-labelledby="knowledge-suggestions-title"
      className="rounded-[6px] border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] p-4"
    >
      <h3 id="knowledge-suggestions-title" className="flex items-center gap-1.5 text-xs font-bold text-content">
        <BookOpen className="h-3.5 w-3.5 text-[var(--color-primary-ink)]" aria-hidden="true" />
        Thử tự xử lý trước khi gửi phiếu
      </h3>
      <p className="mt-1 text-[11px] text-content-muted">
        Các bài hướng dẫn dưới đây thường giải quyết được sự cố thuộc danh mục này.
      </p>
      {recordedFor && continueTicket ? (
        <p
          ref={continueNoteRef}
          tabIndex={-1}
          className="mt-3 flex items-start gap-1.5 text-xs text-content-muted focus:outline-none"
        >
          <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-primary-ink)]" aria-hidden="true" />
          Bạn có thể tiếp tục điền phiếu bên dưới.
        </p>
      ) : recordedFor ? (
        <div
          role="group"
          aria-labelledby="knowledge-self-service-confirm"
          className="mt-3 rounded-md border border-status-success-border bg-status-success-bg p-3.5"
        >
          <h4
            id="knowledge-self-service-confirm"
            ref={confirmHeadingRef}
            tabIndex={-1}
            className="flex items-start gap-1.5 text-xs font-bold text-status-success focus:outline-none"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Đã ghi nhận bạn tự xử lý được. Cảm ơn bạn!
          </h4>
          <p className="mt-1 pl-5.5 text-xs text-content">
            Sự cố đã được khắc phục thì bạn không cần gửi phiếu nữa.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 pl-5.5">
            {onGoHome && (
              <button
                type="button"
                onClick={onGoHome}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <Home className="h-3.5 w-3.5" aria-hidden="true" />
                Về trang chủ
              </button>
            )}
            <button
              type="button"
              onClick={() => setContinueTicket(true)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-edge bg-surface px-3.5 text-xs font-semibold text-content shadow-2xs transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
              Tôi vẫn cần gửi phiếu
            </button>
          </div>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {articles.map((article) => (
            <li key={article.id} className="rounded-[4px] border border-edge-subtle bg-surface p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {article.url ? (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary-ink)] underline-offset-2 hover:underline"
                    >
                      {article.title}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">(mở Wiki ở tab mới)</span>
                    </a>
                  ) : (
                    <span className="text-xs font-semibold text-content">{article.title}</span>
                  )}
                  {article.summary && <p className="mt-0.5 text-[11px] text-content-muted">{article.summary}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void markResolved(article.id)}
                  disabled={saving !== null}
                  className="inline-flex min-h-[36px] shrink-0 items-center rounded-[6px] border border-[var(--color-edge-subtle)] bg-surface px-3 text-[11px] font-semibold text-content transition-all hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-wait disabled:opacity-60"
                >
                  {saving === article.id ? 'Đang ghi nhận…' : 'Đã tự xử lý được'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error != null && <ErrorMessage error={error} title="Chưa ghi nhận được lượt tự xử lý" className="mt-3" />}
    </section>
  );
};
