// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// clamd TCP client (dependency-free, node:net) cho luồng quét INSTREAM của ADR 0007.
//
// Giao thức lấy từ tài liệu ClamAV chính thức:
//   https://docs.clamav.net/manual/Usage/ClamdProtocol.html
// Điểm chốt về cách đóng khung (xác minh bằng docs, ngày viết mã):
//   * Lệnh stream phải dùng khung "n" hoặc "z"; ở đây dùng khung "n" ("nINSTREAM\n"),
//     vì docs ghi: dấu chấm hết của REPLY là newline cho lệnh "n" và NUL cho lệnh "z".
//   * MỖI chunk: 4 byte độ dài không dấu, big-endian (network byte order), rồi tới đúng
//     số byte dữ liệu; kết thúc luồng bằng chunk độ dài 0 ("00 00 00 00").
//   * clamd trả "stream: OK" khi sạch, "stream: <TênVirus> FOUND" khi nhiễm,
//     và "INSTREAM size limit exceeded. ERROR" khi vượt StreamMaxLength phía daemon.
//   * Lưu ý: bản docs HIỆN HÀNH không khai báo lệnh "ZINSTREAM"; tên đúng là "INSTREAM"
//     với tiền tố khung n/z. Task ghi "nZINSTREAM" — ta bám theo docs (nINSTREAM) và
//     ghi rõ độ lệch ở đây để không tự bịa giao thức.

/** Kết quả phân loại một lượt quét; 'error' luôn là fail-closed (không bao giờ coi là sạch). */
export type ScanResult =
  | { outcome: 'clean' }
  | { outcome: 'infected'; virus: string }
  | { outcome: 'error'; code: ClamdErrorCode };

export type ClamdErrorCode = 'oversize' | 'unreachable' | 'timeout' | 'malformed_reply';

export interface ClamdOptions {
  /** Trần số byte được stream — dựng TRƯỚC khi mở socket (khớp CHECK attachments.size_bytes). */
  maxBytes: number;
  /** Thời gian chờ tối đa cho cả nối + trả lời; quá -> outcome 'error'/'timeout'. */
  timeoutMs: number;
  /** Kích thước mỗi chunk khi bơm vào clamd. */
  chunkSize: number;
}

export const CLAMD_DEFAULTS: ClamdOptions = {
  maxBytes: 10485760, // 10 MiB
  timeoutMs: 5000,
  chunkSize: 32768,
};

/** Tách "host:port" (IPv4/host-name, không hỗ trợ IPv6-literal) thành cặp host/port. */
export function parseClamdAddr(addr: string): { host: string; port: number } {
  const index = addr.lastIndexOf(':');
  if (index <= 0) throw new Error('CLAMD_ADDR must be host:port');
  const host = addr.slice(0, index);
  const port = Number(addr.slice(index + 1));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('CLAMD_ADDR port is invalid');
  return { host, port };
}

/**
 * Phân tích một dòng trả lời clamd thành ScanResult; null khi chưa đủ dữ liệu để kết luận.
 * Bảo thủ: chỉ 'clean' khi dòng kết thúc bằng OK; '<...> FOUND' -> infected kèm tên virus;
 * mọi thứ khác (ERROR, size limit, dữ liệu bất ngờ) -> null (gọi map sang 'error' fail-closed).
 */
export function parseClamdReply(raw: string): ScanResult | null {
  const text = raw.replace(/\0/g, '').trim();
  if (!text) return null;
  if (/(?:^|:)\s*OK$/.test(text)) return { outcome: 'clean' };
  const found = /^(?:.*:\s*)?(.+?)\s+FOUND$/.exec(text);
  if (found) return { outcome: 'infected', virus: found[1].trim() };
  if (/ERROR$/.test(text)) return { outcome: 'error', code: 'malformed_reply' };
  return { outcome: 'error', code: 'malformed_reply' };
}

/**
 * Quét `data` bằng clamd trên `addr` qua INSTREAM. Không ghi nội dung tệp ra log.
 * Trả về discriminated union; 'error' bao gồm oversize (không mở socket), unreachable,
 * timeout và malformed_reply — controller map tất cả sang 503 + scan_status='failed'.
 */
export async function scanWithClamd(
  addr: string,
  data: Buffer,
  options: Partial<ClamdOptions> = {},
): Promise<ScanResult> {
  const { maxBytes, timeoutMs, chunkSize } = { ...CLAMD_DEFAULTS, ...options };
  // Cắt trần TRƯỚC khi kết nối: không cấp phát thêm, không giao workload quá cỡ cho clamd.
  if (data.length === 0 || data.length > maxBytes) return { outcome: 'error', code: 'oversize' };

  let target: { host: string; port: number };
  try {
    target = parseClamdAddr(addr);
  } catch {
    return { outcome: 'error', code: 'unreachable' };
  }

  // Import lười để module unit-test được mà không kéo net vào môi trường lạ.
  const net = await import('node:net');
  return new Promise<ScanResult>(resolve => {
    const socket = net.connect({ host: target.host, port: target.port });
    let settled = false;
    let reply = Buffer.alloc(0);
    let timer: NodeJS.Timeout | undefined;
    const finish = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    timer = setTimeout(() => finish({ outcome: 'error', code: 'timeout' }), timeoutMs);

    const consume = (final: boolean) => {
      // Chấp nhận cả newline (khung n) lẫn NUL để an toàn trước khác biệt build clamd.
      const newline = reply.indexOf(0x0a);
      const nul = reply.indexOf(0x00);
      const end = newline === -1 ? nul : nul === -1 ? newline : Math.min(newline, nul);
      if (end !== -1) {
        finish(parseClamdReply(reply.subarray(0, end).toString('utf8')) ?? { outcome: 'error', code: 'malformed_reply' });
      } else if (final) {
        const parsed = parseClamdReply(reply.toString('utf8'));
        finish(parsed ?? { outcome: 'error', code: 'unreachable' });
      }
    };

    socket.once('error', () => finish({ outcome: 'error', code: 'unreachable' }));
    socket.once('close', () => consume(true));
    socket.on('data', chunk => { reply = Buffer.concat([reply, chunk]); consume(false); });
    socket.once('connect', () => {
      socket.write('nINSTREAM\n', 'ascii');
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.subarray(offset, Math.min(offset + chunkSize, data.length));
        const header = Buffer.allocUnsafe(4);
        header.writeUInt32BE(chunk.length, 0);
        socket.write(Buffer.concat([header, chunk]));
      }
      socket.write(Buffer.alloc(4)); // chunk độ dài 0: báo hết luồng.
    });
  });
}
