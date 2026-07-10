/**
 * Fetch sentence MP3 from Duoreader live-translation API (same as web player).
 */

export const DUOREADER_AUDIO_SERVER = 'https://duoreader-api.botanisense.app';
export const DUOREADER_AUDIO_ENDPOINT = `${DUOREADER_AUDIO_SERVER}/tts`;

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
}

export function buildDuoreaderAudioUrl(
  text: string,
  lang: string,
  options: DuoreaderAudioFetchOptions = {},
): string {
  const params = new URLSearchParams();
  params.set('text', text);
  params.set('lang', lang === 'jp' ? 'ja' : lang);
  params.set('stream', 'false');
  params.set('encoding', 'MP3');
  params.set('sig', computeDuoreaderAudioSignature(text));
  if (options.speaker) params.set('speaker', options.speaker);
  if (options.rate != null) params.set('rate', String(options.rate));
  return `${DUOREADER_AUDIO_ENDPOINT}?${params.toString()}`;
}

export async function fetchDuoreaderAudio(
  text: string,
  lang: string,
  options: DuoreaderAudioFetchOptions = {},
): Promise<Uint8Array> {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('empty text');
  }
  const url = buildDuoreaderAudioUrl(trimmed, lang, options);
  const timeoutMs = options.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } catch (error: any) {
    clearTimeout(timer);
    const timedOut = error?.name === 'AbortError';
    throw new Error(timedOut ? `audio fetch timeout (${timeoutMs}ms)` : (error?.message || String(error)));
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
