// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { answer, proposalStore, tools } from './chat.mjs';
import { searchKnowledge, wikiKnowledge } from './knowledge.mjs';
import { chatStream } from './llm.mjs';

const errorWith = (status, message) => Object.assign(new Error(message), { status });
const MAX_BODY = 4096;
async function readBody(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw errorWith(415, 'Yêu cầu JSON.');
  const size = Number(request.headers['content-length']);
  if (size > MAX_BODY) throw errorWith(413, 'Yêu cầu vượt quá kích thước cho phép.');
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY) throw errorWith(413, 'Yêu cầu vượt quá kích thước cho phép.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw errorWith(400, 'Yêu cầu JSON không hợp lệ.'); }
}

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

export function assistantServer(dependencies, proposals = proposalStore()) {
  let active = 0;
  return createServer(async (request, response) => {
    const url = request.url;
    const endpoints = ['/api/assistant/chat', '/api/assistant/confirm'];
    if (request.method === 'GET' && url === '/healthz') return json(response, 200, { status: 'ok' });
    if (!endpoints.includes(url)) return json(response, 404, { message: 'Không tìm thấy.' });
    if (request.method !== 'POST') return json(response, 405, { message: 'Chỉ nhận POST.' });
    const controller = new AbortController();
    response.once('close', () => controller.abort());
    try {
      const token = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? '')?.[1];
      if (!token) throw errorWith(401, 'Cần đăng nhập.');
      const caller = await dependencies.identity(token);
      if (!caller?.id || !caller.roles?.some(role => ['Employee', 'Agent', 'Manager'].includes(role))) {
        throw errorWith(403, 'Bạn không có quyền dùng trợ lý.');
      }
      const body = await readBody(request);
      if (url.endsWith('/confirm')) {
        const id = body?.id;
        if (typeof id !== 'string' || typeof body.approve !== 'boolean' ||
          Object.keys(body).length !== 2) throw errorWith(400, 'Xác nhận không hợp lệ.');
        const offer = proposals.take(id, caller.id);
        if (!offer) throw errorWith(404, 'Đề xuất đã hết hạn hoặc đã được xử lý.');
        if (!body.approve) return json(response, 200, { status: 'cancelled' });
        try {
          const result = await dependencies.invoke(offer.tool, offer.args, token, offer.id, controller.signal, caller.id);
          return json(response, 200, { status: 'applied', result });
        } catch (error) {
          // The API commits by action ID, so retrying the same confirmation is safe after a lost response.
          if (!error.status || error.status >= 500) proposals.restore(offer);
          throw error;
        }
      }
      const question = typeof body?.question === 'string' ? body.question.trim() : '';
      if (!question || question.length > 1000 || Object.keys(body).length !== 1) throw errorWith(400, 'Câu hỏi cần từ 1 đến 1000 ký tự.');
      if (active >= 2) throw errorWith(429, 'Trợ lý đang bận. Vui lòng thử lại.');
      active++;
      response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
      response.flushHeaders();
      const emit = (type, payload) => { if (!controller.signal.aborted) response.write(JSON.stringify({ type, ...payload }) + '\n'); };
      try {
        await answer({ caller: { ...caller, token }, signal: controller.signal, question, emit,
          dependencies: { ...dependencies, propose: proposals.offer } });
      } finally {
        active--;
      }
      response.end();
    } catch (error) {
      if (response.destroyed) return;
      // Ghi lỗi nội bộ (chỉ thông điệp, không câu hỏi hay token) để vận hành chẩn đoán được,
      // ví dụ thiếu AI_API_KEY hoặc nhà cung cấp AI từ chối; người dùng vẫn chỉ thấy thông điệp chung.
      if (!error.status) console.error('Assistant request failed:', error?.message ?? error);
      const message = error.status ? error.message : 'Trợ lý chưa xử lý được yêu cầu. Vui lòng thử lại.';
      if (!response.headersSent) return json(response, error.status ?? 503, { message });
      response.end(JSON.stringify({ type: 'error', message }) + '\n');
    }
  });
}

export function assistantDependencies(env = process.env) {
  const config = wikiKnowledge(env);
  const gateway = env.ASSISTANT_GATEWAY_URL || 'http://apisix:9080';
  const endpoints = {
    ticket_statistics: 'ticket_statistics', similar_tickets: 'similar_tickets', create_ticket: 'create_ticket', create_task: 'create_task',
  };
  const call = (path, token, options = {}) => fetch(new URL(path, gateway), {
    ...options, headers: { Authorization: 'Bearer ' + token, ...options.headers }, redirect: 'error',
    signal: AbortSignal.any([options.signal ?? new AbortController().signal, AbortSignal.timeout(15000)]),
  });
  return {
    async identity(token) {
      const result = await call('/api/me', token);
      if (result.status === 401) throw errorWith(401, 'Phiên đăng nhập đã hết hạn.');
      if (!result.ok) throw errorWith(result.status === 403 ? 403 : 503, 'Không xác minh được quyền của tài khoản.');
      return result.json();
    },
    knowledge: question => searchKnowledge(config, question),
    async available(token) {
      const result = await call('/api/assistant-tools', token);
      if (result.status === 404) { await result.body?.cancel(); return []; }
      if (!result.ok) throw new Error('Assistant tool catalogue unavailable');
      const catalog = await result.json();
      if (!Array.isArray(catalog.tools)) throw new Error('Invalid assistant tool catalogue');
      return [...new Set(catalog.tools)].filter(name => typeof name === 'string' && Object.hasOwn(tools, name));
    },
    async invoke(name, args, token, id, signal, owner) {
      if (!Object.hasOwn(endpoints, name)) throw new Error('Unexpected assistant tool');
      const canonical = Object.fromEntries(Object.entries(args).sort(([a], [b]) => a.localeCompare(b)));
      const proof = id && createHmac('sha256', env.ASSISTANT_ACTION_KEY || '')
        .update(JSON.stringify([owner, name, id, canonical])).digest('hex');
      const result = await call('/api/assistant-tools/' + endpoints[name], token, {
        method: 'POST', signal, body: JSON.stringify(args),
        headers: { 'Content-Type': 'application/json', ...(id ? { 'Idempotency-Key': id, 'X-DXDesk-Assistant-Proof': proof } : {}) },
      });
      if (!result.ok) {
        await result.body?.cancel();
        throw errorWith([400,403,409,422].includes(result.status) ? result.status : 503, 'Công cụ chưa thực hiện được thao tác.');
      }
      return result.json();
    },
    // Mô hình chạy ở nhà cung cấp API bên thứ ba (ADR 0011), không còn Ollama cục bộ.
    complete: (messages, available, signal) => chatStream(config.ai, messages, available, signal),
  };
}
