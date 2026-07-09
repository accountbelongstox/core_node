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
} from '../../../../core/api-libs/base';
import { appendLog } from '../../../../core/logstore/logStore';
// Leaf UI module (react + Portal + overlay constants only — it never imports
// any api-lib), so pulling it into the transport layer cannot create a cycle.
import { notify } from '../../../../core/notify/notify';
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


// Type/interface surface extracted to ./wordflowApiTypes (re-exported for back-compat).
export * from './wordflowApiTypes';

import { WordflowApiMethods } from './wordflowMethods';
class WordflowApiService extends WordflowApiMethods {
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

  /**
   * Enqueue words for translation.
   *
   * `opts.interactive` (default false) flags a USER-INITIATED single lookup so
   * the backend lands the GlobalTask on the shared `remote_fast` interactive
   * lane at priority 100 with capability "translate". Batch/scan callers MUST
   * leave it false (the default) so background work stays on the normal lane.
   */
  async translationQueueBatchAdd(
    words: string[],
    targetLanguage?: string,
    opts: { interactive?: boolean; language?: string } = {}
  ) {
    const body: Record<string, any> = {
      words,
      // Source language is REQUIRED by AppQyV1TranslationQueueController::batchAdd
      // (alongside target_language); omitting it 422s and the task is never created.
      language: opts.language || this.currentLanguage,
      target_language: targetLanguage || this.currentLanguage,
    };
    if (opts.interactive) {
      body.interactive = true;
      body.capability = 'translate';
    }
    return this.request<any>('/ai_tools/translation/queue/batch/add', {
      method: 'POST',
      body: JSON.stringify(body),
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

  /**
   * Enqueue text(s) for word-audio (TTS) generation.
   *
   * `opts.interactive` (default false) flags a USER-INITIATED single request so
   * the backend bumps the word to the FRONT of the audio queue (tts_priority=100)
   * via the assist protocol (position='beginning') — NOT a remote_fast GlobalTask.
   * Batch callers MUST leave it false so background generation keeps normal
   * priority. Body matches AppQyV1BatchAddTTSTasksRequest: { tasks: [{ content,
   * language, type }], interactive? }. `language` is a short code (max:10).
   */
  async ttsQueueBatchAdd(
    texts: string[],
    language?: string,
    opts: { interactive?: boolean } = {}
  ) {
    const lang = language || this.currentLanguage;
    const body: Record<string, any> = {
      tasks: texts.map((t) => ({ content: t, language: lang, type: 'word' })),
    };
    if (opts.interactive) {
      body.interactive = true;
    }
    return this.request<any>('/ai_tools/tts/queue/batch/add', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async ttsQueueBatchGet(texts: string[], language?: string) {
    return this.request<any>('/ai_tools/tts/queue/batch/get', {
      method: 'POST',
      body: JSON.stringify({ texts, language: language || this.currentLanguage }),
    });
  }

  // ---- AI tools: word image queue ----
  // Verified backend route: AppQyV1AITools.php word_image group
  // (word_image/queue/add). Marks the dict row image_status=pending; priority
  // 'front' => image_priority=PRIORITY_FRONT(100).

  /**
   * Enqueue word(s) for image generation.
   *
   * `opts.interactive` (default false) flags a USER-INITIATED single lookup so
   * the backend ALSO promotes the canonical word_media image GlobalTask onto the
   * shared `remote_fast` lane (capability "image", priority>=100, is_fast_tier=1)
   * via AppQyV1WordMediaService — the SINGLE canonical word_media task creator.
   * Because pycore advertises caps [audio,translate] and has no image generator,
   * a capability="image" task is claimable ONLY by chrome (caps [image,translate]),
   * which fast-drains it sub-second. Background/batch callers MUST leave it false
   * (the default) so generation stays on the normal lane.
   */
  async imageQueueBatchAdd(
    words: string[],
    language: string,
    opts: { interactive?: boolean } = {}
  ) {
    return this.request<any>('/ai_tools/word_image/queue/add', {
      method: 'POST',
      body: JSON.stringify({
        words: words.map((w) => ({ word: w, language })),
        priority: opts.interactive ? 'front' : 'normal',
        ...(opts.interactive ? { interactive: true } : {}),
      }),
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
