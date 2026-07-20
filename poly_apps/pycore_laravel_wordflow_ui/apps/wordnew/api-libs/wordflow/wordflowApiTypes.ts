/** wordflowApiTypes - the type/interface/constants surface for the wordflow
 * backend client, extracted from WordflowApi so the service class file stays
 * under the 800-line modular limit. All exported verbatim (no rename). */

export interface VocabularyRecommendation {
  id: number;
  name: string;
  lang_code: string;
  total_words: number;
  level: string;
  category: string;
  is_selected: boolean;
  is_popular: boolean;
  difficulty: number;
  estimated_days: number;
  description: string;
}

/**
 * Verified row shape of the personal-dictionary endpoints
 * (AppQyV1PersonalDictionaryQueryController::formatEntry).
 */
export interface PersonalDictionaryEntry {
  id: string;
  word: string;
  definition: string | null;
  example: string | null;
  notes: string | null;
  language: string | null;
  created_at: string | null;
}

/**
 * Verified success data of POST /ai_tools/article/preview
 * (AppQyV1ArticleController::previewParsing).
 */
export interface ArticlePreviewResult {
  sentences: string[];
  words: string[];
  word_frequency: Record<string, number>;
  total_sentences: number;
  total_words: number;
  unique_words: number;
}

/**
 * Verified success data of POST /ai_tools/article/submit
 * (AppQyV1ArticleController::submitArticle). task_id is null when neither
 * sentence nor word audio generation was requested.
 */
export interface ArticleSubmitResult {
  article_id: string;
  task_id: string | null;
  tts_status: 'processing' | 'not_requested';
  article: {
    title: string | null;
    language: string;
    article_type: string;
    total_sentences: number;
    total_words: number;
    unique_words: number;
  };
  sentences: Array<{ text: string; audio_url: string | null; status: string }>;
  words: Array<{ word: string; frequency: number; audio_url: string | null; status: string }>;
}

/**
 * Verified success data of GET /ai_tools/article/task/{taskId}
 * (AppQyV1ArticleController::getTaskStatus). sentences/words (audio mappings)
 * only appear once status === 'completed' and the task cache is still warm.
 */
export interface ArticleTaskStatus {
  task_id: string;
  article_id?: string;
  status: string; // pending | processing | completed | failed
  progress?: number;
  error?: string | null;
  total_sentences?: number;
  total_words?: number;
  unique_words?: number;
  sentences?: Array<{ text: string; audio_url: string | null; status: string }>;
  words?: Array<{ word: string; audio_url: string | null; status: string }>;
  note?: string;
}

/** Verified shape of /group/get_progress_stats → data.stats. */
export interface GroupProgressStats {
  total_words: number;
  avg_proficiency: number;
  total_reads: number;
  total_reviews: number;
  mastered_words: number;
  learning_words: number;
  struggling_words: number;
  due_for_review: number;
}

// ---- Per-group JSON progress blob ----
// Backend contract (2026-06-12, implemented in parallel with this client):
// AUTH POST /group/get_progress_blob {gid} returns the ENTIRE group's per-word
// progress map in ONE response (no pagination, no 65k limits) using compressed
// short keys decoded via the response `legend`. Stats aggregation moves
// CLIENT-SIDE (apps/wordflow/services/WfProgressCenter.ts) — the user
// directive is JSON 运算尽量交由前端.

/**
 * Compressed per-word entry of POST /group/get_progress_blob →
 * data.words["<word_id>"]. Short-key meanings come from the response `legend`
 * (fr=first_read_at, lr=last_read_at, lv=last_review_at, nr=next_review_at,
 * rc=read_count, vc=review_count, wt=weight, pf=proficiency, aa=added_at).
 * The index signature tolerates short keys this client does not know yet —
 * expandProgressEntry() passes them through unchanged.
 */
export interface WfProgressEntryShort {
  fr?: string | null;
  lr?: string | null;
  lv?: string | null;
  nr?: string | null;
  rc?: number | null;
  vc?: number | null;
  wt?: number | null;
  pf?: number | null;
  aa?: string | null;
  [shortKey: string]: any;
}

