// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { createServer } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { answer, proposalStore, tools } from './chat.mjs';
import { searchKnowledge, wikiKnowledge } from './knowledge.mjs';
import { chatStream } from './llm.mjs';
import { conversationContext } from './context.mjs';

const errorWith = (status, message) => Object.assign(new Error(message), { status });
const MAX_BODY = 40000;
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
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw errorWith(400, 'Yêu cầu JSON cần là một đối tượng.');
      if (url.endsWith('/confirm')) {
        const id = body?.id;
        if (typeof id !== 'string' || typeof body.approve !== 'boolean' ||
          Object.keys(body).length !== 2) throw errorWith(400, 'Xác nhận không hợp lệ.');
        const offer = proposals.take(id, caller.id) ?? await dependencies.pendingProposal?.(id, token);
        if (!offer) throw errorWith(404, 'Đề xuất đã hết hạn hoặc đã được xử lý.');
        if (!body.approve) {
          if (offer.session_id) await dependencies.cancelProposal(id, token);
          return json(response, 200, { status: 'cancelled' });
        }
        try {
          const result = await dependencies.invoke(offer.tool, offer.args, token, offer.id, controller.signal, caller.id, offer.session_id);
          return json(response, 200, { status: 'applied', result });
        } catch (error) {
          // The API commits by action ID, so retrying the same confirmation is safe after a lost response.
          if ((!error.status || error.status >= 500) && !offer.session_id) proposals.restore(offer);
          throw error;
        }
      }
      const question = typeof body?.question === 'string' ? body.question.trim() : '';
      const sessionId = body.session_id;
      const requestId = body.request_id;
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validShape = sessionId === undefined ? Object.keys(body).length === 1
        : uuid.test(sessionId) && uuid.test(requestId) && Object.keys(body).length === 3;
      if (!question || question.length > 8000 || !validShape) throw errorWith(400, 'Tin nhắn cần từ 1 đến 8000 ký tự và mã hội thoại hợp lệ.');
      if (active >= 2) throw errorWith(429, 'Trợ lý đang bận. Vui lòng thử lại.');
      active++;
      try {
        const started = sessionId ? await dependencies.beginTurn(sessionId, { request_id: requestId, question }, caller, token) : null;
        if (controller.signal.aborted) {
          if (started && !started.replay) await dependencies.finishTurn(sessionId, requestId, {
            answer: '', metadata: { steps: [], sources: [] }, status: 'interrupted',
          }, caller, token);
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
        response.flushHeaders();
        const write = (type, payload) => {
          if (!controller.signal.aborted) response.write(JSON.stringify({ type, ...payload }) + '\n');
        };
        if (started?.replay) {
          const turn = started.replay;
          write('turn', { id: turn.id, session_id: sessionId });
          for (const label of turn.metadata.steps ?? []) write('step', { label });
          write('sources', { items: turn.metadata.sources ?? [] });
          write('delta', { text: turn.answer });
          if (turn.metadata.proposal) write('proposal', turn.metadata.proposal);
          if (turn.status !== 'complete') write('error', { message: turn.metadata.error || 'Lượt trả lời đã bị gián đoạn.' });
          else write('done', {});
          response.end();
          return;
        }
        if (started) write('turn', { ...started.turn, session_id: sessionId, title: started.session.title });
        const saved = { answer: '', metadata: { steps: [], sources: [] }, status: 'complete' };
        let context;
        let generationError;
        const emit = (type, payload) => {
          if (type === 'done') return;
          if (type === 'delta') {
            if (saved.answer.length + payload.text.length > 16000) throw new Error('Assistant answer too long');
            saved.answer += payload.text;
          }
          if (type === 'step') saved.metadata.steps.push(payload.label);
          if (type === 'sources') saved.metadata.sources = payload.items;
          write(type, payload);
        };
        const propose = (owner, tool, args) => {
          if (!sessionId) return proposals.offer(owner, tool, args);
          const proposal = { id: randomUUID(), label: tools[tool].label, fields: args, tool,
            expires_at: new Date(Date.now() + 300000).toISOString(), status: 'pending' };
          saved.metadata.proposal = proposal;
          return proposal;
        };
        try {
          context = started ? await conversationContext(started, dependencies.complete, controller.signal, emit) : null;
          await answer({ caller: { ...caller, token }, signal: controller.signal, question, history: context?.messages ?? [], emit,
            dependencies: { ...dependencies, propose } });
          if (controller.signal.aborted) saved.status = 'interrupted';
        } catch (error) {
          generationError = error;
          saved.status = controller.signal.aborted ? 'interrupted' : 'error';
          saved.metadata.error = error.status ? error.message : 'Trợ lý chưa xử lý được yêu cầu. Bạn có thể gửi tiếp tin nhắn.';
        }
        if (saved.status !== 'complete') delete saved.metadata.proposal;
        if (started) await dependencies.finishTurn(sessionId, requestId, {
          ...saved, ...(context ? { summary: context.summary, summarized_through: String(context.summarized_through) } : {}),
        }, caller, token);
        if (generationError) throw generationError;
        if (!controller.signal.aborted) write('done', {});
        response.end();
      } finally {
        active--;
      }
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
  const internalApi = env.ASSISTANT_API_URL || 'http://api:3000';
  const endpoints = {
    ticket_statistics: 'ticket_statistics', similar_tickets: 'similar_tickets', create_ticket: 'create_ticket', create_task: 'create_task',
  };
  const call = (path, token, options = {}) => fetch(new URL(path, gateway), {
    ...options, headers: { Authorization: 'Bearer ' + token, ...options.headers }, redirect: 'error',
    signal: AbortSignal.any([options.signal ?? new AbortController().signal, AbortSignal.timeout(15000)]),
  });
  async function sessions(path, token, body, owner, scope) {
    const proof = scope && createHmac('sha256', env.ASSISTANT_ACTION_KEY || '')
      .update(JSON.stringify([owner, scope, body])).digest('hex');
    const response = await call('/api/assistant-sessions/' + path, token, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(proof ? { 'X-DXDesk-Assistant-Proof': proof } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const message = await response.json().catch(() => null);
      throw errorWith(response.status, message?.message || 'Không thể lưu cuộc trò chuyện.');
    }
    return response.json();
  }
  async function finishInternal(id, turnId, result, caller) {
    if (!env.ASSISTANT_ACTION_KEY || env.ASSISTANT_ACTION_KEY.length < 32) throw new Error('Missing ASSISTANT_ACTION_KEY');
    const proof = createHmac('sha256', env.ASSISTANT_ACTION_KEY)
      .update(JSON.stringify([caller.id, 'finish:' + id + ':' + turnId, result])).digest('hex');
    const response = await fetch(new URL('/internal/assistant-sessions/' + id + '/turns/' + turnId + '/finish', internalApi), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-DXDesk-Assistant-Proof': proof },
      body: JSON.stringify({ owner_id: caller.id, result }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw errorWith(response.status, error?.message || 'Không thể lưu kết quả hội thoại.');
    }
    return response.json();
  }
  return {
    beginTurn: (id, body, caller, token) => sessions(id + '/turns/start', token, body, caller.id, 'start:' + id),
    async finishTurn(id, turnId, body, caller) {
      try { return await finishInternal(id, turnId, body, caller); }
      catch (error) {
        if (error.status && error.status < 500) throw error;
        return finishInternal(id, turnId, body, caller);
      }
    },
    pendingProposal: (id, token) => sessions('proposals/' + id, token),
    cancelProposal: (id, token) => sessions('proposals/' + id + '/cancel', token, {}),
    async identity(token) {
      const result = await call('/api/me', token);
      if (result.status === 401) { await result.body?.cancel(); throw errorWith(401, 'Phiên đăng nhập đã hết hạn.'); }
      if (!result.ok) { await result.body?.cancel(); throw errorWith(result.status === 403 ? 403 : 503, 'Không xác minh được quyền của tài khoản.'); }
      return result.json();
    },
    knowledge: (question, signal) => searchKnowledge(config, question, signal),
    async available(token) {
      const result = await call('/api/assistant-tools', token);
      if (result.status === 404) { await result.body?.cancel(); return []; }
      if (!result.ok) { await result.body?.cancel(); throw new Error('Assistant tool catalogue unavailable'); }
      const catalog = await result.json();
      if (!Array.isArray(catalog.tools)) throw new Error('Invalid assistant tool catalogue');
      return [...new Set(catalog.tools)].filter(name => typeof name === 'string' && Object.hasOwn(tools, name));
    },
    async invoke(name, args, token, id, signal, owner, sessionId) {
      if (!Object.hasOwn(endpoints, name)) throw new Error('Unexpected assistant tool');
      if (id && !env.ASSISTANT_ACTION_KEY) throw new Error('Missing ASSISTANT_ACTION_KEY');
      const canonical = Object.fromEntries(Object.entries(args).sort(([a], [b]) => a.localeCompare(b)));
      const payload = sessionId ? [owner, name, id, canonical, sessionId] : [owner, name, id, canonical];
      const proof = id && createHmac('sha256', env.ASSISTANT_ACTION_KEY)
        .update(JSON.stringify(payload)).digest('hex');
      const result = await call('/api/assistant-tools/' + endpoints[name], token, {
        method: 'POST', signal, body: JSON.stringify(args),
        headers: { 'Content-Type': 'application/json', ...(id ? { 'Idempotency-Key': id, 'X-DXDesk-Assistant-Proof': proof } : {}),
          ...(sessionId ? { 'X-DXDesk-Assistant-Session': sessionId } : {}) },
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
