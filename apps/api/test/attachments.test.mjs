// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// W3-06 unit tests: client clamd INSTREAM (node:net giả), SeaweedFS PUT (node:http giả),
// bộ điều khiển AttachmentsController (Database giả) và DTO chặn thân request độc hại.
// KHÔNG chạm ClamAV thật — engine thật được kiểm chứng bằng EICAR ở bước chờ Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { ValidationPipe } from '@nestjs/common';
import { parseClamdAddr, parseClamdReply, scanWithClamd } from '../dist/clamd.js';
import { putObject } from '../dist/seaweedfs.js';
import { AttachmentsController } from '../dist/controllers.js';
import { UploadAttachment } from '../dist/dto.js';

const PAYLOAD = Buffer.from('DX-DESK attachment payload: 0123456789', 'utf8');

/** clamd giả: nghe, parse khung INSTREAM, ghi lại ĐÚNG byte đã nhận, trả lời theo mode. */
async function startFakeClamd(mode) {
  const state = { connections: 0, received: Buffer.alloc(0), command: '', replies: 0 };
  const server = net.createServer(socket => {
    state.connections += 1;
    let buffer = Buffer.alloc(0);
    let done = false;
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (done) return;
      const newline = buffer.indexOf(0x0a);
      if (newline === -1) return;
      let position = newline + 1;
      const body = [];
      for (;;) {
        if (position + 4 > buffer.length) return; // chờ thêm byte cho header độ dài
        const length = buffer.readUInt32BE(position);
        position += 4;
        if (length === 0) { done = true; break; }
        if (position + length > buffer.length) return; // chờ đủ dữ liệu chunk
        body.push(buffer.subarray(position, position + length));
        position += length;
      }
      state.command = buffer.subarray(0, newline).toString('utf8');
      state.received = Buffer.concat(body);
      state.replies += 1;
      // mode 'silent' mô phỏng clamd treo: nối được nhưng không bao giờ trả lời -> timeout.
      if (mode === 'clean') socket.write('stream: OK\n');
      else if (mode === 'infected') socket.write('stream: Eicar-Signature FOUND\n');
      else if (mode === 'malformed') socket.write('stream: nonsense\n');
    });
    socket.on('error', () => {});
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { addr: `127.0.0.1:${server.address().port}`, state, stop: () => new Promise(r => server.close(r)) };
}

