/**
 * Fetch sentence MP3 from Duoreader live-translation API (same as web player).
 */

export const DUOREADER_AUDIO_SERVER = 'https://duoreader-api.botanisense.app';
export const DUOREADER_AUDIO_ENDPOINT = `${DUOREADER_AUDIO_SERVER}/tts`;
export const DUOREADER_WEB_ORIGIN = 'https://web.duoreader.cn';

export const AUDIO_FETCH_MAX_RETRIES = 4;
export const AUDIO_FETCH_RETRY_BASE_MS = 800;
export const AUDIO_FETCH_MIN_INTERVAL_MS = 200;

let lastAudioFetchAt = 0;

/** Duoreader request signature (fnv-like hash → base36). */
export function computeDuoreaderAudioSignature(text: string): string {
  let hash = -2128831035;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i) + (hash << 5) + (hash >>> 2);
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}

export interface DuoreaderAudioFetchOptions {
  speaker?: string;
  rate?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export function buildDuoreaderAudioUrl(
  text: string,
  lang: string,
  options: DuoreaderAudioFetchOptions = {},
): string {
  const params = new URLSearchParams();
  params.set('text', text);
  const normalizedLang = lang === 'jp' ? 'ja' : lang === 'zh-CN' ? 'zh' : lang;
  params.set('lang', normalizedLang);
  params.set('stream', 'false');
  params.set('encoding', 'MP3');
  params.set('sig', computeDuoreaderAudioSignature(text));
  if (options.speaker) params.set('speaker', options.speaker);
  if (options.rate != null) params.set('rate', String(options.rate));
  return `${DUOREADER_AUDIO_ENDPOINT}?${params.toString()}`;
}

async function throttleAudioFetch(): Promise<void> {
  const now = Date.now();
  const wait = AUDIO_FETCH_MIN_INTERVAL_MS - (now - lastAudioFetchAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastAudioFetchAt = Date.now();
}

async function fetchDuoreaderAudioOnce(
  text: string,
  lang: string,
  options: DuoreaderAudioFetchOptions = {},
): Promise<Uint8Array> {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('empty text');
  }
  const url = buildDuoreaderAudioUrl(trimmed, lang, options);
  const timeoutMs = options.timeoutMs ?? 45000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    await throttleAudioFetch();
    res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'audio/mpeg,*/*',
        Referer: `${DUOREADER_WEB_ORIGIN}/`,
      },
    });
  } catch (error: unknown) {
    clearTimeout(timer);
    const err = error as { name?: string; message?: string };
    const timedOut = err?.name === 'AbortError';
    throw new Error(timedOut ? `audio fetch timeout (${timeoutMs}ms)` : (err?.message || String(error)));
  }
  clearTimeout(timer);
  if (!res.ok) {
    throw new Error(`Duoreader audio HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) {
    throw new Error('Duoreader audio empty body');
  }
  return new Uint8Array(buf);
}

export async function fetchDuoreaderAudio(
  text: string,
  lang: string,
  options: DuoreaderAudioFetchOptions = {},
): Promise<Uint8Array> {
  const maxRetries = options.maxRetries ?? AUDIO_FETCH_MAX_RETRIES;
  let lastError = 'unknown';
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fetchDuoreaderAudioOnce(text, lang, options);
    } catch (error: unknown) {
      const err = error as { message?: string };
      lastError = err?.message || String(error);
      const retryable = /HTTP 5\d\d|timeout|Failed to fetch|network/i.test(lastError);
      if (!retryable || attempt >= maxRetries - 1) {
        throw new Error(lastError);
      }
      const delay = AUDIO_FETCH_RETRY_BASE_MS * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(lastError);
}
