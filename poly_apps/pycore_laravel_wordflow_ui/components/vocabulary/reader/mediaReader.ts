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
 * Prefers the per-language correspondence map (v3); falls back to the flat
 * primary-language fields for legacy/non-v3 rows (where a present `audio`
 * string is treated as playable).
 */
export function resolveCell(s: ReaderSentence, lang?: string): ResolvedCell {
  if (s.languages && lang && s.languages[lang]) {
    const c = s.languages[lang];
    return { text: c.text, audioBare: c.audio, hasAudio: !!c.has_audio && !!c.audio };
  }
  return { text: s.text, audioBare: s.audio ?? null, hasAudio: !!s.audio };
}

/** The set of languages a sentence carries text/audio for (map keys, else its flat lang). */
export function sentenceLangs(s: ReaderSentence): string[] {
  if (s.languages) return Object.keys(s.languages);
  return s.language ? [s.language] : [];
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