/** SeaweedFS filer giả: ghi nhận mọi PUT (path, content-type, body) và trả 200. */
async function startFakeSeaweed() {
  const puts = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on('data', c => chunks.push(c));
    request.on('end', () => {
      puts.push({
        method: request.method, url: request.url,
        contentType: request.headers['content-type'], body: Buffer.concat(chunks),
      });
      response.statusCode = 200;
      response.end('OK');
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { endpoint: `http://127.0.0.1:${server.address().port}`, puts, stop: () => new Promise(r => server.close(r)) };
}

/** Database giả: asUser chạy callback với client giả ghi lại mọi câu query. */
function fakeDatabase({ ticketVisible = true } = {}) {
  const calls = [];
  const client = {
    query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('FROM public.tickets')) {
        return Promise.resolve(ticketVisible
          ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 });
      }
      if (sql.includes('private.record_attachment')) {
        const [ticketId, fileName, objectKey, contentType, size, scanStatus] = params;
        return Promise.resolve({
          rows: [{
            id: '11111111-1111-4111-8111-111111111111', ticket_id: ticketId,
            uploaded_by: '20000000-0000-4000-8000-000000000001', file_name: fileName,
            object_key: objectKey, content_type: contentType, size_bytes: size,
            scan_status: scanStatus, created_at: '2026-10-27T00:00:00.000Z',
          }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    },
  };
  return {
    calls,
    asUser: async (_claims, operation) => operation(client),
    pool: { query: async () => ({ rows: [] }) },
  };
}

const claims = {
  sub: '20000000-0000-4000-8000-000000000001', role: 'authenticated',
  realm_access: { roles: ['Employee'] },
};
const request = { claims };
const body = fileName => ({
  file_name: fileName, content_type: 'text/plain', content_base64: PAYLOAD.toString('base64'),
});

// ---- parseClamdAddr / parseClamdReply -----------------------------------------------------

test('parseClamdAddr tách host:port, từ chối chuỗi hỏng', () => {
  assert.deepEqual(parseClamdAddr('clamav:3310'), { host: 'clamav', port: 3310 });
  assert.deepEqual(parseClamdAddr('127.0.0.1:3310'), { host: '127.0.0.1', port: 3310 });
  assert.throws(() => parseClamdAddr('no-colon'));
  assert.throws(() => parseClamdAddr('host:0'));
  assert.throws(() => parseClamdAddr('host:99999'));
});

test('parseClamdReply phân loại OK/FOUND/lỗi, fail-closed với dữ liệu lạ', () => {
  assert.deepEqual(parseClamdReply('stream: OK'), { outcome: 'clean' });
  assert.deepEqual(parseClamdReply('stream: Eicar-Signature FOUND'),
    { outcome: 'infected', virus: 'Eicar-Signature' });
  assert.equal(parseClamdReply('INSTREAM size limit exceeded. ERROR').outcome, 'error');
  assert.equal(parseClamdReply('nonsense').outcome, 'error'); // không bao giờ coi là sạch
  assert.equal(parseClamdReply(''), null);
});

// ---- scanWithClamd qua clamd giả ---------------------------------------------------------

test('scanWithClamd clean: đúng khung lệnh + ĐÚNG byte stream tới clamd', async () => {
  const clamd = await startFakeClamd('clean');
  try {
    const result = await scanWithClamd(clamd.addr, PAYLOAD, { timeoutMs: 2000 });
    assert.deepEqual(result, { outcome: 'clean' });
    assert.equal(clamd.state.connections, 1);
    assert.equal(clamd.state.command, 'nINSTREAM'); // tiền tố n = reply phân cách newline
    assert.ok(clamd.state.received.equals(PAYLOAD), 'byte tới clamd phải đúng bằng nội dung upload');
  } finally { await clamd.stop(); }
});

test('scanWithClamd infected: trả về tên virus và cũng stream đủ byte', async () => {
  const clamd = await startFakeClamd('infected');
  try {
    const result = await scanWithClamd(clamd.addr, PAYLOAD, { timeoutMs: 2000 });
    assert.deepEqual(result, { outcome: 'infected', virus: 'Eicar-Signature' });
    assert.ok(clamd.state.received.equals(PAYLOAD));
  } finally { await clamd.stop(); }
});

test('scanWithClamd oversize trả error mà KHÔNG mở socket', async () => {
  const clamd = await startFakeClamd('clean');
  try {
    const result = await scanWithClamd(clamd.addr, PAYLOAD, { maxBytes: 8, timeoutMs: 2000 });
    assert.deepEqual(result, { outcome: 'error', code: 'oversize' });
    assert.equal(clamd.state.connections, 0, 'phải chặn trước khi kết nối clamd');
  } finally { await clamd.stop(); }
});

test('scanWithClamd timeout khi clamd im lặng', async () => {
  const clamd = await startFakeClamd('silent');
  try {
    const result = await scanWithClamd(clamd.addr, PAYLOAD, { timeoutMs: 80 });
    assert.deepEqual(result, { outcome: 'error', code: 'timeout' });
  } finally { await clamd.stop(); }
});

test('scanWithClamd unreachable khi không có ai nghe (cổng đóng)', async () => {
  const clamd = await startFakeClamd('clean');
  const addr = clamd.addr;
  await clamd.stop();
  const result = await scanWithClamd(addr, PAYLOAD, { timeoutMs: 500 });
  assert.equal(result.outcome, 'error');
  assert.ok(['unreachable', 'timeout'].includes(result.code));
});

// ---- putObject qua SeaweedFS giả ---------------------------------------------------------

test('putObject gửi đúng path, content-type và thân nhị phân', async () => {
  const swfs = await startFakeSeaweed();
  try {
    process.env.SEAWEEDFS_ENDPOINT = swfs.endpoint;
    const returned = await putObject('attachments/t-1/uuid-x', 'text/plain', PAYLOAD);
    assert.equal(returned, 'attachments/t-1/uuid-x');
    assert.equal(swfs.puts.length, 1);
    assert.equal(swfs.puts[0].method, 'PUT');
    assert.equal(swfs.puts[0].url, '/attachments/t-1/uuid-x');
    assert.equal(swfs.puts[0].contentType, 'text/plain');
    assert.ok(swfs.puts[0].body.equals(PAYLOAD));
  } finally { await swfs.stop(); delete process.env.SEAWEEDFS_ENDPOINT; }
});

test('putObject ném Error khi filer trả mã lỗi', async () => {
  const failing = createServer((_req, res) => { res.statusCode = 500; res.end('boom'); });
  failing.listen(0, '127.0.0.1');
  await once(failing, 'listening');
  try {
    await assert.rejects(
      putObject('k', 'text/plain', PAYLOAD, 5000, `http://127.0.0.1:${failing.address().port}`),
    );
  } finally { await new Promise(r => failing.close(r)); }
});

// ---- AttachmentsController: ánh xạ kết quả quét -> HTTP + thứ tự an toàn ------------------

async function withServices(mode, run) {
  const clamd = await startFakeClamd(mode);
  const swfs = await startFakeSeaweed();
  const prev = { clamd: process.env.CLAMD_ADDR, swfs: process.env.SEAWEEDFS_ENDPOINT, max: process.env.ATTACHMENT_MAX_BYTES, to: process.env.CLAMD_TIMEOUT_MS };
  process.env.CLAMD_ADDR = clamd.addr;
  process.env.SEAWEEDFS_ENDPOINT = swfs.endpoint;
  process.env.ATTACHMENT_MAX_BYTES = String(10485760);
  process.env.CLAMD_TIMEOUT_MS = '2000';
  try { return await run({ clamd, swfs }); }
  finally {
    await clamd.stop(); await swfs.stop();
    const restore = (k, v) => (v === undefined ? delete process.env[k] : (process.env[k] = v));
    restore('CLAMD_ADDR', prev.clamd); restore('SEAWEEDFS_ENDPOINT', prev.swfs);
    restore('ATTACHMENT_MAX_BYTES', prev.max); restore('CLAMD_TIMEOUT_MS', prev.to);
  }
}

test('controller clean: quét -> PUT SeaweedFS -> 201 kèm hình dạng bản ghi metadata', async () => {
  await withServices('clean', async ({ clamd, swfs }) => {
    const db = fakeDatabase();
    const controller = new AttachmentsController(db);
    const row = await controller.uploadAttachment(request, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body('note.txt'));
    assert.equal(clamd.state.connections, 1);
    assert.ok(clamd.state.received.equals(PAYLOAD));
    assert.equal(swfs.puts.length, 1);
    assert.ok(swfs.puts[0].body.equals(PAYLOAD));
    // object key do server sinh, không chứa tên tệp của client.
    assert.match(swfs.puts[0].url, /^\/attachments\/.+\/[0-9a-f-]{36}$/);
    assert.doesNotMatch(row.object_key, /note\.txt/);
    assert.equal(row.scan_status, 'clean');
    assert.equal(row.size_bytes, PAYLOAD.length);
    assert.equal(row.file_name, 'note.txt');
    assert.equal(row.content_type, 'text/plain');
    assert.ok(row.id && row.ticket_id && row.created_at);
  });
});

test('controller infected: KHÔNG gọi SeaweedFS, ghi metadata infected, trả 422', async () => {
  await withServices('infected', async ({ clamd, swfs }) => {
    const db = fakeDatabase();
    const controller = new AttachmentsController(db);
    const error = await controller
      .uploadAttachment(request, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body('bad.exe'))
      .then(() => null, e => e);
    assert.ok(error, 'phải ném exception');
    assert.equal(error.getStatus(), 422);
    assert.match(error.message, /[a-zà-ỹ]/i);
    assert.doesNotMatch(JSON.stringify(error.getResponse?.() ?? error.message), /select|insert|private\.|attachment/i);
    assert.equal(swfs.puts.length, 0, 'tệp nhiễm không được bao giờ chạm SeaweedFS');
    assert.ok(clamd.state.received.equals(PAYLOAD));
    const recorded = db.calls.find(c => c.sql.includes('private.record_attachment'));
    assert.equal(recorded.params[5], 'infected');
  });
});

test('controller clamd timeout: ghi failed, trả 503', async () => {
  await withServices('silent', async ({ swfs }) => {
    const db = fakeDatabase();
    const controller = new AttachmentsController(db);
    const error = await controller
      .uploadAttachment(request, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body('x.txt'))
      .then(() => null, e => e);
    assert.ok(error);
    assert.equal(error.getStatus(), 503);
    assert.equal(swfs.puts.length, 0);
    const recorded = db.calls.find(c => c.sql.includes('private.record_attachment'));
    assert.equal(recorded.params[5], 'failed');
  });
});

test('controller oversize: chặn TRƯỚC khi kết nối clamd (422)', async () => {
  await withServices('clean', async ({ clamd, swfs }) => {
    process.env.ATTACHMENT_MAX_BYTES = '8'; // trần nhỏ để dựng kịch bản quá cỡ mà không tốn bộ nhớ
    const db = fakeDatabase();
    const controller = new AttachmentsController(db);
    const error = await controller
      .uploadAttachment(request, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body('big.bin'))
      .then(() => null, e => e);
    assert.equal(error.getStatus(), 422);
    assert.equal(clamd.state.connections, 0, 'không được kết nối clamd khi tệp quá cỡ');
    assert.equal(swfs.puts.length, 0);
  });
});

test('controller content type ngoài allow-list: chặn trước clamd (400)', async () => {
  await withServices('clean', async ({ clamd, swfs }) => {
    const db = fakeDatabase();
    const controller = new AttachmentsController(db);
    const error = await controller.uploadAttachment(
      request, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      { file_name: 'x.exe', content_type: 'application/x-msdownload', content_base64: PAYLOAD.toString('base64') },
    ).then(() => null, e => e);
    assert.equal(error.getStatus(), 400);
    assert.equal(clamd.state.connections, 0);
    assert.equal(swfs.puts.length, 0);
  });
});

test('controller ticket không nhìn thấy theo RLS: 404, không quét không lưu', async () => {
  await withServices('clean', async ({ clamd, swfs }) => {
    const db = fakeDatabase({ ticketVisible: false });
    const controller = new AttachmentsController(db);
    const error = await controller
      .uploadAttachment(request, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body('x.txt'))
      .then(() => null, e => e);
    assert.equal(error.getStatus(), 404);
    assert.equal(clamd.state.connections, 0);
    assert.equal(swfs.puts.length, 0);
  });
});

// ---- DTO UploadAttachment: chặn thân request độc hại ---------------------------------------

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = value => pipe.transform(value, { type: 'body', metatype: UploadAttachment });
const validBody = { file_name: 'a.png', content_type: 'image/png', content_base64: Buffer.from('hi').toString('base64') };

test('DTO chấp nhận body hợp lệ và trim tên tệp', async () => {
  const result = await validate({ ...validBody, file_name: '  a.png  ' });
  assert.equal(result.file_name, 'a.png');
});

test('DTO chặn content type ngoài allow-list, base64 rác, thiếu/trùng field', async () => {
  await assert.rejects(validate({ ...validBody, content_type: 'application/x-msdownload' }));
  await assert.rejects(validate({ ...validBody, content_base64: 'not!!!valid#base64' }));
  await assert.rejects(validate({ ...validBody, content_base64: '' }));
  await assert.rejects(validate({ ...validBody, file_name: '' }));
  await assert.rejects(validate({ ...validBody, scan_status: 'clean' })); // không cho spoof
  await assert.rejects(validate({ content_type: 'text/plain', content_base64: validBody.content_base64 })); // thiếu file_name
});
