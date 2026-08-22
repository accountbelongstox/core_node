/** AppQyV1 request and response types. */
import type { GlobalQueuePositionTaskAlias } from '../../../../core/contracts/QueueCenterTypes';

// ========== Vocabulary export (server-side file download) ==========

export type VocabExportFormat = 'csv' | 'json' | 'anki' | 'pdf' | 'text';

export interface VocabExportOptions {
  language?: string;
  library_id?: string | number;
  /** Server caps at 20000. */
  limit?: number;
  include_phonetics?: boolean;
  include_translations?: boolean;
  /** Extra hint (all|learned|review|library); ignored by current backend. */
  scope?: string;
}

export interface VocabExportResult {
  ok: true;
  /** Filename parsed from Content-Disposition (or a sensible default). */
  filename: string;
  /** True when the server sent `X-Export-Fallback: html` — the "PDF" is a printable HTML page. */
  htmlFallback: boolean;
}

// ========== Document extraction ==========

export interface ExtractWordsResult {
  document_id: number | string;
  words_total: number;
  added: number;
  skipped: number;
}

export interface ExtractSentencesResult {
  document_id: number | string;
  sentences_total: number;
  stored: number;
  skipped: number;
}

// ========== Cover generation / AI status (Task Center management surface) ==========

/** Per-status counts of the vocabulary-library cover queue. `leased` = covers
 *  currently leased out to a third-party assist worker (pycore). */
export interface CoverQueueStats {
  pending: number;
  retry: number;
  processing: number;
  ready: number;
  failed: number;
  total: number;
  leased: number;
}

/** Live availability probe of the Laravel-side AI key (null when not probed). */
export interface CoverAiProbe {
  available: boolean;
  error?: string | null;
  latency_ms?: number | null;
}

export interface CoverPycoreProvider {
  name: string;
  configured: boolean;
  available: boolean;
  /** True when this pycore provider can generate images. */
  image?: boolean;
}

/** GET /ai_tools/cover-status — full cover-generation management snapshot. */
export interface CoverStatusData {
  task: {
    enabled: boolean;
    batch_size: number;
    retry_delay_minutes: number;
  };
  queue: CoverQueueStats;
  laravel_ai: {
    /** Currently always 'gemini'. */
    provider: string;
    configured: boolean;
    key_masked: string | null;
    probe: CoverAiProbe | null;
  };
  pycore: {
    reachable: boolean;
    base_url: string | null;
    image_capable: boolean;
    providers: CoverPycoreProvider[] | null;
    error: string | null;
  };
  recent_failures: Array<{
    library_id: number | string;
    name: string;
    error: string;
    at: string;
  }>;
}

/** POST /ai_tools/cover-retry — failed→retry reset result. */
export interface CoverRetryResult {
  /** How many failed covers were reset back into the retry queue. */
  reset: number;
  queue: CoverQueueStats;
}

/** POST /assist/cover/retry — pull-mode failed→pending reset result. */
export interface AssistCoverRetryResult {
  /** How many failed/stuck covers were reset back to `pending` for pycore. */
  reset: number;
}

/** Per-status counts of the word_translation queue (global_tasks). */
export interface TranslationQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

/** GET /assist/status — cover + TTS queues as exposed to third-party assist workers. */
export interface AssistStatusData {
  enabled?: boolean;
  mode?: string;
  cover: CoverQueueStats;
  tts: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    leased: number;
  };
  /** Added 2026-06-15: word-translation queue counts. */
  translation?: TranslationQueueStats;
  lease_minutes: number;
}

/** GET /assist/pending — unified, cache-backed pending-work snapshot warmed by
 *  the Octane cover timer (cover + tts + translation). */
export interface AssistPendingSnapshot {
  generated_at: string;
  enabled: boolean;
  lease_minutes: number;
  cover: CoverQueueStats;
  tts: { pending: number; processing: number; completed: number; failed: number; leased: number };
  translation: TranslationQueueStats;
}

