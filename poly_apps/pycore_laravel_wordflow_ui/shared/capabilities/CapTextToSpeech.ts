/* =============================================================================
 * CapTextToSpeech — public, cross-platform TEXT-TO-SPEECH capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordflow_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): a vocabulary app lives and dies on pronunciation — tap a word,
 *   hear it; auto-read example sentences; karaoke-style word highlighting. Falls
 *   back to the browser SpeechSynthesis API.
 *
 * WHAT IT DOES
 *   - speak(text, options) with rate / pitch / volume / lang / voice.
 *   - A QUEUE so multiple words/sentences play in order (or flush + replace).
 *   - Voice catalog: enumerate, cache, and auto-pick the best voice per language.
 *   - On web, emits word-boundary events for karaoke highlighting (the native
 *     plugin can't, so it degrades to start/end only).
 *   - pause / resume / stop, plus a `speaking` state + rich events.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor-community/text-to-speech (OS voices, background-safe).
 *   - Web: window.speechSynthesis + SpeechSynthesisUtterance. On the web build
 *     the plugin is aliased to a SpeechSynthesis-backed shim.
 *
 * QUICK START
 *   import { capTTS, useTextToSpeech } from '@/shared/capabilities/CapTextToSpeech';
 *   await capTTS.speak('serendipity', { lang: 'en-US', rate: 0.9 });
 *   capTTS.on('boundary', ({ charIndex }) => highlightAt(charIndex));
 *   // React: const { speak, speaking, stop } = useTextToSpeech();
 * ========================================================================== */

import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  /** Index in the voice catalog (used by the native plugin's `voice` option). */
  index: number;
}

export interface CapTTSSpeakOptions {
  /** BCP-47 language tag, e.g. 'en-US', 'zh-CN'. Defaults to the service lang. */
  lang?: string;
  /** Speed 0.1..2 (clamped). Default from service (0.95). */
  rate?: number;
  /** Pitch 0..2. Default 1. */
  pitch?: number;
  /** Volume 0..1. Default 1. */
  volume?: number;
  /** Voice index from getVoices() (overrides automatic per-lang pick). */
  voice?: number;
  /** Flush the queue and speak immediately (default), or enqueue. */
  flush?: boolean;
}

export interface CapTTSBoundary {
  charIndex: number;
  charLength: number;
  text: string;
}

export interface CapTTSError {
  code: 'unsupported' | 'interrupted' | 'unknown';
  message: string;
}

export interface CapTTSEventMap {
  start: { id: number; text: string };
  end: { id: number; text: string };
  /** Web-only word boundary (for karaoke highlighting). */
  boundary: CapTTSBoundary;
  pause: void;
  resume: void;
  /** speaking state changed. */
  speakingchange: boolean;
  /** queue length changed. */
  queuechange: number;
  error: CapTTSError;
}

export type CapTTSListener<K extends keyof CapTTSEventMap> = (p: CapTTSEventMap[K]) => void;

