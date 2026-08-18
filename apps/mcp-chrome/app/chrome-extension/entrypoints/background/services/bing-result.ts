/**
 * Bing dictionary result helpers — classification + rich-entry building.
 *
 * Extracted from BingDictionaryWorkerService so the orchestration (polling,
 * tab pool, lifecycle) stays separate from the pure "what does this scrape
 * mean / how do we turn it into a backend entry" logic. These functions hold no
 * service state: classify() + formatExplanation() are pure; buildEntry() only
 * needs the tab id (to capture media in-page via the Bing dictionary tool).
 */

import { bingDictionaryTool, BingDictionaryResult } from '../tools/browser/bing-dictionary';
import { logger } from '@/utils/logger';
import type { NormalizedWord } from '@/utils/task-words';

const LOG = 'Bing Worker';

/** One word's rich result, ready to ship to the Laravel write-back. */
export interface ResultEntry {
  word: string;
  md5?: string;
  translation: string;
  phonetic?: string;
  us_phonetic?: string;
  uk_phonetic?: string;
  // Bing sample images as captured BYTES (base64), each { base64, mime }. The
  // backend stores ONLY image_base64 (the remote *.bing.net URL is not fetchable
  // server-side — hot-link/referrer protected), so shipping URLs would silently
  // drop every image. We capture the bytes here and ship them.
  image_base64?: Array<{ base64: string; mime?: string }>;
  audio_base64?: string;
  audio_mime?: string;
  // Authoritative "Bing has any?" signals, set from whether a media URL EXISTED
  // on the page BEFORE capture — independent of whether the byte capture
  // succeeded. false = Bing genuinely has none for this word (the backend marks
  // it terminal so it is never re-queued); true + missing *_base64 = a URL
  // existed but capture failed transiently (stays eligible for retry).
  images_available?: boolean;
  audio_available?: boolean;
  // The headword Bing actually rendered on the result page (.hd_div strong). The
  // backend compares it (normalized) against the requested word and REJECTS a
  // mismatch — catches input confusion (a word typed into the wrong tab / a
  // redirect to a near-word) before the wrong translation is saved.
  page_word?: string;
  // The FULL remote Bing resource URLs (image *.bing.net + audio /dict/mediamp3).
  // Persisted so missing media can be RE-FETCHED in-page later without a full
  // re-translate. NOT fetchable server-side (referrer/cookie bound).
  image_urls?: string[];
  audio_url?: string;
  // True when the parallel howtopronounce mode contributed audio/phonetics/web
  // content for this word (filled by HowToPronouncePronunciationSource.mergeInto).
  // Extra field the Laravel writeback ignores; used for worker stats only.
  howtopronounce_audio?: boolean;
  provider: string;
}

/** classify() verdict + a human-readable reason for the DEBUG-center trace. */
export interface Classification {
  kind: 'translated' | 'invalid' | 'error';
  reason: string;
}

export const NO_RESULT_ERROR = 'No results found for this word';

/** Cap on sample images shipped per word — keeps the result payload lean. */
export const MAX_IMAGES_PER_WORD = 3;

/**
 * Decide what a single Bing lookup result means for the backend, with a
 * human-readable reason for the DEBUG-center trace.
 *
 * invalid  = a definitive "Bing has no entry for this word" — reported to
 *            Laravel via invalid_words[] (is_valid=false), NEVER a failure.
 * error    = a transient miss (region redirect / web fallback / load fail) —
 *            re-pended and retried; must NOT invalidate the word.
 */
export function classify(data: BingDictionaryResult | null): Classification {
  if (!data) {
    return { kind: 'error', reason: 'no data returned from page' };
  }

  // FIRST check: Bing's soft outage page is a GLOBAL transient, never a per-word
  // verdict — return 'error' before any 'invalid' branch (all of which require
  // success===true) so an outage can NEVER invalidate a word.
  if (data.outage) {
    return { kind: 'error', reason: 'Bing outage / service unavailable page' };
  }

  const hasContent =
    data.hasContent === true ||
    (data.hasContent === undefined &&
      ((data.translations?.length ?? 0) > 0 ||
        (data.phonetics?.length ?? 0) > 0 ||
        (data.sampleImages?.length ?? 0) > 0));

  if (data.success && hasContent) {
    return { kind: 'translated', reason: 'dictionary content found' };
  }

  // A CONFIRMED "No results found for <word>" page (keyword: "No results") is a
  // definitive no-entry — the word is invalid regardless of the dict-page
  // heuristic. The backend marks it is_valid=false and keeps it as a
  // placeholder so it is never re-queued.
  if (data.success && data.noEntry) {
    return { kind: 'invalid', reason: 'confirmed Bing "No results" page' };
  }

  // A machine-translation-only page (.lf_area .smt_hw, no real .qdef entry) — Bing
  // has no genuine dictionary record, only an auto-translation. The reference
  // scraper deletes such words; we mark it invalid so it is not re-queued forever.
  if (data.success && data.computerTranslate) {
    return { kind: 'invalid', reason: 'computer-translation only (no Bing dictionary entry)' };
  }

  // SAFETY: otherwise only a CONFIRMED dictionary page with no entry means the
  // word is genuinely invalid. A non-dict page (region redirect, web-search
  // fallback, load failure) must NOT invalidate the word — otherwise a regional
  // Bing outage would mass-flag the whole queue. Those are transient.
  const isDictPage = data.pageType === undefined || data.pageType === 'dict';
  if (isDictPage && data.success && (data.error === NO_RESULT_ERROR || !hasContent)) {
    return { kind: 'invalid', reason: 'dictionary page with no entry' };
  }

  const reason =
    data.pageType === 'non-dict'
      ? `non-dict/region-redirect page${data.error ? ` (${data.error})` : ''}`
      : data.error || 'no usable result';
  return { kind: 'error', reason };
}

