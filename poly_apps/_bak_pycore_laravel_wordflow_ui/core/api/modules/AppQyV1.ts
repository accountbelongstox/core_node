import { BaseAPI } from '../base/BaseAPI';
import { apiCache } from '../base/APICache';
import { APIResponse } from '../../types';

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

/** One provider entry in the poster-pipeline status. `has_v4_token` is only
 *  present for tmdb (the optional v4 Bearer read-access token). */
export interface PosterProviderStatus {
  name: 'tmdb' | 'omdb' | string;
  configured: boolean;
  has_v4_token?: boolean;
}

/** Per-poster_status distribution for one media table. */
export interface PosterStatusCounts {
  pending: number;
  ready: number;
  failed: number;
  none: number;
  total: number;
}

/** GET /media/poster/status — provider key config + masked keys + per-type
 *  poster_status counts (book / subtitle). Cheap, no-auth, never throws. */
export interface PosterStatusData {
  providers: PosterProviderStatus[];
  /** Masked (first6…last4) key values keyed by secret base; null when unset. */
  keys: Record<string, string | null>;
  counts: {
    book: PosterStatusCounts;
    subtitle: PosterStatusCounts;
  };
}

/** POST /media/poster/fetch — on-demand poster fetch (TMDB→OMDB→AI cover). */
export interface PosterFetchResult {
  image_url: string | null;
  poster_status: 'pending' | 'ready' | 'failed' | 'none';
  provider?: string | null;
  already_done?: boolean;
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

/**
 * AppQyV1 API Module
 * Vocabulary learning system + AI tools
 */
export class AppQyV1API extends BaseAPI {
  // ========== Authentication ==========
  async register(data: { username: string; password: string; email?: string; nickname?: string; name?: string; registration_code?: string }): Promise<APIResponse> {
    return this.post('/register', data);
  }

  async login(data: { username: string; password: string }): Promise<APIResponse> {
    return this.post('/login', data);
  }

  async logout(): Promise<APIResponse> {
    return this.post('/logout');
  }

  async getCurrentUser(): Promise<APIResponse> {
    return this.get('/user');
  }

  async registerWithCode(data: { registration_code: string; referral_source?: string }): Promise<APIResponse> {
    return this.post('/register-code', data);
  }

  // ========== Translation ==========
  /**
   * Translate text. Accepts EITHER positional args
   * `translate(text, sourceLang, targetLang)` (AppQyV1Model / legacy callers)
   * OR a single payload object — the universal `ToolModel.execute()` dispatch
   * always calls `apiModule.method(input)` with one object, so the AI Tools
   * Translation form and VocabularyLearning pass `{ text, sourceLang?,
   * source_lang?, source_language?, targetLang?, target_lang?,
   * target_language?, type? }`. Without this both live paths silently posted
   * `{ text: <object>, source_lang: undefined }` and never translated.
   */
  async translate(
    textOrPayload: string | Record<string, any>,
    sourceLang?: string,
    targetLang?: string
  ): Promise<APIResponse> {
    let body: Record<string, any>;

    if (typeof textOrPayload === 'string') {
      body = {
        text: textOrPayload,
        source_lang: sourceLang,
        target_lang: targetLang
      };
    } else {
      const p = textOrPayload || {};
      body = {
        text: p.text,
        source_lang: p.source_lang ?? p.sourceLang ?? p.source_language,
        target_lang: p.target_lang ?? p.targetLang ?? p.target_language
      };
      if (p.type !== undefined) body.type = p.type;
      if (p.options !== undefined) body.options = p.options;
    }

    return this.post('/ai_tools/translation/translate', body);
  }

  /**
   * Auto-detect the source language and translate. There is no dedicated
   * `detect-translate` route under app_qy_v1; the translate endpoint performs
   * auto-detection when `source_lang` is 'auto'. Signature/return shape kept
   * stable so callers (TranslationPanel, VocabularyLearning, AppQyV1Model)
   * keep working.
   */
  async detectAndTranslate(text: string, targetLang: string): Promise<APIResponse> {
    return this.post('/ai_tools/translation/translate', {
      text,
      source_lang: 'auto',
      target_lang: targetLang
    });
  }

  async getTranslationLanguages(): Promise<APIResponse> {
    return this.get('/ai_tools/translation/languages', undefined, true, 3600000); // Cache 1 hour
  }