/** Legend-expanded (long-key) form of one blob progress entry. */
export interface WfProgressEntry {
  first_read_at: string | null;
  last_read_at: string | null;
  last_review_at: string | null;
  next_review_at: string | null;
  read_count: number;
  review_count: number;
  weight: number;
  proficiency: number;
  added_at: string | null;
  /** Unknown short keys pass through expandProgressEntry() unchanged. */
  [key: string]: any;
}

/**
 * Success data of AUTH POST /group/get_progress_blob {gid} — one request
 * returns the whole group's progress map.
 */
export interface WfGroupProgressBlob {
  gid: string;
  gname: string;
  language_code: string | null;
  total_words: number;
  /** short key → long field name, e.g. { pf: 'proficiency', ... }. */
  legend: Record<string, string>;
  /** word_id (stringified) → compressed progress entry. */
  words: Record<string, WfProgressEntryShort>;
}

/**
 * One study answer of the batch shape of POST /group/update_progress.
 *
 * Two backend shapes are supported (contract 2026-07-18 §5.7):
 *   - legacy answer: { word_id, correct }
 *   - read action:   { word_id, action: 'read', play_time } (correct omitted)
 * `correct` is optional so a read-action update (action='read' + play_time) can
 * be sent without it. `play_time` is the seconds spent on this word this pass
 * (accumulated into the group progress map's pt/rpt accumulators server-side).
 */
export interface WfGroupProgressUpdate {
  word_id: string | number;
  /** Legacy answer correctness. Omitted when `action: 'read'|'review'` is used. */
  correct?: boolean;
  /** Explicit action kind for read/review logging (omitted = legacy answer shape). */
  action?: 'read' | 'review';
  /** Seconds spent on this word this pass (read action only). */
  play_time?: number;
}

/**
 * The documented short-key legend, used as the defensive fallback when a
 * response arrives without one. The response legend always wins.
 */
export const WF_PROGRESS_LEGEND: Record<string, string> = {
  fr: 'first_read_at',
  lr: 'last_read_at',
  lv: 'last_review_at',
  nr: 'next_review_at',
  rc: 'read_count',
  vc: 'review_count',
  wt: 'weight',
  pf: 'proficiency',
  aa: 'added_at',
};

/** Long fields of WfProgressEntry that must come out numeric. */
const WF_PROGRESS_NUMERIC_FIELDS = new Set([
  'read_count',
  'review_count',
  'weight',
  'proficiency',
]);

/**
 * Expand one compressed blob entry to its long-key form using the RESPONSE
 * legend (defensive: short keys missing from the legend pass through under
 * their short name, so future backend additions are never dropped). Numeric
 * fields are coerced (missing → 0); timestamp fields default to null.
 */
export function expandProgressEntry(
  entry: WfProgressEntryShort,
  legend?: Record<string, string>
): WfProgressEntry {
  const map = legend && typeof legend === 'object' ? legend : WF_PROGRESS_LEGEND;
  const expanded: Record<string, any> = {
    first_read_at: null,
    last_read_at: null,
    last_review_at: null,
    next_review_at: null,
    read_count: 0,
    review_count: 0,
    weight: 0,
    proficiency: 0,
    added_at: null,
  };
  for (const [shortKey, value] of Object.entries(entry ?? {})) {
    const longKey = map[shortKey];
    if (longKey) {
      expanded[longKey] = WF_PROGRESS_NUMERIC_FIELDS.has(longKey)
        ? Number(value ?? 0) || 0
        : value ?? null;
    } else {
      // Unknown short key — pass through unchanged.
      expanded[shortKey] = value;
    }
  }
  return expanded as WfProgressEntry;
}

// ---- Public content (vocabulary libraries / books / subtitles) ----
// Live-verified 2026-06-12 against :9000.
//
// Vocabulary libraries: PUBLIC GET /vocabulary/libraries/recommended?language=
// (anonymous OK) → data.libraries[] — REAL library rows; these ids are exactly
// what /group/add_library expects.
//
// Media lists: PUBLIC GET /media/books and /media/subtitles are served by
// MediaBrowseController::books/subtitles and return the standard Laravel
// paginator envelope { items, total, per_page, current_page, last_page }
// (query params: page / per_page / language / search), wrapped in the usual
// { success, data, message } envelope that request() unwraps.

