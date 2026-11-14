// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { handoverCode, handoverFields, handoverKey, handoverUrl, renderHandover, validHandover } from '../dist/handover.js';
import { downloadSignature } from '../dist/downloads.js';

const id = '5a28d48d-0000-4000-8000-000000000001';
const data = { id, device_type: 'monitor', quantity: 2, department: 'phong-hanh-chinh',
  created_at: '2026-11-12T02:00:00Z', decided_at: '2026-11-12T03:00:00Z', handed_over_at: '2026-11-12T16:35:00Z',
  handover_key: null, requester_name: 'employee.a', approver_name: 'manager.1', handed_over_by_name: 'agent.1' };

test('handover lists the agreed fields in Vietnamese and Vietnam time, without the request reason', () => {
  assert.deepEqual(handoverFields(data), [
    ['Mã đề nghị', `DX-TB-5A28D48D (${id})`], ['Đơn vị', 'phong-hanh-chinh'], ['Người nhận', 'employee.a'],
    ['Loại thiết bị', 'Màn hình'], ['Số lượng', '2'], ['Người duyệt', 'manager.1'],
    ['Thời điểm duyệt', '10:00 12/11/26 (giờ Việt Nam)'], ['Người bàn giao', 'agent.1'],
    ['Thời điểm bàn giao', '23:35 12/11/26 (giờ Việt Nam)'],
  ]);
  // Dữ liệu cũ thiếu tên hoặc thời điểm vẫn ra biên bản, ghi rõ là không có thông tin.
  const legacy = Object.fromEntries(handoverFields({ ...data, approver_name: null, decided_at: null, device_type: 'tablet' }));
  assert.equal(legacy['Người duyệt'], 'Không có thông tin');
  assert.equal(legacy['Thời điểm duyệt'], 'Không có thông tin');
  assert.equal(legacy['Loại thiết bị'], 'tablet');
  assert.equal(handoverKey(id), `device-handover/${id}.pdf`);
  assert.equal(handoverCode(id), 'DX-TB-5A28D48D');
});

test('PDF is a one-page A4 with embedded TrueType fonts and is reproducible for the same data', async () => {
  const pdf = await renderHandover(data);
  const text = pdf.toString('latin1');
  assert.equal(text.slice(0, 5), '%PDF-');
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.ok(pdf.length > 5_000 && pdf.length < 200_000, `unexpected size ${pdf.length}`);
  assert.equal((text.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  // Phông được nhúng (tập con) nên máy không cài Noto Sans vẫn hiển thị đúng dấu tiếng Việt.
  assert.equal((text.match(/\/FontFile2 /g) ?? []).length, 2);
  assert.match(text, /\+NotoSans-Regular/);
  assert.match(text, /\+NotoSans-Bold/);
  assert.match(text, /\/ToUnicode /);
  // Phông tập con có glyph cho chữ có dấu: tìm bảng ToUnicode chứa mã U+1EC1 (ề) của "đề nghị".
  const streams = [...text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => {
    try { return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); } catch { return ''; }
  });
  assert.ok(streams.some(stream => stream.includes('beginbfrange') && /1ec1/i.test(stream)), 'ToUnicode covers Vietnamese letters');
  assert.deepEqual(await renderHandover(data), pdf, 'Same data gives the same bytes');
  assert.notDeepEqual(await renderHandover({ ...data, quantity: 3 }), pdf);
});

test('signed handover links expire, are bound to one request and are not interchangeable with attachment links', () => {
  process.env.ATTACHMENT_SIGNING_KEY = 'unit-only-signing-secret-with-at-least-32-bytes';
  const now = Date.UTC(2026, 10, 12, 10, 0, 0);
  const link = new URL(handoverUrl(id, now).url, 'http://localhost');
  const expires = link.searchParams.get('expires');
  const signature = link.searchParams.get('signature');
  assert.equal(link.pathname, `/api/device-handovers/${id}/content`);
  assert.equal(Number(expires) - now / 1000, 120);
  assert.equal(validHandover(id, expires, signature, now), true);
  assert.equal(validHandover(id, expires, signature, now + 119_000), true);
  assert.equal(validHandover(id, expires, signature, now + 120_000), false, 'expired');
  assert.equal(validHandover('5a28d48d-0000-4000-8000-000000000002', expires, signature, now), false, 'other request');
  assert.equal(validHandover(id, String(Number(expires) + 1), signature, now), false, 'tampered expiry');
  assert.equal(validHandover(id, expires, downloadSignature(id, expires), now), false, 'attachment signature');
  assert.equal(validHandover(id, expires, 'zz', now), false);
  assert.equal(validHandover(id, undefined, undefined, now), false);
  process.env.ATTACHMENT_SIGNING_KEY = 'short';
  assert.throws(() => handoverUrl(id, now), /at least 32 bytes/);
  delete process.env.ATTACHMENT_SIGNING_KEY;
});
