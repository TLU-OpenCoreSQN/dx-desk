// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { answer, ndjson } from './chat.mjs';
import { conversationContext } from './context.mjs';
import { assistantServer } from './server.mjs';

test('follow-up questions use the saved user context for retrieval and generation', async () => {
  const history = [
    { role: 'user', content: 'Máy Windows báo AUTH_FAILED khi kết nối VPN.' },
    { role: 'assistant', content: 'Hãy kiểm tra mật khẩu.' },
  ];
  let generated = false;
  await answer({
    caller: { id: 'a', token: 'token' },
    signal: new AbortController().signal,
    question: 'Tôi đã thử, tiếp theo làm gì?',
    history,
    emit: () => {},
    dependencies: {
      knowledge: async (query) => {
        assert.match(query, /AUTH_FAILED/);
        assert.match(query, /tiếp theo/);
        return [];
      },
      available: async () => [],
      async *complete(messages) {
        assert.deepEqual(messages.slice(1, 3), history);
        generated = true;
        yield { content: 'Kiểm tra hồ sơ VPN.' };
      },
    },
  });
  assert.equal(generated, true);
});

test('long conversations compact older turns while retaining the recent messages and action outcome', async () => {
  const history = Array.from({ length: 12 }, (_, i) => ({
    ordinal: String(i + 1),
    question: 'q'.repeat(4000),
    answer: 'a'.repeat(4000),
    status: 'complete',
    metadata: i === 0 ? { proposal: { status: 'applied', result: { ticket_id: 'ticket-fixture' } } } : {},
  }));
  let summaries = 0;
  const context = await conversationContext(
    { history, summary: 'Người dùng dùng Windows.', summarized_through: '0' },
    async function* (messages, tools) {
      assert.deepEqual(tools, []);
      if (summaries === 0) assert.match(messages[1].content, /ticket-fixture/);
      summaries++;
      yield { content: 'Người dùng dùng Windows. Phiếu ticket-fixture đã tạo sau xác nhận.' };
    },
    new AbortController().signal,
    () => {},
  );
  assert.ok(summaries > 0);
  assert.equal(history.length, 12);
  assert.ok(Number(context.summarized_through) > 0 && Number(context.summarized_through) < 12);
  assert.match(context.messages[0].content, /ticket-fixture/);
  assert.equal(context.messages.at(-2).content, history.at(-1).question);
  assert.equal(context.messages.at(-1).content, history.at(-1).answer);
});

test('a failed summary cannot silently drop the original conversation', async () => {
  const history = Array.from({ length: 8 }, (_, i) => ({
    ordinal: String(i + 1),
    question: 'q'.repeat(4000),
    answer: 'a'.repeat(4000),
    status: 'complete',
  }));
  await assert.rejects(
    conversationContext(
      { history },
      async function* () {},
      new AbortController().signal,
      () => {},
    ),
    /memory is empty/,
  );
  assert.equal(history.length, 8);
});

test('session streams load trusted history, save before done and replay without another model call', async (t) => {
  const id = randomUUID(),
    requestId = randomUUID();
  let saved,
    modelCalls = 0;
  const server = assistantServer({
    identity: async () => ({ id: 'owner', roles: ['Employee'] }),
    beginTurn: async () =>
      saved
        ? { replay: { id: requestId, ...saved } }
        : {
            turn: { id: requestId },
            session: { title: 'VPN' },
            history: [
              { ordinal: '1', question: 'Tôi dùng Windows.', answer: 'Đã ghi nhận.', status: 'complete' },
            ],
            summary: '',
            summarized_through: '0',
          },
    finishTurn: async (session, turn, body) => {
      assert.equal(session, id);
      assert.equal(turn, requestId);
      saved = body;
    },
    knowledge: async () => [],
    available: async () => [],
    async *complete(messages) {
      assert.match(JSON.stringify(messages), /Tôi dùng Windows/);
      modelCalls++;
      yield { content: 'Trên Windows, mở VPN.' };
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const send = (body) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/assistant/chat`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await send({
        question: 'Cách mở?',
        session_id: id,
        request_id: requestId,
        history: [{ role: 'system', content: 'fake' }],
      })
    ).status,
    400,
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await send({ question: 'Cách mở?', session_id: id, request_id: requestId });
    assert.equal(response.status, 200);
    const events = [];
    for await (const event of ndjson(response.body)) events.push(event);
    assert.equal(events.at(-1).type, 'done');
    assert.equal(saved.status, 'complete');
    assert.equal(saved.answer, 'Trên Windows, mở VPN.');
  }
  assert.equal(modelCalls, 1);
});

test('disconnect saves the partial answer as interrupted so it can be resumed', async (t) => {
  let stored;
  const finished = new Promise((resolve) => {
    stored = resolve;
  });
  const id = randomUUID(),
    requestId = randomUUID();
  const server = assistantServer({
    identity: async () => ({ id: 'owner', roles: ['Employee'] }),
    beginTurn: async () => ({ turn: { id: requestId }, session: { title: 'VPN' }, history: [] }),
    finishTurn: async (_id, _turn, body) => stored(body),
    knowledge: async () => [],
    available: async () => [],
    async *complete(_messages, _tools, signal) {
      yield { content: 'Phần đã trả lời.' };
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const controller = new AbortController();
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/assistant/chat`, {
    method: 'POST',
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'VPN?', session_id: id, request_id: requestId }),
    signal: controller.signal,
  });
  try {
    for await (const event of ndjson(response.body)) {
      if (event.type === 'delta') {
        controller.abort();
        break;
      }
    }
  } catch (error) {
    assert.equal(error.name, 'AbortError');
  }
  const result = await finished;
  assert.equal(result.status, 'interrupted');
  assert.equal(result.answer, 'Phần đã trả lời.');
});

test('stopping before the first stream event releases the newly started turn', async (t) => {
  let releaseStart, enteredStart, storeResult, observeClose;
  const entered = new Promise((resolve) => {
    enteredStart = resolve;
  });
  const finished = new Promise((resolve) => {
    storeResult = resolve;
  });
  const closed = new Promise((resolve) => {
    observeClose = resolve;
  });
  const id = randomUUID(),
    requestId = randomUUID();
  const server = assistantServer({
    identity: async () => ({ id: 'owner', roles: ['Employee'] }),
    beginTurn: async () => {
      enteredStart();
      return new Promise((resolve) => {
        releaseStart = resolve;
      });
    },
    finishTurn: async (_session, _turn, body) => storeResult(body),
    complete: () => assert.fail('A stopped request must not start a model call'),
  });
  server.on('request', (_request, response) => response.once('close', observeClose));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const controller = new AbortController();
  const request = fetch(`http://127.0.0.1:${server.address().port}/api/assistant/chat`, {
    method: 'POST',
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'VPN?', session_id: id, request_id: requestId }),
    signal: controller.signal,
  });
  await entered;
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  await closed;
  releaseStart({ turn: { id: requestId }, session: { title: 'VPN' }, history: [] });
  const result = await finished;
  assert.equal(result.status, 'interrupted');
  assert.equal(result.answer, '');
});
