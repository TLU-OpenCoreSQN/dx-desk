// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { chromium } from 'playwright';

const env = parseEnv(await readFile(process.env.DXDESK_TEST_ENV || '.env', 'utf8'));
const base = 'http://localhost:' + env.APISIX_PORT;
const marker = 'SEN-XANH-' + Date.now();
const conversationTitle = 'Hỗ trợ VPN trên Windows 11 · ' + marker;
const question = 'Ghi nhớ mã của tôi là ' + marker + ' và tôi dùng Windows 11.';
const browser = await chromium.launch();
const report = { passed: false, checks: [] };
const pass = (name) => {
  report.checks.push(name);
  console.log('PASS ' + name);
};
await mkdir('.local/reports', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(120000);
  await page.goto(base);
  await page.getByRole('button', { name: 'Đăng nhập hệ thống (SSO)', exact: true }).click();
  await page.locator('#username').fill('employee.b');
  await page.locator('#password').fill(env.DEMO_USER_PASSWORD || 'DxDesk@2026');
  await page.locator('#kc-login').click();
  await page.getByRole('link', { name: 'Trợ lý AI', exact: true }).click();

  async function send(text) {
    const before = await page.locator('.assistant-response').count();
    await page.getByLabel('Câu hỏi hỗ trợ IT', { exact: true }).fill(text);
    const response = page.waitForResponse(
      (item) => item.url().endsWith('/api/assistant/chat') && item.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
    assert.equal((await response).status(), 200);
    await page.getByText('Trợ lý đang xử lý…', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('alert').count(), 0);
    const answer = page.locator('.assistant-response').nth(before);
    await answer.waitFor();
    return answer.innerText();
  }

  await send(question);
  const first = new URL(page.url()).searchParams.get('chat');
  assert.ok(first);
  const followup = await send('Mã nhận diện và hệ điều hành tôi vừa nói là gì?');
  assert.ok(followup.includes(marker));
  assert.match(followup, /Windows\s*11/i);
  pass('A follow-up uses the same conversation context');
  await page.reload();
  await page.locator('.assistant-response').nth(1).waitFor();
  assert.equal(await page.locator('.assistant-response').count(), 2);
  assert.ok((await send('Nhắc lại mã nhận diện tôi đã chọn.')).includes(marker));
  pass('Reload preserves history and the model continues from the saved context');

  await page.getByRole('button', { name: 'Đổi tên ' + question.slice(0, 80), exact: true }).click();
  await page.getByLabel('Tên cuộc trò chuyện', { exact: true }).fill(conversationTitle);
  await page.getByRole('button', { name: 'Lưu tên cuộc trò chuyện', exact: true }).click();
  await page.getByRole('button', { name: conversationTitle, exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: conversationTitle, exact: true }).waitFor();
  pass('Rename is persisted across reload');

  await page.getByRole('button', { name: 'Cuộc trò chuyện mới', exact: true }).click();
  await page.getByRole('heading', { name: 'Bạn cần hỗ trợ việc gì?', exact: true }).waitFor();
  const isolation = 'Nếu tôi chưa cung cấp mã nhận diện ở cuộc trò chuyện này, hãy trả lời CHƯA CÓ.';
  const fresh = await send(isolation);
  assert.ok(!fresh.includes(marker));
  assert.match(fresh, /CHƯA CÓ/i);
  const second = new URL(page.url()).searchParams.get('chat');
  assert.notEqual(first, second);
  pass('New conversations have separate model context');

  await page.getByRole('button', { name: 'Xóa ' + isolation.slice(0, 80), exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xóa cuộc trò chuyện', exact: true }).click();
  await page.getByRole('heading', { name: 'Bạn cần hỗ trợ việc gì?', exact: true }).waitFor();
  await page.getByRole('button', { name: conversationTitle, exact: true }).click();
  await page.locator('.assistant-response').nth(2).waitFor();
  pass('Delete removes the selected conversation and preserves other conversations');

  for (const username of ['employee.a', 'agent.1']) {
    const auth = await fetch(
      env.KEYCLOAK_PUBLIC_URL + '/realms/' + env.KEYCLOAK_REALM + '/protocol/openid-connect/token',
      {
        method: 'POST',
        body: new URLSearchParams({
          client_id: 'dxdesk-web',
          grant_type: 'password',
          username,
          password: env.DEMO_USER_PASSWORD || 'DxDesk@2026',
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    assert.equal(auth.status, 200);
    const { access_token } = await auth.json();
    const forbidden = await fetch(base + '/api/assistant-sessions/' + first, {
      headers: { Authorization: 'Bearer ' + access_token },
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(forbidden.status, 404);
  }
  pass('Employee and Agent accounts cannot read another user’s conversation');

  await page.screenshot({ path: '.local/reports/assistant-conversations-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mở lịch sử hội thoại', exact: true }).click();
  const history = page.getByRole('complementary', { name: 'Lịch sử hội thoại' });
  await history.getByRole('button', { name: conversationTitle, exact: true }).waitFor();
  await history.getByRole('button', { name: 'Đóng lịch sử hội thoại', exact: true }).click();
  await page.screenshot({ path: '.local/reports/assistant-conversations-mobile.png' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  pass('Mobile history drawer works without horizontal page overflow');
  report.session_id = first;
  report.passed = true;
} finally {
  await browser.close();
  await writeFile('.local/reports/assistant-conversations.json', JSON.stringify(report, null, 2));
}
