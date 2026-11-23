// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chatStream, DEFAULT_BASE_URL, embed, llmConfig } from './llm.mjs';

async function provider(t, handler) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks));
    requests.push({ url: request.url, authorization: request.headers.authorization, body });
    handler(request, response, body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const config = llmConfig({ AI_API_BASE_URL: `http://127.0.0.1:${server.address().port}/v1beta/openai`,
    AI_API_KEY: 'key-fixture', ASSISTANT_CHAT_MODEL: 'chat-fixture', ASSISTANT_EMBED_MODEL: 'embed-fixture' });
  return { config, requests };
}

const collect = async iterable => { const parts = []; for await (const part of iterable) parts.push(part); return parts; };

test('mặc định dùng endpoint tương thích OpenAI của Gemini', () => {
  const config = llmConfig({});
  assert.equal(config.baseUrl, DEFAULT_BASE_URL);
  assert.equal(config.apiKey, '');
});

test('chatStream ghép chữ và mảnh đối số công cụ từ luồng SSE', async t => {
  const { config, requests } = await provider(t, (_request, response) => {
    response.setHeader('Content-Type', 'text/event-stream');
    const events = [
      { choices: [{ delta: { content: 'Xin ' } }] },
      { choices: [{ delta: { content: 'chào' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'similar_tickets', arguments: '{"que' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"VPN"}' } }] } }] },
    ];
    // Một sự kiện bị cắt giữa hai gói TCP để kiểm tra phần đệm.
    const text = events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n';
    response.write(text.slice(0, 37));
    response.end(text.slice(37));
  });
  const tools = [{ type: 'function', function: { name: 'similar_tickets' } }];
  const parts = await collect(chatStream(config, [{ role: 'user', content: 'Hỏi' }], tools, new AbortController().signal));
  assert.deepEqual(parts, [
    { content: 'Xin ' }, { content: 'chào' },
    { tool_calls: [{ id: 'call_a', name: 'similar_tickets', arguments: { query: 'VPN' } }] },
  ]);
  assert.equal(requests[0].url, '/v1beta/openai/chat/completions');
  assert.equal(requests[0].authorization, 'Bearer key-fixture');
  assert.equal(requests[0].body.model, 'chat-fixture');
  assert.equal(requests[0].body.stream, true);
  assert.deepEqual(requests[0].body.tools, tools);
});

test('chatStream không gửi trường tools khi không có công cụ', async t => {
  const { config, requests } = await provider(t, (_request, response) => response.end('data: [DONE]\n\n'));
  assert.deepEqual(await collect(chatStream(config, [], [], new AbortController().signal)), []);
  assert.equal(Object.hasOwn(requests[0].body, 'tools'), false);
});

test('embed trả vector theo đúng thứ tự index và từ chối phản hồi sai', async t => {
  let broken = false;
  const { config, requests } = await provider(t, (_request, response, body) => {
    const data = body.input.map((_, index) => ({ index, embedding: broken ? [1] : [index, 1] })).reverse();
    if (broken) data[0].embedding = [1, 2];
    response.end(JSON.stringify({ data }));
  });
  assert.deepEqual(await embed(config, ['a', 'b']), [[0, 1], [1, 1]]);
  assert.equal(requests[0].url, '/v1beta/openai/embeddings');
  assert.equal(requests[0].body.model, 'embed-fixture');
  broken = true;
  await assert.rejects(embed(config, ['a', 'b']), /Invalid AI embedding response/);
});

test('lỗi HTTP của nhà cung cấp không lộ nội dung phản hồi; thiếu khóa thì không gọi mạng', async t => {
  const { config } = await provider(t, (_request, response) => { response.statusCode = 429; response.end('quota: secret detail'); });
  await assert.rejects(embed(config, ['a']), error => error.message === 'AI provider returned HTTP 429');
  await assert.rejects(embed({ ...config, apiKey: '' }, ['a']), /Missing AI_API_KEY/);
});
