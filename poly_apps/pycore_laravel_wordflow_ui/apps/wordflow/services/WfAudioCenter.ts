/* [v4.1-Iris] Wf audio center — TTS playback helpers for the Wf shell
 * (qy_capacitor's VocabularyAudioCenter/TtsUrl.ts surface reduced to what the
 * ported pages use). Owns:
 *   - canonical TTS audio URL construction/repair (port of the TtsUrl.ts logic
 *     previously inlined in the word-detail page) with a ~24h in-memory URL
 *     cache, cleared on 'api-endpoint-changed' (URLs embed the base URL);
 *   - HTMLAudioElement playback of backend audio files;
 *   - a Web Speech API (speechSynthesis) fallback helper, as used by the
 *     listening player and word detail. */

import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { apiManager } from '../../../core/api-libs/wordflow/WordflowApiManager';
import { wfEventBus } from './WfEventBus';

/** Resolved-URL cache lifetime (~24 hours, matching the backend audio TTL). */
const URL_TTL_MS = 24 * 60 * 60 * 1000;

// The backend may have persisted legacy `audio_url` forms missing the
// `ai_tools` segment or the route prefix entirely; the single correct serving
// route is {origin}/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}[/{speed}]/{filename}.
const CANONICAL_TTS_PREFIX = '/api/app_qy_v1/ai_tools/tts/audio/';
const TTS_MARKER = 'tts/audio/';

export interface WfSpeakOptions {
  /** BCP-47-ish language tag for the utterance (e.g. 'en' / 'en-US'). */
  lang?: string;
  /** SpeechSynthesis rate (1.0 = normal). */
  rate?: number;
  /** Called when the utterance finishes normally. */
  onEnd?: () => void;
  /** Called when the utterance errors. */
  onError?: () => void;
}

class WfAudioCenterClass {
  private urlCache: Map<string, { url: string; at: number }> = new Map();

  constructor() {
    // Constructed URLs embed the active endpoint's base URL — drop them all
    // when the user re-points the API endpoint.
    wfEventBus.on('api-endpoint-changed', () => this.urlCache.clear());
  }

  private readCachedUrl(key: string): string | null {
    const entry = this.urlCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > URL_TTL_MS) {
      this.urlCache.delete(key);
      return null;
    }
    return entry.url;
  }

  private writeCachedUrl(key: string, url: string): string {
    this.urlCache.set(key, { url, at: Date.now() });
    return url;
  }

  /**
   * Repair a stored/legacy audio URL into the canonical absolute serving URL
   * (port of qy_capacitor/services/TtsUrl.ts). Absolute http(s) URLs pass
   * through untouched; anything else is re-rooted onto the canonical
   * ai_tools/tts/audio route of the active endpoint.
   */
  resolveAudioUrl(audioUrl: string): string {
    if (!audioUrl) return '';
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) return audioUrl;

    const key = `resolve:${audioUrl}`;
    const cached = this.readCachedUrl(key);
    if (cached) return cached;

    const markerIndex = audioUrl.indexOf(TTS_MARKER);
    const rest = markerIndex >= 0
      ? audioUrl.slice(markerIndex + TTS_MARKER.length)
      : audioUrl.replace(/^\/+/, '');
    return this.writeCachedUrl(key, `${apiManager.getCurrentBaseUrl()}${CANONICAL_TTS_PREFIX}${rest}`);
  }

  /**
   * Absolute URL for a generated TTS audio file
   * ({language}/{type}[/{speed}]/{filename}), built by wordflowApi and cached
   * for ~24h per parameter combination.
   */
  getTtsAudioUrl(language: string, type: string, filename: string, speed?: string | number): string {
    const key = `tts:${language}|${type}|${speed ?? ''}|${filename}`;
    const cached = this.readCachedUrl(key);
    if (cached) return cached;
    return this.writeCachedUrl(key, wordflowApi.getTtsAudioUrl(language, type, filename, speed));
  }

  /**
   * Play a backend audio file (repairing legacy URL forms first). Errors are
   * logged, never thrown — playback is best-effort.
   */
  playUrl(audioUrl: string): void {
    try {
      const audio = new Audio(this.resolveAudioUrl(audioUrl));
      audio.play().catch((err) => console.error('[WfAudioCenter] Audio play failed:', err));
    } catch (err) {
      console.error('[WfAudioCenter] Audio error:', err);
    }
  }

  /**
   * Play a word: its backend audio file when available, else the Web Speech
   * fallback (the word-detail page's original behavior).
   */
  playWord(opts: { audioUrl?: string | null; text?: string; lang?: string }): void {
    if (opts.audioUrl) {
      this.playUrl(opts.audioUrl);
      return;
    }
    this.speak(opts.text || '', { lang: opts.lang });
  }

  /** Whether the Web Speech API is available in this environment. */
  isSpeechAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Speak text via the Web Speech API, cancelling any in-flight utterance
   * first. Returns false when speech is unavailable or speaking throws — the
   * caller then runs its own fallback (e.g. a timer advance).
   */
  speak(text: string, opts: WfSpeakOptions = {}): boolean {
    if (!this.isSpeechAvailable() || !text) return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (opts.lang) utterance.lang = opts.lang;
      if (opts.rate !== undefined) utterance.rate = opts.rate;
      if (opts.onEnd) utterance.onend = () => opts.onEnd!();
      if (opts.onError) utterance.onerror = () => opts.onError!();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  /** Cancel any in-flight Web Speech utterance (safe no-op when unavailable). */
  cancelSpeech(): void {
    if (!this.isSpeechAvailable()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  /** Drop all cached URLs (e.g. for debugging / manual refresh). */
  clearCache(): void {
    this.urlCache.clear();
  }
}

export const wfAudioCenter = new WfAudioCenterClass();
