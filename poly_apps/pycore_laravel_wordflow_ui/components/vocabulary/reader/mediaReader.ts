import { mediaUrl } from '../../../config/constants';
import type { ReaderSentence } from '../../../core/api/modules/MediaQueryAPI';

/**
 * Shared helpers for the book/document reader (MediaReaderModal).
 *
 * Sentence audio is stored as a BARE storage-relative path `{lang}/{content_id}.mp3`
 * (LangSentence.audio) — it is NOT a URL. The backend serves it under the static
 * sentence-sounds route, so a playable URL is:
 *   {api-origin}/static/app_qy_v1/sentence_sounds/{lang}/{content_id}.mp3
 * (see AppQyV1SentenceAudioUrl::PREFIX). mediaUrl() pins the API origin (:9000).
 */
const SENTENCE_SOUNDS_PREFIX = '/static/app_qy_v1/sentence_sounds/';

/** Turn a bare `{lang}/{content_id}.mp3` audio path into a playable absolute URL. */
export function readerAudioUrl(bare?: string | null): string | undefined {
  if (!bare) return undefined;
  // Already absolute / root-relative → let mediaUrl handle it verbatim.
  if (/^(https?:)?\/\//i.test(bare) || bare.startsWith('/')) return mediaUrl(bare);
  return mediaUrl(SENTENCE_SOUNDS_PREFIX + bare.replace(/^\/+/, ''));
}

/** Stable per-sentence key (unique within one source's loaded list). */
export function sentenceKey(s: ReaderSentence): string {
  return `${s.grain}-${s.seq}`;
}

export interface ResolvedCell {
  text: string | null;
  audioBare: string | null;
  /** Authoritative "has playable audio" — drives the audio icon enabled/disabled. */
  hasAudio: boolean;
}

/**
 * Resolve one sentence's text + audio for a chosen language.
 *
 * When the sentence carries a v3 correspondence map, the CHOSEN language's cell
 * is authoritative: if that language key is absent the verse is 留空 (empty text,
 * no audio) — we must NOT fall back to a different language's text/audio. The
 * flat primary-language fields are used only for legacy/non-v3 rows (no map) or
 * when no language is selected (single-language source).
 */
export function resolveCell(s: ReaderSentence, lang?: string): ResolvedCell {
  if (s.languages && lang) {
    const c = s.languages[lang];
    if (c) return { text: c.text, audioBare: c.audio, hasAudio: !!c.has_audio && !!c.audio };
    return { text: null, audioBare: null, hasAudio: false };   // selected language absent → 留空
  }
  return { text: s.text, audioBare: s.audio ?? null, hasAudio: !!s.audio };
}

/** The set of languages a sentence carries text/audio for (map keys, else its flat lang). */
export function sentenceLangs(s: ReaderSentence): string[] {
  if (s.languages) return Object.keys(s.languages);
  return s.language ? [s.language] : [];
}

/** Union of every language across a batch of sentences (map keys, else flat lang). */
export function collectLangs(items: ReaderSentence[]): string[] {
  const set = new Set<string>();
  for (const s of items) for (const l of sentenceLangs(s)) if (l) set.add(l);
  return Array.from(set);
}

/**
 * Pick the best default reading language: the one (from `langs`) with the most
 * non-empty text across `items`. Guards against a seeded-but-empty language
 * being langs[0] (which — with resolveCell's no-fallback rule — would render the
 * whole source blank). Falls back to langs[0] when nothing is populated.
 */
export function bestLang(items: ReaderSentence[], langs: string[]): string {
  if (langs.length <= 1) return langs[0] || '';
  let best = langs[0];
  let bestCount = -1;
  for (const l of langs) {
    let n = 0;
    for (const s of items) if (resolveCell(s, l).text) n += 1;
    if (n > bestCount) { bestCount = n; best = l; }
  }
  return best;
}

/** Chapter title: prefer the chosen language, then any non-empty title, then a default. */
export function chapterTitle(titles: Record<string, string | null> | undefined, lang: string, chapterIndex: number): string {
  if (titles) {
    const byLang = titles[lang];
    if (byLang) return byLang;
    const firstNonEmpty = Object.values(titles).find((v) => !!v);
    if (firstNonEmpty) return firstNonEmpty as string;
  }
  return `Chapter ${chapterIndex + 1}`;
}
