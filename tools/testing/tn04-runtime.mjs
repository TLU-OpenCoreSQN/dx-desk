// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Exercises only a disposable TN-04 Compose project, never existing app instances.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const app=process.argv[2];
assert.ok(['wikijs','mattermost','metabase'].includes(app));
const project=process.env.TN04_PROJECT;
assert.ok(/^dxdesk-tn04-[a-z0-9-]+$/.test(project??''),'Use an isolated dxdesk-tn04-* project');
const port={wikijs:13001,mattermost:13002,metabase:13003}[app];
const origin=`http://127.0.0.1:${port}`;
const password=randomBytes(20).toString('hex')+'Aa1!';
const checks=[];
async function check(name,operation){await operation();checks.push(name);console.log('PASS '+name);}
async function call(path,body,headers={}){
  const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  assert.ok(response.ok,`${app} ${path}: HTTP ${response.status}`);
  return response;
}
const health={wikijs:'/',mattermost:'/api/v4/system/ping',metabase:'/api/health'}[app];
let ready=false;
for(let n=0;n<180;n++){
  try {const r=await fetch(origin+health,{signal:AbortSignal.timeout(2000)});if(r.ok){ready=true;break;}}catch{/* booting */}
  await new Promise(r=>setTimeout(r,2000));
}
assert.ok(ready,`${app} did not become ready`);
if(app==='wikijs'){
  await check('Wiki.js 2.5.315 initializes its database and serves the login page',async()=>{
    const result=await (await call('/finalize',{siteUrl:'http://localhost:13001',adminEmail:'admin@tn04.local',adminPassword:password,telemetry:false})).json();
    assert.equal(result.ok,true);
    await new Promise(r=>setTimeout(r,5000));
    assert.match(await (await call('/login')).text(),/Wiki\.js/i);
  });
  await check('running pinned Wiki.js image contains an available Keycloak strategy',async()=>{
    const result=spawnSync('docker',['compose','-p',project,'-f','infra/compose/tn04.yml','exec','-T','wikijs','node','-e',
      "const fs=require('fs');const p=require('./package.json');if(p.version!=='2.5.315')process.exit(1);const s=fs.readFileSync('server/modules/authentication/keycloak/definition.yml','utf8');if(!s.includes('isAvailable: true')||!s.includes('tokenURL:'))process.exit(1)"],{encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(result.status,0,result.stderr);
  });
}
if(app==='mattermost'){
  await check('Team Edition supports local login and the channel webhook fallback',async()=>{
    const user=await (await call('/api/v4/users',{email:'admin@tn04.local',username:'tn04admin',password})).json();
    const login=await call('/api/v4/users/login',{login_id:user.email,password});
    const headers={Authorization:'Bearer '+login.headers.get('token')};
    const team=await (await call('/api/v4/teams',{name:'tn04',display_name:'TN04 test',type:'O'},headers)).json();
    const channel=await (await call('/api/v4/channels',{team_id:team.id,name:'test-notifications',display_name:'Test notifications',type:'O'},headers)).json();
    const hook=await (await call('/api/v4/hooks/incoming',{channel_id:channel.id,display_name:'TN04 fixture'},headers)).json();
    await call('/hooks/'+hook.id,{text:'TN04 isolated acceptance notification'});
    const posts=await (await call(`/api/v4/channels/${channel.id}/posts`,undefined,headers)).json();
    assert.ok(Object.values(posts.posts).some(post=>post.message==='TN04 isolated acceptance notification'));
    assert.equal((await (await call('/api/v4/license/client?format=old')).json()).IsLicensed,'false');
  });
}
if(app==='metabase'){
  await check('OSS Metabase supports setup and local-account login without public ticket sharing',async()=>{
    const settings=await (await call('/api/session/properties')).json();
    assert.ok(settings['setup-token']);
    await call('/api/setup',{token:settings['setup-token'],user:{first_name:'TN04',last_name:'Admin',email:'admin@tn04.local',password},
      prefs:{site_name:'TN04 isolated PoC',allow_tracking:false}});
    const session=await (await call('/api/session',{username:'admin@tn04.local',password})).json();
    const profile=await (await call('/api/user/current',undefined,{'X-Metabase-Session':session.id})).json();
    assert.equal(profile.email,'admin@tn04.local');
    assert.equal(profile.is_superuser,true);
  });
}
await mkdir('.local/reports',{recursive:true});
await writeFile(`.local/reports/tn04-${app}.json`,JSON.stringify({app,passed:true,checks,
  scope:'Isolated runtime PoC; full Wiki.js SSO integration and reporting permissions are week-4 deliverables'},null,2)+'\n');
