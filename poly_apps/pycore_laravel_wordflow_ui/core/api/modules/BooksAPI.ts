import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * BooksAPI — laravel-manager "Books / Add source" client + stat drill-down lists.
 *
 * Mirrors the pycore Books UX but targets the Laravel app_qy_v1 backend (prefix
 * `/api/app_qy_v1`). It covers:
 *   - book file upload + multi-language analysis (POST /books/upload),
 *   - paginated drill-down of a single upload's words/sentences/languages
 *     (POST /books/list),
 *   - ingesting an analyzed upload into the sentence/word library
 *     (POST /books/ingest — sync result OR async {task_id}),
 *   - the supported-formats list (GET /books/supported-formats),
 * plus the Vocabulary-page stat drill-down endpoints:
 *   - dictionary words by filter (GET /dictionary/words),
 *   - TTS queue items by status/type (GET /tts/queue/items),
 *   - per-language breakdown (GET /vocabulary/language-breakdown),
 *   - async task polling (GET /task/{id}/status).
 *
 * FormData (the upload) is auto-detected by BaseAPI.request() — it omits the
 * JSON Content-Type and sends the multipart body as-is.
 */

// ========== Books: text analysis ==========

export interface BookLanguageStat {
  script: string;
  code: string;
  chars: number;
  ratio: number;
}

export interface BookTopWord {
  word: string;
  count: number;
}

/** Authoritative per-file text statistics returned by the backend. */
export interface BookTextStats {
  char_count: number;
  char_count_no_space: number;
  word_count: number;
  unique_word_count: number;
  sentence_count: number;
  unique_sentence_count: number;
  line_count: number;
  paragraph_count: number;
  primary_language: string;
  languages: BookLanguageStat[];
  top_words: BookTopWord[];
}

export interface BookUploadFile {
  name: string;
  ext: string;
  size: number;
  stats?: BookTextStats | null;
  preview?: string | null;
  error?: string | null;
}

/** Aggregate totals across all files in one upload (drives the stat tiles). */
export interface BookTotals {
  words: number;
  unique_words: number;
  sentences: number;
  unique_sentences: number;
  chars: number;
}

export interface BooksUploadResponse {
  success: boolean;
  upload_id: string;
  files: BookUploadFile[];
  aggregate?: BookTextStats | null;
  totals: BookTotals;
  error?: string;
}

// ========== Books: paginated drill-down list ==========

export type BookListKind =
  | 'words'
  | 'unique_words'
  | 'sentences'
  | 'unique_sentences'
  | 'languages';

export interface BooksListResponse {
  success: boolean;
  kind: BookListKind;
  total: number;
  start: number;
  limit: number;
  /** words → [{word,count}]; sentences/unique → [{seq,text}]; languages → [{script,code,chars,ratio}]. */
  items: any[];
  totals?: Partial<BookTotals> & Record<string, number>;
  error?: string;
}

// ========== Books: ingest ==========

export interface BookIngestedBook {
  source_key: string;
  original_name: string;
  sentences: number;
  words: number;
}

/** Sync ingest → {books}; large docs → {task_id} (poll getTaskStatus). */
export interface BooksIngestResponse {
  success: boolean;
  books?: BookIngestedBook[];
  task_id?: string | number;
  error?: string;
}

export interface BooksSupportedFormatsResponse {
  formats: string[];
  success?: boolean;
}

// ========== Async task polling ==========

export interface TaskStatusData {
  status: string;
  progress?: number;
  /** Free-form stage label when the backend supplies one. */
  stage?: string;
  result?: any;
  error?: string | null;
}

export interface TaskStatusResponse {
  task: TaskStatusData;
}

// ========== Vocabulary stat drill-down: dictionary words ==========

export type DictionaryWordFilter =
  | 'all'
  | 'with_translation'
  | 'without_translation'
  | 'invalid'
  | 'with_audio'
  | 'without_audio';

export interface DictionaryWordRow {
  /** Stable row id (when supplied by the backend). */
  id?: number | string;
  content: string;
  md5: string;
  has_translation: boolean;
  has_audio: boolean;
  is_valid: boolean;

  // ----- Rich per-word detail (all optional / nullable) -----
  /** Actual translation strings (preferred over the has_translation flag). */
  translations?: string[] | null;
  us_phonetic?: string | null;
  uk_phonetic?: string | null;
  phonetic?: string | null;
  query_count?: number;
  /** Direct URL to the word's audio (when available). */
  audio_url?: string | null;
  audio_available?: boolean;
  /** Free-form JSON blob: may hold definitions / examples / POS. */
  word_details?: any | null;
  /** Image URLs / descriptors associated with the word. */
  image_files?: any[] | null;
  translation_provider?: string | null;
  tts_provider?: string | null;
  image_provider?: string | null;
  tts_status?: string | null;
  tts_attempts?: number;
  tts_error?: string | null;
  validity_note?: string | null;
  validity_source?: string | null;
  validity_checked_at?: string | null;
  last_modified?: string | null;
  last_query_time?: string | null;
}

