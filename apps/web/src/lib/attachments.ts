// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
export function fileError(file: File): string | null {
  if (!ATTACHMENT_TYPES.includes(file.type)) return 'Chỉ nhận PNG, JPEG, GIF, WebP, PDF hoặc TXT.';
  if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) return 'Tệp phải lớn hơn 0 và không quá 10 MiB.';
  return null;
}
export async function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được tệp đã chọn.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}

/** Dung lượng dễ đọc theo kiểu Việt Nam: 512 B, 12,3 KB, 4,5 MB. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${units[unit]}`;
}

/**
 * Bắt đầu tải một liên kết đã ký. Máy chủ trả Content-Disposition: attachment nên trang hiện tại
 * không bị điều hướng đi; thuộc tính download chỉ là gợi ý tên tệp cho trình duyệt.
 */
export function startDownload(url: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
