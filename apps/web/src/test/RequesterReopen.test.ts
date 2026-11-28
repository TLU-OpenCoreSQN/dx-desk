// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import {expect,it} from 'vitest';
import {getAllowedTransitions,REQUESTER_REOPEN_WINDOW_MS,withinRequesterReopenWindow} from '../lib/ticketWorkflow';

it('requester reopen includes exactly seven days and excludes invalid or future resolution times',()=>{
  const resolved='2026-11-20T10:00:00Z';
  const end=Date.parse(resolved)+REQUESTER_REOPEN_WINDOW_MS;
  expect(withinRequesterReopenWindow(resolved,end)).toBe(true);
  expect(withinRequesterReopenWindow(resolved,end+1)).toBe(false);
  expect(withinRequesterReopenWindow(resolved,Date.parse(resolved)-1)).toBe(false);
  expect(withinRequesterReopenWindow(null,end)).toBe(false);
  expect(withinRequesterReopenWindow('invalid',end)).toBe(false);
});

it('only the owner sees the customer reopen edge, while staff retains its existing reopen action',()=>{
  const allowed=getAllowedTransitions('resolved',['Employee'],{isRequester:true,canRequesterReopen:true});
  expect(allowed.some(edge=>edge.label==='Chưa khắc phục được')).toBe(true);
  expect(getAllowedTransitions('resolved',['Employee'],{isRequester:false,canRequesterReopen:true})).toEqual([]);
  expect(getAllowedTransitions('resolved',['Employee'],{isRequester:true,canRequesterReopen:false}).some(edge=>edge.to==='in_progress')).toBe(false);
  expect(getAllowedTransitions('resolved',['Agent'],{isRequester:false}).some(edge=>edge.label==='Mở lại để xử lý')).toBe(true);
  expect(getAllowedTransitions('closed',['Employee'],{isRequester:true,canRequesterReopen:true})).toEqual([]);
});
