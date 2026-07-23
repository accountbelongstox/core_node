/**
 * wfWordAudioFallback — accent mapping + tiered playback fallbacks for word
 * audio while the backend rendition is missing/pending. Pure helpers, no React.
 *
 * Tiers used by the play path (WfNewLibraryPage):
 *   1. preferred-accent backend URL (audioVariants / audioAccent match),
 *   2. any-accent backend URL (accent fallback),
 *   3. speechSynthesis with an accent-matched voice (always-available resort),
 *   4. OPT-IN external services (default OFF, `externalAudioSources` setting):
 *      dictionaryapi.dev phonetics audio + Puter.js txt2speech (script is
 *      lazy-injected ONLY when the setting is enabled). Tried before tier 3
 *      when enabled, since they return real recordings.
 */
import type { WfNewWordAccent, WfNewWordMedia } from '../api';

/** UI accent (Settings voiceAccent, e.g. 'en-GB') → wire accent (contract D1). */
export function mapUiAccent(uiAccent: string): WfNewWordAccent {
  return uiAccent === 'en-GB' || uiAccent === 'en-AU' ? 'uk' : 'us';
}

/** Wire accent → BCP-47 tag for speechSynthesis / Puter. */
export function accentToBcp47(accent: WfNewWordAccent): 'en-US' | 'en-GB' {
  return accent === 'uk' ? 'en-GB' : 'en-US';
}

/** A resolved backend audio choice for one word (tiers 1–2). */
export interface WfWordAudioPick {
  url: string | null;
  /** Accent of the picked url ('unknown' = legacy untagged file). */
  accent: WfNewWordAccent | 'unknown' | null;
  /** True when the picked url is NOT the preferred accent (tier 2). */
  isFallback: boolean;
}

/**
 * Pick the best available backend URL: preferred-accent variant first, then
 * any served/ready rendition (accent fallback), then the page-payload url.
 */
export function pickWordAudioUrl(
  baseUrl: string | null,
  media: WfNewWordMedia | undefined,
  preferred: WfNewWordAccent,
): WfWordAudioPick {
  // Tier 1: preferred accent — a ready variant, or the served url when tagged so.
  const variants = media?.audioVariants ?? [];
  const exact = variants.find((v) => v.accent === preferred && v.status === 'ready' && v.url);
  if (exact?.url) return { url: exact.url, accent: preferred, isFallback: false };
  if (media?.audioUrl && media.audioAccent === preferred && !media.accentFallback) {
    return { url: media.audioUrl, accent: preferred, isFallback: false };
  }
  // Tier 2: any accent — the served url, any ready variant, or the page payload.
  if (media?.audioUrl) {
    return { url: media.audioUrl, accent: media.audioAccent ?? 'unknown', isFallback: true };
  }
  const anyReady = variants.find((v) => v.status === 'ready' && v.url);
  if (anyReady?.url) return { url: anyReady.url, accent: anyReady.accent, isFallback: true };
  if (baseUrl) return { url: baseUrl, accent: 'unknown', isFallback: true };
  return { url: null, accent: null, isFallback: false };
}

/**
 * Tier 3 — speechSynthesis with an accent-matched voice. Returns false when the
 * Web Speech API is unavailable or speaking throws (caller may ignore: last resort).
 */
export function speakWordWithAccent(
  word: string,
  accent: WfNewWordAccent,
  opts: { rate?: number; onEnd?: () => void } = {},
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !word) return false;
  try {
    const lang = accentToBcp47(accent);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang;
    if (opts.rate !== undefined) utterance.rate = opts.rate;
    // Prefer an exact-locale voice; getVoices() may be empty pre-warm — the
    // utterance.lang assignment above still steers the default voice then.
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang === lang || v.lang.replace('_', '-') === lang);
    if (voice) utterance.voice = voice;
    if (opts.onEnd) {
      utterance.onend = () => opts.onEnd!();
      utterance.onerror = () => opts.onEnd!();
    }
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/**
 * The browser's installed speech voices, shaped for the practice voice picker.
 * Empty when the list hasn't loaded yet — getVoices() is async in some browsers;
 * the UI re-reads this on the `voiceschanged` event.
 */
export function listPracticeVoices(): { uri: string; label: string; lang: string }[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  try {
    return window.speechSynthesis.getVoices().map((v) => ({
      uri: v.voiceURI,
      label: `${v.name} (${v.lang})`,
      lang: v.lang,
    }));
  } catch {
    return [];
  }
}

/**
 * Resolve the SpeechSynthesisVoice for the recite fallback. Order: the user-chosen
 * voiceURI, then an accent-matched locale (mirrors speakWordWithAccent), then any
 * en-* voice, then the first available. Null when the API is unavailable or no
 * voices are loaded yet.
 */
export function resolvePracticeVoice(
  voiceUri: string,
  accent: WfNewWordAccent,
): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  let voices: SpeechSynthesisVoice[];
  try {
    voices = window.speechSynthesis.getVoices();
  } catch {
    return null;
  }
  if (!voices.length) return null;
  if (voiceUri) {
    const chosen = voices.find((v) => v.voiceURI === voiceUri);
    if (chosen) return chosen;
  }
  const lang = accentToBcp47(accent);
  const exact = voices.find((v) => v.lang === lang || v.lang.replace('_', '-') === lang);
  if (exact) return exact;
  const anyEn = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en'));
  if (anyEn) return anyEn;
  return voices[0] ?? null;
}

// --- Puter.js txt2speech (external, opt-in) --------------------------------- #

const PUTER_SRC = 'https://js.puter.com/v2/';
let puterLoadPromise: Promise<boolean> | null = null;

/** Lazy-inject the Puter.js script ONCE — called ONLY when the opt-in setting
 *  is enabled (temp-account credit cliff + sign-in popup: never load eagerly). */
export function ensurePuterLoaded(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  if ((window as any).puter?.ai?.txt2speech) return Promise.resolve(true);
  if (!puterLoadPromise) {
    puterLoadPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = PUTER_SRC;
      script.async = true;
      script.onload = () => resolve(!!(window as any).puter?.ai?.txt2speech);
      script.onerror = () => {
        puterLoadPromise = null; // allow a later retry
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }
  return puterLoadPromise;
}

/**
 * Speak a word via Puter.js txt2speech (accent-matched neural voice). Resolves
 * to the playable HTMLAudioElement, or null when Puter is unavailable/fails.
 */
export async function puterSpeakWord(
  word: string,
  accent: WfNewWordAccent,
): Promise<HTMLAudioElement | null> {
  const loaded = await ensurePuterLoaded();
  if (!loaded) return null;
  try {
    const audio = await (window as any).puter.ai.txt2speech(word, {
      language: accentToBcp47(accent),
      voice: accent === 'uk' ? 'Amy' : 'Joanna',
      engine: 'neural',
    });
    return audio instanceof HTMLAudioElement ? audio : null;
  } catch {
    return null;
  }
}
