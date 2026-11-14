// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { OutboxDispatcher, retryDelay, notificationText, validAck } from '../dist/outbox-dispatcher.js';

const ticket = '20000000-0000-4000-8000-000000000001';
const event = '20000000-0000-4000-8000-000000000002';
const claims = { sub:'20000000-0000-4000-8000-000000000003',role:'ticket_automation',azp:'dxdesk-automation',
  realm_access:{roles:['ticket-automation']} };
async function fixture(t, mode='success', destination='automation') {
  const requests=[]; let transaction=false;
  const {privateKey,publicKey}=await generateKeyPair('RS256');
  const jwk={...await exportJWK(publicKey),kid:'worker-test',use:'sig',alg:'RS256'};
  let token,base;
  const server=createServer(async(request,response)=>{
    assert.equal(transaction,false,'Network I/O must happen after the DB transaction is released');
    const parts=[];for await(const chunk of request)parts.push(chunk);
    const body=Buffer.concat(parts).toString();requests.push({path:request.url,headers:request.headers,body});
    response.setHeader('Content-Type','application/json');
    if(request.url==='/token')response.end(JSON.stringify({access_token:token}));
    else if(request.url==='/certs')response.end(JSON.stringify({keys:[jwk]}));
    else if(request.url==='/events'){
      assert.equal(request.headers['x-dxdesk-webhook-key'],'test-internal-webhook-key-at-least-32');
      if(mode==='unavailable'){response.statusCode=503;response.end('{}');}
      else if(mode==='activating'){response.statusCode=404;response.end('{}');}
      else if (destination === 'device_request') response.end(JSON.stringify({ event_id: event, request_id: ticket,
        result: 'notification', notification: { kind: 'handed_over', audience: 'requester' } }));
      else response.end(JSON.stringify({event_id:mode==='bad-ack'?'wrong':event,ticket_id:ticket,
        result:destination==='notification'?'notification':'routed',team_id:'network',notification:{kind:'status',team_id:'network'}}));
    }else if(request.url.startsWith('/api/v4/channels/')){
      response.end(JSON.stringify({posts:mode==='already-posted'?{prior:{props:{dxdesk_event_id:event}}}:{}}));
    }else if(request.url==='/api/v4/posts'){
      assert.equal(request.headers.authorization,'Bearer bot-token-test');
      response.statusCode=mode==='chat-down'?503:201;response.end('{}');
    }else{response.statusCode=404;response.end('{}');}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  token=await new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer(base)
    .setAudience('dxdesk-api').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const env={OIDC_ISSUER:base,OIDC_AUDIENCE:'dxdesk-api',OIDC_JWKS_URL:base+'/certs',OIDC_TOKEN_URL:base+'/token',
    AUTOMATION_CLIENT_ID:'dxdesk-automation',AUTOMATION_CLIENT_SECRET:'client-test-secret',AUTOMATION_WEBHOOK_URL:base+'/events',
    DEVICE_REQUEST_WEBHOOK_URL:base+'/events', AUTOMATION_WEBHOOK_KEY:'test-internal-webhook-key-at-least-32',
    MATTERMOST_URL:base,MATTERMOST_BOT_TOKEN:'bot-token-test',
    MATTERMOST_TEAM_CHANNELS:JSON.stringify({network:'private-network-channel', default:'shared-channel',
      ...mode !== 'missing-device-channel' && { ['device-requester:' + ticket]: 'private-requester-channel' }})};
  const previous=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));Object.assign(process.env,env);
  t.after(()=>{for(const [key,value] of Object.entries(previous))value===undefined?delete process.env[key]:process.env[key]=value;});
  const calls=[];let claimed=false;
  const db={asAutomation:async(actual,operation)=>{
    assert.equal(actual.role,'ticket_automation');transaction=true;
    try{return await operation({query:async(sql,params)=>{
      calls.push({sql,params});
      if(sql.includes('complete_outbox'))return {rows:[{completed:mode!=='lost-lease'}]};
      if(sql.includes('fail_outbox'))return {rows:[{deferred:mode!=='lost-lease'}]};
      if(sql.includes('device_notice_channel'))return {rows:[{channel_key:'device-requester:'+ticket}]};
      const rows=sql.includes('claim_outbox')&&!claimed?[{event_id:event,destination,lease_token:'lease-test',attempts:3,
        envelope:{event_id:event,ticket_id:ticket,event_type:destination==='notification'?'ticket.status_changed':'ticket.created',
          ticket_version:2,schema_version:1,payload:{title:'PRIVATE TITLE',description:'PRIVATE NOTE'},
          ...destination === 'device_request' && { request_id:ticket, event_type:'device_request.handed_over' }}}]:[];
      if(sql.includes('claim_outbox'))claimed=true;
      return {rows};
    }});}finally{transaction=false;}
  }};
  return {worker:new OutboxDispatcher(db),requests,calls};
}
test('worker retries are bounded and notification messages omit ticket content',()=>{
  assert.equal(retryDelay(1,0),1);assert.equal(retryDelay(2,0),2);assert.equal(retryDelay(99,1),63);
  assert.equal(notificationText({event_id:event,ticket_id:ticket,event_type:'ticket.sla_warning',payload:{title:'SECRET'}}).includes('SECRET'),false);
});
test('ACK type is tied to the delivery destination and only obsolete SLA may skip a notification',()=>{
  const item={event_id:event,destination:'notification',envelope:{ticket_id:ticket,event_type:'ticket.status_changed'}};
  const ack={event_id:event,ticket_id:ticket,result:'routed'};
  assert.equal(validAck(item,ack),false);assert.equal(validAck(item,{...ack,result:'skipped'}),false);
  assert.equal(validAck({...item,envelope:{...item.envelope,event_type:'ticket.sla_warning'}},{...ack,result:'skipped'}),true);
});
test('W5-02 device request deliveries need a matching request ACK and post identifiers only',()=>{
  const request='99999999-0000-4000-8000-000000000001';
  const item={event_id:event,destination:'device_request',envelope:{event_id:event,request_id:request,event_type:'device_request.approved',
    payload:{status:'approved',department:'phong-hanh-chinh'}}};
  const ack={event_id:event,request_id:request,result:'notification',notification:{kind:'approved',audience:'it',team_id:null}};
  assert.equal(validAck(item,ack),true);
  assert.equal(validAck(item,{...ack,request_id:ticket}),false);
  assert.equal(validAck(item,{...ack,notification:{kind:'approved',audience:'manager'}}),false);
  assert.equal(validAck(item,{...ack,notification:{kind:'created',audience:'it'}}),false);
  assert.equal(validAck(item,{...ack,result:'skipped'}),false);
  assert.equal(validAck({...item,envelope:{...item.envelope,event_type:'device_request.preparing'}},ack),false);
  // ACK của phiếu không được dùng cho đề nghị thiết bị và ngược lại.
  assert.equal(validAck(item,{event_id:event,ticket_id:ticket,result:'notification',notification:{kind:'status'}}),false);
  assert.equal(validAck({...item,destination:'notification'},ack),false);
  const text=notificationText(item.envelope);
  assert.ok(text.includes(request)&&text.includes(event));
  assert.equal(text.includes('phong-hanh-chinh'),false);
});
test('worker validates service identity and only acknowledges after durable consumer success',async t=>{
  const f=await fixture(t);await f.worker.runOnce();
  assert.ok(f.calls.some(call=>call.sql.includes('evaluate_sla')));
  assert.deepEqual(f.calls.find(call=>call.sql.includes('complete_outbox')).params,[event,'lease-test']);
  assert.equal(f.calls.some(call=>call.sql.includes('fail_outbox')),false);
  assert.ok(f.requests.some(request=>request.path==='/certs'));
});
test('bad ACK and unavailable consumer retain retry evidence and never mark delivery complete',async t=>{
  for(const mode of ['bad-ack','unavailable'])await t.test(mode,async child=>{
    const f=await fixture(child,mode);await f.worker.runOnce();
    assert.equal(f.calls.some(call=>call.sql.includes('complete_outbox')),false);
    assert.equal(f.calls.find(call=>call.sql.includes('fail_outbox')).params[0],event);
  });
});
test('notification delivery uses the configured bot channel without disclosing private ticket text',async t=>{
  const f=await fixture(t,'success','notification');await f.worker.runOnce();
  const post=JSON.parse(f.requests.find(request=>request.path==='/api/v4/posts').body);
  assert.equal(post.channel_id,'private-network-channel');assert.equal(post.props.dxdesk_event_id,event);
  assert.doesNotMatch(post.message,/PRIVATE TITLE|PRIVATE NOTE/);
  assert.ok(f.calls.some(call=>call.sql.includes('complete_outbox')));
});
test('Mattermost failure cannot mark a notification delivered',async t=>{
  const f=await fixture(t,'chat-down','notification');await f.worker.runOnce();
  assert.equal(f.calls.some(call=>call.sql.includes('complete_outbox')),false);
  assert.ok(f.calls.some(call=>call.sql.includes('fail_outbox')));
});
test('Device notices use the leased route and never fall back to operations', async t => {
  await t.test('configured personal channel', async child => {
    const f = await fixture(child, 'success', 'device_request');
    await f.worker.runOnce();
    assert.deepEqual(f.calls.find(call => call.sql.includes('device_notice_channel')).params, [event, 'lease-test']);
    assert.equal(JSON.parse(f.requests.find(request => request.path === '/api/v4/posts').body).channel_id, 'private-requester-channel');
  });
  await t.test('missing personal channel', async child => {
    const f = await fixture(child, 'missing-device-channel', 'device_request');
    await f.worker.runOnce();
    assert.ok(f.requests.every(request => !request.path.startsWith('/api/v4/')));
    assert.equal(f.calls.find(call => call.sql.includes('fail_outbox')).params[4], false);
  });
});
test('n8n webhook activation 404 is retried instead of terminally losing the event',async t=>{
  const f=await fixture(t,'activating');await f.worker.runOnce();
  assert.equal(f.calls.some(call=>call.sql.includes('complete_outbox')),false);
  assert.equal(f.calls.find(call=>call.sql.includes('fail_outbox')).params[4],false);
});
test('a previously posted correlation ID is reconciled without sending another chat message',async t=>{
  const f=await fixture(t,'already-posted','notification');await f.worker.runOnce();
  assert.equal(f.requests.some(request=>request.path==='/api/v4/posts'),false);
  assert.ok(f.calls.some(call=>call.sql.includes('complete_outbox')));
});
test('lost completion lease remains visible and is never mistaken for acknowledged delivery',async t=>{
  const f=await fixture(t,'lost-lease');await f.worker.runOnce();
  assert.ok(f.calls.some(call=>call.sql.includes('fail_outbox')));
});