export interface DictionaryWordsResponse {
  success: boolean;
  total: number;
  start: number;
  limit: number;
  items: DictionaryWordRow[];
  error?: string;
}

/** Validity breakdown for a language (GET /dictionary/validity-summary). */
export interface ValiditySummaryResponse {
  language: string;
  language_code: string;
  total: number;
  valid: number;
  invalid: number;
  unchecked: number;
  /** Invalid-row counts keyed by validity_source ('region-redirect' | 'bing-assist' | 'other' | ...). */
  invalid_by_source: Record<string, number>;
}

// ========== Vocabulary stat drill-down: word example sentences ==========

/** One example sentence for a dictionary word (GET /dictionary/sentences). */
export interface WordSentenceRow {
  id?: number | string;
  text: string;
  explanation?: string | null;
  grammar?: string | null;
  special_usage?: string | null;
  ai_commentary?: string | null;
  audio?: string | null;
  occurrence_count?: number | null;
}

export interface WordSentencesResponse {
  success: boolean;
  sentences: WordSentenceRow[];
  error?: string;
}

// ========== Vocabulary stat drill-down: TTS queue items ==========

export type TtsQueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type TtsQueueItemType = 'word' | 'sentence' | 'article';

export interface TtsQueueItemsResponse {
  success: boolean;
  total: number;
  start: number;
  limit: number;
  items: any[];
  error?: string;
}

// ========== Vocabulary stat drill-down: language breakdown ==========

export interface LanguageBreakdownRow {
  language: string;
  words: number;
  with_translation: number;
  with_audio: number;
  invalid: number;
}

export interface LanguageBreakdownResponse {
  success: boolean;
  items: LanguageBreakdownRow[];
  error?: string;
}

// ========== Processing capability (laravel-host probe + recommendation) ==========

export interface ProcessingRecommendation {
  can_local: boolean;
  suggested: 'local' | 'pycore';
  reason: string;
}
export interface ProcessingCapability {
  host: string;
  os: string;
  busy: boolean;
  cpu: { count: number | null; load1: number | null; load5: number | null; load15: number | null; load_ratio: number | null };
  memory: { total_mb: number | null; available_mb: number | null; used_percent: number | null };
  disk: { path: string; free_gb: number | null; total_gb: number | null };
  ffmpeg: { available: boolean; version: string | null };
  gpu: { available: boolean; name: string | null; memory_total_mb: number | null; memory_used_mb: number | null; utilization: number | null };
  recommendations: { document: ProcessingRecommendation; video: ProcessingRecommendation };
  probed_at: string;
}

/**
 * BooksAPI module — registered as `api.books`, prefix `/api/app_qy_v1`.
 */
export class BooksAPI extends BaseAPI {
  // ----- Books -----

