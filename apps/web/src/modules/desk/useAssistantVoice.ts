// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantTurn } from './assistantApi';

type InputPhase = 'idle' | 'connecting' | 'listening' | 'paused';
export type PlaybackPhase = 'idle' | 'speaking' | 'paused';
interface RecognitionResult { results: ArrayLike<ArrayLike<{ transcript: string }>> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type VoiceBrowser = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function speechText(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, ' Đoạn mã được hiển thị trên màn hình. ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '')
    .replace(/[*_~`#>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16000);
}

export function useAssistantVoice({ conversationId, draft, onDraft, disabled }: {
  conversationId: string | null; draft: string; onDraft: (text: string) => void; disabled: boolean;
}) {
  const [inputPhase, setInputPhase] = useState<InputPhase>('idle');
  const [playback, setPlayback] = useState<{ id: string | null; phase: PlaybackPhase }>({ id: null, phase: 'idle' });
  const [error, setError] = useState('');
  const latest = useRef({ draft, onDraft });
  latest.current = { draft, onDraft };
  const recognition = useRef<Recognition | null>(null);
  const inputEpoch = useRef(0);
  const speech = useRef<{ id: string; phase: PlaybackPhase; chunks: string[]; index: number; utterance?: SpeechSynthesisUtterance } | null>(null);
  const browser = window as VoiceBrowser;
  const inputSupported = Boolean((browser.SpeechRecognition || browser.webkitSpeechRecognition) && window.isSecureContext !== false);
  const speechSupported = Boolean(window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined');

  const releaseInput = useCallback((notify = true, next: InputPhase = 'idle') => {
    inputEpoch.current++;
    const active = recognition.current;
    recognition.current = null;
    if (active) {
      active.onstart = active.onresult = active.onerror = active.onend = null;
      try { next === 'paused' ? active.stop() : active.abort(); } catch { /* already stopped */ }
    }
    if (notify) setInputPhase(next);
  }, []);

  const releaseSpeech = useCallback((notify = true) => {
    const active = speech.current;
    speech.current = null;
    if (active) {
      if (active.utterance) active.utterance.onend = active.utterance.onerror = null;
      window.speechSynthesis?.cancel();
    }
    if (notify) setPlayback({ id: null, phase: 'idle' });
  }, []);

  const stopAll = useCallback(() => { releaseInput(); releaseSpeech(); }, [releaseInput, releaseSpeech]);
  useEffect(() => {
    stopAll(); setError('');
    return () => { releaseInput(false); releaseSpeech(false); };
  }, [conversationId, stopAll, releaseInput, releaseSpeech]);
  useEffect(() => { if (disabled) stopAll(); }, [disabled, stopAll]);

  const startInput = useCallback(() => {
    const Constructor = (window as VoiceBrowser).SpeechRecognition || (window as VoiceBrowser).webkitSpeechRecognition;
    if (!Constructor || window.isSecureContext === false) {
      setError('Trình duyệt chưa hỗ trợ nhập giọng nói. Bạn vẫn có thể nhập bằng bàn phím.'); return;
    }
    releaseInput(); releaseSpeech(); setError('');
    const current = new Constructor();
    recognition.current = current;
    const epoch = inputEpoch.current;
    const base = latest.current.draft.trimEnd();
    const owns = () => recognition.current === current && inputEpoch.current === epoch;
    current.lang = 'vi-VN'; current.continuous = true; current.interimResults = true;
    current.onstart = () => { if (owns()) setInputPhase('listening'); };
    current.onresult = event => {
      if (!owns()) return;
      const heard = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim();
      const combined = [base, heard].filter(Boolean).join(' ');
      latest.current.onDraft(combined.slice(0, 8000));
      if (combined.length >= 8000) { releaseInput(true, 'paused'); setError('Đã đạt giới hạn 8.000 ký tự. Bạn có thể chỉnh sửa trước khi gửi.'); }
    };
    current.onend = () => { if (owns()) { recognition.current = null; setInputPhase('paused'); } };
    current.onerror = event => {
      if (!owns()) return;
      const messages: Record<string, string> = {
        'not-allowed': 'Micro chưa được cấp quyền. Cho phép micro trong trình duyệt hoặc tiếp tục nhập bằng bàn phím.',
        'service-not-allowed': 'Dịch vụ nhận giọng nói chưa được trình duyệt cho phép. Bạn có thể nhập bằng bàn phím.',
        'audio-capture': 'Không tìm thấy micro hoạt động. Kiểm tra kết nối micro rồi thử lại.',
        'no-speech': 'Chưa nghe được giọng nói. Bạn có thể thử lại hoặc nhập bằng bàn phím.',
        network: 'Nhận giọng nói đang mất kết nối. Nội dung đã nhận vẫn được giữ lại.',
      };
      releaseInput();
      if (event.error !== 'aborted') setError(messages[event.error] || 'Chưa nhận được giọng nói. Bạn có thể thử lại.');
    };
    setInputPhase('connecting');
    try { current.start(); } catch { releaseInput(); setError('Chưa mở được micro. Bạn thử lại hoặc nhập bằng bàn phím nhé.'); }
  }, [releaseInput, releaseSpeech]);

  const pauseInput = useCallback(() => releaseInput(true, 'paused'), [releaseInput]);
  const stopInput = useCallback(() => releaseInput(), [releaseInput]);
  const stopPlayback = useCallback(() => releaseSpeech(), [releaseSpeech]);
  const togglePlayback = useCallback(() => {
    const active = speech.current;
    if (!active) return;
    active.phase = active.phase === 'paused' ? 'speaking' : 'paused';
    if (active.phase === 'paused') window.speechSynthesis.pause(); else window.speechSynthesis.resume();
    setPlayback({ id: active.id, phase: active.phase });
  }, []);

  const readTurn = useCallback((turn: AssistantTurn) => {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setError('Trình duyệt chưa hỗ trợ đọc câu trả lời.'); return;
    }
    const text = speechText(turn.answer);
    if (!text || turn.status === 'pending') return;
    releaseInput(); releaseSpeech(); setError('');
    const chunks: string[] = [];
    let rest = text;
    while (rest) {
      const space = rest.slice(0, 800).lastIndexOf(' ');
      const end = rest.length <= 800 ? rest.length : space >= 400 ? space : 800;
      chunks.push(rest.slice(0, end)); rest = rest.slice(end).trimStart();
    }
    const active = { id: turn.id, phase: 'speaking' as PlaybackPhase, chunks, index: 0, utterance: undefined as SpeechSynthesisUtterance | undefined };
    speech.current = active;
    const next = () => {
      if (speech.current !== active) return;
      if (active.index >= active.chunks.length) { releaseSpeech(); return; }
      const utterance = new SpeechSynthesisUtterance(active.chunks[active.index]);
      utterance.lang = 'vi-VN';
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(item => item.lang.toLowerCase() === 'vi-vn') || voices.find(item => item.lang.toLowerCase().startsWith('vi'));
      if (voice) utterance.voice = voice;
      active.utterance = utterance;
      utterance.onend = () => { if (speech.current === active) { active.index++; next(); } };
      utterance.onerror = () => {
        if (speech.current === active) { releaseSpeech(); setError('Trình duyệt chưa đọc được câu trả lời. Bạn có thể thử lại.'); }
      };
      setPlayback({ id: active.id, phase: active.phase });
      window.speechSynthesis.speak(utterance);
    };
    next();
  }, [releaseInput, releaseSpeech]);

  return { inputSupported, speechSupported, inputPhase, playback, error, startInput, pauseInput, stopInput, readTurn, togglePlayback, stopPlayback, stopAll };
}