/** One terminal word_translation task in the processing-history view. */
export interface TranslationHistoryItem {
  task_id: string;
  status: string;
  words: string[];
  word_count: number;
  language: string;
  target_language: string;
  provider: string;
  translations: Array<{ word: string; translation: string }>;
  error: string | null;
  retry_count: number;
  assigned_to: string | null;
  created_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface TranslationHistoryResponse {
  items: TranslationHistoryItem[];
  pagination: { limit: number; offset: number; page: number; total: number; has_more: boolean };
}

// ========== Movie/TV poster pipeline ==========

/** One execution owner entry in the poster-pipeline status. */
export interface PosterProviderStatus {
  name: 'mcp-chrome' | string;
  configured: boolean;
}

export interface TranslationLanguageOption {
  code: string;
  name: string;
  native_name: string;
}

type TranslationLanguageCatalog = Record<
  string,
  string | Partial<TranslationLanguageOption>
>;

function normalizeTranslationLanguages(
  payload: { languages?: TranslationLanguageCatalog | TranslationLanguageOption[] } | null,
): TranslationLanguageOption[] {
  const languages = payload?.languages;
  if (Array.isArray(languages)) return languages;
  if (!languages || typeof languages !== 'object') return [];
  return Object.entries(languages).map(([code, value]) => {
    if (typeof value === 'string') {
      return { code, name: value, native_name: value };
    }
    const normalizedCode = String(value.code || code);
    const name = String(value.name || normalizedCode);
    return {
      code: normalizedCode,
      name,
      native_name: String(value.native_name || name),
    };
  });
}

/** Per-poster_status distribution for one media table. */
export interface PosterStatusCounts {
  pending: number;
  ready: number;
  failed: number;
  none: number;
  total: number;
}

/** GET /media/poster/status — mcp-chrome ownership plus per-type queue counts. */
export interface PosterStatusData {
  providers: PosterProviderStatus[];
  keys: Record<string, string | null>;
  owner?: 'mcp-chrome' | string;
  source?: 'search-engine' | string;
  counts: {
    book: PosterStatusCounts;
    subtitle: PosterStatusCounts;
  };
}

/** POST /media/poster/fetch — move one poster to the mcp-chrome queue head. */
export interface PosterFetchResult {
  image_url: string | null;
  poster_status: 'pending' | 'ready' | 'failed' | 'none';
  provider?: string | null;
  already_done?: boolean;
  queued?: boolean;
}

// ========== Sentence-library audio (file-first resolution) ==========

/**
 * GET /ai_tools/tts/sentence/audio — file-first resolution of one sentence's
 * spoken audio. Resolve EITHER by `hash` (sha1 sentence_id or md5 content_id)
 * or by raw `text` (hashed server-side); `language` (full name, e.g.
 * "english") is required for the on-disk path. `exists:true` carries the
 * playable `/static` URL; `exists:false` with `queued:true` means the miss was
 * (re)enqueued for generation.
 */
export interface SentenceAudioResolveResponse {
  success: boolean;
  exists: boolean;
  url?: string | null;
  queued?: boolean;
  hash: string;
  language: string;
}

/** POST /ai_tools/tts/sentence/claim with { limit: 0 } — counts-only summary
 *  for the Queue Center "Sentence Audio" strip (no rows leased). */
export interface SentenceAudioClaimSummary {
  /** Sentences with has_audio=false not currently leased (work waiting). */
  pending: number;
  /** Sentences currently leased out to a worker. */
  leased: number;
  count?: number;
  lock_stale_minutes?: number;
}

// ========== Review queue / learning stats ==========

export interface ReviewQueueWord {
  /** Learning-progress record id — this is the `progress_id` for POST /learning/progress. */
  id: number | string;
  word: string;
  word_md5: string;
  learning_status: string;
  familiarity_level?: number;
  review_count?: number;
  next_review_at?: string | null;
}

export interface ReviewQueueData {
  review_words: ReviewQueueWord[];
  new_words: ReviewQueueWord[];
}

export interface LearningStatsData {
  stats: {
    total_words: number;
    new_words: number;
    learning_words: number;
    mastered_words: number;
    needs_review: number;
  };
  selected_libraries_count: number;
  learning_languages: string[];
  native_language: string;
}