/**
 * Build the rich result entry for one word. Audio + images are captured INSIDE
 * the Bing dictionary tab by the resident BingMediaFetcher class library: the
 * *.bing.net image CDN and the /dict/mediamp3 pronunciation are referrer/cookie
 * bound, so they can ONLY be read from within the page — a background or popup
 * fetch of the same URL returns a 403/broken body. The page returns raw bytes
 * (number[]), which we encode to base64 and ship; the backend persists
 * image_base64 + audio_base64 and never fetches a Bing URL server-side.
 */
export async function buildEntry(
  w: NormalizedWord,
  data: BingDictionaryResult,
  tabId: number,
): Promise<ResultEntry> {
  const formatted = formatExplanation(data);

  const entry: ResultEntry = {
    word: w.word,
    translation: formatted.text,
    provider: 'bing',
  };
  if (w.md5) entry.md5 = w.md5;
  if (formatted.phonetic) entry.phonetic = formatted.phonetic;
  if (formatted.us_phonetic) entry.us_phonetic = formatted.us_phonetic;
  if (formatted.uk_phonetic) entry.uk_phonetic = formatted.uk_phonetic;
  // The page headword Bing rendered — the backend cross-checks it vs the
  // requested word and rejects a mismatch (input-confusion guard).
  if (typeof data.word === 'string' && data.word.trim() !== '') {
    entry.page_word = data.word.trim();
  }

  await attachMedia(entry, data, tabId);
  return entry;
}

/**
 * Capture a word's sample images + pronunciation audio IN-PAGE and attach them
 * to the entry as base64. The image URLs and the chosen audio URL are handed to
 * fetchMediaInTab (the injected BingMediaFetcher), which fetch()es each one with
 * the dictionary page's own origin/referrer/cookies and returns the raw bytes.
 * A URL already captured as a data: URL (test path) is decoded directly. Media
 * is best-effort: a miss simply yields no bytes and never fails the word.
 */
async function attachMedia(
  entry: ResultEntry,
  data: BingDictionaryResult,
  tabId: number,
): Promise<void> {
  const imageUrls = (data.sampleImages || [])
    .map((s) => s.dataUrl || s.url)
    .filter((u): u is string => typeof u === 'string' && u !== '')
    .slice(0, MAX_IMAGES_PER_WORD);
  const audioUrl = pickAudioUrl(data);

  // Record what Bing HAD (before any capture) so the backend can mark a word
  // "checked, none available" and stop re-queuing it. A capture failure below
  // does NOT flip these to false — they reflect the page, not the download.
  entry.images_available = imageUrls.length > 0;
  entry.audio_available = audioUrl != null;

  // Persist the FULL remote Bing URLs (http only — never data: URLs) so missing
  // media can be re-fetched in-page later WITHOUT a re-translate.
  const remoteImageUrls = imageUrls.filter((u) => /^https?:/i.test(u));
  if (remoteImageUrls.length > 0) entry.image_urls = remoteImageUrls;
  if (audioUrl && /^https?:/i.test(audioUrl)) entry.audio_url = audioUrl;

  const { imageParts, audioBase64 } = await captureMediaInTab(tabId, imageUrls, audioUrl);
  if (imageParts.length > 0) entry.image_base64 = imageParts;
  if (audioBase64) {
    entry.audio_base64 = audioBase64;
    entry.audio_mime = 'audio/mpeg';
  }
}

/**
 * Capture media bytes IN-PAGE for a set of image URLs + an optional audio URL,
 * returning base64 parts. A data: URL is decoded locally; the rest are fetched
 * by the resident BingMediaFetcher (referrer/cookie-bound — only the page can
 * read them). Best-effort: a capture failure yields fewer bytes, never throws.
 */
