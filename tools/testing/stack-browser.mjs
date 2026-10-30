// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Real browser -> APISIX -> Keycloak PKCE/TOTP -> API -> clamd/Filer.
// Creates and deletes its own OTP user; never modifies existing users or MFA.
import { chromium } from 'playwright';
import { createHmac, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = {...parseEnv(await readFile(resolve(root,'.env'),'utf8')), ...process.env};
const origin = `http://localhost:${env.APISIX_PORT}`;
const kc = env.KEYCLOAK_PUBLIC_URL;
const realm = env.KEYCLOAK_REALM;
const reports = resolve(root,'.local/reports'); await mkdir(reports,{recursive:true});
const report = {scope:'Real browser, Keycloak PKCE + TOTP, APISIX, API, ClamAV, SeaweedFS',checks:[],passed:false};
const username = 'w3-otp-' + randomBytes(6).toString('hex');
const password = randomBytes(24).toString('base64url') + '@Aa1';
let browser, userId, adminToken, secret, ticketId;
async function check(name, operation) {
  try { await operation(); report.checks.push({name,passed:true}); console.log('PASS '+name); }
  catch(error) { report.checks.push({name,passed:false,error:error.message}); throw error; }
}
async function admin(path, method='GET', body) {
  const response = await fetch(`${kc}/admin/realms/${realm}${path}`, {method,
    headers:{Authorization:`Bearer ${adminToken}`,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  assert.ok(response.ok, `Keycloak admin ${method} ${path} -> ${response.status}`);
  return response.status===204 ? null : response;
}
function totp(base32, offset=0) {
  let bits=''; for(const char of base32.toUpperCase().replace(/[\s=]/g,'')) {
    const n='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char); assert.ok(n>=0); bits+=n.toString(2).padStart(5,'0');
  }
  const bytes=Buffer.from(bits.match(/.{8}/g).map(chunk=>parseInt(chunk,2)));
  const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)+offset));
  const hash=createHmac('sha1',bytes).update(counter).digest(); const index=hash[19]&15;
  return String((hash.readUInt32BE(index)&0x7fffffff)%1000000).padStart(6,'0');
}
async function beginLogin(page, user=username, pass=password) {
  await page.goto(origin);
  await page.getByRole('button',{name:'Đăng nhập hệ thống (SSO)',exact:true}).click();
  await page.locator('#username').fill(user); await page.locator('#password').fill(pass);
  await page.locator('#kc-login').click();
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');
try {
  const tokenResponse=await fetch(`${kc}/realms/master/protocol/openid-connect/token`,{method:'POST',
    body:new URLSearchParams({client_id:'admin-cli',grant_type:'password',username:env.KEYCLOAK_ADMIN,password:env.KEYCLOAK_ADMIN_PASSWORD}),
    signal:AbortSignal.timeout(30000)});
  assert.equal(tokenResponse.status,200); adminToken=(await tokenResponse.json()).access_token;
  const response=await admin('/users','POST',{username,firstName:'Acceptance',lastName:'OTP',email:`${username}@dxdesk.local`,
    emailVerified:true,enabled:true,requiredActions:['CONFIGURE_TOTP'],credentials:[{type:'password',value:password,temporary:false}]});
  userId=response.headers.get('location').split('/').pop();
  const role=await (await admin('/roles/Employee')).json();
  await admin(`/users/${userId}/role-mappings/realm`,'POST',[role]);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page=await context.newPage(); page.setDefaultTimeout(30000);
  const pageErrors=[]; page.on('pageerror',error=>pageErrors.push(error.message));
  let pkceSeen=false;
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.pathname.endsWith('/protocol/openid-connect/auth') && url.searchParams.get('code_challenge_method')==='S256'
      && url.searchParams.get('code_challenge')) pkceSeen=true;
  });
  await check('PKCE browser enrollment requires TOTP and accepts a valid generated code',async()=>{
    await beginLogin(page);
    assert.match(page.url(),/code_challenge_method=S256|login-actions/);
    await page.locator('#mode-manual').click();
    secret=await page.locator('#kc-totp-secret-key').innerText();
    await page.locator('#totp').fill(totp(secret)); await page.locator('#userLabel').fill('CI acceptance device');
    await page.locator('#saveTOTPBtn').click();
    await page.waitForURL(origin+'/**');
    await page.getByRole('button',{name:/Đăng xuất/}).waitFor();
    const credentials=await (await admin(`/users/${userId}/credentials`)).json();
    assert.ok(credentials.some(item=>item.type==='otp'));
    assert.equal(pkceSeen,true,'authorization code request must use PKCE S256');
  });
  await check('browser creates a VPN ticket with a scanned image and downloads exact bytes by signed URL',async()=>{
    await page.goto(origin+'/tickets/new');
    await page.locator('#ticket-category').selectOption('10000000-0000-4000-8000-000000000001');
    await page.locator('#requirement-client_version').fill('OpenVPN Connect 4.2');
    await page.locator('#requirement-error_message').fill('Connection timeout');
    await page.locator('#ticket-title').fill('W3 real browser OTP VPN '+Date.now());
    await page.locator('#ticket-description').fill('Browser acceptance: VPN image uploaded through APISIX and scanned by real ClamAV.');
    await page.locator('#ticket-attachment').setInputFiles({name:'vpn.png',mimeType:'image/png',buffer:png});
    await page.getByRole('button',{name:/Gửi phiếu hỗ trợ/}).click();
    await page.getByText(/đã được quét và lưu an toàn/).waitFor();
    await page.getByRole('button',{name:'Xem chi tiết phiếu'}).click();
    await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/); ticketId=page.url().split('/').pop(); report.ticket_id=ticketId;
    await page.getByText('Đã tiếp nhận phiếu',{exact:true}).waitFor();
    await page.getByText('OpenVPN Connect 4.2',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Lấy liên kết tải vpn.png'}).click();
    const link=page.getByRole('link',{name:'Tải vpn.png'}); await link.waitFor();
    const href=await link.getAttribute('href');
    const downloaded=await context.request.get(origin+href);
    assert.equal(downloaded.status(),200); assert.deepEqual(await downloaded.body(),png);
    const tampered=href.replace(/signature=[a-f0-9]+/,'signature='+'0'.repeat(64));
    assert.equal((await context.request.get(origin+tampered)).status(),403);
    await page.screenshot({path:resolve(reports,'week3-ticket-browser.png'),fullPage:true});
  });
  await check('browser blocks EICAR without losing the existing ticket',async()=>{
    const eicar=Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    assert.equal(eicar.length,68);
    await page.getByLabel(/Bổ sung tệp/).setInputFiles({name:'eicar.txt',mimeType:'text/plain',buffer:eicar});
    await page.getByRole('button',{name:'Tải tệp lên phiếu này'}).click();
    await page.getByText(/Tệp đính kèm bị đánh dấu mã độc/).waitFor();
    assert.equal(page.url(),origin+'/tickets/'+ticketId);
    await page.getByRole('button',{name:'Làm mới danh sách tệp'}).click();
    await page.getByText('Bị chặn: mã độc',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:/Lấy liên kết tải eicar/}).count(),0);
  });
  await check('Agent and requester complete workflow in the real browser with a resolution timeline',async()=>{
    const staffContext=await browser.newContext(); const staff=await staffContext.newPage(); staff.setDefaultTimeout(30000);
    try {
      await beginLogin(staff,'agent.1',env.DEMO_USER_PASSWORD??'DxDesk@2026');
      await staff.waitForURL(origin+'/**'); await staff.goto(origin+'/tickets/'+ticketId);
      async function transition(target,label,result) {
        await target.getByRole('button',{name:label,exact:true}).click();
        if(result) await target.locator('#transition-resolution-note').fill(result);
        const complete=target.waitForResponse(response=>response.url().endsWith('/status') && response.request().method()==='PATCH');
        await target.getByRole('button',{name:'Xác nhận chuyển trạng thái',exact:true}).click();
        assert.equal((await complete).status(),200);
        await target.getByRole('button',{name:'Xác nhận chuyển trạng thái',exact:true}).waitFor({state:'detached'});
      }
      for(const label of ['Phân loại phiếu','Phân công xử lý','Bắt đầu xử lý','Chờ người dùng phản hồi']) await transition(staff,label);
      await page.reload(); await transition(page,'Phản hồi, tiếp tục xử lý');
      await staff.reload(); await staff.getByRole('button',{name:'Đánh dấu đã giải quyết',exact:true}).click();
      assert.equal(await staff.getByRole('button',{name:'Xác nhận chuyển trạng thái',exact:true}).isDisabled(),true);
      await staff.getByRole('button',{name:'Hủy bỏ',exact:true}).click();
      await transition(staff,'Đánh dấu đã giải quyết','Đã cấu hình lại VPN và kiểm tra kết nối thành công.');
      await page.reload(); await transition(page,'Xác nhận đã hài lòng, đóng phiếu');
      await page.getByText('Chuyển từ Đã giải quyết sang Đã đóng',{exact:true}).waitFor();
      await page.getByRole('region',{name:'Kết quả xử lý'}).getByText('Đã cấu hình lại VPN và kiểm tra kết nối thành công.').waitFor();
    } finally { await staffContext.close(); }
  });
  await check('fresh browser rejects wrong and stale OTP, then signs in with a current code',async()=>{
    await context.close();
    const clean=await browser.newContext(); const login=await clean.newPage(); login.setDefaultTimeout(30000);
    await beginLogin(login); await login.locator('#otp').waitFor();
    const wrong=String((Number(totp(secret))+12345)%1000000).padStart(6,'0');
    async function rejectCode(code) {
      await login.locator('#otp').fill(code); await login.locator('#kc-login').click();
      assert.ok(!login.url().startsWith(origin),'invalid OTP must never authenticate');
      await login.locator('#otp').waitFor();
      // Keycloak can report an OTP rejection globally rather than per-field.
      await login.locator('#input-error-otp-code:visible, .kc-feedback-text:visible').first().waitFor();
    }
    await rejectCode(wrong);
    await rejectCode(totp(secret,-10));
    // Enrollment may consume the current TOTP. Wait for a new counter, at most 31s.
    await new Promise(r=>setTimeout(r,30000-Date.now()%30000+1000));
    await login.locator('#otp').fill(totp(secret)); await login.locator('#kc-login').click();
    await login.waitForURL(origin+'/**'); await login.getByRole('button',{name:/Đăng xuất/}).waitFor();
    await clean.close();
  });
  assert.deepEqual(pageErrors,[]); report.passed=true;
} catch(error) { console.error(error.message); process.exitCode=1; }
finally {
  await browser?.close();
  if(userId) try { await admin(`/users/${userId}`,'DELETE'); } catch { console.error('Cleanup required for acceptance user '+username); process.exitCode=1; }
  await writeFile(resolve(reports,'week3-browser.json'),JSON.stringify(report,null,2)+'\n');
}
