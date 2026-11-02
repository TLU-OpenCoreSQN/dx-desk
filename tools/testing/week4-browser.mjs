// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Real UI with real PKCE login and server-side queues. No auth/API fixtures.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const env={...parseEnv(await readFile(resolve(root,'.env'),'utf8')),...process.env};
const origin='http://localhost:'+env.APISIX_PORT;
const directory=resolve(root,'.local/reports');await mkdir(directory,{recursive:true});
const report={scope:'Real browser + PKCE + APISIX + M3 automation/queues',checks:[],passed:false};
let browser, activePage;
async function check(name,op){try{await op();report.checks.push({name,passed:true});console.log('PASS '+name);}catch(error){report.checks.push({name,passed:false,error:error.message});throw error;}}
async function login(username){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(30000);
 await page.goto(origin);await page.getByRole('button',{name:'Đăng nhập hệ thống (SSO)',exact:true}).click();
 await page.locator('#username').fill(username);await page.locator('#password').fill(env.DEMO_USER_PASSWORD??'DxDesk@2026');await page.locator('#kc-login').click();
 await page.waitForURL(origin+'/**');await page.getByRole('button',{name:/Đăng xuất/}).waitFor();return {context,page};
}
async function transition(page,label,note){
 await page.getByRole('button',{name:label,exact:true}).click();
 if(note)await page.locator('#transition-resolution-note').fill(note);
 const response=page.waitForResponse(r=>r.url().endsWith('/status')&&r.request().method()==='PATCH');
 await page.getByRole('button',{name:'Xác nhận chuyển trạng thái',exact:true}).click();assert.equal((await response).status(),200);
 await page.getByRole('button',{name:'Xác nhận chuyển trạng thái',exact:true}).waitFor({state:'detached'});
}
async function createAccess(page,title){
 await page.goto(origin+'/tickets/new');await page.locator('#ticket-category').selectOption('10000000-0000-4000-8000-000000000005');
 await page.locator('#requirement-system_name').fill('Demo CRM');await page.locator('#requirement-permission_level').fill('Reader');
 await page.locator('#requirement-valid_until').fill('2026-12-31');await page.locator('#ticket-title').fill(title);
 await page.locator('#ticket-description').fill('Yêu cầu giả lập dùng kiểm hàng đợi phê duyệt Manager.');
 const pending=page.waitForResponse(r=>r.url().endsWith('/api/tickets')&&r.request().method()==='POST');
 await page.getByRole('button',{name:/Gửi phiếu hỗ trợ/}).click();const response=await pending;assert.equal(response.status(),201);
 await page.getByText('Tạo phiếu yêu cầu thành công!',{exact:true}).waitFor();return response.json();
}
try{
 browser=await chromium.launch({headless:true});const employee=await login('employee.a');const agent=await login('agent.1');const manager=await login('manager.1');
 const page=employee.page;activePage=page;const title='[SYNTHETIC M3 browser] VPN '+Date.now();let ticketId,createdAt;
 await check('Employee creates VPN with an image and automated team assignment appears within 60 seconds',async()=>{
  await page.goto(origin+'/tickets/new');await page.locator('#ticket-category').selectOption('10000000-0000-4000-8000-000000000001');
  await page.locator('#requirement-client_version').fill('OpenVPN Connect 4.2');await page.locator('#requirement-error_message').fill('Connection timed out');
  await page.locator('#ticket-title').fill(title);await page.locator('#ticket-description').fill('Dữ liệu mô phỏng nghiệm thu M3 qua trình duyệt thật.');
  await page.locator('#ticket-attachment').setInputFiles({name:'vpn.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64')});
  const response=page.waitForResponse(r=>r.url().endsWith('/api/tickets')&&r.request().method()==='POST');
  await page.getByRole('button',{name:/Gửi phiếu hỗ trợ/}).click();const created=await (await response).json();ticketId=created.id;createdAt=new Date(created.created_at).getTime();
  report.ticket_id=ticketId;await page.getByText(/đã được quét và lưu an toàn/).waitFor();await page.getByRole('button',{name:'Xem chi tiết phiếu'}).click();
  const until=Date.now()+60000;let found=false;
  while(Date.now()<until){await page.reload();try{await page.getByText('Network Team',{exact:true}).waitFor({timeout:3000});found=true;break;}catch{/* Wait for authenticated data before retrying navigation. */}}
  assert.ok(found,'automated team label');report.assignment_ms=Date.now()-createdAt;assert.ok(report.assignment_ms<=60000);report.ticket_id=ticketId;
 });
 await check('Agent server queue claims the routed ticket and shows its real assignee',async()=>{
  const staff=agent.page;activePage=staff;await staff.goto(origin+'/work-queue');await staff.getByRole('button',{name:'Nhóm của tôi · Chưa nhận',exact:true}).click();
  const card=staff.getByRole('article',{name:title});await card.waitFor();
  const response=staff.waitForResponse(r=>r.url().endsWith('/claim')&&r.request().method()==='POST');
  await card.getByRole('button',{name:/Nhận/}).click();assert.equal((await response).status(),200);
  await staff.getByRole('button',{name:'Đang phụ trách',exact:true}).click();await staff.getByRole('link',{name:title,exact:true}).click();
  await staff.waitForURL(origin+'/tickets/'+ticketId);
  await staff.getByRole('heading',{name:title,level:1,exact:true}).waitFor();
  await staff.locator('dt').filter({hasText:'Phụ trách:'}).locator('..').getByText('agent.1',{exact:true}).waitFor();
  await staff.screenshot({path:resolve(directory,'week4-agent-detail.png'),fullPage:true});
 });
 await check('Agent waiting/resolution and requester confirmation preserve workflow history',async()=>{
  const staff=agent.page;await transition(staff,'Bắt đầu xử lý');await transition(staff,'Chờ người dùng phản hồi');
  await page.reload();await transition(page,'Phản hồi, tiếp tục xử lý');
  await staff.reload();await transition(staff,'Đánh dấu đã giải quyết','Đã cập nhật cấu hình VPN và kiểm tra kết nối ổn định.');
  await page.reload();await transition(page,'Xác nhận đã hài lòng, đóng phiếu');
  await page.getByText('Chuyển từ Đã giải quyết sang Đã đóng',{exact:true}).waitFor();
 });
 await check('Manager sees approval queue while Employee cannot access staff queues',async()=>{
  activePage=manager.page;await manager.page.goto(origin+'/approvals');await manager.page.getByRole('heading',{name:'Phê duyệt phiếu hỗ trợ'}).waitFor();
  const approvalTitle='[SYNTHETIC M3 approval] '+Date.now();
  await createAccess(page,approvalTitle);
  await manager.page.reload();const card=manager.page.getByRole('article',{name:approvalTitle});await card.waitFor();
  await card.getByRole('button',{name:'Duyệt phiếu',exact:true}).click();
  const decision=manager.page.waitForResponse(r=>r.url().endsWith('/status')&&r.request().method()==='PATCH');
  await card.getByRole('button',{name:'Xác nhận quyết định',exact:true}).click();assert.equal((await decision).status(),200);
  await card.waitFor({state:'detached'});
  await manager.page.screenshot({path:resolve(directory,'week4-manager-queue.png'),fullPage:true});
  await page.goto(origin+'/work-queue');await page.getByText('Không có quyền truy cập',{exact:true}).waitFor();
 });
 await check('Manager rejects with an audited reason on mobile; both staff queues fit portrait and landscape',async()=>{
  const title='[SYNTHETIC M3 rejection] '+Date.now();const rejected=await createAccess(page,title);
  const staff=manager.page;activePage=staff;await staff.setViewportSize({width:375,height:812});await staff.goto(origin+'/approvals');
  const card=staff.getByRole('article',{name:title});await card.waitFor();await card.getByRole('button',{name:'Từ chối phiếu',exact:true}).click();
  const reason='Thiếu căn cứ phê duyệt quyền; đề nghị bổ sung chủ hệ thống.';
  await card.getByRole('textbox',{name:/Lý do quyết định/}).fill('abc');
  const confirm=card.getByRole('button',{name:'Xác nhận quyết định',exact:true});assert.equal(await confirm.isDisabled(),true);
  await card.getByRole('textbox',{name:/Lý do quyết định/}).fill(reason);
  await staff.screenshot({path:resolve(directory,'week4-mobile-rejection.png'),fullPage:true});
  const pending=staff.waitForResponse(r=>r.url().endsWith('/status')&&r.request().method()==='PATCH');
  await confirm.click();const decision=await pending;assert.equal(decision.status(),200);assert.equal((await decision.json()).status,'new');
  await card.waitFor({state:'detached'});await page.goto(origin+'/tickets/'+rejected.id);await page.getByText(reason,{exact:true}).waitFor();
  for(const viewport of [{width:375,height:812},{width:812,height:375}])for(const [target,path,heading] of [
   [agent.page,'/work-queue','Bảng việc kỹ thuật viên'],[staff,'/approvals','Phê duyệt phiếu hỗ trợ']]){
   activePage=target;await target.setViewportSize(viewport);await target.goto(origin+path);
   await target.getByRole('heading',{name:heading,level:1,exact:true}).waitFor();
   await target.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Làm mới hàng đợi')?.disabled);
   assert.ok(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path+' horizontal overflow at '+viewport.width);
  }
 });
 report.passed=true;
}catch(error){report.error=error.message;console.error(error.message);process.exitCode=1;
 if(activePage){await activePage.screenshot({path:resolve(directory,'week4-browser-failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(resolve(directory,'week4-browser-failure.txt'),await activePage.locator('body').innerText()).catch(()=>{});}}
finally{await browser?.close();await writeFile(resolve(directory,'week4-browser.json'),JSON.stringify(report,null,2)+'\n');}
