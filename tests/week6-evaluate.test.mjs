// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, sanitize, parseNdjson, collectChat, triageRequest, classifyResult, summaryFor,
  percentile, answerHash, reviewTemplate, scoreReviews, loadFixtures, preflight, runEvaluation } from '../tools/testing/week6-evaluate.mjs';

const fixtures = await loadFixtures();
const env = { WEEK6_EMPLOYEE_TOKEN: 'employee-test-secret', WEEK6_AGENT_TOKEN: 'agent-test-secret', WEEK6_MANAGER_TOKEN: 'manager-test-secret' };
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const tags = () => ({ models: [
  { name: 'qwen3:4b', digest: 'sha256:test-chat', size: 123, details: { quantization_level: 'Q4_K_M' } },
  { name: 'bge-m3:567m', digest: 'sha256:test-embedding' },
] });
const events = value => new Response(value.map(event => JSON.stringify(event)).join('\n') + '\n', {
  headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
});
const defaults = extra => ({ ...parseArgs([]), ...extra });
function mockRuntime({ chatEvents, triageInvalid = false, failTags = false, changedDigest = false } = {}) {
  const calls = [];
  let tagRequests = 0;
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const path = new URL(url).pathname;
    if (path === '/api/tags') {
      if (failTags) throw new Error('offline');
      const value = tags();
      if (changedDigest && tagRequests++ > 0) value.models[0].digest = 'sha256:changed';
      return json(value);
    }
    if (path === '/api/me') {
      const authorization = options.headers.Authorization;
      const role = Object.entries(env).find(([, token]) => authorization === 'Bearer ' + token)?.[0].split('_')[1];
      const name = { EMPLOYEE: 'Employee', AGENT: 'Agent', MANAGER: 'Manager' }[role];
      return json({ id: 'subject-' + name, roles: [name] });
    }
    if (path === '/api/assistant-tools') return json({ tools: ['ticket_statistics', 'similar_tickets', 'create_ticket'] });
    if (path === '/api/assistant/chat') return events(chatEvents ?? [
      { type: 'step', label: 'Đang tìm bài Wiki liên quan' }, { type: 'sources', items: [] },
      { type: 'delta', text: 'Câu trả lời tổng hợp giả chỉ dùng cho unit test.' }, { type: 'done' },
    ]);
    if (path === '/api/chat') {
      const payload = JSON.parse(options.body);
      const input = JSON.parse(payload.messages[1].content);
      assert.deepEqual(Object.keys(input).sort(), ['categories', 'ticket']);
      assert.deepEqual(Object.keys(input.ticket).sort(), ['description', 'title']);
      const ticket = fixtures.triage.tickets.find(value => value.title === input.ticket.title);
      return json({ model: 'qwen3:4b', done: true, eval_count: 10, eval_duration: 2e9,
        message: { content: JSON.stringify({ category: ticket.expected.category, priority: triageInvalid ? 'critical' : ticket.expected.priority }) } });
    }
    throw new Error('Unexpected endpoint: ' + path);
  };
  return { fetchImpl, calls };
}
async function* chunks(strings) {
  for (const value of strings) yield typeof value === 'string' ? Buffer.from(value) : value;
}

function scoringFixture() {
  const report = { version: 1, runId: 'test-run', operator: 'operator-A', completed: true, repeats: 3,
    requested: { assistant: true, triage: true }, provenance: { gitSha: 'a'.repeat(40), configHash: 'config-sha', model: { digest: 'model-sha' } }, results: [] };
  for (let repeat = 1; repeat <= 3; repeat++) {
    for (const q of fixtures.assistant.questions) report.results.push({ key: `assistant:${q.id}:${repeat}`, kind: 'assistant',
      caseId: q.id, group: q.group, deterministic_demo: q.deterministic_demo, repeat, answer: 'Human-reviewed synthetic answer', completed: true });
    for (const ticket of fixtures.triage.tickets) report.results.push({ key: `triage:${ticket.id}:${repeat}`, kind: 'triage',
      caseId: ticket.id, repeat, completed: true, expected: ticket.expected, classification: { ...ticket.expected, summary: summaryFor(ticket.description) } });
  }
  for (const result of report.results) result.answerHash = answerHash(result);
  const reviews = reviewTemplate(report);
  for (const review of reviews.reviews) {
    review.reviewer = 'independent-B';
    review.notes = 'Synthetic unit test review, not real model evidence.';
    if ('correct' in review) { review.correct = true; review.privacy_ok = true; review.consent_ok = true; }
    else { review.facts_ok = true; review.summary_ok = true; }
  }
  return { report, reviews };
}
function rehash(report, reviews, result) {
  result.answerHash = answerHash(result);
  reviews.reviews.find(review => review.key === result.key).answerHash = result.answerHash;
}

