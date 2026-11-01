// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain'];
export function fileError(file: File): string | null {
  if (!ATTACHMENT_TYPES.includes(file.type)) return 'Chỉ nhận PNG, JPEG, PDF hoặc TXT.';
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
