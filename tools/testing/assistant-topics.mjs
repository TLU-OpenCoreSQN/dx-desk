// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {classifySupportTopic} from '../../apps/assistant/policy.mjs';
import {chatStream,llmConfig} from '../../apps/assistant/llm.mjs';

const env = {...parseEnv(await readFile(process.env.DXDESK_TEST_ENV || '.env','utf8')), ...process.env};
const config = llmConfig(env);
if (!config.apiKey) throw new Error('Cần AI_API_KEY trong .env local để nghiệm thu chủ đề bằng mô hình thật.');
const cases = JSON.parse(await readFile(new URL('../../config/doanh-nghiep/assistant-evaluation.json',import.meta.url),'utf8'));
const report = {passed:false,model:config.chatModel,results:[]};
const delay = Number(process.env.DXDESK_TOPIC_DELAY_MS ?? 4500);
if (!Number.isFinite(delay) || delay < 0 || delay > 60000) throw new Error('DXDESK_TOPIC_DELAY_MS không hợp lệ.');
for (const item of cases) {
  let providerError;
  const actual = await classifySupportTopic(item.question,item.history ?? [],
    async function* (messages,tools,signal) {
      try { yield* chatStream(config,messages,tools,signal); }
      catch (error) { providerError = error.message; throw error; }
    },AbortSignal.timeout(90000));
  const passed = actual.topic === item.topic;
  report.results.push({id:item.id,expected:item.topic,actual:actual.topic,passed,...(providerError && {providerError})});
  console.log((passed ? 'PASS ' : 'FAIL ') + item.id + ': ' + actual.topic + (providerError ? ' (' + providerError + ')' : ''));
  if (delay) await new Promise(done=>setTimeout(done,delay));
}
report.passed = report.results.every(item=>item.passed);
await mkdir('.local/reports',{recursive:true});
await writeFile('.local/reports/assistant-topic-evaluation.json',JSON.stringify(report,null,2));
console.log(report.results.filter(item=>item.passed).length+'/'+cases.length+' topic cases passed');
if (!report.passed) process.exitCode=1;
