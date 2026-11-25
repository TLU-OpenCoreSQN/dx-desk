// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Client API mô hình AI bên thứ ba theo chuẩn OpenAI-compatible (ADR 0011).
// Mặc định trỏ tới endpoint tương thích OpenAI của Google Gemini; đổi nhà cung cấp
// chỉ cần đổi AI_API_BASE_URL, AI_API_KEY và tên model trong .env.

export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
export const DEFAULT_CHAT_MODEL = 'gemini-flash-latest';
export const DEFAULT_EMBED_MODEL = 'gemini-embedding-001';

export function llmConfig(env = process.env) {
  const baseUrl = env.AI_API_BASE_URL || DEFAULT_BASE_URL;
  return {
    // Dấu `/` cuối để new URL('chat/completions', base) giữ nguyên đường dẫn /v1beta/openai/.
    baseUrl: baseUrl.endsWith('/') ? baseUrl : baseUrl + '/',
    apiKey: env.AI_API_KEY || '',
    chatModel: env.ASSISTANT_CHAT_MODEL || DEFAULT_CHAT_MODEL,
    embedModel: env.ASSISTANT_EMBED_MODEL || DEFAULT_EMBED_MODEL,
  };
}

/** 429/503 của nhà cung cấp thường chỉ là quá tải tạm thời: thử lại tối đa 2 lần, chờ 1 s rồi 3 s.
 *  An toàn vì lỗi đến trước khi có dữ liệu nào được trả cho người dùng. */
export const RETRY_DELAYS_MS = [1000, 3000];

async function post(config, path, body, signal, delays = config.retryDelays ?? RETRY_DELAYS_MS) {
  if (!config.apiKey) throw new Error('Missing AI_API_KEY');
  let response;
  for (let attempt = 0; ; attempt++) {
    response = await fetch(new URL(path, config.baseUrl), {
      method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
      body: JSON.stringify(body),
    });
    if (![429, 503].includes(response.status) || attempt >= delays.length) break;
    await response.body?.cancel();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, delays[attempt]);
      signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    });
  }
  if (!response.ok) {
    await response.body?.cancel();
    // Không đưa nội dung phản hồi của nhà cung cấp vào lỗi: có thể lặp lại dữ liệu đã gửi.
    throw new Error(`AI provider returned HTTP ${response.status}`);
  }
  return response;
}

/** Đọc luồng Server-Sent Events, trả từng đối tượng JSON trong dòng `data:`. */
export async function* sse(body) {
  if (!body) throw new Error('Missing response stream');
  const decoder = new TextDecoder();
  let pending = '';
  const parse = function* (lines) {
    for (const line of lines) {
      const data = /^data:\s?(.*)$/.exec(line.trimEnd())?.[1];
      if (data === undefined || data === '') continue;
      if (data === '[DONE]') return;
      yield JSON.parse(data);
    }
  };
  for await (const block of body) {
    pending += decoder.decode(block, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    if (pending.length > 100000) throw new Error('AI stream message too large');
    yield* parse(lines);
  }
  pending += decoder.decode();
  yield* parse([pending]);
}

/**
 * Chat có stream. Trả về các phần `{ content }` khi có chữ mới, và cuối cùng một phần
 * `{ tool_calls }` (đối số đã parse thành object) nếu mô hình gọi công cụ. Mảnh đối số
 * công cụ được ghép theo `index` vì nhà cung cấp có thể chia nhỏ qua nhiều sự kiện.
 */
export async function* chatStream(config, messages, tools, signal) {
  const response = await post(config, 'chat/completions', {
    // Gemini counts reasoning toward the completion budget. Leave room for the answer too.
    model: config.chatModel, messages, stream: true, temperature: 0.1, max_tokens: 4096,
    ...(tools.length ? { tools } : {}),
  }, AbortSignal.any([signal, AbortSignal.timeout(90000)]));
  const calls = [];
  for await (const event of sse(response.body)) {
    const delta = event.choices?.[0]?.delta;
    if (!delta) continue;
    if (typeof delta.content === 'string' && delta.content) yield { content: delta.content };
    for (const part of delta.tool_calls ?? []) {
      // Gemini gửi cả tool call trong một sự kiện và không có `index`; mảnh không có index và
      // không có id mới thì là phần tiếp của tool call trước đó.
      const index = Number.isInteger(part.index) ? part.index
        : part.id || !calls.length ? calls.length : calls.length - 1;
      const call = calls[index] ??= { id: '', name: '', arguments: '', extra: undefined };
      if (part.id) call.id = part.id;
      if (part.function?.name) call.name += part.function.name;
      if (typeof part.function?.arguments === 'string') call.arguments += part.function.arguments;
      // Gemini 3: `extra_content.google.thought_signature` phải được gửi lại nguyên vẹn ở lượt sau,
      // thiếu thì API trả 400 (thử ngày 23/11/2026). Giữ nguyên giá trị nhà cung cấp gửi.
      if (part.extra_content && typeof part.extra_content === 'object') call.extra = part.extra_content;
      if (call.arguments.length > 20000) throw new Error('AI tool call arguments too large');
    }
  }
  const toolCalls = calls.filter(Boolean).map((call, index) => {
    let args = null;
    try { args = call.arguments ? JSON.parse(call.arguments) : {}; } catch { args = null; }
    return { id: call.id || `call_${index}`, name: call.name, arguments: args,
      ...(call.extra ? { extra_content: call.extra } : {}) };
  });
  if (toolCalls.length) yield { tool_calls: toolCalls };
}

export async function embed(config, input, signal = AbortSignal.timeout(90000)) {
  const { data } = await (await post(config, 'embeddings', { model: config.embedModel, input }, signal)).json();
  const embeddings = Array.isArray(data)
    ? [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(item => item?.embedding)
    : [];
  if (embeddings.length !== input.length || !embeddings[0]?.length ||
      embeddings.some(vector => !Array.isArray(vector) || vector.length !== embeddings[0].length ||
        !vector.every(Number.isFinite))) {
    throw new Error('Invalid AI embedding response');
  }
  return embeddings;
}
