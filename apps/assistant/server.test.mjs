// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { assistantDependencies, assistantServer } from './server.mjs';
import { answer, ndjson, proposalStore } from './chat.mjs';

test('confirmation is bound to the question owner, consumes the proposal once, and forwards the exact arguments', async t => {
  const args = { category: 'vpn', title: 'Hỗ trợ VPN', description: 'VPN bị ngắt khi đăng nhập từ xa.' };
  const mutations = [];
  const server = assistantServer({
    identity: async token => ({ id: token, roles: ['Employee'] }),
    available: async () => ['create_ticket'],
    knowledge: async () => [{ title: 'VPN', url: 'https://wiki.example.test/en/ho-tro/vpn', text: 'VPN.' }],
    async *complete(messages, definitions) {
      if (definitions.length) yield { tool_calls: [
        { id: 'call_1', name: 'create_ticket', arguments: { ...args, role: 'Manager' } },
        { id: 'call_2', name: 'create_ticket', arguments: args, extra_content: { google: { thought_signature: 'sig' } } },
      ] };
      else {
        // Lượt sau gửi lại tool call theo định dạng OpenAI, kèm thought signature và tool_call_id.
        const replayed = messages.find(message => message.role === 'assistant');
        assert.deepEqual(replayed.tool_calls[1], { id: 'call_2', type: 'function',
          function: { name: 'create_ticket', arguments: JSON.stringify(args) }, extra_content: { google: { thought_signature: 'sig' } } });
        assert.deepEqual(messages.filter(message => message.role === 'tool').map(message => message.tool_call_id), ['call_1', 'call_2']);
        yield { content: 'Đã chuẩn bị đề xuất.' };
      }
    },
    async invoke(...params) { mutations.push(params.slice(0, 4)); },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = (name, token, body) => fetch(`http://127.0.0.1:${server.address().port}/api/assistant/${name}`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  async function propose() {
    const response = await post('chat', 'a', { question: 'VPN bị lỗi nên tôi cần phiếu hỗ trợ.' });
    assert.equal(response.status, 200);
    const events = [];
    for await (const event of ndjson(response.body)) events.push(event);
    assert.deepEqual(events.map(event => event.type), ['step', 'sources', 'step', 'proposal', 'delta', 'done']);
    assert.equal(mutations.length, 0);
    return events.find(event => event.type === 'proposal').id;
  }
  const cancel = await propose();
  assert.equal((await post('confirm', 'b', { id: cancel, approve: true })).status, 404);
  assert.deepEqual(await (await post('confirm', 'a', { id: cancel, approve: false })).json(), { status: 'cancelled' });
  assert.equal((await post('confirm', 'a', { id: cancel, approve: true })).status, 404);
  const id = await propose();
  const decisions = await Promise.all([post('confirm', 'a', { id, approve: true }), post('confirm', 'a', { id, approve: true })]);
  assert.deepEqual(decisions.map(response => response.status).sort(), [200, 404]);
  assert.deepEqual(mutations, [['create_ticket', args, 'a', id]]);
});

test('proposals expire after five minutes', () => {
  let now = 5000;
  const store = proposalStore(() => now);
  const offer = store.offer('owner', 'create_task', { title: 'Điều tra VPN' });
  now += 300000;
  assert.equal(store.take(offer.id, 'owner'), null);
});

test('an unresolved VPN report offers a prefilled ticket and awaits confirmation', async () => {
  const events = [];
  await answer({
    caller: { id: 'employee', token: 'token', roles: ['Employee'] },
    signal: new AbortController().signal,
    question: 'Tôi đã thử nhưng vẫn không kết nối được VPN.',
    dependencies: {
      knowledge: async () => [],
      available: async () => ['create_ticket'],
      propose: proposalStore().offer,
      invoke: () => assert.fail('A proposal must never invoke the write tool'),
    },
    emit: (type, data) => events.push({ type, ...data }),
  });
  assert.deepEqual(events.find(event => event.type === 'proposal').fields, {
    category: 'vpn', title: 'Hỗ trợ kết nối VPN', description: 'Tôi đã thử nhưng vẫn không kết nối được VPN.',
  });
  assert.equal(events.at(-1).type, 'done');
});

test('a lost tool response allows retry with the same durable action ID', async t => {
  const store = proposalStore();
  const offered = store.offer('owner', 'create_task', { title: 'Điều tra VPN', description: 'Kiểm tra xu hướng hệ thống.' });
  const ids = [];
  const server = assistantServer({
    identity: async () => ({ id: 'owner', roles: ['Manager'] }),
    invoke: async (_name, _args, _token, id) => {
      ids.push(id);
      if (ids.length === 1) throw new Error('lost response');
      return { id };
    },
  }, store);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const confirm = () => fetch(`http://127.0.0.1:${server.address().port}/api/assistant/confirm`, {
    method: 'POST', headers: { Authorization: 'Bearer demo', 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: offered.id, approve: true }),
  });
  assert.equal((await confirm()).status, 503);
  assert.equal((await confirm()).status, 200);
  assert.deepEqual(ids, [offered.id, offered.id]);
});

test('guidance and deferred writes do not offer a ticket even if the model requests the tool', async () => {
  for (const question of [
    'Tôi dùng Windows 11. Hướng dẫn tôi kiểm tra kết nối VPN trước khi tạo phiếu hỗ trợ.',
    'Tôi vẫn chưa kết nối được VPN, đừng tạo phiếu.',
    'Tôi chưa muốn tạo phiếu VPN, hãy hướng dẫn thêm.',
    'Hướng dẫn cách tạo phiếu VPN.',
  ]) {
    const events = [];
    let calls = 0;
    await answer({
      caller: { id: 'employee', token: 'token', roles: ['Employee'] },
      signal: new AbortController().signal,
      question,
      dependencies: {
        knowledge: async () => [],
        available: async () => ['create_ticket', 'create_task', 'similar_tickets'],
        propose: () => assert.fail('The user deferred writes'),
        invoke: () => assert.fail('A write must not execute'),
        async *complete(messages, definitions) {
          assert.ok(definitions.every(item => !['create_ticket', 'create_task'].includes(item.function.name)));
          if (calls++ === 0) {
            assert.ok(definitions.some(item => item.function.name === 'similar_tickets'));
            yield { tool_calls: [{ id: 'unexpected', name: 'create_ticket', arguments: {
              category: 'vpn', title: 'VPN', description: question,
            } }] };
          } else {
            assert.match(messages.at(-1).content, /Công cụ hoặc tham số không hợp lệ/);
            yield { content: 'Hãy kiểm tra kết nối mạng trước.' };
          }
        },
      },
      emit: (type, data) => events.push({ type, ...data }),
    });
    assert.equal(events.some(event => event.type === 'proposal'), false);
    assert.equal(events.find(event => event.type === 'delta').text, 'Hãy kiểm tra kết nối mạng trước.');
  }
});

test('an explicit VPN ticket request still offers a confirmation', async () => {
  const events = [];
  await answer({
    caller: { id: 'employee', token: 'token', roles: ['Employee'] },
    signal: new AbortController().signal,
    question: 'Tạo phiếu VPN giúp tôi.',
    dependencies: {
      knowledge: async () => [], available: async () => ['create_ticket'], propose: proposalStore().offer,
      invoke: () => assert.fail('A proposal needs confirmation'),
    },
    emit: (type, data) => events.push({ type, ...data }),
  });
  assert.equal(events.find(event => event.type === 'proposal').fields.category, 'vpn');
});

test('a Manager can request VPN statistics while deferring task creation', async () => {
  const events = [];
  await answer({
    caller: { id: 'manager', token: 'token', roles: ['Manager'] },
    signal: new AbortController().signal,
    question: 'VPN tăng tuần này thế nào? Chưa cần tạo công việc.',
    dependencies: {
      knowledge: async () => [], available: async () => ['ticket_statistics', 'create_task'],
      propose: () => assert.fail('Task creation was deferred'),
      invoke: async name => { assert.equal(name, 'ticket_statistics'); return { current_week: 8, previous_week: 4 }; },
    },
    emit: (type, data) => events.push({ type, ...data }),
  });
  assert.match(events.find(event => event.type === 'delta').text, /tuần này 8, tuần trước 4/);
  assert.equal(events.some(event => event.type === 'proposal'), false);
});

test('Vietnamese đ is normalized for unresolved VPN reports', async () => {
  const events = [];
  await answer({
    caller: { id: 'employee', token: 'token', roles: ['Employee'] },
    signal: new AbortController().signal,
    question: 'Tôi đã thử nhưng vẫn chưa khắc phục được VPN.',
    dependencies: {
      knowledge: async () => [],
      available: async () => ['create_ticket'],
      propose: proposalStore().offer,
      invoke: () => assert.fail('A proposal must never invoke the write tool'),
    },
    emit: (type, data) => events.push({ type, ...data }),
  });
  assert.equal(events.find(event => event.type === 'proposal')?.fields.category, 'vpn');
});

test('ndjson rejects oversized complete lines and expired proposals are evicted on take', async () => {
  const oversized = '{"ok":true,"pad":"' + 'a'.repeat(100001) + '"}\n';
  await assert.rejects(async () => {
    for await (const _ of ndjson([Buffer.from(oversized)])) { /* noop */ }
  }, /too large/);

  let now = 5000;
  const store = proposalStore(() => now);
  const offer = store.offer('owner', 'create_task', { title: 'Test' });
  now += 300000;
  assert.equal(store.take(offer.id, 'owner'), null);
  now = 5000;
  assert.equal(store.take(offer.id, 'owner'), null);
});

test('assistantDependencies.invoke fails fast when ASSISTANT_ACTION_KEY is missing for write actions', async () => {
  const deps = assistantDependencies({ ASSISTANT_ACTION_KEY: '' });
  await assert.rejects(
    deps.invoke('create_ticket', { category: 'vpn', title: 'T', description: 'D' }, 'tok', 'action-1', undefined, 'owner'),
    /Missing ASSISTANT_ACTION_KEY/,
  );
});

test('finishTurn saves without a user JWT and retries a transient failure with identical proof', async t => {
  const calls = [];
  const server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    calls.push({ path: request.url, headers: request.headers, body: JSON.parse(text) });
    response.writeHead(calls.length === 1 ? 503 : 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(calls.length === 1 ? { message: 'Thử lại.' } : { status: 'complete' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const secret = 'internal-finish-test-secret-at-least-32';
  const deps = assistantDependencies({ ASSISTANT_ACTION_KEY: secret, ASSISTANT_API_URL: 'http://127.0.0.1:' + server.address().port });
  const result = { answer: 'Đã trả lời.', status: 'complete', metadata: { steps: [], sources: [] } };
  assert.deepEqual(await deps.finishTurn('session', 'turn', result, { id: 'owner' }, 'expired-user-token'), { status: 'complete' });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.path, '/internal/assistant-sessions/session/turns/turn/finish');
    assert.equal(call.headers.authorization, undefined);
    assert.deepEqual(call.body, { owner_id: 'owner', result });
    assert.equal(call.headers['x-dxdesk-assistant-proof'], createHmac('sha256', secret).update(JSON.stringify(['owner', 'finish:session:turn', result])).digest('hex'));
  }
});
