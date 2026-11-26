// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileImage, FileText, Paperclip, RefreshCw, Upload, X } from 'lucide-react';
import { Attachment } from '../../types/api';
import { getAttachments, getAttachmentDownload, uploadAttachment } from '../../services/api';
import { ATTACHMENT_TYPES, fileError, formatFileSize, startDownload } from '../../lib/attachments';
import { Button } from './Button';
import { ErrorMessage } from './ErrorMessage';

const SCAN_STATUS: Record<Attachment['scan_status'], { label: string; className: string }> = {
  pending: { label: 'Đang quét', className: 'text-status-warning' },
  clean: { label: 'An toàn', className: 'text-status-success' },
  infected: { label: 'Bị chặn: mã độc', className: 'text-status-danger' },
  failed: { label: 'Tải lên thất bại', className: 'text-[var(--color-content-muted)]' },
};

const FileIcon: React.FC<{ type: string }> = ({ type }) => {
  const Icon = type.startsWith('image/') ? FileImage : FileText;
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-edge-subtle)] bg-[var(--color-surface-sidebar)] text-[var(--color-content-muted)]"
      aria-hidden="true"
    >
      <Icon className="h-4 w-4" />
    </span>
  );
};

export const AttachmentPanel: React.FC<{ ticketId: string }> = ({ ticketId }) => {
  const [items, setItems] = useState<Attachment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRevision = useRef(0);

  const reload = useCallback(async () => {
    const revision = ++requestRevision.current;
    setError(null);
    setIsRefreshing(true);
    try {
      const res = await getAttachments(ticketId);
      if (revision !== requestRevision.current) return;
      setItems(res.data ?? []);
    } catch (err) {
      if (revision !== requestRevision.current) return;
      setError(err);
    } finally {
      if (revision === requestRevision.current) {
        setIsRefreshing(false);
        setIsLoaded(true);
      }
    }
  }, [ticketId]);

  useEffect(() => {
    void reload();
    return () => {
      requestRevision.current += 1;
    };
  }, [reload]);

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const pickFile = (chosen: File | null) => {
    const issue = chosen ? fileError(chosen) : null;
    setError(issue ? new Error(issue) : null);
    setFile(issue ? null : chosen);
  };

  const upload = async () => {
    if (!file || isUploading) return;
    setIsUploading(true);
    setError(null);
    try {
      await uploadAttachment(ticketId, file);
      setAnnouncement(`Đã tải lên ${file.name}.`);
      clearFile();
      await reload();
    } catch (err) {
      setError(err);
    } finally {
      setIsUploading(false);
    }
  };

  /** Một bước: xin liên kết đã ký (hạn 2 phút, ADR 0009) rồi tải ngay, không bắt người dùng bấm lần hai. */
  const download = async (item: Attachment) => {
    if (downloadingId) return;
    setDownloadingId(item.id);
    setError(null);
    try {
      const { url } = await getAttachmentDownload(item.id);
      startDownload(url, item.file_name);
      setAnnouncement(`Đang tải xuống ${item.file_name}.`);
    } catch (err) {
      setError(err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section
      aria-labelledby="attachments-title"
      className="overflow-hidden rounded-[8px] border border-[var(--color-edge-subtle)] bg-surface shadow-2xs"
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-edge-subtle)] py-1.5 pl-5 pr-2">
        <Paperclip className="h-4 w-4 shrink-0 text-[var(--color-primary-ink)]" aria-hidden="true" />
        <h2 id="attachments-title" className="text-sm font-bold tracking-tight text-[var(--color-content)]">
          Tệp đính kèm
          {items.length > 0 && (
            <span className="ml-1.5 font-normal text-[var(--color-content-muted)]">({items.length})</span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void reload()}
          disabled={isRefreshing || isUploading}
          aria-label="Làm mới danh sách tệp"
          title="Làm mới danh sách tệp"
          className="ml-auto min-w-11"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {error != null && <ErrorMessage error={error} title="Không xử lý được tệp" />}

        {items.length > 0 ? (
          <ul className="divide-y divide-[var(--color-edge-subtle)]">
            {items.map((item) => {
              const status = SCAN_STATUS[item.scan_status];
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <FileIcon type={item.content_type} />
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-medium text-[var(--color-content)]">{item.file_name}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-content-muted)]">
                      {formatFileSize(Number(item.size_bytes))}
                      {' · '}
                      <span className={`font-semibold ${status.className}`}>{status.label}</span>
                    </p>
                  </div>
                  {item.scan_status === 'clean' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void download(item)}
                      isLoading={downloadingId === item.id}
                      disabled={downloadingId !== null}
                      leftIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
                      aria-label={`Tải xuống ${item.file_name}`}
                      className="shrink-0"
                    >
                      Tải xuống
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          isLoaded && error == null && (
            <p className="text-sm text-[var(--color-content-muted)]">Chưa có tệp đính kèm.</p>
          )
        )}

        <div className="space-y-2">
          <label
            htmlFor="attachment-upload"
            onDragOver={(event) => {
              // Luôn chặn mặc định: nếu không, thả tệp lúc đang tải lên sẽ khiến trình duyệt mở tệp và rời trang.
              event.preventDefault();
              if (isUploading) {
                event.dataTransfer.dropEffect = 'none';
                return;
              }
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) return;
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const dropped = event.dataTransfer.files?.[0];
              if (isUploading || !dropped) return;
              if (inputRef.current) inputRef.current.value = '';
              pickFile(dropped);
            }}
            className={`group flex items-center gap-3 rounded-lg border-2 border-dashed p-3.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-surface ${
              isUploading
                ? 'cursor-not-allowed border-edge bg-surface-muted opacity-60'
                : isDragging
                  ? 'cursor-copy border-primary bg-primary-tint'
                  : 'cursor-pointer border-edge bg-surface-muted hover:border-primary hover:bg-primary-tint'
            }`}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-edge bg-surface text-content-muted transition-colors group-hover:border-primary-border group-hover:text-[var(--color-primary-ink)]"
              aria-hidden="true"
            >
              <Upload className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-content">Bổ sung tệp</span>
              <span className="mt-0.5 block text-content-muted">
                {file ? (
                  <>
                    Đã chọn: <strong className="break-all text-content">{file.name}</strong>
                  </>
                ) : (
                  'Bấm để chọn tệp hoặc kéo thả vào đây.'
                )}
              </span>
              <span className="mt-0.5 block text-content-muted">
                PNG, JPEG, GIF, WebP, PDF, TXT; tối đa 10 MiB. Tệp được quét mã độc trước khi lưu.
              </span>
            </span>
            <input
              ref={inputRef}
              id="attachment-upload"
              type="file"
              className="sr-only"
              accept={ATTACHMENT_TYPES.join(',')}
              disabled={isUploading}
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />
          </label>

          {file && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                disabled={isUploading}
                leftIcon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Bỏ tệp đã chọn
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void upload()}
                isLoading={isUploading}
                leftIcon={<Upload className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                {isUploading ? 'Đang quét và tải lên…' : 'Tải tệp lên phiếu này'}
              </Button>
            </div>
          )}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </section>
  );
};
