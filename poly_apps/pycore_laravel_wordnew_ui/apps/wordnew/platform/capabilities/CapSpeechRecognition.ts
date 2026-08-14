/* =============================================================================
 * CapSpeechRecognition — public, cross-platform SPEECH-TO-TEXT capability lib
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordnew_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): say a word and have it checked (pronunciation practice), or
 *   dictate a spoken answer. Falls back to the browser Web Speech API.
 *
 * WHAT IT DOES
 *   - Permission lifecycle (available / check / request).
 *   - One-shot `listenOnce()` (resolves with the best transcript) and a
 *     continuous mode that auto-restarts for dictation.
 *   - Partial + final result events; a live transcript/partial state.
 *   - A built-in PRONUNCIATION SCORER: compare what was heard to a target word
 *     and get a 0..100 similarity score + pass/fail (normalized edit distance).
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor-community/speech-recognition.
 *   - Web: window.SpeechRecognition / webkitSpeechRecognition. On the web build
 *     the plugin is aliased to a Web-Speech-API-backed shim.
 *
 * QUICK START
 *   import { capSTT, useSpeechRecognition, scorePronunciation } from
 *     '@/apps/wordnew/platform/capabilities/CapSpeechRecognition';
 *   const { matches } = await capSTT.listenOnce({ language: 'en-US' });
 *   const result = scorePronunciation('serendipity', matches);  // { score, passed }
 *   // React: const { listening, transcript, listen, stop } = useSpeechRecognition();
 * ========================================================================== */

import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TypedEventEmitter } from '../../../../core/events/TypedEventEmitter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapSTTPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface CapSTTOptions {
  /** BCP-47 language tag, e.g. 'en-US'. Default 'en-US'. */
  language?: string;
  /** Max alternative transcripts. Default 5. */
  maxResults?: number;
  /** Emit partial (interim) results while speaking. Default true. */
  partialResults?: boolean;
  /** Android-only popup prompt. */
  prompt?: string;
  /** Android-only system popup. Default false. */
  popup?: boolean;
}

export interface CapSTTResult {
  /** Best (first) transcript. */
  transcript: string;
  /** All alternative transcripts (best first). */
  matches: string[];
  /** Whether this is a final result. */
  isFinal: boolean;
}

export interface CapSTTError {
  code: 'unsupported' | 'permission-denied' | 'no-speech' | 'aborted' | 'busy' | 'unknown';
  message: string;
}

export interface CapSTTEventMap {
  /** A final recognized result. */
  result: CapSTTResult;
  /** An interim/partial result (while speaking). */
  partial: CapSTTResult;
  /** Listening actually started. */
  start: void;
  /** Listening stopped. */
  end: void;
  /** listening boolean changed. */
  listeningchange: boolean;
  error: CapSTTError;
}

export type CapSTTListener<K extends keyof CapSTTEventMap> = (p: CapSTTEventMap[K]) => void;

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pronunciation scoring helpers (exported — pure)
// ---------------------------------------------------------------------------

