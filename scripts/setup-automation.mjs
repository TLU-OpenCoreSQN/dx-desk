// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Idempotent LOCAL DEMO bootstrap; real Keycloak subjects and a channel-scoped bot.
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function prepareAutomation(root, env) {
  if (env.AUTOMATION_ENABLED === 'false') return;
  const defaults = { AUTOMATION_ENABLED: 'true', COMPOSE_PROFILES: 'demo-light', MATTERMOST_VERSION: '12.0.1',
    MATTERMOST_PORT: '18065', AUTOMATION_CLIENT_ID: 'dxdesk-automation', MATTERMOST_TEAM_CHANNELS: '{}' };
  for (const [key, value] of Object.entries(defaults)) env[key] ??= value;
  for (const key of ['AUTOMATION_CLIENT_SECRET','AUTOMATION_WEBHOOK_KEY','MATTERMOST_ADMIN_PASSWORD','MATTERMOST_DEMO_PASSWORD']) {
    if (!env[key]) env[key] = randomBytes(32).toString('hex') + (key.startsWith('MATTERMOST_') ? 'Aa1!' : '');
  }
  if(env.AUTOMATION_CLIENT_ID!=='dxdesk-automation')throw new Error('This contract reserves the dxdesk-automation client identity.');
  await saveAutomationEnv(root, env);
}
export async function saveAutomationEnv(root, env) {
  let text = await readFile(resolve(root,'.env'),'utf8');
  const keys = ['AUTOMATION_ENABLED','COMPOSE_PROFILES','MATTERMOST_VERSION','MATTERMOST_PORT','AUTOMATION_CLIENT_ID',
    'AUTOMATION_CLIENT_SECRET','AUTOMATION_WEBHOOK_KEY','MATTERMOST_ADMIN_PASSWORD','MATTERMOST_DEMO_PASSWORD','MATTERMOST_BOT_TOKEN','MATTERMOST_TEAM_CHANNELS'];
  for (const key of keys) if (env[key] !== undefined) {
    const expression = new RegExp('^'+key+'=.*$', 'm');
    const line = key + '=' + env[key];
    text = expression.test(text) ? text.replace(expression, () => line) : text.trimEnd()+'\n'+line+'\n';
  }
  await writeFile(resolve(root,'.env'), text);
}
function localDemo(env) {
  if (!['localhost','127.0.0.1','[::1]'].includes(new URL(env.KEYCLOAK_PUBLIC_URL).hostname)) {
    throw new Error('Automatic demo bootstrap requires a local Keycloak. Configure shared deployments explicitly.');
  }
}
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Object.assign(new Error(`Demo setup HTTP ${response.status}`), {status:response.status});
  const text=await response.text();
  return text ? JSON.parse(text) : null;
}

