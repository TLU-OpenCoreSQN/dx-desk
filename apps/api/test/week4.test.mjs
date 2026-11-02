// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationPipe } from '@nestjs/common';
import { validateAutomationClaims } from '../dist/service-auth.js';
import { validateClaims } from '../dist/auth.js';
import { Database } from '../dist/database.js';
import { TicketListQuery, ProcessEvent, SyncRoster } from '../dist/dto-week4.js';
import { UpdateTicketStatus } from '../dist/dto.js';

const service={sub:'20000000-0000-4000-8000-000000000005',role:'ticket_automation',azp:'dxdesk-automation',realm_access:{roles:['ticket-automation']}};
const human={...service,role:'authenticated',realm_access:{roles:['Agent']}};
test('service and human identity validators remain disjoint, including mixed roles',()=>{
  assert.equal(validateAutomationClaims(service).sub,service.sub);
  assert.throws(()=>validateClaims(service));
  assert.throws(()=>validateAutomationClaims(human));
  for(const invalid of [{...service,sub:'untrusted'},{...service,azp:'other-client'},
    {...service,realm_access:{roles:['ticket-automation','Agent']}},
    {...service,realm_access:{roles:'ticket-automation'}},{...service,realm_access:{roles:[]}}]) {
    assert.throws(()=>validateAutomationClaims(invalid));
  }
});

test('service database context chooses a fixed role and commits claims locally',async()=>{
  const calls=[];
  const db=Object.create(Database.prototype);
  db.pool={connect:async()=>({query:async(sql,values)=>calls.push([sql,values]),release:discard=>calls.push(['release',discard])})};
  assert.equal(await db.asAutomation(service,async()=>42),42);
  assert.equal(calls[1][0],'SET LOCAL ROLE ticket_automation');
  assert.deepEqual(calls[2][1],[JSON.stringify(service)]);
  assert.deepEqual(calls.slice(-2),[['COMMIT',undefined],['release',false]]);
  const before=calls.length;
  await assert.rejects(db.asAutomation(human,async()=>0));
  assert.equal(calls.length,before,'Invalid service claims must not borrow a connection');
});

const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});
const validate=(metatype,value,type='body')=>pipe.transform(value,{metatype,type});
test('W4 DTOs reject arbitrary callback envelopes and retain version and queue allowlists',async()=>{
  assert.equal((await validate(ProcessEvent,{schema_version:1})).schema_version,1);
  await assert.rejects(validate(ProcessEvent,{schema_version:2}));
  await assert.rejects(validate(ProcessEvent,{schema_version:1,event_type:'ticket.created'}));
  await assert.rejects(validate(TicketListQuery,{queue:'all_private'},'query'));
  await assert.rejects(validate(TicketListQuery,{team_id:'injection'},'query'));
  await assert.rejects(validate(UpdateTicketStatus,{to:'assigned',expected_version:0}));
  assert.equal((await validate(UpdateTicketStatus,{to:'assigned',expected_version:3})).expected_version,3);
  await assert.rejects(validate(SyncRoster,{members:[{team_id:service.sub,user_id:service.sub,display_name:'Agent',active:true,role:'Manager'}]}));
});