/** One row of PUBLIC GET /vocabulary/libraries/recommended → data.libraries[]. */
export interface WfPublicLibrary {
  id: number;
  name: string;
  description: string;
  word_count: number;
  /** FULL language name, e.g. 'english' (AppQyV1 vocabulary convention). */
  language: string;
  /** 'beginner' | 'intermediate' | 'advanced' (free-form string). */
  difficulty: string;
  category: string;
  image_url: string | null;
  /** 'pending' | 'processing' | 'retry' | 'ready' | 'failed' (cover lifecycle). */
  cover_status?: string | null;
  cover_error_message?: string | null;
  cover_attempts?: number;
  is_recommended?: boolean;
  tags?: string[];
}

/** One row of PUBLIC GET /media/books → data.items[]
 *  (MediaBrowseController::books item mapping). */
export interface WfBookSummary {
  id: number;
  source_key: string;
  title: string;
  original_name?: string | null;
  language: string;
  sentence_count: number;
  has_audio?: boolean;
  synced_at: string | null;
  /** Movie/TV poster (MOVIE_POSTER_PIPELINE.md §6): a same-origin
   *  /static/app_qy_v1/posters/... URL when ready, else null. */
  image_url?: string | null;
  /** Poster lifecycle: pending | ready | failed | none. */
  poster_status?: string | null;
}

/** One row of PUBLIC GET /media/subtitles → data.items[]
 *  (MediaBrowseController::subtitles item mapping). */
export interface WfSubtitleSummary {
  id: number;
  source_key: string;
  title: string;
  original_name?: string | null;
  language: string;
  duration_sec: number;
  subtitle_count?: number;
  segment_count: number;
  sentence_count: number;
  synced_at: string | null;
  /** Movie/TV poster (MOVIE_POSTER_PIPELINE.md §6): a same-origin
   *  /static/app_qy_v1/posters/... URL when ready, else null. */
  image_url?: string | null;
  /** Poster lifecycle: pending | ready | failed | none. */
  poster_status?: string | null;
}

/** Paginator envelopes of the public media list endpoints. */
export interface WfBookListResult {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  books: WfBookSummary[];
}
export interface WfSubtitleListResult {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  subtitles: WfSubtitleSummary[];
}

/**
 * 2-char UI language code → FULL AppQyV1 language name (the vocabulary
 * endpoints filter by full names: ?language=english, not ?language=en).
 * Unknown values pass through lowercased so full names also work as input.
 */
const LANGUAGE_CODE_TO_NAME: Record<string, string> = {
  en: 'english',
  zh: 'chinese',
  es: 'spanish',
  fr: 'french',
  de: 'german',
  ja: 'japanese',
  ko: 'korean',
};
const toFullLanguageName = (lang?: string): string | undefined => {
  if (!lang) return undefined;
  const key = lang.toLowerCase();
  return LANGUAGE_CODE_TO_NAME[key] ?? key;
};

/** One sentence of PUBLIC GET /media/content/{type}/{id} → data.sentences[].
 *  start_sec/end_sec are subtitle-only (null/absent for books). */
export interface WfMediaSentence {
  seq: number;
  text: string;
  audio: string | null;
  explanation: string | null;
  start_sec: number | null;
  end_sec: number | null;
}

/** File-first resolution of one sentence's audio
 *  (GET /ai_tools/tts/sentence/audio). `exists:true` carries the playable
 *  `/static` URL; `exists:false` with `queued:true` means generation was
 *  (re)enqueued. Resolve by `hash` (sha1 sentence_id or md5 content_id) or by
 *  raw `text`; `language` is the full name (e.g. "english"). */
export interface WfSentenceAudioResolve {
  success: boolean;
  exists: boolean;
  url?: string | null;
  queued?: boolean;
  hash: string;
  language: string;
}

