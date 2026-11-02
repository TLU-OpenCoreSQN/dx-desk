// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Native HTTP against the real Compose M3 services; fault injection affects only
// the current explicitly configured project, never unrelated containers.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const env={...parseEnv(await readFile(resolve(root,'.env'),'utf8')),...process.env};
const base='http://localhost:'+env.APISIX_PORT;
const issuer=env.KEYCLOAK_PUBLIC_URL+'/realms/'+env.KEYCLOAK_REALM;
const report={sha:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).stdout.trim(),scope:'Real Keycloak/APISIX/API/PostgreSQL/n8n/Mattermost',checks:[],passed:false};
async function check(name,op){try{await op();report.checks.push({name,passed:true});console.log('PASS '+name);}catch(error){report.checks.push({name,passed:false,error:error.message});throw error;}}
async function token(username){
 const response=await fetch(issuer+'/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams(username?{
 grant_type:'password',client_id:'dxdesk-web',username,password:env.DEMO_USER_PASSWORD??'DxDesk@2026'}:{
 grant_type:'client_credentials',client_id:env.AUTOMATION_CLIENT_ID,client_secret:env.AUTOMATION_CLIENT_SECRET}),signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200,'Keycloak token acquisition');return (await response.json()).access_token;
}
async function api(path,identity,body,method=body===undefined?'GET':'POST'){
 const response=await fetch(base+'/api'+path,{method,headers:{Authorization:'Bearer '+identity,...(body===undefined?{}:{'Content-Type':'application/json'})},
 ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
 return {status:response.status,data:await response.json()};
}
async function until(op,description,ms=60000){const end=Date.now()+ms;while(Date.now()<end){const value=await op();if(value)return value;await new Promise(r=>setTimeout(r,500));}throw new Error('Timeout '+description);}
function compose(...args){
 const result=spawnSync('docker',['compose','--env-file',resolve(root,'.env'),'-f',resolve(root,'infra/compose/docker-compose.yml'),...args],
 {cwd:root,env:{...process.env,...env},encoding:'utf8',windowsHide:true,timeout:60000});
 assert.equal(result.status,0,'Compose action failed: '+args[0]);return result.stdout;
}
const payload={category_id:'10000000-0000-4000-8000-000000000001',title:'[SYNTHETIC W4 acceptance] VPN '+Date.now(),description:'Dữ liệu nghiệm thu giả lập. Không phải số liệu vận hành.',
 fields:{client_version:'OpenVPN 4.2',error_message:'Connection timeout'}};
let stopped=false;
try{
 const [employee,agent,agent2,manager,service]=await Promise.all(['employee.a','agent.1','agent.2','manager.1',null].map(token));
 const teams=(await api('/teams',manager)).data.data;const network=teams.find(team=>team.name==='Network Team');assert.ok(network);
 await check('service and human boundaries remain distinct',async()=>{
  assert.equal((await api('/system/sla/evaluate',employee,{})).status,403);
  assert.equal((await api('/me',service)).status,401);
  assert.equal((await api('/teams',employee)).status,403);
 });
 const created=await api('/tickets',employee,payload);assert.equal(created.status,201);report.ticket_id=created.data.id;
 let routed;
 await check('VPN routes to Network Team in at most 60 seconds with an explicit system actor',async()=>{
  const started=new Date(created.data.created_at).getTime();
  routed=await until(async()=>{const row=(await api('/tickets/'+created.data.id,employee)).data;return row.status==='assigned'?row:null;},'VPN assignment');
  report.assignment_ms=Date.now()-started;assert.ok(report.assignment_ms<=60000);assert.equal(routed.assigned_team_id,network.id);
  const events=(await api('/tickets/'+routed.id+'/events',employee)).data.data;
  assert.ok(events.some(event=>event.actor_type==='system'&&event.payload.to==='assigned'));
 });
 await check('Mattermost receives the routed ticket in its private team channel',async()=>{
  const channels=JSON.parse(env.MATTERMOST_TEAM_CHANNELS);const channel=channels[network.id];assert.ok(channel);
  await until(async()=>{
   const response=await fetch('http://localhost:'+env.MATTERMOST_PORT+'/api/v4/channels/'+channel+'/posts',{
    headers:{Authorization:'Bearer '+env.MATTERMOST_BOT_TOKEN},signal:AbortSignal.timeout(10000)});
   assert.equal(response.status,200);const posts=(await response.json()).posts;
   return Object.values(posts).some(post=>post.message.includes(routed.id)&&!post.message.includes(payload.description));
  },'Mattermost private notification');
 });
 await check('concurrent Agent claims have one winner and idempotent same-Agent retry',async()=>{
  assert.equal((await api('/tickets/'+routed.id+'/claim',manager,{})).status,403,'Manager-only membership does not confer Agent claim');
  const results=await Promise.all([agent,agent2].map(identity=>api('/tickets/'+routed.id+'/claim',identity,{})));
  assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
  const winner=results[0].status===200?agent:agent2;
  assert.equal((await api('/tickets/'+routed.id+'/claim',winner,{})).status,200);
  routed=(await api('/tickets/'+routed.id,employee)).data;
 });
 await check('Manager rejection requires a reason and stale approval cannot overwrite another decision',async()=>{
  const access=await api('/tickets',employee,{...payload,category_id:'10000000-0000-4000-8000-000000000005',
   fields:{system_name:'Demo CRM',permission_level:'Reader',valid_until:'2026-12-31'}});
  assert.equal(access.status,201);assert.equal(access.data.status,'pending_approval');
  assert.equal((await api('/tickets/'+access.data.id+'/status',manager,{to:'new'},'PATCH')).status,422);
  const approved=await api('/tickets/'+access.data.id+'/status',manager,{to:'assigned',expected_version:access.data.ticket_version},'PATCH');
  assert.equal(approved.status,200);assert.ok(approved.data.assigned_team_id);
  assert.equal((await api('/tickets/'+access.data.id+'/status',manager,{to:'new',note:'Cần bổ sung căn cứ',expected_version:access.data.ticket_version},'PATCH')).status,409);
 });
 await check('n8n interruption retains durable events and restart delivers each business effect once',async()=>{
  compose('stop','n8n');stopped=true;
  const waiting=await api('/tickets',employee,{...payload,title:'[SYNTHETIC W4 recovery] '+Date.now()});assert.equal(waiting.status,201);
  await new Promise(r=>setTimeout(r,3000));assert.equal((await api('/tickets/'+waiting.data.id,employee)).data.status,'new');
  compose('up','-d','--wait','n8n');stopped=false;
  await until(async()=>{const row=(await api('/tickets/'+waiting.data.id,employee)).data;return row.status==='assigned';},'n8n event recovery');
  const events=(await api('/tickets/'+waiting.data.id+'/events',employee)).data.data;
  assert.equal(events.filter(event=>event.event_type==='assignment_changed').length,1);
 });
 await check('SLA persisted flags and outbox are service-only; new queues are server-side',async()=>{
  const evaluated=await api('/system/sla/evaluate',service,{});assert.equal(evaluated.status,200);
  const queue=await api('/tickets?queue=team_assigned&team_id='+network.id+'&limit=1&offset=0',agent);
  assert.equal(queue.status,200);assert.ok(queue.data.data.length<=1);assert.equal(typeof queue.data.total,'number');
  assert.equal((await api('/tickets?queue=unknown',agent)).status,400);
  assert.equal((await api('/tickets?queue=team_unassigned',employee)).status,403);
 });
 await check('real clock crosses the 80% reminder and overdue thresholds with durable notices',async()=>{
  // Demo acceptance only: change the policy for one snapshot, restore it before
  // waiting. Never backdate a ticket or alter its persisted deadline directly.
  const sql=query=>compose('exec','-T','postgres','psql','-U',env.POSTGRES_USER,'-d',env.POSTGRES_DB,'-At','-v','ON_ERROR_STOP=1','-c',query).trim();
  const original=JSON.parse(sql("SELECT row_to_json(p) FROM public.sla_policies p WHERE priority='normal'"));
  let short;
  try{
   sql("UPDATE public.sla_policies SET response_minutes=1,resolution_minutes=1 WHERE priority='normal'");
   short=await api('/tickets',employee,{...payload,title:'[SYNTHETIC W4 real-clock SLA] '+Date.now()});assert.equal(short.status,201);
  }finally{
   assert.ok(Number.isInteger(original.response_minutes)&&Number.isInteger(original.resolution_minutes));
   sql(`UPDATE public.sla_policies SET response_minutes=${original.response_minutes},resolution_minutes=${original.resolution_minutes} WHERE priority='normal'`);
  }
  assert.equal(new Date(short.data.sla_due_at)-new Date(short.data.created_at),60000);
  report.sla_ticket_id=short.data.id;
  const elapsed=()=>Date.now()-new Date(short.data.created_at).getTime();
  await until(()=>elapsed()>=48200,'80% real clock',55000);
  assert.equal((await api('/system/sla/evaluate',service,{})).status,200);
  await until(async()=>{const events=(await api('/tickets/'+short.data.id+'/events',employee)).data.data;
   return events.some(event=>event.event_type==='sla_warning');},'80% event',10000);
  await until(()=>elapsed()>61000,'overdue real clock',20000);
  assert.equal((await api('/system/sla/evaluate',service,{})).status,200);
  const breached=(await api('/tickets/'+short.data.id,employee)).data;
  assert.equal(breached.sla_breached,true);assert.ok(breached.sla_breached_at);
  const events=(await api('/tickets/'+short.data.id+'/events',employee)).data.data;
  assert.equal(events.filter(event=>event.event_type==='sla_warning').length,1);
  assert.equal(events.filter(event=>event.event_type==='sla_breached').length,1);
  await until(async()=>{
   const result=await fetch('http://localhost:'+env.MATTERMOST_PORT+'/api/v4/channels/'+JSON.parse(env.MATTERMOST_TEAM_CHANNELS)[network.id]+'/posts?per_page=200',{
    headers:{Authorization:'Bearer '+env.MATTERMOST_BOT_TOKEN},signal:AbortSignal.timeout(10000)});
   assert.equal(result.status,200);return Object.values((await result.json()).posts).some(post=>post.message.includes(short.data.id)&&post.message.includes('SLA đã quá hạn'));
  },'overdue private notification');
 });
 report.passed=true;
}catch(error){console.error(error.message);report.error=error.message;process.exitCode=1;}
finally{
 if(stopped)try{compose('up','-d','--wait','n8n');}catch{console.error('Acceptance project n8n needs restarting.');}
 await mkdir(resolve(root,'.local/reports'),{recursive:true});
 await writeFile(resolve(root,'.local/reports/week4-stack.json'),JSON.stringify(report,null,2)+'\n');
}