test('fixtures contain ten core, five extended, two fixed flows and twenty synthetic tickets', () => {
  assert.equal(fixtures.assistant.questions.filter(q => q.group === 'core').length, 10);
  assert.equal(fixtures.assistant.questions.filter(q => q.group === 'extended').length, 5);
  assert.equal(fixtures.assistant.questions.filter(q => q.deterministic_demo).length, 2);
  assert.equal(fixtures.triage.tickets.length, 20);
  assert.ok(fixtures.triage.tickets.every(t => t.facts.length && t.must_not_invent.length));
  assert.ok(fixtures.triage.tickets.some(t => t.description.length > 420));
  assert.equal(fixtures.triage.categories.some(c => c.code === 'email'), false);
});

test('category names/descriptions and routing match actual seed migrations, not invented email mapping', async () => {
  const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
  const sql = (await read('db/migrations/002_reference_data.sql')) + (await read('db/migrations/003_ticket_workflow.sql'));
  const teamsSql = await read('db/migrations/009_teams_routing_claim.sql');
  const rows = [...sql.matchAll(/\('([0-9a-f-]{36})',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g)];
  for (const category of fixtures.triage.categories) {
    const row = rows.find(value => value[2] === category.code);
    assert.ok(row, category.code);
    assert.equal(row[3], category.name);
    assert.equal(row[4], category.description);
    assert.ok(sql.includes(`('${row[1]}', '${category.team_name}')`));
    assert.ok(teamsSql.includes(`'${category.team}','${category.team_name}'`));
  }
});

test('actual API classification prompt/options match standalone request', async () => {
  const source = await readFile(new URL('../apps/api/src/ticket-ai-suggestion.ts', import.meta.url), 'utf8');
  const payload = triageRequest(fixtures.triage.tickets[0], fixtures.triage.categories, 'qwen3:4b');
  assert.ok(source.includes(payload.messages[0].content));
  assert.ok(source.includes('temperature: 0, num_predict: 120'));
  assert.equal(payload.stream, false);
  assert.equal(payload.think, false);
  assert.equal(payload.format.additionalProperties, false);
  assert.deepEqual(payload.format.properties.priority.enum, ['low', 'normal', 'high']);
  assert.equal(JSON.parse(payload.messages[1].content).ticket.description, fixtures.triage.tickets[0].description);
  assert.deepEqual(payload.format.properties.category.enum, fixtures.triage.categories.map(category => category.code).sort());
  assert.deepEqual(JSON.parse(payload.messages[1].content).categories.map(category => category.code), payload.format.properties.category.enum);
});

test('CLI is opt-in, rejects unsafe/unknown/apply arguments, role/model mismatch and too few repetitions', () => {
  assert.equal(parseArgs([]).runAssistant, undefined);
  for (const args of [['--apply'], ['--model'], ['--repeats', '2'], ['--warmup', '-1'], ['--repeats', '3.1'],
    ['--gateway', 'http://user:secret@localhost'], ['--ollama', 'http://localhost/?token=x'],
    ['--gateway', 'file:///tmp'], ['--output', 'relative.json'], ['--reviews', '/tmp/reviews.json'],
    ['--score', '/tmp/run.json'], ['--model', 'a', '--model', 'b'], ['--run-assistant'],
    ['--run-assistant', '--operator', 'a', '--profile', 'full', '--data-version', 'v1', '--gateway-model', 'wrong']]) {
    assert.throws(() => parseArgs(args), args.join(' '));
  }
  assert.equal(parseArgs(['--help']).help, true);
});

test('NDJSON supports CRLF, arbitrary UTF-8 fragmentation and unterminated last line', async () => {
  const data = Buffer.from('{"type":"delta","text":"Tiếng Việt"}\r\n\n{"type":"done"}');
  const parsed = [];
  for await (const event of parseNdjson(chunks([...data].map(byte => Uint8Array.of(byte))))) parsed.push(event);
  assert.deepEqual(parsed, [{ type: 'delta', text: 'Tiếng Việt' }, { type: 'done' }]);
});

test('NDJSON rejects oversized complete lines, malformed JSON and invalid UTF-8', async () => {
  async function consume(body, max) { for await (const _event of parseNdjson(body, max)) { /* consume */ } }
  await assert.rejects(consume(chunks(['{"text":"too big"}\n']), 8), /limit/);
  await assert.rejects(consume(chunks(['{broken}\n'])), SyntaxError);
  await assert.rejects(consume(chunks([Uint8Array.of(0xff)])));
  await assert.rejects(consume(null), /Missing/);
});

test('TTFT is the first visible non-whitespace delta, not metadata or first event', async () => {
  const times = [20, 30, 40, 150, 170, 200];
  const body = chunks([
    '{"type":"step","label":"search"}\n', '{"type":"sources","items":[]}\n',
    '{"type":"delta","text":" \\n"}\n', '{"type":"delta","text":"Xin chào"}\n', '{"type":"done"}\n',
  ]);
  const result = await collectChat(body, { started: 0, clock: () => times.shift() });
  assert.equal(result.completed, true);
  assert.equal(result.firstEventMs, 20);
  assert.equal(result.ttftMs, 150);
  assert.equal(result.latencyMs, 200);
  assert.equal(result.answer, ' \nXin chào');
  assert.equal(result.tokensPerSecond, null);
});

test('truncated stream, explicit error, malformed events and no-visible-answer never pass', async () => {
  const variants = [
    [{ type: 'delta', text: 'partial' }],
    [{ type: 'delta', text: 'partial' }, { type: 'error', message: 'offline' }],
    [{ type: 'done' }], [{ type: 'delta', text: ' ' }, { type: 'done' }],
    [{ type: 'delta', text: 3 }, { type: 'done' }],
    [{ type: 'delta', text: 'x' }, { type: 'done' }, { type: 'delta', text: 'late' }],
  ];
  for (const values of variants) {
    const result = await collectChat(chunks(values.map(value => JSON.stringify(value) + '\n')));
    assert.equal(result.completed, false);
    assert.ok(result.error);
  }
});

test('stream abort preserves partial answer but reports incomplete deadline', async () => {
  async function* aborted() {
    yield Buffer.from('{"type":"delta","text":"Một phần"}\n');
    throw new DOMException('aborted', 'AbortError');
  }
  const result = await collectChat(aborted());
  assert.equal(result.completed, false);
  assert.equal(result.answer, 'Một phần');
  assert.equal(result.error, 'Request deadline exceeded');
});

test('classification checks full completion, schema, category and priority; team is routing-derived', () => {
  const ticket = fixtures.triage.tickets[0];
  const valid = { done: true, message: { content: '{"category":"vpn","priority":"high"}' } };
  assert.deepEqual(classifyResult(valid, ticket, fixtures.triage.categories), {
    category: 'vpn', team: 'network', priority: 'high', summary: summaryFor(ticket.description),
  });
  for (const raw of [{ ...valid, done: false }, { ...valid, error: 'offline' }, { done: true },
    { done: true, message: { content: '{"category":"email","priority":"normal"}' } },
    { done: true, message: { content: '{"category":"vpn","priority":"critical"}' } },
    { done: true, message: { content: '{"category":"vpn","priority":"normal","summary":"invented"}' } }]) {
    assert.throws(() => classifyResult(raw, ticket, fixtures.triage.categories));
  }
});

test('summary mirrors API normalization/truncation and is not advertised as semantic summarization', () => {
  assert.equal(summaryFor('  Chưa\n\tđược duyệt.  '), 'Chưa được duyệt.');
  assert.equal(summaryFor('a'.repeat(420)), 'a'.repeat(420));
  assert.equal(summaryFor('a'.repeat(421)), 'a'.repeat(419) + '…');
  assert.ok(fixtures.triage.scope.includes('not model summarization'));
});

test('sanitization removes exact caller tokens, JWTs, Bearer values and sensitive object keys', () => {
  const value = sanitize({ answer: 'secret-A Bearer secret-B eyJabc.defghi.jklm', password: 'private',
    nested: [{ Authorization: 'Bearer hidden', token: 'hidden' }] }, ['secret-A']);
  const text = JSON.stringify(value);
  for (const secret of ['secret-A', 'secret-B', 'eyJabc.defghi.jklm', 'private', 'hidden']) assert.equal(text.includes(secret), false);
});

test('percentile uses nearest rank and does not manufacture missing timing', () => {
  assert.equal(percentile([]), null);
  assert.equal(percentile([null, NaN, 1, 2, 3, 4, 100]), 100);
});

test('preflight only performs GETs; validates real role tokens and model digest', async () => {
  const mock = mockRuntime();
  const result = await preflight(defaults(), env, mock.fetchImpl);
  assert.equal(result.completed, true);
  assert.equal(result.model.digest, 'sha256:test-chat');
  assert.equal(result.embedding.digest, 'sha256:test-embedding');
  assert.ok(mock.calls.every(call => !call.options.method || call.options.method === 'GET'));
  assert.equal(JSON.stringify(result).includes('employee-test-secret'), false);
});

test('preflight missing services/tokens/model never claims readiness or generates', async () => {
  const mock = mockRuntime({ failTags: true });
  const report = await runEvaluation(defaults(), { env: {}, fetchImpl: mock.fetchImpl });
  assert.equal(report.completed, false);
  assert.equal(report.evaluationCompleted, false);
  assert.equal(report.results.length, 0);
  assert.equal(mock.calls.some(call => call.options.method === 'POST'), false);
});

test('preflight refuses elevated employee identity and missing model digest', async () => {
  const mock = mockRuntime();
  const fetchImpl = async (url, options) => {
    if (String(url).endsWith('/api/me')) return json({ id: 'shared', roles: ['Employee', 'Agent', 'Manager'] });
    if (String(url).endsWith('/api/tags')) return json({ models: [{ name: 'qwen3:4b' }] });
    return mock.fetchImpl(url, options);
  };
  const result = await preflight(defaults(), env, fetchImpl);
  assert.equal(result.completed, false);
  assert.ok(result.services.some(service => service.service === 'apisix-Employee' && !service.available));
});

test('triage execution is classification-only, three passes, actual HTTP payload, no API/DB writes', async () => {
  const mock = mockRuntime();
  const report = await runEvaluation(defaults({ runTriage: true, operator: 'A', profile: 'full', dataVersion: 'synthetic-v1' }), { env, fetchImpl: mock.fetchImpl });
  assert.equal(report.completed, true);
  assert.equal(report.results.length, 60);
  assert.equal(report.warmups.length, 1);
  assert.ok(report.results.every(result => result.ttftMs === null && result.tokensPerSecond === 5));
  assert.ok(mock.calls.every(call => ['/api/tags', '/api/chat'].includes(new URL(call.url).pathname)));
  assert.ok(report.provenance.gitSha);
  assert.match(report.provenance.configHash, /^[a-f0-9]{64}$/);
  assert.ok(report.resources.host.samples.length >= 2);
  assert.equal(report.resources.containerPeakBytes, null);
  assert.equal(report.qualityReviewed, false);
  assert.ok(report.reviewTemplate.reviews.every(review => review.facts_ok === null));
});

test('assistant execution uses APISIX with caller tokens, exposes raw answers/trace, never confirms proposals', async () => {
  const mock = mockRuntime({ chatEvents: [
    { type: 'step', label: 'Tạo phiếu' }, { type: 'delta', text: 'Chờ xác nhận' },
    { type: 'proposal', id: 'pending-id', label: 'Tạo phiếu', fields: { category: 'vpn' } }, { type: 'done' },
  ] });
  const report = await runEvaluation(defaults({ runAssistant: true, gatewayModel: 'qwen3:4b', operator: 'A', profile: 'full', dataVersion: 'v1' }), { env, fetchImpl: mock.fetchImpl });
  assert.equal(report.completed, true);
  assert.equal(report.results.length, 45);
  assert.equal(report.provenance.gatewayModel.verifiedByProtocol, false);
  assert.ok(report.results.every(result => result.answer === 'Chờ xác nhận' && result.proposals.length === 1 && result.toolTrace.length === 1));
  assert.ok(mock.calls.filter(call => call.options.method === 'POST').every(call => new URL(call.url).pathname === '/api/assistant/chat'));
  const employee = mock.calls.find(call => call.options.body && JSON.parse(call.options.body).question === fixtures.assistant.questions[0].question);
  assert.equal(employee.options.headers.Authorization, 'Bearer ' + env.WEEK6_EMPLOYEE_TOKEN);
  assert.deepEqual(Object.keys(JSON.parse(employee.options.body)), ['question']);
  assert.ok(report.results.every(result => result.answerHash === answerHash(result)));
});

test('runtime stream and classification failures produce completed:false with preserved evidence', async () => {
  const mock = mockRuntime({ chatEvents: [{ type: 'delta', text: 'partial' }, { type: 'error', message: 'offline' }], triageInvalid: true });
  const report = await runEvaluation(defaults({ runAssistant: true, runTriage: true, gatewayModel: 'qwen3:4b' }), { env, fetchImpl: mock.fetchImpl });
  assert.equal(report.completed, false);
  assert.ok(report.results.every(result => !result.completed && result.error));
  assert.equal(report.results[0].answer, 'partial');
});

test('credential leaks are redacted but leave an automatic privacy fail signal', async () => {
  const mock = mockRuntime({ chatEvents: [{ type: 'delta', text: 'Leaked ' + env.WEEK6_EMPLOYEE_TOKEN }, { type: 'done' }] });
  const report = await runEvaluation(defaults({ runAssistant: true, gatewayModel: 'qwen3:4b' }), { env, fetchImpl: mock.fetchImpl });
  assert.equal(JSON.stringify(report).includes(env.WEEK6_EMPLOYEE_TOKEN), false);
  assert.equal(report.results[0].sensitiveOutputDetected, true);
  assert.equal(report.completed, false);
  assert.equal(report.security.detectedCredentialLeak, true);
  assert.equal(scoreReviews(report, reviewTemplate(report)).privacyFailure, true);
});

test('whole-request deadline also aborts a body stalled after successful headers', async () => {
  const mock = mockRuntime();
  let stalled = false, abortObserved = false;
  const fetchImpl = async (url, options) => {
    if (String(url).endsWith('/api/assistant/chat') && !stalled) {
      stalled = true;
      return new Response(new ReadableStream({ start(controller) {
        // Keep one referenced handle so this synthetic stream behaves like a live socket.
        const handle = setTimeout(() => controller.close(), 2000);
        options.signal.addEventListener('abort', () => {
          abortObserved = true;
          clearTimeout(handle);
          controller.error(options.signal.reason);
        }, { once: true });
      } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
    }
    return mock.fetchImpl(url, options);
  };
  const report = await runEvaluation(defaults({ runAssistant: true, gatewayModel: 'qwen3:4b', timeoutMs: 25 }), { env, fetchImpl });
  assert.equal(abortObserved, true);
  assert.equal(report.completed, false);
  assert.equal(report.warmups[0].error, 'Request deadline exceeded');
  assert.equal(report.warmups[0].ttftMs, null);
  assert.ok(report.warmups[0].latencyMs >= 15);
  assert.ok(report.results.every(result => result.completed));
});

test('embedding digest changes are not silently accepted on assistant acquisition', async () => {
  const mock = mockRuntime();
  let count = 0;
  const fetchImpl = async (url, options) => {
    if (String(url).endsWith('/api/tags')) {
      const value = tags();
      if (count++ > 0) value.models[1].digest = 'changed-embedding';
      return json(value);
    }
    return mock.fetchImpl(url, options);
  };
  const report = await runEvaluation(defaults({ runAssistant: true, gatewayModel: 'qwen3:4b' }), { env, fetchImpl });
  assert.equal(report.completed, false);
  assert.ok(report.errors.some(error => error.includes('changed')));
});

test('digest changed during generation makes acquisition incomplete', async () => {
  const mock = mockRuntime({ changedDigest: true });
  const report = await runEvaluation(defaults({ runTriage: true }), { env, fetchImpl: mock.fetchImpl });
  assert.equal(report.completed, false);
  assert.ok(report.errors.some(error => error.includes('changed')));
});

test('no reviewed answers means no correctness/no-hallucination pass', () => {
  const { report } = scoringFixture();
  const score = scoreReviews(report, reviewTemplate(report));
  assert.equal(score.completed, false);
  assert.equal(score.passed, false);
  assert.equal(score.rounds[0].triage.factsReviewedOk, 0);
  assert.equal(score.rounds[0].assistant.core.correct, 0);
});

test('reviewed score keeps 10 model-core answers separate from 2 fixed flows and 5 extended', () => {
  const { report, reviews } = scoringFixture();
  const score = scoreReviews(report, reviews);
  assert.equal(score.completed, true);
  assert.equal(score.passed, true);
  assert.equal(score.fullAcceptance, false);
  assert.deepEqual(score.rounds[0].assistant.core, { correct: 10, total: 10, threshold: 8 });
  assert.equal(score.rounds[0].assistant.generalizedCore.total, 10);
  assert.equal(score.rounds[0].assistant.generalizedCore.acceptanceThreshold, 8);
  assert.equal(score.rounds[0].assistant.deterministicFlow.total, 2);
  assert.equal(score.rounds[0].assistant.extended.total, 5);
});

test('core threshold is 8/10 per pass, not 8/15 or pooled over repetitions', () => {
  const { report, reviews } = scoringFixture();
  const core = report.results.filter(result => result.kind === 'assistant' && result.group === 'core' && result.repeat === 1);
  for (const result of core.slice(0, 2)) reviews.reviews.find(review => review.key === result.key).correct = false;
  assert.equal(scoreReviews(report, reviews).passed, true);
  reviews.reviews.find(review => review.key === core[2].key).correct = false;
  assert.equal(scoreReviews(report, reviews).passed, false);
  assert.equal(scoreReviews(report, reviews).rounds[0].assistant.core.correct, 7);
});

test('two passing fixed VPN flows cannot rescue fewer than eight model-core answers', () => {
  const { report, reviews } = scoringFixture();
  for (const repeat of [1, 2, 3]) {
    const core = report.results.filter(result => result.kind === 'assistant' && result.group === 'core' && result.repeat === repeat);
    assert.ok(core.every(result => !result.deterministic_demo));
    for (const result of core.slice(0, 4)) reviews.reviews.find(review => review.key === result.key).correct = false;
  }
  const score = scoreReviews(report, reviews);
  assert.equal(score.completed, true);
  assert.equal(score.passed, false);
  assert.equal(score.rounds[0].assistant.core.correct, 6);
  assert.equal(score.rounds[0].assistant.deterministicFlow.correct, 2);
});

test('triage threshold is category 16/20, team/priority separate and facts never auto-marked', () => {
  const { report, reviews } = scoringFixture();
  const triage = report.results.filter(result => result.kind === 'triage' && result.repeat === 1);
  for (const result of triage.slice(0, 4)) {
    result.classification.category = 'wrong';
    rehash(report, reviews, result);
  }
  assert.equal(scoreReviews(report, reviews).passed, true);
  triage[4].classification.category = 'wrong';
  rehash(report, reviews, triage[4]);
  const score = scoreReviews(report, reviews);
  assert.equal(score.passed, false);
  assert.equal(score.rounds[0].triage.category.correct, 15);
  assert.equal(score.rounds[0].triage.priority.correct, 20);
});

test('any privacy/consent failure gates even perfect core and category scores', () => {
  for (const field of ['privacy_ok', 'consent_ok']) {
    const { report, reviews } = scoringFixture();
    reviews.reviews.find(review => review.key === 'assistant:extended-05:3')[field] = false;
    const score = scoreReviews(report, reviews);
    assert.equal(score.completed, true);
    assert.equal(score.passed, false);
  }
});

test('one hallucinated fact or lossy summary fails triage quality despite 20 category matches', () => {
  for (const field of ['facts_ok', 'summary_ok']) {
    const { report, reviews } = scoringFixture();
    reviews.reviews.find(review => review.key === 'triage:triage-12:1')[field] = false;
    const score = scoreReviews(report, reviews);
    assert.equal(score.passed, false);
    assert.equal(score.rounds[0].triage.category.correct, 20);
  }
});

test('reject self-review, stale hashes, duplicate reviews, missing case and incomplete runtime', () => {
  const changes = [
    ({ report, reviews }) => { reviews.reviews[0].reviewer = report.operator; },
    ({ reviews }) => { reviews.reviews[0].answerHash = 'stale'; },
    ({ reviews }) => { reviews.reviews.push(reviews.reviews[0]); },
    ({ report }) => { report.results.pop(); },
    ({ report }) => { report.completed = false; },
    ({ report }) => { report.results[0].answer = 'changed after review'; },
    ({ report }) => { report.provenance.model.digest = null; },
  ];
  for (const change of changes) {
    const data = scoringFixture();
    change(data);
    const score = scoreReviews(data.report, data.reviews);
    assert.equal(score.completed, false);
    assert.equal(score.passed, false);
  }
});

test('CLI help has no network and absent runtime exits nonzero with a useful sanitized report', () => {
  const cli = fileURLToPath(new URL('../tools/testing/week6-evaluate.mjs', import.meta.url));
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.ok(help.stdout.includes('No apply mode'));
  const result = spawnSync(process.execPath, [cli, '--ollama', 'http://127.0.0.1:1', '--gateway', 'http://127.0.0.1:1', '--timeout-ms', '50'], {
    encoding: 'utf8', env: { ...process.env, ...env }, timeout: 10000,
  });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.completed, false);
  assert.equal(report.evaluationCompleted, false);
  assert.ok(report.preflight.services.some(service => !service.available));
  assert.equal(result.stdout.includes(env.WEEK6_EMPLOYEE_TOKEN), false);
});
