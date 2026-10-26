// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Ghi một đối tượng nhị phân lên SeaweedFS filer (HTTP PUT) — ADR 0007 bước 3.
// Chỉ dùng global fetch của Node (không thêm dependency). Filer endpoint lấy từ
// biến môi trường SEAWEEDFS_ENDPOINT, đọc theo đúng kiểu required() như DATABASE_URL.
//
// Thứ tự chống orphan (theo ADR): QUÉT TRƯỚC -> SẠCH MỚI LƯU -> MỚI INSERT.
// Vì vậy hàm này KHÔNG cần nghiệp vụ xoá/bãi bỏ: một tệp chỉ được PUT sau khi clamd
// báo sạch, nên không bao giờ có object "nhiễm" nằm chờ trong SeaweedFS.

import { required } from './config';

/** Bỏ slash cuối để nối key an toàn; gọi mỗi lần để test trỏ endpoint giả bằng env. */
export function seaweedfsEndpoint(): string {
  return required('SEAWEEDFS_ENDPOINT').replace(/\/+$/, '');
}

/**
 * PUT đối tượng `body` tại `objectKey` (do server sinh — KHÔNG chứa tên tệp do client gửi lên).
 * Trả về chính objectKey khi filer báo thành công; ném Error khi HTTP != 2xx (controller map 503).
 */
export async function putObject(
  objectKey: string,
  contentType: string,
  body: Buffer,
  timeoutMs = 15000,
  endpoint = seaweedfsEndpoint(),
): Promise<string> {
  const url = `${endpoint}/${objectKey.replace(/^\/+/, '')}`;
  // fetch yêu cầu BodyInit; Uint8Array là định dạng an toàn cho nhị phân (Buffer chỉ là
  // một Uint8Array nhưng kiểu DOM không nhận trực tiếp).
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`SeaweedFS upload failed: ${response.status}`);
  return objectKey;
}
