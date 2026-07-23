/** types/media.ts - media types: books, subtitles, dictionary words, library words, word media, bilingual. (extracted from WfNewApiTypes to keep each
 * source file under the 800-line modular limit; re-exported by the barrel). */
/** One chapter of a book, merged across languages. `titles[lang]` is null where a
 *  language has no chapter title (留空); `sentenceCount` is the verse count. */
export interface WfNewBookChapter {
  chapterIndex: number;
  corrId?: string;
  sentenceCount: number;
  titles: Record<string, string | null>;
}

/** A book's chapter list (GET /media/books/{key}/chapters). `chapterCount === 0`
 *  for a legacy/unstructured book (read it flat via getBookVerses with no chapter). */
export interface WfNewBookChapters {
  sourceKey: string;
  languages: string[];
  chapterCount: number;
  chapters: WfNewBookChapter[];
}

export interface WfNewAgentArticle {
  id: string;
  title: string;
  title_en?: string | null;
  title_cn?: string | null;
  reference_cn?: string | null;
  article_en?: string | null;
  source_key?: string | null;
  article_id?: string | null;
  audio_url?: string | null;
  word_count?: number | null;
  published_at?: string | null;
  reading_date?: string | null;
  created_at?: string | null;
  document_id?: string | null;
}

/** One audio variant on a sentence or word row. */
export interface WfAudioFileVariant {
  variantKey?: string;
  accent?: string;
  gender?: string;
  source?: string;
  voiceType?: string;
  provider?: string;
  path?: string;
  hasFile?: boolean;
  url?: string | null;
}

/** One language's cell on a verse: text + (lazily filled) audio. `hasAudio` is the
 *  backend flag (audio for book sentences is generated over time by the pycore
 *  sentence-TTS worker); `explanation` is optional AI enrichment. */
export interface WfNewBookVerseLang {
  text: string | null;
  /** Absolute audio URL (resolved against the endpoint host), or null. */
  audio: string | null;
  /** True once TTS audio exists for this cell (else play is disabled / "generating"). */
  hasAudio?: boolean;
  /** Laravel tts_status: pending | processing | completed | failed */
  ttsStatus?: string | null;
  /** Multi-variant clips (accent/gender/provider metadata). */
  audioFiles?: WfAudioFileVariant[];
  explanation?: string | null;
}

/** One verse/sentence slot. `text`/`language` are the primary-language fields;
 *  `languages[lang]` carries every checked language's text/audio (null = 留空). */
export interface WfNewBookVerse {
  grain: string;
  seq: number;
  chapterIndex?: number;
  /** Real reference within the chapter, e.g. "1:1" (Bible chapter:verse). */
  ref?: string | null;
  /** Sub-book name for one-book-with-chapters sources (e.g. "Genesis"). */
  book?: string | null;
  text: string | null;
  language: string | null;
  audio?: string | null;
  corrId?: string;
  languages?: Record<string, WfNewBookVerseLang>;
}

/** A page of a book's verses (GET /media/books/{key}?chapter_index=&page=). */
export interface WfNewBookVersesPage {
  items: WfNewBookVerse[];
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  /** Backend `has_more` flag (more pages after this one). */
  hasMore?: boolean;
}

// ---- Subtitle playback (GET /media/subtitles/{source_key}) ----------------

/** One subtitle/movie segment (a playable clip) with its media URLs. */
export interface WfNewSubtitleSegment {
  segIndex: number;
  startSec: number;
  endSec: number;
  subtitleCount?: number;
  /** Absolute clip URLs (HTTP impl resolves them against the endpoint host). */
  mp3Url?: string | null;
  mp4Url?: string | null;
  fullMp4Url?: string | null;
}

/** One subtitle line (a sentence). `text`/`language` are the primary-language
 *  fields; `languages[lang]` carries each language's text + audio for bilingual play. */
export interface WfNewSubtitleSentence {
  grain: string;
  seq: number;
  segIndex?: number;
  startSec?: number;
  endSec?: number;
  text: string | null;
  language: string | null;
  audio?: string | null;
  languages?: Record<string, { text: string | null; audio: string | null }>;
}