export interface CapTTSOptions {
  defaultLang?: string;
  defaultRate?: number;
  defaultPitch?: number;
  defaultVolume?: number;
  logger?: (msg: string, ...args: unknown[]) => void;
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

class Emitter<M> {
  private map = new Map<keyof M, Set<(p: any) => void>>();
  on<K extends keyof M>(e: K, fn: (p: M[K]) => void): () => void {
    let s = this.map.get(e);
    if (!s) {
      s = new Set();
      this.map.set(e, s);
    }
    s.add(fn as any);
    return () => this.off(e, fn);
  }
  once<K extends keyof M>(e: K, fn: (p: M[K]) => void): () => void {
    const off = this.on(e, (p) => {
      off();
      fn(p);
    });
    return off;
  }
  off<K extends keyof M>(e: K, fn: (p: M[K]) => void): void {
    this.map.get(e)?.delete(fn as any);
  }
  emit<K extends keyof M>(e: K, p: M[K]): void {
    const s = this.map.get(e);
    if (!s) return;
    for (const fn of Array.from(s)) {
      try {
        fn(p);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[CapTextToSpeech] listener error', err);
      }
    }
  }
  clear(): void {
    this.map.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers (exported)
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function webSynth(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
  } catch {
    return null;
  }
}

/** Normalize a language tag to its primary subtag, e.g. 'en-US' -> 'en'. */
export function primaryLang(lang: string): string {
  return (lang || '').toLowerCase().split('-')[0];
}

/**
 * Pick the best voice for a language from a catalog: exact tag > same primary
 * subtag + localService > same primary subtag > default voice.
 */
export function pickVoiceForLang(voices: CapVoice[], lang: string): CapVoice | null {
  if (!voices.length) return null;
  const tag = lang.toLowerCase();
  const primary = primaryLang(lang);
  const exact = voices.find((v) => v.lang.toLowerCase() === tag);
  if (exact) return exact;
  const localPrimary = voices.find((v) => primaryLang(v.lang) === primary && v.localService);
  if (localPrimary) return localPrimary;
  const anyPrimary = voices.find((v) => primaryLang(v.lang) === primary);
  if (anyPrimary) return anyPrimary;
  return voices.find((v) => v.default) ?? voices[0];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const DEFAULTS: Required<Omit<CapTTSOptions, 'logger'>> & Pick<CapTTSOptions, 'logger'> = {
  defaultLang: 'en-US',
  defaultRate: 0.95,
  defaultPitch: 1,
  defaultVolume: 1,
  logger: undefined,
};

interface QueueItem {
  id: number;
  text: string;
  options: CapTTSSpeakOptions;
  resolve: () => void;
  reject: (e: CapTTSError) => void;
}

export class CapTextToSpeechService {
  private readonly opts: typeof DEFAULTS;
  private readonly native = safeIsNative();
  private readonly emitter = new Emitter<CapTTSEventMap>();

  private voices: CapVoice[] = [];
  private voicesLoaded = false;
  private queue: QueueItem[] = [];
  private speaking = false;
  private paused = false;
  private seq = 0;
  private currentWebUtterance: SpeechSynthesisUtterance | null = null;

  constructor(options: CapTTSOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  private log(msg: string, ...args: unknown[]): void {
    this.opts.logger?.(`[CapTextToSpeech] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }
  isSpeaking(): boolean {
    return this.speaking;
  }
  isPaused(): boolean {
    return this.paused;
  }
  queueLength(): number {
    return this.queue.length;
  }

  on<K extends keyof CapTTSEventMap>(e: K, fn: CapTTSListener<K>): () => void {
    return this.emitter.on(e, fn);
  }
  once<K extends keyof CapTTSEventMap>(e: K, fn: CapTTSListener<K>): () => void {
    return this.emitter.once(e, fn);
  }
  off<K extends keyof CapTTSEventMap>(e: K, fn: CapTTSListener<K>): void {
    this.emitter.off(e, fn);
  }

  /** Whether TTS is available at all. */
  async isSupported(): Promise<boolean> {
    if (this.native) return true;
    return !!webSynth() && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /** Load + cache the voice catalog (async; voices may populate lazily on web). */
  async loadVoices(force = false): Promise<CapVoice[]> {
    if (this.voicesLoaded && !force) return this.voices;
    try {
      const res = await TextToSpeech.getSupportedVoices();
      const raw = (res?.voices ?? []) as Array<{
        voiceURI: string;
        name: string;
        lang: string;
        localService: boolean;
        default: boolean;
      }>;
      this.voices = raw.map((v, index) => ({ ...v, index }));
      this.voicesLoaded = this.voices.length > 0;
    } catch (e) {
      this.log('loadVoices failed', e);
      this.voices = [];
    }
    return this.voices;
  }

  /** Synchronously read the cached voices (may be empty before loadVoices()). */
  getVoices(): CapVoice[] {
    return this.voices;
  }

  /** Best voice index for a language, or undefined if none cached. */
  voiceIndexForLang(lang: string): number | undefined {
    const v = pickVoiceForLang(this.voices, lang);
    return v?.index;
  }

  /**
   * Speak `text`. Resolves when this utterance finishes (or is flushed). By
   * default flushes the queue; pass { flush: false } to enqueue after current.
   */
  speak(text: string, options: CapTTSSpeakOptions = {}): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!text || !text.trim()) {
        resolve();
        return;
      }
      const item: QueueItem = { id: ++this.seq, text, options, resolve, reject };
      const flush = options.flush !== false;
      if (flush) {
        this.flushQueue('interrupted');
        this.queue = [item];
        void this.hardStop().then(() => this.processNext());
      } else {
        this.queue.push(item);
        this.emitter.emit('queuechange', this.queue.length);
        if (!this.speaking) this.processNext();
      }
    });
  }

  /** Convenience: speak a single word/phrase in a language. */
  speakWord(word: string, lang?: string): Promise<void> {
    return this.speak(word, { lang, flush: true });
  }

  private async processNext(): Promise<void> {
    const item = this.queue[0];
    if (!item) {
      this.setSpeaking(false);
      return;
    }
    if (!(await this.isSupported())) {
      const err: CapTTSError = { code: 'unsupported', message: 'TTS not available.' };
      this.queue.shift();
      item.reject(err);
      this.emitter.emit('error', err);
      this.emitter.emit('queuechange', this.queue.length);
      void this.processNext();
      return;
    }

    this.setSpeaking(true);
    this.emitter.emit('start', { id: item.id, text: item.text });
    try {
      if (this.native) await this.nativeSpeak(item);
      else await this.webSpeak(item);
      this.emitter.emit('end', { id: item.id, text: item.text });
      item.resolve();
    } catch (e) {
      const err = this.normalize(e);
      item.reject(err);
      this.emitter.emit('error', err);
    } finally {
      // Remove the finished/failed item (guard against flush having cleared it).
      if (this.queue[0] === item) this.queue.shift();
      this.emitter.emit('queuechange', this.queue.length);
      if (this.queue.length) void this.processNext();
      else this.setSpeaking(false);
    }
  }

  private async nativeSpeak(item: QueueItem): Promise<void> {
    const o = item.options;
    const lang = o.lang || this.opts.defaultLang;
    const voiceIndex = typeof o.voice === 'number' ? o.voice : this.voiceIndexForLang(lang);
    await TextToSpeech.speak({
      text: item.text,
      lang,
      rate: clamp(o.rate ?? this.opts.defaultRate, 0.1, 2),
      pitch: clamp(o.pitch ?? this.opts.defaultPitch, 0, 2),
      volume: clamp(o.volume ?? this.opts.defaultVolume, 0, 1),
      ...(typeof voiceIndex === 'number' ? { voice: voiceIndex } : {}),
      queueStrategy: 1, // we manage ordering ourselves
    } as any);
  }

  private webSpeak(item: QueueItem): Promise<void> {
    const synth = webSynth();
    if (!synth) return Promise.reject({ code: 'unsupported', message: 'No speechSynthesis' });
    return new Promise<void>((resolve, reject) => {
      const o = item.options;
      const lang = o.lang || this.opts.defaultLang;
      const u = new SpeechSynthesisUtterance(item.text);
      u.lang = lang;
      u.rate = clamp(o.rate ?? this.opts.defaultRate, 0.1, 10);
      u.pitch = clamp(o.pitch ?? this.opts.defaultPitch, 0, 2);
      u.volume = clamp(o.volume ?? this.opts.defaultVolume, 0, 1);
      const idx = typeof o.voice === 'number' ? o.voice : this.voiceIndexForLang(lang);
      if (typeof idx === 'number') {
        const list = synth.getVoices();
        if (list[idx]) u.voice = list[idx];
      }
      u.onboundary = (e) => {
        this.emitter.emit('boundary', {
          charIndex: e.charIndex,
          charLength: (e as any).charLength ?? 0,
          text: item.text,
        });
      };
      u.onend = () => {
        this.currentWebUtterance = null;
        resolve();
      };
      u.onerror = (e) => {
        this.currentWebUtterance = null;
        // "interrupted"/"canceled" happen on flush — treat as a clean stop.
        const reason = (e as any)?.error || '';
        if (reason === 'interrupted' || reason === 'canceled') resolve();
        else reject({ code: 'unknown', message: reason || 'tts error' });
      };
      this.currentWebUtterance = u;
      synth.speak(u);
    });
  }

  /** Pause playback (resumable). */
  async pause(): Promise<void> {
    if (!this.speaking || this.paused) return;
    this.paused = true;
    try {
      if (this.native) await (TextToSpeech as any).stop?.(); // plugin has no pause; emulate
      else webSynth()?.pause();
    } catch {
      /* ignore */
    }
    this.emitter.emit('pause', undefined);
  }

  /** Resume after pause (web only resumes; native restarts current item). */
  async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;
    try {
      if (!this.native) webSynth()?.resume();
    } catch {
      /* ignore */
    }
    this.emitter.emit('resume', undefined);
  }

  /** Stop everything and clear the queue. */
  async stop(): Promise<void> {
    this.flushQueue('interrupted');
    await this.hardStop();
    this.setSpeaking(false);
    this.emitter.emit('queuechange', 0);
  }

  private async hardStop(): Promise<void> {
    try {
      if (this.native) await TextToSpeech.stop();
      else webSynth()?.cancel();
    } catch {
      /* ignore */
    }
    this.currentWebUtterance = null;
    this.paused = false;
  }

  private flushQueue(code: CapTTSError['code']): void {
    if (!this.queue.length) return;
    const items = this.queue;
    this.queue = [];
    for (const it of items) it.reject({ code, message: 'Speech flushed.' });
  }

  private setSpeaking(v: boolean): void {
    if (this.speaking === v) return;
    this.speaking = v;
    this.emitter.emit('speakingchange', v);
  }

  private normalize(e: any): CapTTSError {
    if (e && typeof e === 'object' && 'code' in e && 'message' in e) return e as CapTTSError;
    return { code: 'unknown', message: String(e?.message || e || 'tts error') };
  }

  async dispose(): Promise<void> {
    await this.stop();
    this.emitter.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capTTS = new CapTextToSpeechService();
export const speak = (text: string, options?: CapTTSSpeakOptions): Promise<void> =>
  capTTS.speak(text, options);
export const speakWord = (word: string, lang?: string): Promise<void> => capTTS.speakWord(word, lang);
export const stopSpeaking = (): Promise<void> => capTTS.stop();

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseTextToSpeechResult {
  speaking: boolean;
  paused: boolean;
  queueLength: number;
  voices: CapVoice[];
  /** Latest web word-boundary char index (-1 when idle). */
  boundaryIndex: number;
  speak: (text: string, options?: CapTTSSpeakOptions) => Promise<void>;
  speakWord: (word: string, lang?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * React hook over the shared TTS service.
 *
 *   const { speak, speaking, boundaryIndex } = useTextToSpeech();
 *   <button onClick={() => speak(word, { lang: 'en-US' })} />
 */
export function useTextToSpeech(): UseTextToSpeechResult {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [voices, setVoices] = useState<CapVoice[]>(() => capTTS.getVoices());
  const [boundaryIndex, setBoundaryIndex] = useState(-1);

  useEffect(() => {
    let mounted = true;
    void capTTS.loadVoices().then((v) => mounted && setVoices(v));
    const offSpeak = capTTS.on('speakingchange', (s) => {
      setSpeaking(s);
      if (!s) setBoundaryIndex(-1);
    });
    const offQueue = capTTS.on('queuechange', setQueueLength);
    const offBoundary = capTTS.on('boundary', (b) => setBoundaryIndex(b.charIndex));
    const offPause = capTTS.on('pause', () => setPaused(true));
    const offResume = capTTS.on('resume', () => setPaused(false));
    return () => {
      mounted = false;
      offSpeak();
      offQueue();
      offBoundary();
      offPause();
      offResume();
    };
  }, []);

  return useMemo<UseTextToSpeechResult>(
    () => ({
      speaking,
      paused,
      queueLength,
      voices,
      boundaryIndex,
      speak: (text: string, options?: CapTTSSpeakOptions) => capTTS.speak(text, options),
      speakWord: (word: string, lang?: string) => capTTS.speakWord(word, lang),
      pause: () => capTTS.pause(),
      resume: () => capTTS.resume(),
      stop: () => capTTS.stop(),
    }),
    [speaking, paused, queueLength, voices, boundaryIndex],
  );
}

// ===========================================================================
// EXTENDED CAPABILITIES — spell-out, read-along sequences, repeat, lang guess
// ===========================================================================
//
// Higher-level pronunciation helpers for the wordnew study flows: spell a word
// letter-by-letter, read a list of words/sentences in order with per-item
// callbacks (for highlighting), and a heuristic language guesser so callers can
// auto-pick a voice when the content language isn't explicitly known.

/** Speaking-rate presets (multipliers); 'slow' is great for new vocabulary. */
export const RATE_PRESETS = {
  verySlow: 0.6,
  slow: 0.78,
  normal: 0.95,
  fast: 1.15,
  veryFast: 1.4,
} as const;

export type CapRatePreset = keyof typeof RATE_PRESETS;

/** Resolve a preset name OR a raw number to a rate value. */
export function resolveRate(rate: CapRatePreset | number | undefined, fallback = RATE_PRESETS.normal): number {
  if (typeof rate === 'number') return rate;
  if (rate && rate in RATE_PRESETS) return RATE_PRESETS[rate];
  return fallback;
}

/**
 * Heuristically guess a BCP-47 language tag from text (script-based). Returns
 * 'und' when undecided so callers can fall back to a configured default.
 */
export function guessLang(text: string): string {
  if (!text) return 'und';
  if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja-JP'; // kana
  if (/[가-힯]/.test(text)) return 'ko-KR'; // hangul
  if (/[一-鿿]/.test(text)) return 'zh-CN'; // han (default zh)
  if (/[Ѐ-ӿ]/.test(text)) return 'ru-RU'; // cyrillic
  if (/[؀-ۿ]/.test(text)) return 'ar'; // arabic
  if (/[฀-๿]/.test(text)) return 'th-TH'; // thai
  if (/[a-z]/i.test(text)) return 'en-US';
  return 'und';
}

/** Split a word into letters for spell-out (keeps combining marks together). */
export function toLetters(word: string): string[] {
  return Array.from(word.normalize('NFC')).filter((ch) => ch.trim().length > 0);
}

export interface CapSpeakSequenceItem {
  text: string;
  lang?: string;
  rate?: CapRatePreset | number;
}

export interface CapSpeakSequenceOptions {
  /** Gap (ms) between items. Default 250. */
  gapMs?: number;
  /** Called as each item starts (index into the array). */
  onItem?: (index: number, item: CapSpeakSequenceItem) => void;
  /** Default lang for items without one. */
  defaultLang?: string;
}

// ---------------------------------------------------------------------------
// Extended service-level helpers (free functions over the singleton)
// ---------------------------------------------------------------------------

const ttsSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Speak a word letter-by-letter ("c — a — t"). Resolves when done. */
export async function spellOut(word: string, lang?: string, perLetterRate: CapRatePreset | number = 'slow'): Promise<void> {
  const letters = toLetters(word);
  const rate = resolveRate(perLetterRate);
  for (let i = 0; i < letters.length; i++) {
    await capTTS.speak(letters[i], { lang, rate, flush: i === 0 });
    await ttsSleep(120);
  }
}

/**
 * Speak a list of items in order, calling `onItem` as each begins. Returns a
 * stop function (also stops the underlying TTS). Great for read-along lists.
 */
export function speakSequence(
  items: CapSpeakSequenceItem[],
  options: CapSpeakSequenceOptions = {},
): { promise: Promise<void>; stop: () => void } {
  let cancelled = false;
  const gap = options.gapMs ?? 250;
  const promise = (async () => {
    for (let i = 0; i < items.length; i++) {
      if (cancelled) return;
      const item = items[i];
      options.onItem?.(i, item);
      await capTTS.speak(item.text, {
        lang: item.lang ?? options.defaultLang,
        rate: resolveRate(item.rate),
        flush: i === 0,
      });
      if (cancelled) return;
      if (gap > 0) await ttsSleep(gap);
    }
  })();
  return {
    promise,
    stop: () => {
      cancelled = true;
      void capTTS.stop();
    },
  };
}

/** Speak the same text `times` times with a gap between repeats. */
export async function repeatSpeak(
  text: string,
  times: number,
  options: CapTTSSpeakOptions & { gapMs?: number } = {},
): Promise<void> {
  const gap = options.gapMs ?? 400;
  for (let i = 0; i < Math.max(1, times); i++) {
    await capTTS.speak(text, { ...options, flush: i === 0 });
    if (i < times - 1 && gap > 0) await ttsSleep(gap);
  }
}

// ---------------------------------------------------------------------------
// Extended React hooks
// ---------------------------------------------------------------------------

export interface UseReadAlongResult {
  /** The text split into words. */
  words: string[];
  /** Index of the word currently being spoken (-1 when idle). */
  activeWord: number;
  speaking: boolean;
  /** Start reading the text aloud (word highlighting via boundary events). */
  read: (options?: CapTTSSpeakOptions) => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Read-along hook: speaks `text` and reports which WORD is active, derived from
 * the web boundary char index. (On native, no boundaries → activeWord stays -1
 * but speaking still works.)
 *
 *   const { words, activeWord, read } = useReadAlong(sentence);
 */
export function useReadAlong(text: string, lang?: string): UseReadAlongResult {
  const [activeWord, setActiveWord] = useState(-1);
  const [speaking, setSpeaking] = useState(false);

  // Precompute word spans [start,end) over the source text.
  const { words, spans } = useMemo(() => {
    const w: string[] = [];
    const s: Array<[number, number]> = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      w.push(m[0]);
      s.push([m.index, m.index + m[0].length]);
    }
    return { words: w, spans: s };
  }, [text]);

  useEffect(() => {
    const offBoundary = capTTS.on('boundary', (b) => {
      if (b.text !== text) return;
      const idx = spans.findIndex(([start, end]) => b.charIndex >= start && b.charIndex < end);
      if (idx >= 0) setActiveWord(idx);
    });
    const offSpeak = capTTS.on('speakingchange', (s) => {
      setSpeaking(s);
      if (!s) setActiveWord(-1);
    });
    return () => {
      offBoundary();
      offSpeak();
    };
  }, [text, spans]);

  return {
    words,
    activeWord,
    speaking,
    read: (options?: CapTTSSpeakOptions) =>
      capTTS.speak(text, { lang: lang ?? (guessLang(text) === 'und' ? undefined : guessLang(text)), ...options }),
    stop: () => capTTS.stop(),
  };
}

export default capTTS;
