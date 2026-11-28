// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { speechText, useAssistantVoice } from '../modules/desk/useAssistantVoice';
import type { AssistantTurn } from '../modules/desk/assistantApi';

class RecognitionMock {
  static instances: RecognitionMock[] = [];
  lang = ''; continuous = false; interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { RecognitionMock.instances.push(this); }
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(); abort = vi.fn();
  say(text: string) { this.onresult?.({ results: [[{ transcript: text }]] }); }
}
class UtteranceMock {
  lang = ''; voice: unknown;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
const synth = { speak: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(),
  getVoices: vi.fn(() => [{ name: 'Vietnamese', lang: 'vi-VN' }, { name: 'English', lang: 'en-US' }]) };
beforeEach(() => {
  vi.clearAllMocks(); RecognitionMock.instances = [];
  vi.stubGlobal('SpeechRecognition', RecognitionMock);
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  vi.stubGlobal('SpeechSynthesisUtterance', UtteranceMock);
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('isSecureContext', true);
});
afterEach(() => vi.unstubAllGlobals());
function mount() {
  return renderHook(({ session = 'first', disabled = false }) => {
    const [draft, setDraft] = useState('Máy Windows.');
    return { ...useAssistantVoice({ conversationId: session, draft, onDraft: setDraft, disabled }), draft, setDraft };
  }, { initialProps: { session: 'first', disabled: false } });
}
const turn = (id = 'answer', answer = 'Kiểm tra **VPN** theo [hướng dẫn](https://example.test).'): AssistantTurn => ({
  id, answer, question: 'VPN bị lỗi.', status: 'complete', created_at: '2026-11-28T10:00:00Z', metadata: { steps: [], sources: [] },
});

it('dictates Vietnamese, pauses for editing and resumes without replacing the edited draft', () => {
  const view = mount();
  act(() => view.result.current.startInput());
  const first = RecognitionMock.instances[0];
  expect(first.lang).toBe('vi-VN');
  act(() => first.say('VPN không kết nối.'));
  expect(view.result.current.draft).toBe('Máy Windows. VPN không kết nối.');
  const late = first.onresult!;
  act(() => view.result.current.pauseInput());
  expect(view.result.current.inputPhase).toBe('paused');
  expect(first.stop).toHaveBeenCalledOnce();
  act(() => view.result.current.setDraft('Đã chỉnh sửa.'));
  act(() => late({ results: [[{ transcript: 'kết quả cũ' }]] }));
  expect(view.result.current.draft).toBe('Đã chỉnh sửa.');
  act(() => view.result.current.startInput());
  act(() => RecognitionMock.instances[1].say('Tôi cần giúp.'));
  expect(view.result.current.draft).toBe('Đã chỉnh sửa. Tôi cần giúp.');
  act(() => view.result.current.stopInput());
  expect(view.result.current.inputPhase).toBe('idle');
});

it('permission denial preserves the draft and lets the user try again', () => {
  const view = mount();
  act(() => view.result.current.startInput());
  act(() => RecognitionMock.instances[0].onerror?.({ error: 'not-allowed' }));
  expect(view.result.current.error).toMatch(/chưa được cấp quyền/);
  expect(view.result.current.inputPhase).toBe('idle');
  expect(view.result.current.draft).toBe('Máy Windows.');
  act(() => view.result.current.startInput());
  expect(view.result.current.error).toBe('');
  expect(view.result.current.inputPhase).toBe('listening');
});

it('caps dictated text and stops the microphone at the message limit', () => {
  const view = mount();
  act(() => view.result.current.startInput());
  act(() => RecognitionMock.instances[0].say('a'.repeat(9000)));
  expect(view.result.current.draft).toHaveLength(8000);
  expect(view.result.current.inputPhase).toBe('paused');
  expect(view.result.current.error).toMatch(/8.000/);
});

it('reads an answer with a Vietnamese voice and supports pause, resume and stop', () => {
  const view = mount();
  act(() => view.result.current.readTurn(turn()));
  const utterance = synth.speak.mock.calls[0][0] as UtteranceMock;
  expect(utterance.text).toBe('Kiểm tra VPN theo hướng dẫn.');
  expect(utterance.lang).toBe('vi-VN');
  expect(utterance.voice).toEqual({ name: 'Vietnamese', lang: 'vi-VN' });
  act(() => view.result.current.togglePlayback());
  expect(view.result.current.playback.phase).toBe('paused');
  expect(synth.pause).toHaveBeenCalledOnce();
  act(() => view.result.current.togglePlayback());
  expect(view.result.current.playback.phase).toBe('speaking');
  expect(synth.resume).toHaveBeenCalledOnce();
  act(() => view.result.current.stopPlayback());
  expect(view.result.current.playback.phase).toBe('idle');
  expect(synth.cancel).toHaveBeenCalledOnce();
});

it('microphone and playback cannot listen to one another', () => {
  const view = mount();
  act(() => view.result.current.startInput());
  act(() => view.result.current.readTurn(turn()));
  expect(RecognitionMock.instances[0].abort).toHaveBeenCalledOnce();
  expect(view.result.current.inputPhase).toBe('idle');
  act(() => view.result.current.startInput());
  expect(synth.cancel).toHaveBeenCalledOnce();
  expect(view.result.current.playback.phase).toBe('idle');
});

it('changing conversation or submitting stops all voice activity and ignores old events', () => {
  const view = mount();
  act(() => view.result.current.readTurn(turn()));
  const lateEnd = (synth.speak.mock.calls[0][0] as UtteranceMock).onend!;
  view.rerender({ session: 'second', disabled: false });
  act(() => lateEnd());
  expect(view.result.current.playback.phase).toBe('idle');
  expect(synth.speak).toHaveBeenCalledOnce();
  act(() => view.result.current.startInput());
  const lateResult = RecognitionMock.instances[0].onresult!;
  view.rerender({ session: 'second', disabled: true });
  act(() => lateResult({ results: [[{ transcript: 'old' }]] }));
  expect(view.result.current.inputPhase).toBe('idle');
  expect(view.result.current.draft).toBe('Máy Windows.');
});

it('chunks long answers without restarting playback while paused and releases speech on unmount', () => {
  const view = mount();
  act(() => view.result.current.readTurn(turn('long', 'Nội dung. '.repeat(350))));
  const first = synth.speak.mock.calls[0][0] as UtteranceMock;
  expect(first.text.length).toBeLessThanOrEqual(800);
  act(() => view.result.current.togglePlayback());
  act(() => first.onend?.());
  expect(synth.speak).toHaveBeenCalledTimes(2);
  expect(view.result.current.playback.phase).toBe('paused');
  view.unmount();
  expect(synth.cancel).toHaveBeenCalledOnce();
});

it('unsupported speech recognition keeps manual input available', () => {
  vi.stubGlobal('SpeechRecognition', undefined);
  const view = mount();
  expect(view.result.current.inputSupported).toBe(false);
  act(() => view.result.current.setDraft('Nhập bằng bàn phím.'));
  expect(view.result.current.draft).toBe('Nhập bằng bàn phím.');
});

it('plain speech omits raw links, HTML and code fences', () => {
  expect(speechText('## Chào\n<b>bạn</b> [VPN](https://example.test)\n```sh\nsecret-command\n```')).toBe('Chào bạn VPN Đoạn mã được hiển thị trên màn hình.');
});