/** Success data of PUBLIC GET /media/content/{type}/{id}?start=&limit=.
 *  `info` is the matching summary shape (book or subtitle). */
export interface WfMediaContentDetail {
  info: Partial<WfBookSummary & WfSubtitleSummary> & {
    id: number;
    source_key: string;
    title: string;
    language: string;
  };
  total_sentences: number;
  sentences: WfMediaSentence[];
}

/** One row of AUTH POST /group/get_sources → data.media_sources[]. */
export interface WfGroupMediaSource {
  source_type: 'book' | 'subtitle';
  source_key: string;
  title: string;
  language: string;
  words_added: number;
  added_at: string | null;
}

/** Success data of AUTH POST /group/add_media_source. */
export interface WfAddMediaSourceResult {
  gid: string;
  source_type: 'book' | 'subtitle';
  source_key: string;
  words_added: number;
  total_words: number;
}

/** Success data of AUTH POST /group/get_sources. `libraries` items match the
 *  getGroupLibraries() item shape ({ id, name, language, total_words, added_at }). */
export interface WfGroupSourcesResult {
  libraries: Array<{
    id: number | string;
    name: string;
    language: string;
    total_words: number;
    added_at: string | null;
  }>;
  media_sources: WfGroupMediaSource[];
}

// ---- Daily recitation (每日背诵) ----
// Backend contract (2026-06-12, implemented in parallel with this client):
// AUTH POST /recitation/log + AUTH GETs /recitation/today-plan,
// /recitation/summary?date=YYYY-MM-DD, /recitation/streak — all under the
// standard { success, data, message } envelope that request() unwraps.

/** One recitation event kind (POST /recitation/log words[].action). */
export type WfRecitationAction = 'read' | 'learn' | 'review_correct' | 'review_wrong';

/** One logged word event of POST /recitation/log. */
export interface WfRecitationLogWord {
  word: string;
  action: WfRecitationAction;
}

/** Live today-counters returned by POST /recitation/log → data.today. */
export interface WfRecitationToday {
  unique_words: number;
  actions: number;
  goal: number;
  goal_met: boolean;
}

/** Success data of POST /recitation/log. `replayed` is true when the backend
 *  recognized the batch_id and skipped double-counting (offline replay). */
export interface WfRecitationLogResult {
  logged: number;
  date: string;
  today: WfRecitationToday;
  replayed?: boolean;
}

/** One word of GET /recitation/today-plan → data.words[]. */
export interface WfRecitationPlanWord {
  word: string;
  /** 'due' = scheduled review word, 'new' = fresh word for today. */
  source: 'due' | 'new';
  personal: {
    read: number;
    learned: number;
    reviewed: number;
    review_time: string | null;
  };
  translation: string | null;
  phonetic: string | null;
}

/** Success data of GET /recitation/today-plan?language=&limit=. */
export interface WfRecitationTodayPlan {
  date: string;
  goal: number;
  done_today: number;
  words: WfRecitationPlanWord[];
}

/** Success data of GET /recitation/summary?date=YYYY-MM-DD. */
export interface WfRecitationSummary {
  date: string;
  unique_words: number;
  actions: number;
  goal: number;
  goal_met: boolean;
  words: Array<{ word: string; actions: WfRecitationAction[] }>;
}

/** One day of GET /recitation/streak → data.days[] (last 35 days). */
export interface WfRecitationStreakDay {
  date: string;
  unique_words: number;
}

/** Success data of GET /recitation/streak. */
export interface WfRecitationStreak {
  current_streak: number;
  longest_streak: number;
  days: WfRecitationStreakDay[];
}

/**
 * Short TTL of the recitation read cache (summary / streak ONLY — the
 * today-plan is never cached): today's state changes as the user recites, so
 * these GETs must stay near-live. The cache is dropped on every successful
 * /recitation/log so post-flush refetches see the new counters immediately.
 */
const RECITATION_CACHE_TTL = 60 * 1000;

/** TTL of the in-memory public-content list cache (books / subtitles). */
const PUBLIC_MEDIA_CACHE_TTL = 10 * 60 * 1000;
