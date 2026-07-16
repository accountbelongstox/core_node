/**
 * Shared Puter.js txt2speech helper (browser-side word-audio generation).
 *
 * Used by wordnew (library auto-batch) AND pycore-manager (Queue Center
 * persistent "1000-word batch" bar). Puter.js runs in the browser and uses the
 * visitor's own Puter credits - never a server-side dependency. The synthesized
 * MP3 bytes are uploaded to laravel_main's /word/audio/upload for persistence.
 *
 * Language-aware: English respects the user's accent (us/uk -> Joanna/Amy);
 * other languages use a sensible default AWS Polly neural voice.
 */

const PUTER_SRC = 'https://js.puter.com/v2/';
let puterLoadPromise: Promise<boolean> | null = null;

export type WordAccent = 'us' | 'uk' | null;

export interface PuterSynthResult {
  /** Raw MP3 bytes (uploaded to Laravel). */
  blob: Blob;
  /** Object URL for immediate in-page playback (the Puter blob URL). */
  objectUrl: string;
}

/** Ensure the Puter SDK is loaded (idempotent). Resolves false when unavailable. */
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

/** Library language name (e.g. 'english') OR code (e.g. 'en') -> short code. */
const LANG_NAME_TO_CODE: Record<string, string> = {
  english: 'en', en: 'en',
  chinese: 'zh', zh: 'zh', 'zh-cn': 'zh', 'zh-tw': 'zh',
  japanese: 'ja', ja: 'ja',
  korean: 'ko', ko: 'ko',
  french: 'fr', fr: 'fr',
  german: 'de', de: 'de',
  spanish: 'es', es: 'es',
  italian: 'it', it: 'it',
  portuguese: 'pt', pt: 'pt',
  vietnamese: 'vi', vi: 'vi',
};

/** Normalize a library language (name or code) to a short lang code. */
export function langNameToCode(lang: string): string {
  const key = (lang || '').trim().toLowerCase();
  if (LANG_NAME_TO_CODE[key]) return LANG_NAME_TO_CODE[key];
  return key.length > 0 && key.length <= 3 ? key : 'en';
}

/** Per-language default Puter (AWS Polly) voice + BCP-47 tag. */
const LANG_VOICE: Record<string, { language: string; voice: string }> = {
  en: { language: 'en-US', voice: 'Joanna' },
  zh: { language: 'zh-CN', voice: 'Zhiyu' },
  ja: { language: 'ja-JP', voice: 'Mizuki' },
  ko: { language: 'ko-KR', voice: 'Seoyeon' },
  fr: { language: 'fr-FR', voice: 'Lea' },
  de: { language: 'de-DE', voice: 'Vicki' },
  es: { language: 'es-ES', voice: 'Lucia' },
  it: { language: 'it-IT', voice: 'Bianca' },
  pt: { language: 'pt-BR', voice: 'Camila' },
  vi: { language: 'vi-VN', voice: 'Hao' },
};

/** Pick a Puter voice/language for a lang code + optional English accent. */
function puterVoiceFor(
  code: string,
  accent?: WordAccent,
): { language: string; voice: string } {
  if (code === 'en') {
    return accent === 'uk'
      ? { language: 'en-GB', voice: 'Amy' }
      : { language: 'en-US', voice: 'Joanna' };
  }
  return LANG_VOICE[code] || { language: 'en-US', voice: 'Joanna' };
}

/**
 * Synthesize `text` via Puter.js txt2speech. Returns the audio blob + an object
 * URL for immediate playback, or null when Puter is unavailable / synth fails /
 * the payload is too small to be a real clip.
 */
export async function puterSynthesizeWord(
  text: string,
  lang: string,
  accent?: WordAccent,
): Promise<PuterSynthResult | null> {
  const t = (text || '').trim();
  if (!t) return null;
  const loaded = await ensurePuterLoaded();
  if (!loaded) return null;
  const code = langNameToCode(lang);
  const { language, voice } = puterVoiceFor(code, accent);
  try {
    const audio = await (window as any).puter.ai.txt2speech(t, {
      language,
      voice,
      engine: 'neural',
    });
    if (!audio || typeof audio.src !== 'string' || !audio.src) return null;
    const blob = await fetch(audio.src).then((r) => r.blob());
    if (!blob || blob.size < 100) return null;
    return { blob, objectUrl: audio.src };
  } catch {
    return null;
  }
}

/** Read a Blob as a raw base64 string (for JSON upload to Laravel). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result as string;
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Clean a word for TTS: decode HTML entities (&#x27; -> ', &amp; -> &, ...) then
 * replace every non-alphanumeric char (except CJK) with a single '-'. e.g.
 * ``distemp&#x27;rature`` -> ``distemp-rature``. Words with HTML markup or stray
 * punctuation would otherwise be spoken verbatim by Puter/edge-tts.
 */
export function cleanWordText(word: string): string {
  let s = (word || '').trim();
  if (!s) return '';
  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(s, 'text/html');
      s = doc.documentElement.textContent || s;
    }
  } catch {
    // keep raw when DOMParser is unavailable
  }
  s = s.replace(/[^A-Za-z0-9一-鿿]+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}