/** A subtitle source's full detail: the source row + ordered segments + a page of lines. */
export interface WfNewSubtitleDetail {
  sourceKey: string;
  title: string;
  language?: string;
  durationSec?: number;
  segments: WfNewSubtitleSegment[];
  sentences: {
    items: WfNewSubtitleSentence[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
  };
}

// ---- Dictionary words (GET /vocabulary/dictionary/words, paginated) --------

/** One dictionary word row with audio + translation, for the word-stats sidebar. */
export interface WfNewDictWord {
  content: string;
  md5: string;
  phonetic?: string;
  usPhonetic?: string;
  ukPhonetic?: string;
  /** Primary translation text (first available), for a compact row. */
  translation?: string;
  hasTranslation?: boolean;
  /** Absolute audio URL (resolved against the endpoint host), or null. */
  audioUrl?: string | null;
  ttsStatus?: string;
}

/** A page of dictionary words (start/limit pagination, with the grand total). */
export interface WfNewWordPage {
  words: WfNewDictWord[];
  total: number;
  start: number;
  limit: number;
  language: string;
}

// ---- Vocabulary library words (GET /vocabulary/libraries/{id}/words, paginated) ----

/** One word in a vocabulary library, with audio + image + explanation. */
export interface WfNewLibraryWord {
  /** 0-based position within the library. */
  index: number;
  word: string;
  md5: string;
  phonetic?: string;
  usPhonetic?: string;
  ukPhonetic?: string;
  /** Long-form definition/explanation. */
  explanation?: string;
  /** Translation strings (may be empty). */
  translations: string[];
  /** Absolute image URLs (resolved against the endpoint host). */
  images: string[];
  /** Absolute TTS audio URL, or null. */
  audioUrl: string | null;
  hasTranslation: boolean;
  hasAudio: boolean;
  hasImage: boolean;
  isValid: boolean;
  /** Laravel tts_status: pending | processing | completed | failed. */
  ttsStatus?: string | null;
  /** Multi-variant clips (canonical wire field from word-media resolve). */
  audioFiles?: WfAudioFileVariant[];
  /** Alias for audio_files on older payloads. */
  audioVariants?: WfAudioFileVariant[];
}

/** A page of a vocabulary library's words + the library header + aggregate stats. */
export interface WfNewLibraryWordsPage {
  library: { id: string; name: string; totalWords: number; language: string };
  words: WfNewLibraryWord[];
  stats: { total: number; translated: number; withAudio: number; withImage: number; invalid: number };
  pagination: { currentPage: number; perPage: number; total: number; lastPage: number; hasMore: boolean };
}

// ---- Word media on-demand (GET /word/{lang}/{word}/media) ------------------

/** Wire/storage accent value (contract D1). UI accents map: en-US/en-CA → 'us',
 *  en-GB/en-AU → 'uk'. Legacy files without an accent tag report 'unknown'. */
export type WfNewWordAccent = 'us' | 'uk';

/** One accent-specific audio rendition of a word (wire `audio_variants[]`). */
export interface WfNewWordAudioVariant {
  accent: WfNewWordAccent | 'unknown';
  /** Absolute audio URL, or null while this accent is still pending. */
  url: string | null;
  status: 'ready' | 'pending';
}

/**
 * On-demand media + dictionary detail for ONE word, from the file-first resolve
 * endpoint GET /api/app_qy_v1/word/{lang}/{word}/media. Calling this both READS
 * the current state AND triggers/prioritizes backend generation:
 *
 *   - `imageUrl` / `audioUrl` are non-null ONLY when the file already exists on
 *     disk (absolute, resolved against the endpoint host by the HTTP impl).
 *   - When a file is missing the backend ENQUEUES the work + bumps its priority
 *     and reports the corresponding status as 'pending'. So a UI can poll this a
 *     few times until status flips to 'ready' and the url appears.
 *   - With `?accent=us|uk`: when only ANOTHER accent's file exists the backend
 *     serves it (`accentFallback` true) and keeps a preferred-accent task
 *     pending — the UI plays the fallback but may keep polling for the
 *     preferred rendition (see `audioVariants`).
 */
export interface WfNewWordMedia {
  word: string;
  /** Backend content hash key for the word (stable dedupe id). */
  md5: string;
  language: string;
  /** Absolute image URL, or null while pending/absent. */
  imageUrl: string | null;
  /** Absolute audio URL, or null while pending/absent. */
  audioUrl: string | null;
  imageStatus: 'ready' | 'pending';
  audioStatus: 'ready' | 'pending';
  /** Accent of `audioUrl` ('unknown' = legacy untagged file); null/absent when
   *  no audio yet or the backend predates the accent contract. */
  audioAccent?: WfNewWordAccent | 'unknown' | null;
  /** True when `audioUrl` is NOT the requested accent (another accent served
   *  while the preferred one is still being generated). */
  accentFallback?: boolean;
  /** Per-accent renditions (wire `audio_variants`); empty on older backends. */
  audioVariants?: WfNewWordAudioVariant[];
  /** Canonical multi-variant clips (wire `audio_files`) from word-media resolve;
   *  same shape as book-reader sentence cells. Empty on older backends. */
  audioFiles?: WfAudioFileVariant[];
  /** Translation strings (may be empty). */
  translations: string[];
  explanation?: string;
  phonetic?: string;
  usPhonetic?: string;
  ukPhonetic?: string;
}

// ---- Auth -----------------------------------------------------------------

export interface SubtitleWord {
  text: string;
  translation: string;
  definition: string;
  phonetic: string;
  tags?: string[];
}

export interface SubtitleLine {
  startTime: number;
  endTime: number;
  text: string;
  translation: string;
  words: SubtitleWord[];
}

export interface SubtitleCourse {
  id: string;
  title: string;
  category: string;
  subtitles: SubtitleLine[];
}

// ---- Bilingual recital ----------------------------------------------------

export interface BilingualWord {
  text: string;
  phonetic: string;
  translation: string;
  definition: string;
}

export interface BilingualSentence {
  id: string;
  nativeLang: string;
  targetLang: string;
  targetText: string;
  nativeText: string;
  words: BilingualWord[];
}

// ---- Analytics ------------------------------------------------------------