/** Normalize a string for comparison: lowercase, strip punctuation, collapse ws. */
export function normalizeForCompare(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Similarity 0..1 between two strings (1 = identical) via edit distance. */
export function similarity(a: string, b: string): number {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na && !nb) return 1;
  const maxLen = Math.max(na.length, nb.length) || 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

export interface CapPronunciationScore {
  /** 0..100 score against the best-matching alternative. */
  score: number;
  /** Whether the score met the pass threshold. */
  passed: boolean;
  /** The recognized alternative that scored highest. */
  bestMatch: string;
  /** The normalized target that was compared against. */
  target: string;
}

/**
 * Score how closely any of the recognized `matches` matches the `target` word
 * or phrase. Returns the best alternative's score (0..100). Default pass = 80.
 */
export function scorePronunciation(
  target: string,
  matches: string[] | CapSTTResult,
  passThreshold = 80,
): CapPronunciationScore {
  const list = Array.isArray(matches) ? matches : matches.matches;
  const tgt = normalizeForCompare(target);
  let best = '';
  let bestSim = 0;
  for (const m of list) {
    const sim = similarity(target, m);
    if (sim > bestSim) {
      bestSim = sim;
      best = m;
    }
  }
  const score = Math.round(bestSim * 100);
  return { score, passed: score >= passThreshold, bestMatch: best, target: tgt };
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function mapPerm(state: string | undefined): CapSTTPermission {
  switch (state) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
    case 'prompt-with-rationale':
      return 'prompt';
    default:
      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CapSpeechRecognitionService {
  private readonly native = safeIsNative();
  private readonly emitter = new TypedEventEmitter<CapSTTEventMap>('CapSpeechRecognition');
  private readonly logger?: (msg: string, ...args: unknown[]) => void;

  private listening = false;
  private continuous = false;
  private continuousOpts: CapSTTOptions = {};
  private partialHandle: { remove: () => Promise<void> } | null = null;
  private stateHandle: { remove: () => Promise<void> } | null = null;
  private wired = false;

  constructor(options: { logger?: (msg: string, ...args: unknown[]) => void } = {}) {
    this.logger = options.logger;
  }

  private log(msg: string, ...args: unknown[]): void {
    this.logger?.(`[CapSpeechRecognition] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }
  isListening(): boolean {
    return this.listening;
  }

  on<K extends keyof CapSTTEventMap>(e: K, fn: CapSTTListener<K>): () => void {
    return this.emitter.on(e, fn);
  }
  once<K extends keyof CapSTTEventMap>(e: K, fn: CapSTTListener<K>): () => void {
    return this.emitter.once(e, fn);
  }
  off<K extends keyof CapSTTEventMap>(e: K, fn: CapSTTListener<K>): void {
    this.emitter.off(e, fn);
  }

  /** Whether speech recognition is available on this platform. */
  async isAvailable(): Promise<boolean> {
    try {
      const r = await SpeechRecognition.available();
      return !!r.available;
    } catch {
      return false;
    }
  }

  /** Non-prompting permission check. */
  async checkPermission(): Promise<CapSTTPermission> {
    try {
      const r = await SpeechRecognition.checkPermissions();
      return mapPerm((r as any).speechRecognition);
    } catch {
      return 'unknown';
    }
  }

  /** Request permission (may prompt). */
  async requestPermission(): Promise<CapSTTPermission> {
    try {
      const r = await SpeechRecognition.requestPermissions();
      return mapPerm((r as any).speechRecognition);
    } catch {
      return 'denied';
    }
  }

  private async ensureListeners(): Promise<void> {
    if (this.wired) return;
    this.wired = true;
    try {
      this.partialHandle = await SpeechRecognition.addListener('partialResults', (data: any) => {
        const matches: string[] = data?.matches ?? [];
        if (matches.length) {
          this.emitter.emit('partial', {
            transcript: matches[0],
            matches,
            isFinal: false,
          });
        }
      });
      this.stateHandle = await SpeechRecognition.addListener('listeningState', (data: any) => {
        const started = data?.status === 'started';
        this.setListening(started);
      });
    } catch (e) {
      this.log('addListener failed', e);
    }
  }

  /**
   * Start listening. Final results arrive via the 'result' event; if start()
   * resolves with matches (web / some native configs) they are emitted too.
   * Use listenOnce() for a simple promise-based single capture.
   */
  async start(options: CapSTTOptions = {}): Promise<void> {
    if (this.listening) throw this.fail('busy', 'Already listening.');
    if (!(await this.isAvailable())) throw this.fail('unsupported', 'Speech recognition unavailable.');
    let perm = await this.checkPermission();
    if (perm !== 'granted') perm = await this.requestPermission();
    if (perm !== 'granted') throw this.fail('permission-denied', 'Microphone permission denied.');

    await this.ensureListeners();
    this.setListening(true);
    try {
      const res: any = await SpeechRecognition.start({
        language: options.language ?? 'en-US',
        maxResults: options.maxResults ?? 5,
        partialResults: options.partialResults ?? true,
        prompt: options.prompt,
        popup: options.popup ?? false,
      });
      // Web shim (and some native paths) resolve with final matches here.
      const matches: string[] = res?.matches ?? [];
      if (matches.length) {
        this.emitter.emit('result', { transcript: matches[0], matches, isFinal: true });
      }
    } catch (e) {
      this.setListening(false);
      throw this.normalize(e);
    } finally {
      // Native with listeners keeps state via listeningState; otherwise settle.
      if (!this.continuous) this.setListening(false);
    }

    if (this.continuous && this.listening !== false) {
      // Re-arm for the next utterance.
      void this.rearm();
    }
  }

  private async rearm(): Promise<void> {
    if (!this.continuous) return;
    try {
      await this.start(this.continuousOpts);
    } catch (e) {
      this.log('continuous rearm stopped', e);
      this.continuous = false;
      this.setListening(false);
    }
  }

  /** Listen for a single utterance and resolve with its final result. */
  listenOnce(options: CapSTTOptions = {}): Promise<CapSTTResult> {
    return new Promise<CapSTTResult>((resolve, reject) => {
      let settled = false;
      const offResult = this.on('result', (r) => {
        if (settled) return;
        settled = true;
        offResult();
        offErr();
        resolve(r);
      });
      const offErr = this.on('error', (e) => {
        if (settled) return;
        settled = true;
        offResult();
        offErr();
        reject(e);
      });
      this.start({ ...options, partialResults: options.partialResults ?? true }).catch((e) => {
        if (settled) return;
        settled = true;
        offResult();
        offErr();
        reject(e);
      });
    });
  }

  /** Start continuous dictation (auto-restarts until stop()). */
  async startContinuous(options: CapSTTOptions = {}): Promise<void> {
    this.continuous = true;
    this.continuousOpts = options;
    await this.start(options);
  }

  /** Stop listening (and cancel continuous mode). */
  async stop(): Promise<void> {
    this.continuous = false;
    try {
      await SpeechRecognition.stop();
    } catch (e) {
      this.log('stop failed', e);
    }
    this.setListening(false);
  }

  /** Languages the platform claims to support. */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      const r = await SpeechRecognition.getSupportedLanguages();
      return (r as any)?.languages ?? [];
    } catch {
      return [];
    }
  }

  private setListening(v: boolean): void {
    if (this.listening === v) return;
    this.listening = v;
    this.emitter.emit('listeningchange', v);
    this.emitter.emit(v ? 'start' : 'end', undefined);
  }

  private fail(code: CapSTTError['code'], message: string): CapSTTError {
    const e: CapSTTError = { code, message };
    this.emitter.emit('error', e);
    return e;
  }

  private normalize(e: any): CapSTTError {
    if (e && typeof e === 'object' && 'code' in e && 'message' in e) return e as CapSTTError;
    const msg = String(e?.message || e || 'recognition error');
    if (/no-speech/i.test(msg)) return { code: 'no-speech', message: msg };
    if (/denied|permission/i.test(msg)) return { code: 'permission-denied', message: msg };
    if (/abort/i.test(msg)) return { code: 'aborted', message: msg };
    return { code: 'unknown', message: msg };
  }

  async dispose(): Promise<void> {
    await this.stop();
    try {
      await this.partialHandle?.remove();
      await this.stateHandle?.remove();
      await SpeechRecognition.removeAllListeners();
    } catch {
      /* ignore */
    }
    this.partialHandle = null;
    this.stateHandle = null;
    this.wired = false;
    this.emitter.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capSTT = new CapSpeechRecognitionService();
export const listenOnce = (o?: CapSTTOptions): Promise<CapSTTResult> => capSTT.listenOnce(o);

/** One-shot: listen, then score against a target word. */
export async function checkPronunciation(
  target: string,
  options: CapSTTOptions = {},
  passThreshold = 80,
): Promise<CapPronunciationScore & { result: CapSTTResult }> {
  const result = await capSTT.listenOnce({ ...options });
  return { ...scorePronunciation(target, result, passThreshold), result };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseSpeechRecognitionResult {
  listening: boolean;
  /** Latest FINAL transcript. */
  transcript: string;
  /** Latest interim/partial transcript (cleared on final). */
  partial: string;
  /** All alternatives from the latest final result. */
  matches: string[];
  error: CapSTTError | null;
  listen: (options?: CapSTTOptions) => Promise<void>;
  listenOnce: (options?: CapSTTOptions) => Promise<CapSTTResult>;
  startContinuous: (options?: CapSTTOptions) => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * React hook over the shared speech-recognition service.
 *
 *   const { listening, transcript, partial, listenOnce } = useSpeechRecognition();
 */
export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partial, setPartial] = useState('');
  const [matches, setMatches] = useState<string[]>([]);
  const [error, setError] = useState<CapSTTError | null>(null);

  useEffect(() => {
    const offListen = capSTT.on('listeningchange', (v) => {
      setListening(v);
      if (v) {
        setError(null);
        setPartial('');
      }
    });
    const offResult = capSTT.on('result', (r) => {
      setTranscript(r.transcript);
      setMatches(r.matches);
      setPartial('');
    });
    const offPartial = capSTT.on('partial', (r) => setPartial(r.transcript));
    const offErr = capSTT.on('error', setError);
    return () => {
      offListen();
      offResult();
      offPartial();
      offErr();
    };
  }, []);

  return useMemo<UseSpeechRecognitionResult>(
    () => ({
      listening,
      transcript,
      partial,
      matches,
      error,
      listen: (options?: CapSTTOptions) => capSTT.start(options),
      listenOnce: (options?: CapSTTOptions) => capSTT.listenOnce(options),
      startContinuous: (options?: CapSTTOptions) => capSTT.startContinuous(options),
      stop: () => capSTT.stop(),
    }),
    [listening, transcript, partial, matches, error],
  );
}

// ===========================================================================
// EXTENDED CAPABILITIES — word-level analysis + multi-attempt drill
// ===========================================================================
//
// A richer pronunciation analyzer (per-word matched/score for highlighting),
// a best-of-N scorer for multi-attempt drills, and a React hook that runs a
// "say the word, get a score, try again" loop the wordnew practice screens use.

export interface CapWordScore {
  /** The target word. */
  word: string;
  /** Whether a heard word matched it closely enough. */
  matched: boolean;
  /** 0..100 similarity of the best heard word for this slot. */
  score: number;
  /** The heard word that best lined up with this target word (or ''). */
  heard: string;
}

export interface CapPronunciationAnalysis {
  /** Overall 0..100 score (best alternative, phrase-level). */
  score: number;
  passed: boolean;
  /** Per-target-word breakdown (great for coloring each word). */
  words: CapWordScore[];
  /** The recognized alternative used for the breakdown. */
  bestMatch: string;
}

/**
 * Analyze pronunciation at the WORD level: aligns the target words to the best
 * recognized alternative positionally and scores each. Useful to highlight
 * exactly which words were nailed vs missed in a sentence drill.
 */
export function analyzePronunciation(
  target: string,
  matches: string[] | CapSTTResult,
  passThreshold = 80,
  wordPassThreshold = 70,
): CapPronunciationAnalysis {
  const list = Array.isArray(matches) ? matches : matches.matches;
  const overall = scorePronunciation(target, list, passThreshold);
  const targetWords = normalizeForCompare(target).split(' ').filter(Boolean);
  const heardWords = normalizeForCompare(overall.bestMatch).split(' ').filter(Boolean);

  const words: CapWordScore[] = targetWords.map((tw, i) => {
    // Compare against the positional heard word AND its neighbors (±1) to be
    // tolerant of small insertions/deletions, taking the best.
    let best = 0;
    let bestHeard = '';
    for (let j = Math.max(0, i - 1); j <= Math.min(heardWords.length - 1, i + 1); j++) {
      const sim = similarity(tw, heardWords[j] ?? '');
      if (sim > best) {
        best = sim;
        bestHeard = heardWords[j] ?? '';
      }
    }
    const score = Math.round(best * 100);
    return { word: tw, matched: score >= wordPassThreshold, score, heard: bestHeard };
  });

  return { score: overall.score, passed: overall.passed, words, bestMatch: overall.bestMatch };
}

/** Score multiple attempts against a target, returning the best one. */
export function bestAttemptScore(
  target: string,
  attempts: Array<string[] | CapSTTResult>,
  passThreshold = 80,
): CapPronunciationScore {
  let best: CapPronunciationScore = {
    score: 0,
    passed: false,
    bestMatch: '',
    target: normalizeForCompare(target),
  };
  for (const a of attempts) {
    const s = scorePronunciation(target, a, passThreshold);
    if (s.score > best.score) best = s;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Extended React hook — pronunciation drill
// ---------------------------------------------------------------------------

export interface UsePronunciationDrillResult {
  listening: boolean;
  /** Latest analysis (null before the first attempt). */
  analysis: CapPronunciationAnalysis | null;
  /** Best score across all attempts this session. */
  bestScore: number;
  /** Number of attempts made. */
  attempts: number;
  error: CapSTTError | null;
  /** Run one attempt: listen, score against the target, update state. */
  attempt: () => Promise<CapPronunciationAnalysis | null>;
  /** Reset attempts/best for a new target word. */
  reset: () => void;
  stop: () => Promise<void>;
}

/**
 * "Say the word, get scored, try again" drill bound to a target word/phrase.
 *
 *   const { attempt, analysis, bestScore } = usePronunciationDrill('serendipity', { language: 'en-US' });
 *   <button onClick={attempt}>🎤 Say it</button>
 */
export function usePronunciationDrill(
  target: string,
  options: CapSTTOptions = {},
  passThreshold = 80,
): UsePronunciationDrillResult {
  const [listening, setListening] = useState(false);
  const [analysis, setAnalysis] = useState<CapPronunciationAnalysis | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<CapSTTError | null>(null);

  useEffect(() => {
    const off = capSTT.on('listeningchange', setListening);
    return off;
  }, []);

  // Reset whenever the target changes.
  useEffect(() => {
    setAnalysis(null);
    setBestScore(0);
    setAttempts(0);
    setError(null);
  }, [target]);

  const attempt = async (): Promise<CapPronunciationAnalysis | null> => {
    setError(null);
    try {
      const result = await capSTT.listenOnce(options);
      const a = analyzePronunciation(target, result, passThreshold);
      setAnalysis(a);
      setBestScore((prev) => Math.max(prev, a.score));
      setAttempts((n) => n + 1);
      return a;
    } catch (e) {
      setError(e as CapSTTError);
      return null;
    }
  };

  return {
    listening,
    analysis,
    bestScore,
    attempts,
    error,
    attempt,
    reset: () => {
      setAnalysis(null);
      setBestScore(0);
      setAttempts(0);
      setError(null);
    },
    stop: () => capSTT.stop(),
  };
}

export default capSTT;