  // ========== TTS ==========
  async getTTSLanguages(): Promise<APIResponse> {
    return this.get('/ai_tools/tts/languages', undefined, true, 3600000);
  }

  async getTTSVoices(): Promise<APIResponse> {
    return this.get('/ai_tools/tts/voices', undefined, true, 3600000);
  }

  async getTTSOptions(): Promise<APIResponse> {
    return this.get('/ai_tools/tts/options', undefined, true, 3600000);
  }

  async generateTTS(data: { text: string; language: string; type?: string; voice_type?: string; speed?: number; options?: any }): Promise<APIResponse> {
    return this.post('/ai_tools/tts/generate', data);
  }

  async batchGenerateTTS(items: Array<{ text: string; language: string; type?: string; options?: any }>): Promise<APIResponse> {
    return this.post('/ai_tools/tts/batch-generate', { items });
  }

  // ========== TTS Queue Management ==========
  async getTTSQueueStats(): Promise<APIResponse> {
    return this.get('/ai_tools/tts/queue/stats', undefined, false); // No cache, real-time data
  }

  async checkTTSQueueStatus(word: string, language: string): Promise<APIResponse> {
    return this.get('/ai_tools/tts/queue/status', { word, language });
  }

  async queueBatchTTS(words: Array<{ word: string; language: string; priority?: number }>): Promise<APIResponse> {
    return this.post('/ai_tools/tts/queue_batch', { words });
  }

  /**
   * POST /ai_tools/translation/queue/batch/add — queue word(s) for (re)translation.
   * Used by the word-detail "Re-translate" one-click action.
   */
  async queueTranslationBatch(data: {
    words: string[];
    language: string;
    target_language?: string;
  }): Promise<APIResponse> {
    return this.post('/ai_tools/translation/queue/batch/add', {
      target_language: 'zh',
      ...data,
    });
  }

  /**
   * POST /ai_tools/tts/queue/batch/query — request/refresh audio for content
   * item(s). Body is a bare array of { content, language, type }. Used by the
   * word-detail "Add / refresh audio" one-click action.
   */
  async queueTTSBatchQuery(
    items: Array<{ content: string; language: string; type?: 'word' | 'sentence' | 'article' }>
  ): Promise<APIResponse> {
    return this.post('/ai_tools/tts/queue/batch/query', items);
  }

  // ========== Sentence-library audio (file-first resolution) ==========
  /**
   * GET /ai_tools/tts/sentence/audio — resolve one sentence's audio. Pass a
   * pre-computed `hash` (sha1 sentence_id or md5 content_id) OR the raw `text`
   * to hash server-side; `language` is the full name (e.g. "english"). The
   * server checks disk directly (file is the source of truth) and, on a miss,
   * reconciles has_audio=false and may enqueue generation (`queued:true`).
   * Real-time, never cached.
   */
  async getSentenceAudio(params: { hash?: string; text?: string; language: string }): Promise<APIResponse<SentenceAudioResolveResponse>> {
    return this.get<SentenceAudioResolveResponse>('/ai_tools/tts/sentence/audio', params as Record<string, any>, false);
  }

  /**
   * POST /ai_tools/tts/sentence/claim with `{ limit: 0 }` — counts-only summary
   * (no rows leased) for the Queue Center "Sentence Audio" strip. The full
   * claim (limit > 0) is the pycore worker's; the dashboard only reads counts.
   */
  async getSentenceAudioSummary(language?: string): Promise<APIResponse<SentenceAudioClaimSummary>> {
    return this.post<SentenceAudioClaimSummary>('/ai_tools/tts/sentence/claim', { limit: 0, language: language ?? null });
  }

  // ========== Image Generation ==========
  async generateImage(data: { prompt: string; style?: string; size?: string; quality?: string }): Promise<APIResponse> {
    return this.post('/ai_tools/image/generate', data);
  }

  // ========== Cover Generation / AI Status ==========
  /** GET /ai_tools/cover-status — cover queue counts + Laravel AI (gemini)
   *  config/probe + pycore reachability/providers + recent failures.
   *  Real-time diagnostic data, never cached. */
  async getCoverStatus(): Promise<APIResponse<CoverStatusData>> {
    return this.get<CoverStatusData>('/ai_tools/cover-status', undefined, false);
  }

  /** POST /ai_tools/cover-retry — reset ALL failed covers back to retry so the
   *  appqyv1_cover_generation timer task picks them up on its next run. */
  async retryCovers(): Promise<APIResponse<CoverRetryResult>> {
    return this.post<CoverRetryResult>('/ai_tools/cover-retry');
  }

