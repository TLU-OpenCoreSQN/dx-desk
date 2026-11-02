// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
// Operator replay only resets a failed delivery; consumer idempotency remains active.
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const env=parseEnv(await readFile(resolve(root,'.env'),'utf8'));
const id=process.argv[2];
if(id!=='status'&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id??''))throw new Error('Usage: replay-outbox.mjs status|<event UUID>');
const response=await fetch(env.KEYCLOAK_PUBLIC_URL+'/realms/'+env.KEYCLOAK_REALM+'/protocol/openid-connect/token',{
 method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:env.AUTOMATION_CLIENT_ID,client_secret:env.AUTOMATION_CLIENT_SECRET}),signal:AbortSignal.timeout(10000)});
if(!response.ok)throw new Error('Service authentication failed');
const token=(await response.json()).access_token;
const result=await fetch('http://localhost:'+env.APISIX_PORT+'/api/system/outbox'+(id==='status'?'':'/'+id+'/replay'),{
 method:id==='status'?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 ...(id==='status'?{}:{body:'{}'}),signal:AbortSignal.timeout(10000)});
if(!result.ok)throw new Error('Outbox operation failed: HTTP '+result.status);
console.log(JSON.stringify(await result.json(),null,2));
