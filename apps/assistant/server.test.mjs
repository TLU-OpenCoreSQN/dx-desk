// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantServer } from './server.mjs';
import { ndjson, proposalStore } from './chat.mjs';

test('confirmation is bound to the question owner, consumes the proposal once, and forwards the exact arguments', async t => {
  const args = { category: 'vpn', title: 'Hỗ trợ VPN', description: 'VPN bị ngắt khi đăng nhập từ xa.' };
  const mutations = [];
  const server = assistantServer({
    identity: async token => ({ id: token, roles: ['Employee'] }),
    available: async () => ['create_ticket'],
    knowledge: async () => [{ title: 'VPN', url: 'https://wiki.example.test/en/ho-tro/vpn', text: 'VPN.' }],
    async *complete(_messages, definitions) {
      if (definitions.length) yield { message: { tool_calls: [
        { function: { name: 'create_ticket', arguments: { ...args, role: 'Manager' } } },
        { function: { name: 'create_ticket', arguments: args } },
      ] } };
      else yield { message: { content: 'Đã chuẩn bị đề xuất.' } };
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