  /** GET /assist/status — cover + TTS assist queues (third-party lease view). */
  async getAssistStatus(): Promise<APIResponse<AssistStatusData>> {
    return this.get<AssistStatusData>('/assist/status', undefined, false);
  }

  /**
   * POST /assist/cover/retry — pull-mode cover retry. Resets the given failed/
   * stuck library covers (or ALL failed covers when `all=true`) back to
   * `pending` so pycore re-claims and regenerates them. Pass the library ids to
   * retry a specific card's cover.
   */
  async retryCover(payload: { ids?: number[]; all?: boolean }): Promise<APIResponse<AssistCoverRetryResult>> {
    return this.post<AssistCoverRetryResult>('/assist/cover/retry', payload);
  }

  /**
   * POST /assist/cover/clear — discard unsatisfactory covers. Deletes the cover
   * image file(s) and re-queues the row(s) to `pending` with a FRESH randomized
   * prompt so pycore regenerates a different image. `all` clears every cover;
   * `failed_only` narrows to failed/retry rows; otherwise pass specific `ids`.
   * On success the cached library list is invalidated so the UI reloads.
   */
  async clearCover(payload: { ids?: number[]; all?: boolean; failed_only?: boolean }): Promise<APIResponse<{ cleared: number; files_deleted: number }>> {
    const response = await this.post<{ cleared: number; files_deleted: number }>('/assist/cover/clear', payload);
    if (response.success) {
      apiCache.clear('/vocabulary/libraries');
    }
    return response;
  }

  /**
   * POST /assist/cover/reconcile — recovery: re-queue covers marked `ready`
   * whose image file is missing on disk so pycore regenerates them.
   */
  async reconcileCovers(): Promise<APIResponse<{ reset: number; checked: number }>> {
    const response = await this.post<{ reset: number; checked: number }>('/assist/cover/reconcile');
    if (response.success) {
      apiCache.clear('/vocabulary/libraries');
    }
    return response;
  }

  /**
   * GET /assist/pending — cheap, cache-backed pending-work snapshot across all
   * three assist tracks (cover / tts / translation). Warmed every tick by the
   * Octane cover timer, so the dashboard can poll it freely. `fresh` forces a
   * server-side recompute.
   */
  async getAssistPending(fresh = false): Promise<APIResponse<{ snapshot: AssistPendingSnapshot }>> {
    return this.get<{ snapshot: AssistPendingSnapshot }>(
      '/assist/pending', fresh ? { fresh: 1 } : undefined, false);
  }

  // ========== Movie/TV poster pipeline ==========
  /**
   * GET /media/poster/status — cheap, no-auth poster-pipeline snapshot:
   * provider key config (tmdb configured + v4 token, omdb configured), masked
   * key values, and per-type poster_status counts (book / subtitle). Real-time
   * diagnostic data, never cached.
   */
  async getPosterStatus(): Promise<APIResponse<PosterStatusData>> {
    return this.get<PosterStatusData>('/media/poster/status', undefined, false);
  }

  /**
   * POST /media/poster/fetch — on-demand poster fetch for one media row.
   * Resolve the row by `id` (preferred) OR `sourceKey`; the server runs the
   * real TMDB→OMDB→AI-cover chain and returns `{ image_url, poster_status,
   * provider? }`.
   */
  async fetchPoster(
    type: 'book' | 'subtitle',
    target: { id?: number | string; sourceKey?: string }
  ): Promise<APIResponse<PosterFetchResult>> {
    const body: Record<string, any> = { type };
    if (target.id !== undefined && target.id !== null && `${target.id}` !== '') {
      body.id = typeof target.id === 'string' ? Number(target.id) : target.id;
    }
    if (target.sourceKey !== undefined && target.sourceKey !== '') {
      body.source_key = target.sourceKey;
    }
    return this.post<PosterFetchResult>('/media/poster/fetch', body);
  }

  /**
   * GET /ai_tools/translation/queue/history — detailed processing history over
   * TERMINAL word_translation tasks (completed + failed), newest first, with the
   * per-task result (translations + provider) and timing. Read-only, paginated.
   */
  async getTranslationHistory(params?: {
    status?: 'completed' | 'failed' | '';
    limit?: number;
    page?: number;
    offset?: number;
  }): Promise<APIResponse<TranslationHistoryResponse>> {
    return this.get<TranslationHistoryResponse>(
      '/ai_tools/translation/queue/history', params as Record<string, any>, false);
  }

