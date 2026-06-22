/**
 * WordflowApi — the wordflow end's backend client.
 *
 * Ported from poly_apps/qy_capacitor/services/api.ts. Talks to the Laravel
 * backend under the `/api/app_qy_v1` path prefix, with Bearer-token auth read
 * per request from WordflowStorage. Endpoint selection (probe / auto-select /
 * failover) is delegated to the WordflowApiManager; the manager is initialized
 * lazily on first use so callers can fire requests without a bootstrap step.
 *
 * Failures are never disguised with fabricated data. `request()` rethrows on
 * error; list-style methods (word groups, recommendations) catch and degrade to
 * empty so the Iris pages can render an inline empty state instead of crashing.
 *
 * Exports a singleton `wordflowApi`.
 */

import {
  User,
  Word,
  WordGroup,
  QuizQuestion,
  RetentionStat,
  CourseAnalysis,
  BackendGroupData,
  inferLanguageFromWords,
} from './wordflowTypes';
import { apiManager, WORDFLOW_API_HEALTH_EVENT } from './WordflowApiManager';
import { StorageCenter, StorageKey } from './WordflowStorage';
import { WF_AUTH_USE_MOCK, wordflowAuthMock } from './wordflowAuthMock';
import {
  MasterApiClient,
  MasterRequestOptions,
  isQueuedError,
} from '../base';
import { appendLog } from '../../logstore/logStore';
// Leaf UI module (react + Portal + overlay constants only — it never imports
// any api-lib), so pulling it into the transport layer cannot create a cycle.
import { notify } from '../../notify/notify';
import {
  formatWordflowRequestError,
  parseWordflowJsonBody,
  resolveShellLang,
} from './wordflowApiMessages';

const API_PREFIX = '/api/app_qy_v1';

/**
 * Resolve a poster/cover `image_url` to a loadable absolute URL. The backend
 * returns a SAME-ORIGIN server-rooted path (e.g. `/static/app_qy_v1/posters/…`),
 * but the FE may run on a different origin than the active API endpoint, so a
 * `/`-rooted path is joined onto the current base URL (mirrors
 * WfMediaDetailPage's resolveSentenceAudioUrl). Absolute http(s) URLs and
 * empty/nullish values pass through unchanged. */