  /**
   * POST /books/upload (multipart). Analyzes the uploaded files server-side and
   * returns per-file + aggregate stats keyed by a generated `upload_id` (reused
   * by booksList / booksIngest). BaseAPI auto-handles the FormData body.
   */
  async booksUpload(files: File[], language?: string): Promise<APIResponse<BooksUploadResponse>> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files[]', f));
    if (language) formData.append('language', language);
    return this.request<BooksUploadResponse>({
      url: '/books/upload',
      method: 'POST',
      data: formData,
    } as any);
  }

  /**
   * POST /books/list — one paginated page of a stat drill-down (words / unique
   * words / sentences / unique sentences / languages) for a prior upload.
   */
  async booksList(payload: {
    upload_id: string;
    kind: BookListKind;
    start: number;
    limit: number;
  }): Promise<APIResponse<BooksListResponse>> {
    return this.post<BooksListResponse>('/books/list', payload);
  }

  /**
   * POST /books/ingest — persist an analyzed upload into the sentence/word
   * library. Small docs return {books}; large ones return {task_id} (poll
   * getTaskStatus for stage + progress).
   */
  async booksIngest(payload: { upload_id: string; language?: string }): Promise<APIResponse<BooksIngestResponse>> {
    return this.post<BooksIngestResponse>('/books/ingest', payload);
  }

  /** GET /books/supported-formats — extensions the upload analyzer accepts. */
  async getBooksSupportedFormats(): Promise<APIResponse<BooksSupportedFormatsResponse>> {
    return this.get<BooksSupportedFormatsResponse>('/books/supported-formats', undefined, true, 3600000);
  }

  // ----- Async task polling -----

  /** GET /task/{id}/status — async ingest progress (status / progress / result / error). */
  async getTaskStatus(taskId: string | number): Promise<APIResponse<TaskStatusResponse>> {
    return this.get<TaskStatusResponse>(`/task/${taskId}/status`, undefined, false);
  }

  // ----- Vocabulary stat drill-down -----

  /** GET /dictionary/words — paginated dictionary words by filter (+ language / search).
   *  `validity_source` narrows an `invalid` listing to one cause
   *  (e.g. 'region-redirect' | 'bing-assist'). */
  async getDictionaryWords(params: {
    language?: string;
    filter?: DictionaryWordFilter;
    validity_source?: string;
    q?: string;
    start?: number;
    limit?: number;
  }): Promise<APIResponse<DictionaryWordsResponse>> {
    return this.get<DictionaryWordsResponse>('/dictionary/words', params, false);
  }

  /** GET /dictionary/validity-summary — valid/invalid/unchecked counts + the
   *  invalid rows grouped by validity_source, for the Word Validity panel. */
  async getValiditySummary(params?: { language?: string }): Promise<APIResponse<ValiditySummaryResponse>> {
    return this.get<ValiditySummaryResponse>('/dictionary/validity-summary', params, false);
  }

  /**
   * GET /dictionary/sentences — example sentences for one dictionary word.
   * Lazy-loaded when a word's detail panel expands. Returns the sentence text
   * plus any explanation / grammar / special-usage / AI commentary / audio.
   */
  async getWordSentences(params: {
    word: string;
    language?: string;
    limit?: number;
  }): Promise<APIResponse<WordSentencesResponse>> {
    return this.get<WordSentencesResponse>('/dictionary/sentences', params, false);
  }

  /** GET /tts/queue/items — paginated TTS queue items by status / type. */
  async getTtsQueueItems(params: {
    status?: TtsQueueItemStatus;
    type?: TtsQueueItemType;
    start?: number;
    limit?: number;
  }): Promise<APIResponse<TtsQueueItemsResponse>> {
    return this.get<TtsQueueItemsResponse>('/tts/queue/items', params, false);
  }

  /** GET /vocabulary/language-breakdown — per-language word/translation/audio/invalid counts. */
  async getLanguageBreakdown(): Promise<APIResponse<LanguageBreakdownResponse>> {
    return this.get<LanguageBreakdownResponse>('/vocabulary/language-breakdown', undefined, false);
  }

  // ----- Dictionary word management (Words tab) -----

  /** POST /dictionary/words — create (or upsert) a single word with details. */
  async createDictionaryWord(payload: {
    language: string;
    content: string;
    translations?: string[];
    us_phonetic?: string | null;
    uk_phonetic?: string | null;
    phonetic?: string | null;
    word_details?: any;
    is_valid?: boolean;
    validity_note?: string | null;
  }): Promise<APIResponse<{ word: DictionaryWordRow }>> {
    return this.post<{ word: DictionaryWordRow }>('/dictionary/words', payload);
  }

  /** PUT /dictionary/words/{md5} — update a word's editable fields. */
  async updateDictionaryWord(md5: string, payload: {
    language: string;
    translations?: string[];
    us_phonetic?: string | null;
    uk_phonetic?: string | null;
    phonetic?: string | null;
    word_details?: any;
    is_valid?: boolean;
    validity_note?: string | null;
  }): Promise<APIResponse<{ word: DictionaryWordRow }>> {
    return this.put<{ word: DictionaryWordRow }>(`/dictionary/words/${encodeURIComponent(md5)}`, payload);
  }

  /** DELETE /dictionary/words/{md5}?language= — delete a single word. */
  async deleteDictionaryWord(md5: string, language: string): Promise<APIResponse<{ deleted: number }>> {
    return this.delete<{ deleted: number }>(
      `/dictionary/words/${encodeURIComponent(md5)}?language=${encodeURIComponent(language)}`);
  }

  /** POST /dictionary/words/batch — batch action over a selection of md5s. */
  async batchDictionaryWords(payload: {
    language: string;
    md5s: string[];
    action: 'delete' | 'mark_valid' | 'mark_invalid' | 'requeue_tts';
  }): Promise<APIResponse<{ action: string; requested: number; affected: number }>> {
    return this.post<{ action: string; requested: number; affected: number }>('/dictionary/words/batch', payload);
  }

  // ----- Processing capability -----

  /** GET /system/processing-capability — laravel-host load/GPU + laravel-direct-vs-pycore recommendation. */
  async getProcessingCapability(): Promise<APIResponse<ProcessingCapability>> {
    return this.get<ProcessingCapability>('/system/processing-capability', undefined, false);
  }
}