export async function captureMediaInTab(
  tabId: number,
  imageUrls: string[],
  audioUrl: string | null,
): Promise<{ imageParts: Array<{ base64: string; mime?: string }>; audioBase64: string | null }> {
  const imageParts: Array<{ base64: string; mime?: string }> = [];
  let audioBase64: string | null = null;

  const remoteImages: string[] = [];
  for (const u of imageUrls) {
    const parts = dataUrlToParts(u);
    if (parts) imageParts.push(parts);
    else remoteImages.push(u);
  }
  let audioRemote: string | null = null;
  if (audioUrl) {
    const parts = dataUrlToParts(audioUrl);
    if (parts) audioBase64 = parts.base64;
    else audioRemote = audioUrl;
  }

  const toFetch = audioRemote ? [...remoteImages, audioRemote] : [...remoteImages];
  if (toFetch.length > 0) {
    try {
      const captured = await bingDictionaryTool.fetchMediaInTab(tabId, toFetch);
      const byUrl = new Map(captured.map((c) => [c.url, c]));
      for (const u of remoteImages) {
        const c = byUrl.get(u);
        if (c && c.ok && c.bytes && c.bytes.length > 0) {
          imageParts.push({ base64: byteArrayToBase64(c.bytes), mime: c.mime || undefined });
        }
      }
      if (audioRemote) {
        const c = byUrl.get(audioRemote);
        if (c && c.ok && c.bytes && c.bytes.length > 0) {
          audioBase64 = byteArrayToBase64(c.bytes);
        }
      }
    } catch (error) {
      logger.warn(LOG, 'In-page media capture failed', String(error));
    }
  }
  return { imageParts, audioBase64 };
}

/** Prefer the US pronunciation, else the first phonetic/voice URL available. */
function pickAudioUrl(data: BingDictionaryResult): string | null {
  const phonetics = data.phonetics || [];
  // Prefer the in-page base64 capture (data URL) so playback never re-requests
  // the remote mp3 (which can fail from the popup context).
  const us = phonetics.find(
    (p) => (p.audioDataUrl || p.audioUrl) && p.lang && p.lang.includes('US'),
  );
  if (us) return us.audioDataUrl || us.audioUrl;

  const any = phonetics.find((p) => p.audioDataUrl || p.audioUrl);
  if (any) return any.audioDataUrl || any.audioUrl;

  return data.voiceUrls && data.voiceUrls.length > 0 ? data.voiceUrls[0] : null;
}

/** Split a "data:<mime>;base64,<payload>" URL into { base64, mime }. */
function dataUrlToParts(dataUrl?: string): { base64: string; mime?: string } | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const meta = dataUrl.slice(5, comma);
  const base64 = dataUrl.slice(comma + 1);
  if (!base64) return null;
  const mime = meta.split(';')[0] || undefined;
  return { base64, mime };
}

/** Encode a plain number[] of 0–255 bytes (from the in-page fetcher) to base64. */
function byteArrayToBase64(bytes: number[]): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Flatten a Bing scrape into the multi-line explanation text + the US/UK/other
 * phonetics the dictionary row stores.
 */
export function formatExplanation(data: BingDictionaryResult): {
  text: string;
  phonetic?: string;
  us_phonetic?: string;
  uk_phonetic?: string;
} {
  const parts: string[] = [];
  // Short definitions (part of speech + gloss).
  if (data.translations && data.translations.length > 0) {
    data.translations.forEach((trans) => {
      const pos = trans.partOfSpeech ? `${trans.partOfSpeech}. ` : '';
      parts.push(`${pos}${trans.definition}`.trim());
    });
  }
  // Detailed Collins/Oxford definitions (Chinese gloss + English explanation).
  if (data.detailedDefinitions && data.detailedDefinitions.length > 0) {
    data.detailedDefinitions.forEach((d, i) => {
      const en = d.en ? ` — ${d.en}` : '';
      const line = `${i + 1}. ${d.cn}${en}`.trim();
      if (line) parts.push(line);
    });
  }
  // Web definitions (.df_div advanced blocks); the type label comes from the page.
  if (data.advancedTranslations && data.advancedTranslations.length > 0) {
    data.advancedTranslations.forEach((a) => {
      if (a.content) parts.push(`[${a.type}] ${a.content}`.trim());
    });
  }
  // Synonyms / antonyms.
  if (data.synonyms && data.synonyms.length > 0) {
    data.synonyms.forEach((s) => {
      if (s.words) parts.push(`[${s.type}] ${s.words}`.trim());
    });
  }
  // Example sentences (English + Chinese).
  if (data.examples && data.examples.length > 0) {
    data.examples.forEach((ex) => {
      parts.push(`• ${ex.en}${ex.cn ? '  ' + ex.cn : ''}`.trim());
    });
  }

  let phonetic = '';
  let usPhonetic = '';
  let ukPhonetic = '';
  if (data.phonetics && data.phonetics.length > 0) {
    data.phonetics.forEach((p) => {
      const lang = p.lang || '';
      if (lang.includes('US')) {
        usPhonetic = p.text;
      } else if (lang.includes('GB') || lang.includes('UK')) {
        // The helper labels UK pronunciation as 'en-GB' (not 'UK').
        ukPhonetic = p.text;
      } else if (!phonetic) {
        phonetic = p.text;
      }
    });
  }

  return {
    text: parts.join('\n'),
    phonetic: phonetic || usPhonetic || ukPhonetic || undefined,
    us_phonetic: usPhonetic || undefined,
    uk_phonetic: ukPhonetic || undefined,
  };
}