export function resolveWfPosterUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${apiManager.getCurrentBaseUrl()}${url}`;
  return url;
}

// ---- Queued-offline user feedback (CENTRAL handler) ----
// Every queueable write that gets persisted offline rejects with a QueuedError.
// ~10 different callers render error.message and would otherwise show raw
// internals, so the human-facing feedback is centralized HERE instead of in
// every caller:
//   (a) the QueuedError carries the LOCALIZED 'common.queuedOffline' string,
//   (b) request() emits ONE deduped notify.info at queue time.
// Callers keep their own flow handling (optimistic rollback is CORRECT — the
// write has not landed yet) and must NOT show their own queued toast.

/**
 * 'common.queuedOffline' mirrored from apps/wordflow/wf-locales/*.ts — the
 * transport layer must not import from apps/ (core → apps is the wrong
 * direction; nothing in core/ does). KEEP IN SYNC with the wf-locales values.
 */
const QUEUED_OFFLINE_MESSAGES: Record<string, string> = {
  en: 'Saved offline — will sync when the connection returns',
  zh: '已离线保存——网络恢复后将自动同步',
  ja: 'オフラインで保存しました——接続が回復すると自動的に同期されます',
  ko: '오프라인으로 저장됨 — 연결이 복구되면 자동으로 동기화됩니다',
  es: 'Guardado sin conexión: se sincronizará cuando vuelva la conexión',
  fr: 'Enregistré hors ligne — la synchronisation reprendra dès le retour de la connexion',
  de: 'Offline gespeichert — wird synchronisiert, sobald die Verbindung zurückkehrt',
};

/**
 * Resolve the localized queued-offline message without t() (no React context
 * down here). Primary source: the persisted shell UI language — the same
 * 'shell_lang' localStorage key ShellContext owns and WfAppContext mirrors
 * into wordflowApi.setLanguage() — so it is correct even before the wordflow
 * provider mounts. Falls back to the live host language, then English.
 */
const queuedOfflineMessage = (hostLang?: string): string => {
  const lang = resolveShellLang(hostLang);
  return QUEUED_OFFLINE_MESSAGES[lang] ?? QUEUED_OFFLINE_MESSAGES.en;
};

const logWordflowFailure = (label: string, error: unknown, lang?: string): void => {
  const friendly = formatWordflowRequestError(error, lang);
  console.error(`[WordflowApi] ${label}:`, friendly.message);
};

/** Stable toast id: repeats UPDATE the one card in place (notify {id}). */
const QUEUED_OFFLINE_TOAST_ID = 'wf-queued-offline';
/** And a time window so bursts of queued writes don't even reset its timer. */
const QUEUED_OFFLINE_TOAST_DEDUPE_MS = 5000;
let lastQueuedOfflineToastAt = 0;

/** The ONE centralized, deduped "saved offline" toast (see block comment). */
const notifyQueuedOffline = (message: string): void => {
  const now = Date.now();
  if (now - lastQueuedOfflineToastAt < QUEUED_OFFLINE_TOAST_DEDUPE_MS) return;
  lastQueuedOfflineToastAt = now;
  notify.info(message, { id: QUEUED_OFFLINE_TOAST_ID });
};

/** Per-end namespaced localStorage key of wordflow's offline write queue. */
const WF_QUEUE_STORAGE_KEY = 'wf_api_queue';

/**
 * Idempotent write endpoints that are safe to persist offline and replay
 * later (the master client's queueable default for this end). Adding the same
 * library/source/word twice, re-selecting a collection, re-reporting progress
 * or re-enqueueing a translation/TTS batch is harmless server-side.
 * GETs are never queueable (enforced again in the base).
 */
const WF_QUEUEABLE_ENDPOINTS = [
  '/group/add_library',
  '/group/add_media_source',
  '/group/remove_library',
  '/group/remove_word',
  '/group/remove_media_source',
  '/create_group',
  '/learning/collections/select',
  '/learning/progress',
  '/ai_tools/translation/queue/batch/add',
  '/ai_tools/tts/queue/batch/add',
  '/create_personal_dictionary',
  '/delete_personal_dictionary_by_id',
  '/delete_personal_all_dictionary',
  // Same idempotence class as /learning/progress: re-reporting a study answer
  // (single or batch) is harmless server-side.
  '/group/update_progress',
  // Daily-recitation logging is SAFE to queue offline: every flush carries a
  // fresh client-generated batch_id, and the backend dedupes on it — replaying
  // the same persisted payload after reconnect is idempotent (the server
  // answers { replayed: true } instead of double-counting).
  '/recitation/log',
];

/** Accessors the transport needs from the owning WordflowApiService. */
interface WfTransportHost {
  ready(): Promise<void>;
  getToken(): Promise<string | null>;
  getLanguage(): string;
}

/**
 * Wordflow's master-client subclass: transport ONLY (fetch + 30-min ceiling +
 * persistent offline write queue). Parsing (BOM-safe), envelope unwrap, auth
 * token storage and caching stay in WordflowApiService.
 *
 * Replay triggers: window 'online' + app start (wired by the base) and every
 * settled wordflow health pass that sees a healthy endpoint
 * (WORDFLOW_API_HEALTH_EVENT — fires after interval retries, manual Re-detect
 * and endpoint failover, i.e. the endpoint-recovered/changed hook).
 *
 * NOTE: endpoint-detection PROBES are NOT request() — WordflowApiManager keeps
 * its own load-bearing 3000ms probe timeout, untouched by the no-timeout rule.
 */
class WordflowTransport extends MasterApiClient {
  constructor(private host: WfTransportHost) {
    super({
      queueStorageKey: WF_QUEUE_STORAGE_KEY,
      log: (level, message) => appendLog(level, 'api', message),
    });
    if (typeof window !== 'undefined') {
      window.addEventListener(WORDFLOW_API_HEALTH_EVENT, () => {
        if (apiManager.hasHealthyEndpoint()) void this.drainQueue();
      });
    }
  }

  /** Live endpoint (re-resolved per request AND per queue replay attempt). */
  protected async resolveBaseUrl(): Promise<string> {
    await this.host.ready();
    return `${apiManager.getCurrentBaseUrl()}${API_PREFIX}`;
  }

  /** Live token + UI language — re-resolved at send/replay, never persisted. */
  protected async resolveAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.host.getToken();
    const headers: Record<string, string> = {
      'X-App-Language': this.host.getLanguage(),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  protected isQueueableEndpoint(endpoint: string, method: string): boolean {
    if (method === 'GET') return false;
    return WF_QUEUEABLE_ENDPOINTS.some((e) => endpoint.startsWith(e));
  }

  protected queuedMessage(): string {
    // Localized 'common.queuedOffline' so ANY caller that renders
    // error.message shows "saved offline, will sync" instead of internals
    // (central queued-offline handler — see top-of-file block comment).
    return queuedOfflineMessage(this.host.getLanguage());
  }
}

/**
 * Strip every leading U+FEFF. Live-verified: the backend prefixes responses
 * with multiple UTF-8 BOMs (4×EF BB BF observed on :9000); fetch's UTF-8
 * decode removes only the first one, so the rest must go before JSON.parse.
 */
const stripBom = (s: string): string => s.replace(/^﻿+/, '');

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

/** One study answer of the batch shape of POST /group/update_progress. */
export interface WfGroupProgressUpdate {
  word_id: string | number;
  correct: boolean;
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

class WordflowApiService {
  private token: string | null = null;
  private currentLanguage: string = 'en';
  private initPromise: Promise<void> | null = null;
  /**
   * Master-client transport (core/api-libs/base): fetch + 30-min dead-socket
   * ceiling + persistent offline write queue ('wf_api_queue'). This service
   * keeps parsing/auth/cache; the transport owns connectivity.
   */
  private transport: WordflowTransport = new WordflowTransport({
    ready: () => this.ensureReady(),
    getToken: async () => this.token || (await StorageCenter.auth.getToken()),
    getLanguage: () => this.currentLanguage,
  });
  /**
   * In-memory TTL cache for the PUBLIC content list GETs (media books /
   * subtitles + vocabulary libraries), keyed by the full query string. These
   * endpoints are anonymous-friendly and param-dependent (language / page /
   * per_page), so a per-param map fits better than the single-key
   * StorageCenter TTL caches used for the user-scoped lists.
   */
  private publicMediaCache = new Map<string, { ts: number; value: any }>();
  /**
   * Short-TTL (~60s) in-memory cache for the recitation summary/streak GETs,
   * keyed by endpoint+query. The today-plan is deliberately NOT cached and
   * every successful /recitation/log clears this map (today's counters moved).
   */
  private recitationCache = new Map<string, { ts: number; value: any }>();

  /**
   * Ensure the endpoint manager has run its probe/auto-select round exactly once.
   * Subsequent calls reuse the same promise.
   */
  private ensureReady(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = apiManager
        .initialize({ autoDetect: true })
        .catch((e) => {
          logWordflowFailure('endpoint init failed', e, this.currentLanguage);
        });
    }
    return this.initPromise;
  }

  setToken(token: string) {
    this.token = token;
    StorageCenter.auth.setToken(token);
  }

  setLanguage(lang: string) {
    this.currentLanguage = lang;
  }

  /**
   * Generic request wrapper. TRANSPORT (URL resolution, Bearer token +
   * X-App-Language injection, the 30-MINUTE dead-socket ceiling — NO arbitrary
   * short timeouts — and the persistent offline write queue) is delegated to
   * the master client (core/api-libs/base via WordflowTransport). This method
   * keeps the response handling: BOM-safe parse, envelope unwrap, error
   * surfacing. Rethrows on failure — it never fabricates realistic fake data.
   * A queued offline write rejects with a distinguishable QueuedError
   * (isQueuedError) whose message is the localized "saved offline, will sync";
   * the user-facing toast for it fires ONCE here (deduped central handler) —
   * callers must NOT add their own queued-offline toast.
   */
  async request<T>(endpoint: string, options: MasterRequestOptions = {}): Promise<T> {
    // MOCK switch (wordflowAuthMock.WF_AUTH_USE_MOCK): when on, the auth
    // endpoints are served entirely offline so the auth UI can be built with no
    // backend. The mock returns the same already-unwrapped `data` shape this
    // method yields and throws the same status-bearing errors, so every caller
    // (login()/register()/getUserProfile() + the forgot/reset pages) is
    // unchanged. Placed before the try on purpose: a mock error must propagate
    // with its `.status` intact, exactly like the real path's surfaced error.
    if (WF_AUTH_USE_MOCK && wordflowAuthMock.handles(endpoint)) {
      return wordflowAuthMock.handle<T>(endpoint, options);
    }
    try {
      // FormData bodies must NOT get an explicit Content-Type — the browser sets
      // the multipart boundary itself (needed by /learning/upload). The token +
      // X-App-Language headers are merged live by the transport (and re-resolved
      // on every queue replay attempt).
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      const headers: Record<string, string> = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers as Record<string, string>),
      };

      const response = await this.transport.request(endpoint, {
        ...options,
        headers,
      });

      if (!response.ok) {
        // Surface the backend's own message (Laravel validation / auth errors
        // respond with { message, errors }) instead of a bare status code.
        let errorBody: any = null;
        try {
          // Live-verified: backend responses arrive with repeated UTF-8 BOMs
          // prepended (4×EF BB BF before the JSON). response.json() tolerates
          // only a single BOM, so parse from text with all BOMs stripped.
          const rawErrorText = stripBom(await response.text());
          errorBody = rawErrorText ? JSON.parse(rawErrorText) : null;
        } catch {
          // Non-JSON error body (HTML error page, empty body) — keep null.
        }
        let message = `API Error: ${response.status}`;
        if (errorBody && typeof errorBody.message === 'string' && errorBody.message) {
          message = errorBody.message;
        } else if (errorBody && typeof errorBody.error === 'string' && errorBody.error) {
          message = errorBody.error;
        } else if (errorBody && errorBody.error && typeof errorBody.error.message === 'string') {
          message = errorBody.error.message;
        }
        const apiError = new Error(message) as Error & { status: number; body: any };
        apiError.status = response.status;
        apiError.body = errorBody;
        throw apiError;
      }
      // Live-verified: success bodies carry the same repeated-BOM prefix, so
      // never use response.json() here either.
      const rawText = stripBom(await response.text());
      const data = parseWordflowJsonBody(rawText, this.currentLanguage);
      // Backend envelope is { success, data, message } — unwrap to data.
      return (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'data'))
        ? (data.data as T)
        : (data as T);
    } catch (error) {
      if (isQueuedError(error)) {
        // Not a failure: the write was persisted offline and will replay when
        // connectivity returns. Callers branch on isQueuedError() for FLOW
        // only — the single user-facing toast is emitted here (deduped).
        console.warn(`[WordflowApi] ${endpoint} queued offline:`, error.message);
        notifyQueuedOffline(error.message);
        throw error;
      }
      const friendly = formatWordflowRequestError(error, this.currentLanguage);
      console.error(`[WordflowApi] Request to ${endpoint} failed:`, friendly.message);
      throw friendly;
    }
  }

  // ---- Offline write queue observability (master client passthrough) ----

  /** Current offline write queue state ({ size, draining }). */
  getQueueState() {
    return this.transport.getQueueState();
  }

  /** Subscribe to offline-queue changes; returns an unsubscribe fn. */
  onQueueChange(cb: Parameters<WordflowTransport['onQueueChange']>[0]) {
    return this.transport.onQueueChange(cb);
  }

  /** Subscribe to dropped replays (server answered 4xx/5xx at replay time). */
  onQueueEntryFailed(cb: Parameters<WordflowTransport['onQueueEntryFailed']>[0]) {
    return this.transport.onQueueEntryFailed(cb);
  }

  // ---- Auth ----

  async login(email: string, password: string) {
    // The AppQyV1 login controller authenticates by `username` (it never reads
    // `email`); CommonAuthService matches it against username OR email OR phone,
    // so sending whatever the user typed as `username` is correct.
    //
    // Verified backend shape (AppQyV1AuthenticationLoginController::login →
    // CommonAuthService::createLoginResponse + legacy fields):
    //   {
    //     success, message,
    //     token,            // legacy top-level copy of data.login_token
    //     login_by,
    //     data: { user, login_token (Sanctum Bearer), user_token,
    //             user_token_expires_at, token_type, login_by, expiration,
    //             multi_device_enabled }
    //   }
    // request() unwraps the envelope to `data`, which drops the legacy
    // top-level `token` — so the Bearer token must be read from `login_token`.
    // Tolerate both unwrapped and raw shapes and normalize to { token, user }.
    const result = await this.request<any>('/login', {
      method: 'POST',
      body: JSON.stringify({ username: email, password }),
    });
    const data = result && result.data ? result.data : result;
    const token: string | undefined =
      (data && data.login_token) ||
      (result && result.token) ||
      (data && data.token) ||
      (data && data.user_token);
    const user: User | undefined = data ? data.user : undefined;
    if (user) {
      StorageCenter.cache.invalidate(StorageKey.USER_PROFILE_CACHE);
      StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, user, 5 * 60 * 1000);
    }
    return { ...data, token, user } as { token: string; user: User };
  }

  /**
   * Register a new account. Verified backend
   * (AppQyV1AuthenticationRegistrationController::apiStore): `username` +
   * `password` required; `email` / `nickname` / `invite_code` optional.
   * Failure modes: duplicate username → 400 'Username already exists';
   * unknown invite code → 400 'Invalid invite code'; exhausted/expired code →
   * 400 'Invite code is expired or already used'.
   * A successful registration returns the same login envelope as /login
   * (data.login_token is the Sanctum Bearer token — see login() for the full
   * envelope notes), i.e. registering immediately logs the user in. Normalized
   * to { token, user } exactly like login().
   */
  async register(payload: {
    username: string;
    password: string;
    email?: string;
    nickname?: string;
    invite_code?: string;
    /** Catalog learning-language codes chosen at sign-up (multi-select). The
     * backend validates these against /system/supported-languages and persists
     * them on the user (defaults to ['en'] when omitted). */
    learning_languages?: string[];
    /** Native language code (optional; backend defaults to 'zh'). */
    native_language?: string;
  }) {
    const result = await this.request<any>('/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = result && result.data ? result.data : result;
    const token: string | undefined =
      (data && data.login_token) ||
      (result && result.token) ||
      (data && data.token) ||
      (data && data.user_token);
    const user: User | undefined = data ? data.user : undefined;
    if (user) {
      StorageCenter.cache.invalidate(StorageKey.USER_PROFILE_CACHE);
      StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, user, 5 * 60 * 1000);
    }
    return { ...data, token, user } as { token: string; user: User };
  }

  async getUserProfile() {
    const cached = await StorageCenter.cache.get<User>(StorageKey.USER_PROFILE_CACHE);
    if (cached) return cached;

    // Live-verified shape: GET /user/profile → data.{ user: {...} } — the
    // profile is nested under `user`. Unwrap it; tolerate older flat shapes.
    const res = await this.request<any>('/user/profile');
    const user: User = res && typeof res === 'object' && res.user ? (res.user as User) : (res as User);
    if (user) {
      StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, user, 5 * 60 * 1000);
    }
    return user;
  }

  async getSupportedLanguages() {
    const cached = await StorageCenter.cache.get<any>(StorageKey.SUPPORTED_LANGUAGES_CACHE);
    if (cached) return cached;

    const languages = await this.request('/system/supported-languages');
    if (languages) {
      StorageCenter.cache.set(StorageKey.SUPPORTED_LANGUAGES_CACHE, languages, 24 * 60 * 60 * 1000);
    }
    return languages;
  }

  // ---- Learning content ----

  async getWordGroups(): Promise<WordGroup[]> {
    const cached = await StorageCenter.cache.get<WordGroup[]>(StorageKey.WORD_GROUPS_CACHE);
    if (cached) return cached;

    try {
      const response = await this.request<{ uid: string; total: number; groups: BackendGroupData[] }>(
        '/query_all_groups'
      );

      let groups: WordGroup[] = [];
      if (response && response.groups && Array.isArray(response.groups)) {
        groups = response.groups.map((bg: BackendGroupData) => ({
          id: bg.gid,
          name: bg.gname,
          count: bg.total_words || 0,
          type: bg.type || 'user',
          progress: bg.progress || 0,
          // Live-verified: /query_all_groups groups carry `cover_url` /
          // `thumbnail_url` (absolute URLs), not `cover_image`.
          coverImage: bg.cover_image || bg.thumbnail_url || bg.cover_url || '📚',
          language: bg.language || inferLanguageFromWords(bg.gwords || []) || 'en',
          description: bg.description,
        }));
      } else if (Array.isArray(response)) {
        groups = response as any as WordGroup[];
      } else {
        throw new Error('Unexpected response format from backend');
      }

      if (groups && Array.isArray(groups) && groups.length > 0) {
        StorageCenter.cache.set(StorageKey.WORD_GROUPS_CACHE, groups, 5 * 60 * 1000);
      }
      return groups;
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch word groups:', formatWordflowRequestError(error, this.currentLanguage).message);
      // Degrade gracefully instead of throwing so pages can show an empty state.
      return [];
    }
  }

  async getWordsForGroup(groupId: string): Promise<Word[]> {
    // Live-verified shape: GET /query_gwords?gid= → data.{ gid, gname,
    // gwords: [...], words_frequency, ... } — the word list lives under
    // `gwords`, not at the top level. Tolerate bare-array / { words } shapes.
    const res = await this.request<any>(`/query_gwords?gid=${encodeURIComponent(groupId)}`);
    if (Array.isArray(res)) return res as Word[];
    if (Array.isArray(res?.gwords)) return res.gwords as Word[];
    if (Array.isArray(res?.words)) return res.words as Word[];
    return [];
  }

  async getWordDetail(wordId: string) {
    return this.request<Word>(`/words/${wordId}`);
  }

  // ---- Word actions ----
  // Backend routes: AppQyV1Words.php — POST /words/{id}/favorite, /words/{id}/learn,
  // /words/{id}/review (auth:sanctum, same Bearer token).
  // Implemented server-side on 2026-06-12 (AppQyV1WordQueryController::toggleFavorite,
  // AppQyV1WordLearningStatusController::markAsLearned / markAsReviewed) — the
  // earlier 500 "Method ... does not exist" responses are gone. Optimistic
  // update + rollback in callers is still good practice for offline tolerance.

  async toggleWordFavorite(wordId: string | number) {
    return this.request<any>(`/words/${encodeURIComponent(String(wordId))}/favorite`, {
      method: 'POST',
    });
  }

  async markWordLearned(wordId: string | number) {
    return this.request<any>(`/words/${encodeURIComponent(String(wordId))}/learn`, {
      method: 'POST',
    });
  }

  async markWordReviewed(wordId: string | number) {
    return this.request<any>(`/words/${encodeURIComponent(String(wordId))}/review`, {
      method: 'POST',
    });
  }

  async getQuizSession() {
    return this.request<QuizQuestion[]>('/quiz/generate');
  }

  async getRetentionStats() {
    return this.request<RetentionStat[]>('/user/stats/retention');
  }

  async analyzeCourse(groupId: string) {
    return this.request<CourseAnalysis>(`/word-groups/${groupId}/analysis`);
  }

  /**
   * Featured / recommended vocabulary libraries for the learning home.
   * Degrades to an empty list when the backend is unreachable.
   */
  async getRecommendedLibraries(): Promise<VocabularyRecommendation[]> {
    const cached = await StorageCenter.cache.get<VocabularyRecommendation[]>(
      StorageKey.RECOMMENDED_LIBRARIES_CACHE
    );
    if (cached) return cached;

    const normalize = (response: any): VocabularyRecommendation[] => {
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.recommendations)
          ? response.recommendations
          : Array.isArray(response?.libraries)
            ? response.libraries
            : [];
      // Live-verified: /learning/recommendations items already match
      // VocabularyRecommendation; the /vocabulary/libraries/recommended
      // fallback items use { word_count, language, difficulty: string } — fill
      // the keys the pages read (total_words / lang_code / level) defensively.
      return list.map((it: any) => ({
        ...it,
        total_words: it.total_words ?? it.word_count ?? 0,
        lang_code: it.lang_code ?? it.language ?? '',
        level: it.level ?? (typeof it.difficulty === 'string' ? it.difficulty : '') ?? '',
      }));
    };

    try {
      // Verified backend route: GET /learning/recommendations. Falls back to
      // the recommended-libraries route if that path is unavailable.
      let list: VocabularyRecommendation[] = [];
      try {
        list = normalize(await this.request<any>('/learning/recommendations'));
      } catch (primaryError) {
        console.warn(
          '[WordflowApi] /learning/recommendations failed, falling back to /vocabulary/libraries/recommended:',
          primaryError
        );
        list = normalize(await this.request<any>('/vocabulary/libraries/recommended'));
      }
      if (list.length > 0) {
        StorageCenter.cache.set(StorageKey.RECOMMENDED_LIBRARIES_CACHE, list, 30 * 60 * 1000);
      }
      return list;
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch recommended libraries:', formatWordflowRequestError(error, this.currentLanguage).message);
      return [];
    }
  }

  // ---- Public content (vocabulary libraries / books / subtitles) ----
  // PUBLIC GETs — no auth required, anonymous browsing works. Media lists are
  // served by MediaBrowseController (Laravel paginator: items / total /
  // per_page / current_page / last_page; live-verified 2026-06-12).

  /** Read-through helper for the in-memory public-content list cache. */
  private async cachedPublicList<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.publicMediaCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < PUBLIC_MEDIA_CACHE_TTL) {
      return hit.value as T;
    }
    const value = await fetcher();
    this.publicMediaCache.set(cacheKey, { ts: Date.now(), value });
    return value;
  }

  /** Drop the in-memory public-content list cache (books / subtitles /
   *  vocabulary libraries) so the next call re-fetches. */
  invalidatePublicMediaCache() {
    this.publicMediaCache.clear();
  }

  /**
   * PUBLIC list of synced books (GET /media/books?language=&search=&page=&per_page=,
   * MediaBrowseController::books). Cached in memory ~10 min per param set;
   * degrades to an empty page when the backend is unreachable so anonymous
   * pages render an inline empty state.
   */
  async getPublicBooks(
    params: { language?: string; search?: string; page?: number; perPage?: number } = {}
  ): Promise<WfBookListResult> {
    const qs = new URLSearchParams();
    if (params.language) qs.set('language', params.language);
    if (params.search) qs.set('search', params.search);
    if (params.page != null) qs.set('page', String(params.page));
    if (params.perPage != null) qs.set('per_page', String(params.perPage));
    const endpoint = `/media/books${qs.toString() ? `?${qs.toString()}` : ''}`;
    try {
      return await this.cachedPublicList<WfBookListResult>(endpoint, async () => {
        const res = await this.request<any>(endpoint);
        const items: any[] = Array.isArray(res?.items) ? res.items : [];
        return {
          total: Number(res?.total ?? items.length),
          per_page: Number(res?.per_page ?? params.perPage ?? 20),
          current_page: Number(res?.current_page ?? params.page ?? 1),
          last_page: Number(res?.last_page ?? 1),
          books: items.map((it: any): WfBookSummary => ({
            id: Number(it?.id ?? 0),
            source_key: String(it?.source_key ?? ''),
            title: String(it?.title ?? it?.original_name ?? it?.source_key ?? ''),
            original_name: it?.original_name ?? null,
            language: String(it?.language ?? ''),
            sentence_count: Number(it?.sentence_count ?? 0),
            has_audio: !!it?.has_audio,
            synced_at: it?.synced_at ?? null,
            image_url: it?.image_url ?? null,
            poster_status: it?.poster_status ?? null,
          })),
        };
      });
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch public books:', formatWordflowRequestError(error, this.currentLanguage).message);
      return {
        total: 0,
        per_page: params.perPage ?? 20,
        current_page: params.page ?? 1,
        last_page: 1,
        books: [],
      };
    }
  }

  /**
   * PUBLIC list of synced subtitles (GET /media/subtitles?language=&search=&page=&per_page=,
   * MediaBrowseController::subtitles). Same caching/degrade behavior as
   * getPublicBooks().
   */
  async getPublicSubtitles(
    params: { language?: string; search?: string; page?: number; perPage?: number } = {}
  ): Promise<WfSubtitleListResult> {
    const qs = new URLSearchParams();
    if (params.language) qs.set('language', params.language);
    if (params.search) qs.set('search', params.search);
    if (params.page != null) qs.set('page', String(params.page));
    if (params.perPage != null) qs.set('per_page', String(params.perPage));
    const endpoint = `/media/subtitles${qs.toString() ? `?${qs.toString()}` : ''}`;
    try {
      return await this.cachedPublicList<WfSubtitleListResult>(endpoint, async () => {
        const res = await this.request<any>(endpoint);
        const items: any[] = Array.isArray(res?.items) ? res.items : [];
        return {
          total: Number(res?.total ?? items.length),
          per_page: Number(res?.per_page ?? params.perPage ?? 20),
          current_page: Number(res?.current_page ?? params.page ?? 1),
          last_page: Number(res?.last_page ?? 1),
          subtitles: items.map((it: any): WfSubtitleSummary => ({
            id: Number(it?.id ?? 0),
            source_key: String(it?.source_key ?? ''),
            title: String(it?.title ?? it?.original_name ?? it?.source_key ?? ''),
            original_name: it?.original_name ?? null,
            language: String(it?.language ?? ''),
            duration_sec: Number(it?.duration_sec ?? 0),
            subtitle_count: Number(it?.subtitle_count ?? 0),
            segment_count: Number(it?.segment_count ?? 0),
            sentence_count: Number(it?.sentence_count ?? 0),
            synced_at: it?.synced_at ?? null,
            image_url: it?.image_url ?? null,
            poster_status: it?.poster_status ?? null,
          })),
        };
      });
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch public subtitles:', formatWordflowRequestError(error, this.currentLanguage).message);
      return {
        total: 0,
        per_page: params.perPage ?? 20,
        current_page: params.page ?? 1,
        last_page: 1,
        subtitles: [],
      };
    }
  }

  /**
   * PUBLIC vocabulary libraries (anonymous OK; live-verified 2026-06-12).
   * Primary: GET /vocabulary/libraries/recommended?language= → data.libraries[]
   * — the REAL library rows whose ids /group/add_library expects (8 real
   * English libraries on this box, e.g. id=3 "English Coca 60000").
   * Fallback: GET /vocabulary/libraries. `language` accepts the 2-char UI code
   * and is mapped to the backend's FULL name ('en' → 'english'). ~10 min
   * in-memory cache; degrades to [] when the backend is unreachable.
   *
   * Distinct surface from getRecommendedLibraries(): that one is the
   * /learning/recommendations card feed (lang_code/total_words/level shape);
   * this one is the raw public library list (word_count/difficulty/image_url).
   */
  async getPublicVocabularyLibraries(language?: string): Promise<WfPublicLibrary[]> {
    const fullName = toFullLanguageName(language);
    const qs = fullName ? `?language=${encodeURIComponent(fullName)}` : '';
    const cacheKey = `/vocabulary/libraries${qs}#public`;
    const normalize = (res: any): WfPublicLibrary[] => {
      const list = Array.isArray(res?.libraries)
        ? res.libraries
        : Array.isArray(res)
          ? res
          : [];
      return list.map((it: any): WfPublicLibrary => ({
        id: Number(it?.id ?? 0),
        name: String(it?.name ?? ''),
        description: String(it?.description ?? ''),
        word_count: Number(it?.word_count ?? it?.total_words ?? 0),
        language: String(it?.language ?? it?.lang_code ?? ''),
        difficulty: String(it?.difficulty ?? it?.level ?? ''),
        category: String(it?.category ?? ''),
        image_url: it?.image_url ?? null,
        cover_status: it?.cover_status ?? null,
        cover_error_message: it?.cover_error_message ?? null,
        cover_attempts: Number(it?.cover_attempts ?? 0),
        is_recommended: !!it?.is_recommended,
        tags: Array.isArray(it?.tags) ? it.tags : [],
      }));
    };
    try {
      return await this.cachedPublicList<WfPublicLibrary[]>(cacheKey, async () => {
        try {
          return normalize(await this.request<any>(`/vocabulary/libraries/recommended${qs}`));
        } catch (primaryError) {
          console.warn(
            '[WordflowApi] /vocabulary/libraries/recommended failed, falling back to /vocabulary/libraries:',
            primaryError
          );
          return normalize(await this.request<any>(`/vocabulary/libraries${qs}`));
        }
      });
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch public vocabulary libraries:', formatWordflowRequestError(error, this.currentLanguage).message);
      return [];
    }
  }

  /**
   * PUBLIC sentence-paged detail of one book/subtitle
   * (GET /media/content/{type}/{id}?start=&limit=). NOT cached and rethrows on
   * failure — detail pages must surface the real error, never a fake page.
   */
  async getMediaContentDetail(
    type: 'book' | 'subtitle',
    id: number | string,
    opts: { start?: number; limit?: number } = {}
  ): Promise<WfMediaContentDetail> {
    const qs = new URLSearchParams();
    if (opts.start != null) qs.set('start', String(opts.start));
    if (opts.limit != null) qs.set('limit', String(opts.limit));
    return this.request<WfMediaContentDetail>(
      `/media/content/${encodeURIComponent(type)}/${encodeURIComponent(String(id))}${
        qs.toString() ? `?${qs.toString()}` : ''
      }`
    );
  }

  /**
   * Re-queue a failed/stuck library cover for pycore (pull-only generation).
   * POST /api/app_qy_v1/assist/cover/retry { ids:[libraryId] } resets that row
   * to `pending` (cover_attempts=0, lease + error cleared) so the AssistWorker
   * re-claims and regenerates it. No-auth assist group; mirrors laravel-manager's
   * api.appQyV1.retryCover. Callers should refetch the library list afterwards.
   */
  async retryCover(libraryId: number): Promise<any> {
    return this.request<any>('/assist/cover/retry', {
      method: 'POST',
      body: JSON.stringify({ ids: [libraryId] }),
    });
  }

  /**
   * On-demand movie/TV poster fetch + backfill for one book/subtitle
   * (MOVIE_POSTER_PIPELINE.md §7). POST /media/poster/fetch
   * { type, id?, source_key? } → MoviePosterClient (TMDB→OMDB, CJK titles
   * translated first), saves the local file and returns the fresh
   * { image_url, poster_status }. Optional/non-blocking: callers should refetch
   * the list afterwards. Pass an id OR a source_key (id preferred).
   */
  async retryPoster(
    type: 'book' | 'subtitle',
    target: { id?: number | string; sourceKey?: string }
  ): Promise<{ image_url?: string | null; poster_status?: string | null } | any> {
    const body: Record<string, unknown> = { type };
    if (target.id != null) body.id = target.id;
    if (target.sourceKey) body.source_key = target.sourceKey;
    return this.request<any>('/media/poster/fetch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ---- Word groups (CRUD) ----
  // Verified backend routes: AppQyV1Dict.php (/create_group, /delete_group_by_gid,
  // /group/add_library, /query_group_by_gid).

  async getGroupById(gid: string) {
    return this.request<BackendGroupData>(`/query_group_by_gid?gid=${encodeURIComponent(gid)}`);
  }

  async createGroup(payload: { name: string; description?: string; language?: string }) {
    const result = await this.request<any>('/create_group', {
      method: 'POST',
      body: JSON.stringify({ gname: payload.name, ...payload }),
    });
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Append word STRINGS to a group addressed by name, creating the group when
   * it does not exist yet. Verified backend
   * (AppQyV1WordGroupCreationController::createDictGroup): /create_group is an
   * upsert — an existing `gname` gets the new gwords/gcontent APPENDED and its
   * word-frequency map refreshed. `gcontent` is required; `language` must be a
   * 2-char code when present. Success data { gid, uid, did, gname, new_words,
   * words_frequency, gwords_count, gcontent_count, ... }. This is the
   * words-by-string path: /group/add_word only accepts integer
   * vocabulary-item ids, so raw extracted/parsed words must go through here.
   */
  async addWordsToGroup(
    gname: string,
    words: string[],
    opts: { gcontent?: string; language?: string } = {}
  ) {
    const gwords = words.join('\n');
    const body: Record<string, any> = {
      gname,
      gcontent: opts.gcontent && opts.gcontent.trim() ? opts.gcontent : gwords,
      gwords,
    };
    if (opts.language && opts.language.length === 2) body.language = opts.language;
    const result = await this.request<any>('/create_group', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  async deleteGroupByGid(gid: string) {
    const result = await this.request<any>('/delete_group_by_gid', {
      method: 'POST',
      body: JSON.stringify({ gid }),
    });
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  async addLibraryToGroup(gid: string, libraryId: number | string) {
    let result: any;
    try {
      result = await this.request<any>('/group/add_library', {
        method: 'POST',
        body: JSON.stringify({ gid, library_id: libraryId }),
      });
    } catch (error: any) {
      // The already-linked case arrives as HTTP 400 (error_code
      // LIBRARY_ALREADY_ADDED) with data {already_linked: true, words_added: 0}
      // — surface it as a normal result so callers can show the proper
      // "already in this group" feedback instead of a generic failure.
      const body = error?.body;
      const alreadyData = body?.data?.already_linked ? body.data : null;
      if (alreadyData || body?.error_code === 'LIBRARY_ALREADY_ADDED') {
        return alreadyData ?? { already_linked: true, words_added: 0, gid, library_id: libraryId };
      }
      throw error;
    }
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Remove a library from a group. Verified backend
   * (AppQyV1WordGroupLibraryController::removeLibraryFromGroup): payload
   * { gid, library_id }; success data { gid, library_id }; failure 400 with
   * error_code LIBRARY_NOT_LINKED, or GROUP_NOT_FOUND.
   */
  async removeLibraryFromGroup(gid: string, libraryId: number | string) {
    const result = await this.request<{ gid: string; library_id: number | string }>(
      '/group/remove_library',
      {
        method: 'POST',
        body: JSON.stringify({ gid, library_id: libraryId }),
      }
    );
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Remove word(s) from a group. Verified backend
   * (AppQyV1WordGroupWordController::removeWordFromGroup): payload { gid,
   * word_id } or { gid, word_ids: [...] } — ids are the vocabulary-item integer
   * ids. Success data { gid, words_removed, total_requested }; note the call
   * still succeeds (words_removed: 0) when the word was not in the group.
   */
  async removeWordFromGroup(payload: {
    gid: string;
    word_id?: number | string;
    word_ids?: Array<number | string>;
  }) {
    const result = await this.request<{ gid: string; words_removed: number; total_requested: number }>(
      '/group/remove_word',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Paged word list of a group, optionally with per-user progress. Verified
   * backend (AppQyV1WordGroupWordController::getGroupWords): success data
   * { gid, gname, total_words, page, per_page, words: [{ word_id, word,
   * word_index, language_code, added_at, proficiency?, read_count?,
   * review_count?, last_read_at?, next_review_at? }] }. per_page max is 100.
   */
  async getGroupWords(
    gid: string,
    opts: { page?: number; perPage?: number; withProgress?: boolean } = {}
  ) {
    return this.request<any>('/group/get_words', {
      method: 'POST',
      body: JSON.stringify({
        gid,
        page: opts.page ?? 1,
        per_page: opts.perPage ?? 100,
        with_progress: opts.withProgress ?? true,
      }),
    });
  }

  /**
   * Libraries linked to a group. Verified backend
   * (AppQyV1WordGroupLibraryController::getGroupLibraries): success data
   * { gid, gname, libraries_count, libraries: [{ id, name, language,
   * total_words, added_at }] }.
   */
  async getGroupLibraries(gid: string) {
    return this.request<any>('/group/get_libraries', {
      method: 'POST',
      body: JSON.stringify({ gid }),
    });
  }

  // ---- Group media sources (books / subtitles) ----
  // Backend contract (2026-06-12): AUTH POST /group/add_media_source,
  // /group/remove_media_source, /group/get_sources.

  /**
   * Attach a public book/subtitle to a group by source_key (AUTH POST
   * /group/add_media_source { gid, source_type, source_key }). Success data
   * { gid, source_type, source_key, words_added, total_words }. Invalidates
   * the word-groups cache (group word counts changed).
   */
  async addMediaSourceToGroup(
    gid: string,
    sourceType: 'book' | 'subtitle',
    sourceKey: string
  ): Promise<WfAddMediaSourceResult> {
    const result = await this.request<WfAddMediaSourceResult>('/group/add_media_source', {
      method: 'POST',
      body: JSON.stringify({ gid, source_type: sourceType, source_key: sourceKey }),
    });
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Detach a book/subtitle media source from a group (AUTH POST
   * /group/remove_media_source { gid, source_type, source_key }). Invalidates
   * the word-groups cache.
   */
  async removeMediaSourceFromGroup(
    gid: string,
    sourceType: 'book' | 'subtitle',
    sourceKey: string
  ): Promise<any> {
    const result = await this.request<any>('/group/remove_media_source', {
      method: 'POST',
      body: JSON.stringify({ gid, source_type: sourceType, source_key: sourceKey }),
    });
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Every content source linked to a group (AUTH POST /group/get_sources
   * { gid }): vocabulary libraries (getGroupLibraries item shape) + media
   * sources (books/subtitles). Tolerates missing arrays defensively.
   */
  async getGroupSources(gid: string): Promise<WfGroupSourcesResult> {
    const res = await this.request<any>('/group/get_sources', {
      method: 'POST',
      body: JSON.stringify({ gid }),
    });
    return {
      libraries: Array.isArray(res?.libraries) ? res.libraries : [],
      media_sources: Array.isArray(res?.media_sources) ? res.media_sources : [],
    };
  }

  /**
   * Per-user learning stats for a group. Verified backend
   * (AppQyV1WordGroupProgressController::getProgressStats): success data
   * { gid, gname, stats: GroupProgressStats } (live-verified shape).
   *
   * Since the per-group JSON progress storage (2026-06-12) this is the
   * documented FALLBACK only — the primary path is getGroupProgressBlob() +
   * client-side aggregation in wfProgressCenter.computeStats().
   */
  async getGroupProgressStats(gid: string) {
    return this.request<{ gid: string; gname: string; stats: GroupProgressStats }>(
      '/group/get_progress_stats',
      {
        method: 'POST',
        body: JSON.stringify({ gid }),
      }
    );
  }

  /**
   * The ENTIRE per-word progress map of one group in ONE response (AUTH POST
   * /group/get_progress_blob {gid}; per-group JSON progress storage contract,
   * 2026-06-12). Entries use compressed short keys — decode via the response
   * `legend` / expandProgressEntry(). Deliberately NOT cached here: the blob
   * changes with every study action. wfProgressCenter holds it per gid with a
   * short TTL + event invalidation; stats are computed client-side there.
   * Rethrows on failure (callers fall back to getGroupProgressStats()).
   */
  async getGroupProgressBlob(gid: string): Promise<WfGroupProgressBlob> {
    const res = await this.request<any>('/group/get_progress_blob', {
      method: 'POST',
      body: JSON.stringify({ gid }),
    });
    return {
      gid: String(res?.gid ?? gid),
      gname: String(res?.gname ?? ''),
      language_code: res?.language_code ?? null,
      total_words: Number(res?.total_words ?? 0),
      legend:
        res?.legend && typeof res.legend === 'object' ? res.legend : WF_PROGRESS_LEGEND,
      words: res?.words && typeof res.words === 'object' ? res.words : {},
    };
  }

  /**
   * Report study answer(s) against a group (AUTH POST /group/update_progress).
   * Both backend shapes are supported (contract 2026-06-12):
   *   - legacy single: { word_id, correct, gid? }
   *   - batch:         { gid?, updates: [{ word_id, correct }] }
   * Queueable offline (idempotent replay). Invalidates the learning-stats +
   * review-queue TTL caches; the held progress blob is dropped by
   * wfProgressCenter (which is how batch reports should be sent —
   * wfProgressCenter.reportAnswers()).
   */
  async updateGroupProgress(
    payload:
      | ({ gid?: string } & WfGroupProgressUpdate & Record<string, any>)
      | { gid?: string; updates: WfGroupProgressUpdate[] }
  ) {
    const result = await this.request<any>('/group/update_progress', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await Promise.all([
      StorageCenter.cache.invalidate(StorageKey.LEARNING_STATS_CACHE),
      StorageCenter.cache.invalidate(StorageKey.REVIEW_QUEUE_CACHE),
    ]);
    return result;
  }

  // ---- Learning progress / stats ----
  // Verified backend routes: AppQyV1Learning.php + AppQyV1Words.php (/words/daily).

  async getLearningStats() {
    const cached = await StorageCenter.cache.get<any>(StorageKey.LEARNING_STATS_CACHE);
    if (cached) return cached;
    const stats = await this.request<any>('/learning/stats');
    if (stats) StorageCenter.cache.set(StorageKey.LEARNING_STATS_CACHE, stats, 2 * 60 * 1000);
    return stats;
  }

  async getReviewQueue(): Promise<any[]> {
    const cached = await StorageCenter.cache.get<any[]>(StorageKey.REVIEW_QUEUE_CACHE);
    if (cached) return cached;
    try {
      const res = await this.request<any>('/learning/review-queue');
      // Live-verified shape: data.{ review_words: [...], new_words: [...],
      // review_count, new_count, total_count, lang_code } — the queue is the
      // concatenation of review_words + new_words. Older { queue }/{ words }
      // shapes are kept as fallbacks.
      const queue = Array.isArray(res)
        ? res
        : Array.isArray(res?.review_words) || Array.isArray(res?.new_words)
          ? [
              ...(Array.isArray(res?.review_words) ? res.review_words : []),
              ...(Array.isArray(res?.new_words) ? res.new_words : []),
            ]
          : Array.isArray(res?.queue) ? res.queue : Array.isArray(res?.words) ? res.words : [];
      if (queue.length > 0) StorageCenter.cache.set(StorageKey.REVIEW_QUEUE_CACHE, queue, 2 * 60 * 1000);
      return queue;
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch review queue:', formatWordflowRequestError(error, this.currentLanguage).message);
      return [];
    }
  }

  /** Report a study answer; invalidates the stats + review-queue caches. */
  async updateLearningProgress(payload: { word_id: string | number; group_id?: string; correct: boolean; [k: string]: any }) {
    const result = await this.request<any>('/learning/progress', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await Promise.all([
      StorageCenter.cache.invalidate(StorageKey.LEARNING_STATS_CACHE),
      StorageCenter.cache.invalidate(StorageKey.REVIEW_QUEUE_CACHE),
    ]);
    return result;
  }

  async getDailyWords(count = 10): Promise<Word[]> {
    const cached = await StorageCenter.cache.get<Word[]>(StorageKey.DAILY_WORDS_CACHE);
    if (cached) return cached;
    try {
      const res = await this.request<any>(`/words/daily?count=${count}`);
      const words = Array.isArray(res) ? res : Array.isArray(res?.words) ? res.words : [];
      if (words.length > 0) StorageCenter.cache.set(StorageKey.DAILY_WORDS_CACHE, words, 30 * 60 * 1000);
      return words;
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch daily words:', formatWordflowRequestError(error, this.currentLanguage).message);
      return [];
    }
  }

  // ---- Daily recitation (每日背诵) ----
  // AUTH endpoints (never anonymous). Contract: see the WfRecitation* types.
  // /recitation/log is in WF_QUEUEABLE_ENDPOINTS — when offline the write is
  // persisted and replayed; the per-flush batch_id makes the replay idempotent.

  /**
   * Log a batch of recitation events. Callers should generate ONE fresh
   * batch_id per flush (e.g. crypto.randomUUID()) so an offline replay of the
   * same batch is deduped server-side. Rejects with a QueuedError when the
   * write was persisted offline (the centralized queued toast already fired).
   */
  async recitationLog(payload: {
    words: WfRecitationLogWord[];
    language?: string;
    session_id?: string;
    batch_id?: string;
  }): Promise<WfRecitationLogResult> {
    const result = await this.request<WfRecitationLogResult>('/recitation/log', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // Today's counters moved — drop the short-TTL summary/streak cache so the
    // next reads see the fresh state.
    this.recitationCache.clear();
    return result;
  }

  /**
   * Today's recitation plan (due reviews + new words + done/goal counters).
   * NEVER cached: done_today moves with every log flush and the recite page
   * decides when to reload the stack. Rethrows on failure.
   */
  async recitationTodayPlan(
    params: { language?: string; limit?: number } = {}
  ): Promise<WfRecitationTodayPlan> {
    const qs = new URLSearchParams();
    if (params.language) qs.set('language', params.language);
    if (params.limit != null) qs.set('limit', String(params.limit));
    return this.request<WfRecitationTodayPlan>(
      `/recitation/today-plan${qs.toString() ? `?${qs.toString()}` : ''}`
    );
  }

  /** Read-through helper for the short-TTL recitation cache (summary/streak). */
  private async cachedRecitationRead<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.recitationCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < RECITATION_CACHE_TTL) return hit.value as T;
    const value = await fetcher();
    this.recitationCache.set(cacheKey, { ts: Date.now(), value });
    return value;
  }

  /**
   * Per-day recitation summary (defaults to today server-side when no date is
   * passed). Short ~60s TTL — today's summary changes as the user recites.
   */
  async recitationSummary(date?: string): Promise<WfRecitationSummary> {
    const endpoint = `/recitation/summary${date ? `?date=${encodeURIComponent(date)}` : ''}`;
    return this.cachedRecitationRead<WfRecitationSummary>(endpoint, () =>
      this.request<WfRecitationSummary>(endpoint)
    );
  }

  /** Streak counters + the last-35-days activity strip. Short ~60s TTL. */
  async recitationStreak(): Promise<WfRecitationStreak> {
    const endpoint = '/recitation/streak';
    return this.cachedRecitationRead<WfRecitationStreak>(endpoint, () =>
      this.request<WfRecitationStreak>(endpoint)
    );
  }

  async getSelectedCollections(): Promise<any[]> {
    const cached = await StorageCenter.cache.get<any[]>(StorageKey.SELECTED_COLLECTIONS_CACHE);
    if (cached) return cached;
    try {
      const res = await this.request<any>('/learning/collections/selected');
      const list = Array.isArray(res) ? res : Array.isArray(res?.collections) ? res.collections : Array.isArray(res?.selected) ? res.selected : [];
      if (list.length > 0) StorageCenter.cache.set(StorageKey.SELECTED_COLLECTIONS_CACHE, list, 5 * 60 * 1000);
      return list;
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch selected collections:', formatWordflowRequestError(error, this.currentLanguage).message);
      return [];
    }
  }

  async selectCollection(payload: { collection_id: number | string; selected?: boolean;[k: string]: any }) {
    // Backend reads `action: 'select' | 'deselect'` (defaults to 'select'),
    // not the boolean `selected` — without this mapping a deselect silently
    // re-selects server-side.
    const action = payload.action ?? (payload.selected === false ? 'deselect' : 'select');
    const result = await this.request<any>('/learning/collections/select', {
      method: 'POST',
      body: JSON.stringify({ ...payload, action }),
    });
    await StorageCenter.cache.invalidate(StorageKey.SELECTED_COLLECTIONS_CACHE);
    return result;
  }

  // ---- Document upload ----

  /**
   * Upload a vocabulary document. Verified backend route: POST /learning/upload
   * (AppQyV1VocabularyUploadController::uploadDocument, multipart).
   */
  async uploadDocument(form: FormData) {
    const result = await this.request<any>('/learning/upload', {
      method: 'POST',
      body: form,
    });
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  // ---- Personal dictionary ----
  // Verified backend routes: AppQyV1PersonDict.php (custom.authenticate):
  // /create_personal_dictionary, /query_personal_dictionary,
  // /query_personal_dictionary_by_words, /delete_personal_dictionary_by_id,
  // /delete_personal_all_dictionary. All POST; every success body wraps its
  // payload in the standard { success, data, message } envelope that request()
  // unwraps.

  /**
   * Query the user's personal dictionary. Verified params (QueryController::
   * queryPDictionary): word (case-insensitive LIKE), language (exact), limit
   * (default 50), offset (default 0); ordered by id DESC. Returns the entry
   * array directly.
   */
  async queryPersonalDictionary(
    params: { word?: string; language?: string; limit?: number; offset?: number } = {}
  ): Promise<PersonalDictionaryEntry[]> {
    const res = await this.request<any>('/query_personal_dictionary', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return Array.isArray(res) ? (res as PersonalDictionaryEntry[]) : [];
  }

  /** Exact-word batch lookup (QueryController::queryPDictionaryByWords). */
  async queryPersonalDictionaryByWords(words: string[]): Promise<PersonalDictionaryEntry[]> {
    const res = await this.request<any>('/query_personal_dictionary_by_words', {
      method: 'POST',
      body: JSON.stringify({ words }),
    });
    return Array.isArray(res) ? (res as PersonalDictionaryEntry[]) : [];
  }

  /**
   * Create a personal-dictionary entry. Verified validator (CreationController):
   * word required (max 255); definition/example/notes nullable; language
   * nullable max 16, defaults to 'en'. Success data { id, message }.
   */
  async createPersonalDictionaryEntry(payload: {
    word: string;
    definition?: string;
    example?: string;
    notes?: string;
    language?: string;
  }): Promise<{ id: string; message: string }> {
    return this.request<{ id: string; message: string }>('/create_personal_dictionary', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Delete one entry by id (DeletionController; scoped to the auth user). */
  async deletePersonalDictionaryEntry(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/delete_personal_dictionary_by_id', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  }

  /** Delete every entry of the auth user (DeletionController). */
  async deleteAllPersonalDictionaryEntries(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/delete_personal_all_dictionary', {
      method: 'POST',
    });
  }

  // ---- AI tools: article processing ----
  // Verified backend routes: AppQyV1AITools.php article group — POST
  // /ai_tools/article/{preview,submit} (auth:sanctum) + public GET
  // /ai_tools/article/task/{taskId}. The validators take `article_text` (NOT
  // `content`) and a FULL-NAME language in
  // english|chinese|spanish|french|german|japanese|korean (not ISO codes).

  /** Parse an article without creating a task (ArticleController::previewParsing). */
  async articlePreview(payload: {
    article_text: string;
    language?: string;
  }): Promise<ArticlePreviewResult> {
    return this.request<ArticlePreviewResult>('/ai_tools/article/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Persist an article + its parsed words and (by default) enqueue the TTS
   * generation global task (ArticleController::submitArticle).
   */
  async articleSubmit(payload: {
    article_text: string;
    language?: string;
    title?: string;
    article_type?: string;
    source?: string;
    difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
    generate_sentence_audio?: boolean;
    generate_word_audio?: boolean;
    is_daily_reading?: boolean;
    reading_date?: string;
  }): Promise<ArticleSubmitResult> {
    return this.request<ArticleSubmitResult>('/ai_tools/article/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Poll an article TTS task (ArticleController::getTaskStatus, public GET). */
  async getArticleTaskStatus(taskId: string): Promise<ArticleTaskStatus> {
    return this.request<ArticleTaskStatus>(
      `/ai_tools/article/task/${encodeURIComponent(taskId)}`
    );
  }

  // ---- AI tools: translation queue ----
  // Verified backend routes: AppQyV1AITools.php (queue/batch/add + queue/batch/status).

  /** Enqueue words for high-priority translation. */
  async translationQueueBatchAdd(words: string[], targetLanguage?: string) {
    return this.request<any>('/ai_tools/translation/queue/batch/add', {
      method: 'POST',
      body: JSON.stringify({ words, target_language: targetLanguage || this.currentLanguage }),
    });
  }

  /** Poll translation state for a batch of words. */
  async translationQueueBatchStatus(words: string[], targetLanguage?: string) {
    return this.request<any>('/ai_tools/translation/queue/batch/status', {
      method: 'POST',
      body: JSON.stringify({ words, target_language: targetLanguage || this.currentLanguage }),
    });
  }

  // ---- AI tools: TTS ----
  // Verified backend routes: AppQyV1AITools.php tts group (languages/voices/
  // generate/batch-generate/queue/batch/{add,get}/audio).

  async getTtsLanguages() {
    return this.request<any>('/ai_tools/tts/languages');
  }

  async getTtsVoices(language?: string) {
    return this.request<any>(`/ai_tools/tts/voices${language ? `?language=${encodeURIComponent(language)}` : ''}`);
  }

  async ttsGenerate(payload: { text: string; language?: string; voice?: string; speed?: number;[k: string]: any }) {
    return this.request<any>('/ai_tools/tts/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async ttsBatchGenerate(items: any[]) {
    return this.request<any>('/ai_tools/tts/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async ttsQueueBatchAdd(texts: string[], language?: string) {
    return this.request<any>('/ai_tools/tts/queue/batch/add', {
      method: 'POST',
      body: JSON.stringify({ texts, language: language || this.currentLanguage }),
    });
  }

  async ttsQueueBatchGet(texts: string[], language?: string) {
    return this.request<any>('/ai_tools/tts/queue/batch/get', {
      method: 'POST',
      body: JSON.stringify({ texts, language: language || this.currentLanguage }),
    });
  }

  /**
   * Resolve one sentence's audio file-first (GET /ai_tools/tts/sentence/audio).
   * Pass `hash` (sha1 sentence_id or md5 content_id) OR raw `text` to hash
   * server-side; `language` is the full name (e.g. "english"). The server
   * checks disk directly and, on a miss, may enqueue generation (`queued:true`).
   * PUBLIC GET — used to play a sentence whose `audio` reference is not yet on
   * the synced row.
   */
  async resolveSentenceAudio(params: { hash?: string; text?: string; language: string }): Promise<WfSentenceAudioResolve> {
    const qs = new URLSearchParams();
    if (params.hash) qs.set('hash', params.hash);
    if (params.text) qs.set('text', params.text);
    qs.set('language', toFullLanguageName(params.language) || params.language);
    return this.request<WfSentenceAudioResolve>(
      `/ai_tools/tts/sentence/audio?${qs.toString()}`
    );
  }

  /**
   * Absolute URL for a generated TTS audio file (canonical path shape from the
   * original TtsUrl.ts: /api/app_qy_v1/ai_tools/tts/audio/{language}/{type}[/{speed}]/{filename}).
   */
  getTtsAudioUrl(language: string, type: string, filename: string, speed?: string | number): string {
    const base = apiManager.getCurrentBaseUrl();
    const parts = [language, type, ...(speed != null ? [String(speed)] : []), filename]
      .map((p) => encodeURIComponent(String(p)));
    return `${base}${API_PREFIX}/ai_tools/tts/audio/${parts.join('/')}`;
  }

  // ---- AI assistant ----

  /**
   * Single-turn assistant request against the app_qy_v1 AI surface.
   *
   * The original Capacitor app ran its chat client-side via Gemini; in the shell
   * the assistant routes through the same app_qy_v1 backend. We post to the AI
   * learning-mode endpoint (the closest server-side conversational AI surface)
   * and extract a text reply from whatever envelope the backend returns.
   */
  async assistant(prompt: string, history: { role: string; content: string }[] = []): Promise<string> {
    const res = await this.request<any>('/ai_tools/translation/learning', {
      method: 'POST',
      body: JSON.stringify({
        text: prompt,
        message: prompt,
        prompt,
        history,
        target_language: this.currentLanguage,
      }),
    });
    return extractReply(res);
  }

  // ---- Endpoint lifecycle ----

  /**
   * Drop the one-shot endpoint-probe promise so the next request re-runs
   * probe/auto-select. Call after the user switches the API endpoint in
   * settings (the data caches should be cleared separately via clearCache()).
   */
  resetEndpointInit() {
    this.initPromise = null;
  }

  // ---- Cache management ----

  clearCache(key?: StorageKey) {
    if (key) {
      StorageCenter.cache.invalidate(key);
    } else {
      this.publicMediaCache.clear();
      this.recitationCache.clear();
      StorageCenter.cache.invalidateAll();
    }
  }

  async refreshUserProfile() {
    await StorageCenter.cache.invalidate(StorageKey.USER_PROFILE_CACHE);
    return this.getUserProfile();
  }

  async refreshWordGroups() {
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return this.getWordGroups();
  }
}

/**
 * Best-effort reply extraction across the various envelope shapes the AI
 * endpoints may use.
 */
export function extractReply(res: any): string {
  if (res == null) return '';
  if (typeof res === 'string') return res;
  if (typeof res.reply === 'string') return res.reply;
  if (typeof res.text === 'string') return res.text;
  if (typeof res.result === 'string') return res.result;
  if (typeof res.translation === 'string') return res.translation;
  if (typeof res.message === 'string') return res.message;
  if (typeof res.content === 'string') return res.content;
  if (res.data) {
    const nested = extractReply(res.data);
    if (nested) return nested;
  }
  if (res.choices && res.choices[0] && res.choices[0].message) {
    return String(res.choices[0].message.content ?? '');
  }
  if (res.error) throw new Error(String(res.error));
  return JSON.stringify(res);
}

export const wordflowApi = new WordflowApiService();
export const api = wordflowApi;
