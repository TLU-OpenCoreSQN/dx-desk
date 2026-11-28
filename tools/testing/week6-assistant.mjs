// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { chromium } from 'playwright';

const env = parseEnv(await readFile(process.env.DXDESK_TEST_ENV || '.env', 'utf8'));
const base = 'http://localhost:' + env.APISIX_PORT;
const mattermost = 'http://localhost:' + env.MATTERMOST_PORT;
const unique = 'W6-' + Date.now();
const browser = await chromium.launch();
const pass = message => console.log('PASS ' + message);

async function login(username) {
  const page = await browser.newPage();
  page.setDefaultTimeout(95000);
  await page.goto(base);
  await page.getByRole('button', { name: 'Đăng nhập hệ thống (SSO)', exact: true }).click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(env.DEMO_USER_PASSWORD || 'DxDesk@2026');
  await page.locator('#kc-login').click();
  await page.getByRole('button', { name: /Đăng xuất/ }).waitFor();
  return page;
}

async function question(page, text) {
  await page.getByLabel('Câu hỏi hỗ trợ IT').fill(text);
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
}

async function confirm(page) {
  const response = page.waitForResponse(item => item.url().endsWith('/api/assistant/confirm') && item.request().method() === 'POST');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  const completed = await response;
  assert.equal(completed.status(), 200, await completed.text());
  return completed.json();
}

async function eventually(read, description, duration = 90000) {
  const until = Date.now() + duration;
  while (Date.now() < until) {
    if (await read()) return;
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  throw new Error('Timed out: ' + description);
}

try {
  const employee = await login('employee.a');
  await employee.getByRole('link', { name: 'Trợ lý AI' }).click();
  const prompt = 'Tôi không kết nối được VPN khi làm từ xa, phải làm gì?';
  const stream = employee.waitForResponse(response => response.url().endsWith('/api/assistant/chat') && response.status() === 200);
  await question(employee, prompt);
  const source = employee.getByRole('list', { name: 'Bài Wiki tham chiếu' }).first().getByRole('link').first();
  await source.waitFor();
  assert.match(await source.getAttribute('href'), /\/en\/ho-tro\/vpn$/);
  const answer = employee.locator('.assistant-response').first();
  await answer.waitFor();
  await employee.getByRole('button', { name: 'Dừng trả lời', exact: true }).waitFor({ state: 'hidden' });
  assert.match((await stream).headers()['content-type'], /^application\/x-ndjson/);
  assert.ok((await answer.textContent())?.trim().length > 20);
  assert.equal(await employee.getByRole('alert').count(), 0);
  await employee.getByText('Các bước xử lý', { exact: true }).first().click();
  await employee.getByRole('list', { name: 'Các bước gọi công cụ' }).getByText('Đang tìm bài Wiki liên quan').waitFor();
  pass('Employee obtains a streamed answer and a link to the Wiki VPN article');

  await question(employee, `Tôi đã thử hướng dẫn nhưng vẫn không kết nối được VPN. ${unique}`);
  await employee.getByRole('heading', { name: 'Tạo phiếu', exact: true }).waitFor();
  await employee.getByRole('button', { name: 'Hủy đề xuất' }).click();
  await employee.getByText('Đã hủy đề xuất.').waitFor();
  await question(employee, `Tạo phiếu VPN vì lỗi xác thực vẫn tiếp diễn. ${unique}`);
  await employee.getByRole('heading', { name: 'Tạo phiếu', exact: true }).waitFor();
  const created = await confirm(employee);
  assert.ok(created.result.ticket_id);
  await employee.getByRole('link', { name: 'Xem phiếu vừa tạo' }).click();
  await employee.getByText(/AI \(employee.a\)/).waitFor();
  pass('Cancel and confirm are separate; confirmed ticket is linked and records AI provenance');

  const manager = await login('manager.1');
  await manager.getByRole('link', { name: 'Trợ lý AI' }).click();
  await question(manager, 'Tại sao ticket VPN tăng mạnh tuần này?');
  await manager.getByText(/tuần này \d+, tuần trước \d+/).first().waitFor();
  await manager.getByText('Các bước xử lý', { exact: true }).first().click();
  await manager.getByRole('list', { name: 'Các bước gọi công cụ' }).getByText('Thống kê phiếu').waitFor();
  await manager.getByRole('heading', { name: 'Tạo công việc', exact: true }).waitFor();
  const task = (await confirm(manager)).result;
  assert.equal(task.ticket_id, null);
  assert.ok(task.id);
  const channels = JSON.parse(env.MATTERMOST_TEAM_CHANNELS);
  await eventually(async () => {
    const posts = await fetch(mattermost + '/api/v4/channels/' + channels.default + '/posts?per_page=60', {
      headers: { Authorization: 'Bearer ' + env.MATTERMOST_BOT_TOKEN }, signal: AbortSignal.timeout(10000),
    });
    assert.equal(posts.status, 200);
    return Object.values((await posts.json()).posts).some(post => post.message.includes(task.id));
  }, 'Mattermost task notice');
  pass('Manager gets weekly figures, confirms a task and receives its Mattermost notification');

  const agent = await login('agent.1');
  await agent.goto(base + '/tickets/' + created.result.ticket_id);
  await agent.getByRole('region', { name: 'So sánh đề xuất phân loại AI' }).waitFor();
  await agent.getByRole('button', { name: 'Sửa đề xuất' }).click();
  await agent.getByLabel('Tóm tắt').fill('Phiếu báo lỗi xác thực VPN từ xa.');
  await agent.getByRole('button', { name: 'Xác nhận bản đã sửa' }).click();
  await agent.getByText('Đã xác nhận đề xuất AI.', { exact: true }).waitFor();
  await agent.getByText(/AI \(agent.1\)/).waitFor();
  pass('Agent edits and confirms AI triage, then sees the persisted audit event');
} finally {
  await browser.close();
}