export async function demoSeedIdentities(env) {
  localDemo(env);
  if (env.AUTOMATION_ENABLED !== 'true' || !env.AUTOMATION_CLIENT_SECRET) {
    throw new Error('Chạy stack demo với automation trước, hoặc dùng --offline cho dry-run.');
  }
  const base = env.KEYCLOAK_PUBLIC_URL.replace(/\/+$/, '');
  const issuer = base + '/realms/' + env.KEYCLOAK_REALM;
  const tokenUrl = '/protocol/openid-connect/token';
  const [service, administrator] = await Promise.all([
    json(issuer + tokenUrl, { method: 'POST', body: new URLSearchParams({
      grant_type: 'client_credentials', client_id: env.AUTOMATION_CLIENT_ID, client_secret: env.AUTOMATION_CLIENT_SECRET,
    }) }),
    json(base + '/realms/master' + tokenUrl, { method: 'POST', body: new URLSearchParams({
      grant_type: 'password', client_id: 'admin-cli', username: env.KEYCLOAK_ADMIN, password: env.KEYCLOAK_ADMIN_PASSWORD,
    }) }),
  ]);
  const admin = path => json(base + '/admin/realms/' + env.KEYCLOAK_REALM + path, {
    headers: { Authorization: 'Bearer ' + administrator.access_token },
  });
  const result = await json('http://localhost:' + env.APISIX_PORT + '/api/system/teams', {
    headers: { Authorization: 'Bearer ' + service.access_token },
  });
  const expected = { 'employee.a': 'Employee', 'employee.b': 'Employee', 'agent.1': 'Agent', 'agent.2': 'Agent', 'manager.1': 'Manager' };
  const users = await Promise.all(Object.entries(expected).map(async ([username, role]) => {
    const [user] = await admin('/users?exact=true&username=' + encodeURIComponent(username));
    if (!user?.enabled) throw new Error(`Thiếu tài khoản demo hoạt động ${username}.`);
    const roles = await admin('/users/' + user.id + '/role-mappings/realm/composite');
    if (!roles.some(item => item.name === role)) throw new Error(`Tài khoản demo ${username} thiếu vai trò ${role}.`);
    return { sub: user.id, roles: [role] };
  }));
  const staff = new Set(users.filter(user => !user.roles.includes('Employee')).map(user => user.sub));
  const teams = result.data.filter(team => team.active && ['Network Team', 'Identity Team', 'IT Support'].includes(team.name))
    .map(team => ({ id: team.id, name: team.name, members: team.members.filter(subject => staff.has(subject)) }));
  const system = JSON.parse(Buffer.from(service.access_token.split('.')[1], 'base64url')).sub;
  return { users, teams, system };
}
export async function setupIdentity(env) {
  if (env.AUTOMATION_ENABLED !== 'true') return;
  localDemo(env);
  const base = env.KEYCLOAK_PUBLIC_URL;
  const adminToken = await json(base+'/realms/master/protocol/openid-connect/token', {method:'POST',body:new URLSearchParams({
    client_id:'admin-cli',grant_type:'password',username:env.KEYCLOAK_ADMIN,password:env.KEYCLOAK_ADMIN_PASSWORD,
  })});
  const headers = {Authorization:'Bearer '+adminToken.access_token,'Content-Type':'application/json'};
  const admin = (path,method='GET',body) => json(base+'/admin/realms/'+env.KEYCLOAK_REALM+path,
    {method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
  let role;
  try {role=await admin('/roles/ticket-automation');}
  catch(error) {if(error.status!==404)throw error;await admin('/roles','POST',{name:'ticket-automation'});role=await admin('/roles/ticket-automation');}
  const clients=await admin('/clients?clientId='+encodeURIComponent(env.AUTOMATION_CLIENT_ID));
  const client={clientId:env.AUTOMATION_CLIENT_ID,name:'DX-Desk limited automation',enabled:true,protocol:'openid-connect',
    publicClient:false,secret:env.AUTOMATION_CLIENT_SECRET,serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false,
    protocolMappers:[
      {name:'api-audience',protocol:'openid-connect',protocolMapper:'oidc-audience-mapper',config:{'included.client.audience':'dxdesk-api','access.token.claim':'true','id.token.claim':'false'}},
      {name:'database-role',protocol:'openid-connect',protocolMapper:'oidc-hardcoded-claim-mapper',config:{'claim.name':'role','claim.value':'ticket_automation','jsonType.label':'String','access.token.claim':'true','id.token.claim':'false'}},
    ]};
  if(clients.length) await admin('/clients/'+clients[0].id,'PUT',client);
  else await admin('/clients','POST',client);
  const current=(await admin('/clients?clientId='+encodeURIComponent(env.AUTOMATION_CLIENT_ID)))[0];
  const service=await admin('/clients/'+current.id+'/service-account-user');
  await admin('/users/'+service.id+'/role-mappings/realm','POST',[role]);
  // Extra Agent is a demo identity used to prove concurrent team claim semantics.
  let agents=await admin('/users?username=agent.2&exact=true');
  if(!agents.length){
    await admin('/users','POST',{username:'agent.2',firstName:'Kỹ thuật viên',lastName:'2',email:'agent.2@dxdesk.local',enabled:true,
      emailVerified:true,credentials:[{type:'password',value:env.DEMO_USER_PASSWORD??'DxDesk@2026',temporary:false}]});
    agents=await admin('/users?username=agent.2&exact=true');
    await admin('/users/'+agents[0].id+'/role-mappings/realm','POST',[await admin('/roles/Agent')]);
  }
  console.log('Automation client and demo identities configured (no credentials printed).');
}
export async function setupChannelsAndRoster(root,env) {
  if(env.AUTOMATION_ENABLED!=='true')return;
  localDemo(env);
  const issuer=env.KEYCLOAK_PUBLIC_URL+'/realms/'+env.KEYCLOAK_REALM;
  const gateway='http://localhost:'+env.APISIX_PORT;
  const service=await json(issuer+'/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({
    grant_type:'client_credentials',client_id:env.AUTOMATION_CLIENT_ID,client_secret:env.AUTOMATION_CLIENT_SECRET})});
  const teams=await json(gateway+'/api/system/teams',{headers:{Authorization:'Bearer '+service.access_token}});
  // Admin lookup works even when staff must enroll/use TOTP; no password grant or
  // removal of MFA is used to discover the real Keycloak subject.
  const admin=await json(env.KEYCLOAK_PUBLIC_URL+'/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({
    grant_type:'password',client_id:'admin-cli',username:env.KEYCLOAK_ADMIN,password:env.KEYCLOAK_ADMIN_PASSWORD})});
  const lookup = path => json(env.KEYCLOAK_PUBLIC_URL + '/admin/realms/' + env.KEYCLOAK_REALM + path,
    { headers: { Authorization: 'Bearer ' + admin.access_token } });
  const demoRoles = { 'employee.a': 'Employee', 'employee.b': 'Employee', 'agent.1': 'Agent', 'agent.2': 'Agent', 'manager.1': 'Manager' };
  const identities = await Promise.all(Object.entries(demoRoles).map(async ([username, role]) => {
    const [user] = await lookup('/users?exact=true&username=' + encodeURIComponent(username));
    if (!user?.enabled) throw new Error(`Missing active demo account ${username}`);
    const roles = await lookup('/users/' + user.id + '/role-mappings/realm/composite');
    if (!roles.some(item => item.name === role)) throw new Error(`Missing ${role} role for ${username}`);
    return { user_id: user.id, display_name: username, active: true, role, department: user.attributes?.department?.[0] };
  }));
  const staff = identities.filter(identity => identity.role !== 'Employee');
  await json(gateway+'/api/system/roster',{method:'POST',headers:{Authorization:'Bearer '+service.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({members:teams.data.flatMap(team => staff.map(({ user_id, display_name, active }) =>
      ({ user_id, display_name, active, team_id: team.id })))})});

  const mm='http://localhost:'+env.MATTERMOST_PORT;
  try {await json(mm+'/api/v4/users',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:'dxdesk.admin',email:'admin@dxdesk.local',password:env.MATTERMOST_ADMIN_PASSWORD})});}
  catch(error){if(![400,403].includes(error.status))throw error;}
  const signed=await fetch(mm+'/api/v4/users/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({login_id:'dxdesk.admin',password:env.MATTERMOST_ADMIN_PASSWORD}),signal:AbortSignal.timeout(20000)});
  if(!signed.ok)throw new Error('Mattermost demo admin login failed');
  const headers={Authorization:'Bearer '+signed.headers.get('token'),'Content-Type':'application/json'};
  const call=(path,method='GET',body)=>json(mm+'/api/v4'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
  let mmTeam;
  try{mmTeam=await call('/teams/name/dxdesk');}catch(error){if(error.status!==404)throw error;mmTeam=await call('/teams','POST',{name:'dxdesk',display_name:'DX-Desk demo',type:'O'});}
  let bot;
  try{bot=await call('/users/username/dxdesk-notifier');}catch(error){if(error.status!==404)throw error;bot=await call('/bots','POST',{username:'dxdesk-notifier',display_name:'DX-Desk notifications',description:'Ticket identifiers and lifecycle notices only'});}
  const botId=bot.user_id??bot.id;
  try{await call('/teams/'+mmTeam.id+'/members','POST',{team_id:mmTeam.id,user_id:botId});}catch(error){if(error.status!==400)throw error;}
  const channels={};
  async function ensureChannel(name,label){
    let channel;
    try{channel=await call('/teams/'+mmTeam.id+'/channels/name/'+name);}
    catch(error){if(error.status!==404)throw error;channel=await call('/channels','POST',{team_id:mmTeam.id,name,display_name:label,type:'P'});}
    if (channel.type !== 'P') throw new Error(`Expected a private Mattermost channel for ${name}`);
    try{await call('/channels/'+channel.id+'/members','POST',{user_id:botId});}catch(error){if(error.status!==400)throw error;}
    return channel;
  }
  channels.default=(await ensureChannel('dxdesk-operations','DX-Desk Operations')).id;
  for(const team of teams.data){
    const channel=await ensureChannel('ticket-'+team.id.replaceAll('-',''),team.name);
    channels[team.id]=channel.id;
  }
  const mmIdentities = await Promise.all(identities.map(async identity => {
    let user;
    try{user=await call('/users/username/'+encodeURIComponent(identity.display_name));}
    catch(error){if(error.status!==404)throw error;user=await call('/users','POST',{
      username:identity.display_name,email:identity.display_name+'@dxdesk.local',password:env.MATTERMOST_DEMO_PASSWORD});}
    try{await call('/teams/'+mmTeam.id+'/members','POST',{team_id:mmTeam.id,user_id:user.id});}catch(error){if(error.status!==400)throw error;}
    return { ...identity, mmId: user.id };
  }));
  for (const { role, mmId } of mmIdentities) {
    if (role === 'Employee') continue;
    for (const channelId of Object.values(channels)) {
      try{await call('/channels/'+channelId+'/members','POST',{user_id:mmId});}catch(error){if(error.status!==400)throw error;}
    }
  }
  const administrator = await call('/users/me');
  async function scopedChannel(key, label, recipients) {
    const name = 'device-' + createHash('sha256').update(key).digest('hex').slice(0, 32);
    const channel = await ensureChannel(name, label);
    const path = '/channels/' + channel.id + '/members';
    const members = [];
    for (let page = 0; ; page++) {
      const batch = await call(`${path}?page=${page}&per_page=100`);
      members.push(...batch.map(member => member.user_id));
      if (batch.length < 100) break;
    }
    const allowed = new Set([botId, administrator.id, ...recipients]);
    for (const member of members) {
      if (!allowed.has(member)) await call(path + '/' + member, 'DELETE');
    }
    for (const user_id of recipients) {
      if (!members.includes(user_id)) await call(path, 'POST', { user_id });
    }
    channels[key] = channel.id;
  }
  await scopedChannel('device-it', 'Đề nghị thiết bị · IT', mmIdentities.filter(user => user.role === 'Agent').map(user => user.mmId));
  const managers = mmIdentities.filter(user => user.role === 'Manager');
  for (const department of new Set(managers.map(manager => manager.department))) {
    if (!department) throw new Error('A demo manager is missing a department');
    await scopedChannel('device-manager:' + department, 'Đề nghị thiết bị · ' + department,
      managers.filter(manager => manager.department === department).map(manager => manager.mmId));
  }
  for (const user of mmIdentities) {
    await scopedChannel('device-requester:' + user.user_id, 'Đề nghị thiết bị · ' + user.display_name, [user.mmId]);
  }
  if(!env.MATTERMOST_BOT_TOKEN){
    const token=await call('/users/'+botId+'/tokens','POST',{description:'DX-Desk local notification bot'});
    env.MATTERMOST_BOT_TOKEN=token.token;
  }
  env.MATTERMOST_TEAM_CHANNELS=JSON.stringify(channels);
  await saveAutomationEnv(root,env);
  console.log('Actual Keycloak roster and private team notification channels configured.');
}