  // ========== Speech-to-Text ==========
  async transcribeAudio(data: { audio: File; language?: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('audio', data.audio);
    if (data.language) {
      formData.append('language', data.language);
    }
    return this.request({ url: '/ai_tools/speech/transcribe', method: 'POST', data: formData } as any);
  }

  // ========== Vocabulary Learning ==========
  async getLearningWords(params: { limit?: number; library_id?: string }): Promise<APIResponse> {
    return this.get('/learning/words', params);
  }

  async getLibraryWords(libraryId: number, params?: { page?: number; per_page?: number }): Promise<APIResponse> {
    return this.get(`/vocabulary/libraries/${libraryId}/words`, params);
  }

  async getLibraries(params?: { language?: string; category?: string; difficulty?: string; search?: string; page?: number; per_page?: number }): Promise<APIResponse> {
    return this.get('/vocabulary/libraries', params, true, 600000); // Cache 10 minutes
  }

  async getRecommendedLibraries(params?: { language?: string; limit?: number }): Promise<APIResponse> {
    return this.get('/vocabulary/libraries/recommended', params, true, 600000); // Cache 10 minutes
  }

  /**
   * Delete a user-created learning library (auth:sanctum —
   * DELETE /learning/libraries/{library_id}). Words created by that upload
   * are removed server-side; built-in dictionary data is unaffected.
   * On success the cached GET /vocabulary/libraries responses are
   * invalidated so the next list load reflects the deletion.
   */
  async deleteLearningLibrary(libraryId: number | string): Promise<APIResponse> {
    const response = await this.delete(`/learning/libraries/${libraryId}`);
    if (response.success) {
      apiCache.clear('/vocabulary/libraries');
    }
    return response;
  }

  async getVocabularyStatistics(params?: { language?: string; include_words?: boolean | number; page?: number; per_page?: number }): Promise<APIResponse> {
    return this.get('/vocabulary/statistics', params, false);
  }

  // ========== Word Validity (third-party verification client) ==========
  // Validity is externally asserted: words are valid by default and become
  // invalid only when a client explicitly reports them so after an online check.
  async getValidityPending(params?: { language?: string; limit?: number }): Promise<APIResponse> {
    return this.get('/vocabulary/validity/pending', params, false);
  }

  async reportValidity(data: {
    language?: string;
    source?: string;
    results: Array<{ word?: string; md5?: string; is_valid: boolean; note?: string; source?: string }>;
  }): Promise<APIResponse> {
    return this.post('/vocabulary/validity/report', data);
  }

  /**
   * POST /learning/progress.
   *
   * The live backend validates `{ progress_id: int, correct: bool }`
   * (AppQyV1LearningController::updateProgress) while historical callers pass
   * `{ word_id, status }`. We send a superset so both contracts are satisfied:
   * `progress_id` falls back to `word_id` (the learning-progress record id —
   * /learning/words and /learning/review-queue both return it as `id`) and
   * `correct` is derived from `status` when not given explicitly.
   */
  async updateProgress(data: {
    word_id: string | number;
    status: string;
    progress_id?: string | number;
    correct?: boolean;
  }): Promise<APIResponse> {
    return this.post('/learning/progress', {
      word_id: data.word_id,
      status: data.status,
      progress_id: data.progress_id ?? data.word_id,
      correct: data.correct ?? data.status === 'learned'
    });
  }

  /** GET /learning/review-queue (auth) — due review words + a batch of new words. */
  async getReviewQueue(params?: { lang_code?: string }): Promise<APIResponse<ReviewQueueData>> {
    return this.get<ReviewQueueData>('/learning/review-queue', params, false);
  }

  /** GET /learning/stats (auth) — per-status counts + selected libraries/languages. */
  async getLearningStats(params?: { lang_code?: string }): Promise<APIResponse<LearningStatsData>> {
    return this.get<LearningStatsData>('/learning/stats', params, false);
  }

  async getStats(): Promise<APIResponse> {
    return this.get('/user/stats');
  }

  async updateWordReview(wordId: string, data: { correct: boolean; reviewDate: string }): Promise<APIResponse> {
    return this.post(`/words/${wordId}/review`, data);
  }

  // ========== Document Processing ==========
  async uploadDocument(formData: FormData): Promise<APIResponse> {
    return this.request({ url: '/learning/upload', method: 'POST', data: formData } as any);
  }

  /** POST /vocabulary/document/{id}/extract-sentences (auth) — split an uploaded document into sentences. */
  async extractSentences(documentId: string | number): Promise<APIResponse<ExtractSentencesResult>> {
    return this.post<ExtractSentencesResult>(`/vocabulary/document/${documentId}/extract-sentences`);
  }

  /** POST /vocabulary/document/{id}/extract-words (auth) — extract vocabulary words from an uploaded document. */
  async extractWords(documentId: string | number): Promise<APIResponse<ExtractWordsResult>> {
    return this.post<ExtractWordsResult>(`/vocabulary/document/${documentId}/extract-words`);
  }

  // ========== System Initialization ==========
  async getInitializationStatus(): Promise<APIResponse> {
    return this.get('/system/initialization-status');
  }

  async getDictionaryStatistics(): Promise<APIResponse> {
    return this.get('/system/dictionary-statistics', undefined, true, 300000);
  }

  async initializeSystem(): Promise<APIResponse> {
    return this.post('/system/initialize');
  }

  async getSupportedLanguages(): Promise<APIResponse> {
    return this.get('/system/supported-languages', undefined, true, 3600000); // Cache 1 hour
  }

  async completeUserInit(data: {
    learning_languages: string[];
    occupation?: string;
    daily_words_target: number;
    daily_study_time: number;
    preferences: any;
  }): Promise<APIResponse> {
    return this.post('/user/initialize', data);
  }

  // ========== Export Features ==========

  /**
   * POST /vocabulary/export/{format} — server-generated file download.
   *
   * BaseAPI.post() expects a JSON envelope, but this endpoint streams a file
   * (Content-Disposition: attachment), so — mirroring
   * DatabaseManagerAPI.exportTable/downloadBackup — we bypass request() with a
   * raw fetch that still honors the module's resolved base URL + prefix and
   * its auth/global headers, then trigger a browser download via an object
   * URL + anchor click.
   *
   * PDF may come back as a printable HTML page instead of a real PDF; the
   * server flags that with `X-Export-Fallback: html` and we surface it as
   * `htmlFallback` so the caller can hint "use the browser's Save as PDF".
   *
   * Non-2xx responses carry a JSON `{ success:false, message }` body — the
   * message is parsed and thrown as an Error with a `status` field (callers
   * use `status === 404` to fall back to client-side export).
   */
  async exportVocabulary(
    format: VocabExportFormat,
    options: VocabExportOptions = {}
  ): Promise<VocabExportResult> {
    const url = this.buildURL(`/vocabulary/export/${format}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/octet-stream, application/json',
        ...this.headers
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      let message = `Export failed (HTTP ${response.status})`;
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await response.json();
          message = body?.message || body?.error || message;
        }
      } catch {
        // Keep the generic HTTP-status message.
      }
      const error = new Error(message) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const htmlFallback =
      (response.headers.get('X-Export-Fallback') || '').toLowerCase() === 'html';

    const defaultExtension =
      format === 'text' || format === 'anki'
        ? 'txt'
        : format === 'pdf' && htmlFallback
          ? 'html'
          : format;
    const filename =
      this.parseContentDispositionFilename(response.headers.get('Content-Disposition') || '')
      || `vocabulary_export.${defaultExtension}`;

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(objectUrl);

    return { ok: true, filename, htmlFallback };
  }

  /** Parse `filename*=UTF-8''…` (RFC 5987) or plain `filename="…"` from a Content-Disposition header. */
  private parseContentDispositionFilename(disposition: string): string | null {
    const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition);
    if (star && star[1]) {
      const raw = star[1].trim().replace(/^["']+|["']+$/g, '');
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw || null;
      }
    }
    const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
    return plain && plain[1] ? plain[1].trim() : null;
  }

  // ========== User ==========
  async getUserProfile(): Promise<APIResponse> {
    return this.get('/user/profile');
  }

  async updateUserProfile(data: { nickname?: string; name?: string; bio?: string; location?: string; avatar?: string }): Promise<APIResponse> {
    return this.put('/user/profile', data);
  }

  async getUserPreferences(): Promise<APIResponse> {
    return this.get('/user/preferences');
  }

  async updateUserPreferences(data: any): Promise<APIResponse> {
    return this.put('/user/preferences', data);
  }
}
