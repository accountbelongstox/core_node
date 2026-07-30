/**
 * WfNewAdminApi — the /wordnew SUPER-ADMIN gateway (local management mode).
 *
 * When the page is opened from the machine that runs the backend (127.0.0.1 /
 * localhost / ::1), the BACKEND grants a login-free "super" session — the same
 * loopback debug bypass laravel-manager uses (GET /api/dashboard/auth/debug-status,
 * DebugAuthService + the dashboard.auth middleware). This module:
 *
 *   1. probes that status endpoint once (probeStatus) so WfNewApp can flip the
 *      whole app into super-admin mode and surface the badge/entry points, and
 *   2. carries every management call the admin pages make (dictionary word CRUD,
 *      vocabulary libraries, TTS/translation queues, statistics, covers).
 *
 * BASE-URL POLICY — pinned to the PAGE ORIGIN (`${protocol}//${hostname}:9000`),
 * NOT the wfNewEndpoints failover pool. Super permission is decided by the
 * backend from the CONNECTING CLIENT IP, and "manage the backend" here always
 * means the backend on the machine the page was opened from: an endpoint
 * failover to a remote node must never (a) silently mutate a different server
 * or (b) drop loopback-ness mid-session. Same pinning laravel-manager's
 * debug-status probe uses.
 *
 * This gateway is intentionally OUTSIDE the wfNewApi http/mock pair: it only
 * exists when a real local backend is present, so a mock twin is meaningless.
 * Paths live in WfNewApiPaths (WfNewAdminPaths) with the rest of the endpoint
 * catalog. Learner-facing data keeps flowing through wfNewApi untouched.
 *
 * AUTH — most management routes are public on purpose (dashboard trust level);
 * the few sanctum-gated ones (translate / tts generate / library delete) reuse
 * the wordnew session Bearer token when the user IS logged in, and surface a
 * clean 401 error otherwise (callers toast trans('admin.needLogin')).
 */

import { WfNewAdminPaths, WFNEW_ADMIN_DEBUG_STATUS_PATH } from './WfNewApiPaths';
import { WFNEW_API_PORT } from './WfNewEndpoints';
import { loadToken } from './WfNewApiTransport';

// --- super-admin status ------------------------------------------------------ #

/** Result of the loopback debug-status probe (backend-decided, IP-based). */
export interface WfNewSuperAdminStatus {
  /** True only when the backend granted the loopback debug bypass. */
  enabled: boolean;
  /** Backend's reason: 'loopback' (granted) | 'remote' | 'disabled'. */
  reason: string;
  /** The client IP the backend saw (shown in the admin banner). */
  clientIp: string;
}

// --- row/response types (shapes verified against laravel_main controllers) --- #

/** One dictionary row (AppQyV1VocabularyStatsController::dictionaryWords). */
export interface WfNewAdminWordRow {
  id: number;
  content: string;
  md5: string;
  has_translation: boolean;
  has_audio: boolean;
  is_valid: boolean;
  translations: string[];
  us_phonetic: string | null;
  uk_phonetic: string | null;
  phonetic: string | null;
  query_count: number;
  audio_url: string | null;
  audio_available: boolean;
  audio_path: string | null;
  audio_size: number | null;
  word_details: unknown;
  image_files: unknown[] | null;
  tts_status: string | null;
  tts_attempts: number;
  tts_error: string | null;
  validity_note: string | null;
  validity_source: string | null;
  validity_checked_at: string | null;
  last_modified: string | null;
}

export interface WfNewAdminWordsPage {
  language: string;
  filter: string;
  total: number;
  start: number;
  limit: number;
  items: WfNewAdminWordRow[];
}

/** Coverage filters accepted by GET /dictionary/words. */
export type WfNewAdminWordFilter =
  | 'all' | 'with_translation' | 'without_translation'
  | 'invalid' | 'with_audio' | 'without_audio';

/** Server-side sort keys accepted by GET /dictionary/words. */
export type WfNewAdminWordSort = 'word' | 'translation' | 'phonetic' | 'queries' | 'status';

/** Editable fields of a dictionary word (create/update payload). */
export interface WfNewAdminWordEditable {
  translations?: string[];
  us_phonetic?: string | null;
  uk_phonetic?: string | null;
  phonetic?: string | null;
  word_details?: unknown;
  is_valid?: boolean;
  validity_note?: string | null;
}

/** Batch actions over selected md5s (POST /dictionary/words/batch). */
export type WfNewAdminBatchAction = 'delete' | 'mark_valid' | 'mark_invalid' | 'requeue_tts';

/** One per-language aggregate row (GET /vocabulary/language-breakdown). */
export interface WfNewAdminLangRow {
  language: string;
  language_code: string;
  words: number;
  with_translation: number;
  with_audio: number;
  invalid: number;
}

/** One example sentence containing a word (GET /dictionary/sentences). */
export interface WfNewAdminSentence {
  id: number | string;
  text: string;
  explanation: string | null;
  grammar: string | null;
  special_usage: string | null;
  ai_commentary: string | null;
  audio: string | null;
  occurrence_count: number;
}

/** One public vocabulary library row (transformLibrary). */
export interface WfNewAdminLibraryRow {
  id: number;
  name: string;
  description: string | null;
  word_count: number;
  language: string;
  difficulty: string;
  category: string;
  image_url: string | null;
  cover_status: string;
  cover_error: string | null;
  cover_attempts: number;
  is_recommended: boolean;
}

export interface WfNewAdminLibrariesPage {
  libraries: WfNewAdminLibraryRow[];
  pagination: { current_page: number; per_page: number; total: number; last_page: number; has_more: boolean };
}

/** Vocabulary statistics (GET /vocabulary/statistics — summary + languages). */
export interface WfNewAdminStatistics {
  summary: {
    total_languages: number;
    total_libraries: number;
    total_words: number;
    tts_percentage?: number;
    [k: string]: unknown;
  };
  languages: Array<Record<string, unknown>>;
}

/** Unified TTS queue statistics snapshot (GET /ai_tools/tts/queue/stats). */
export interface WfNewAdminTtsQueueStats {
  total?: number;
  by_status?: Record<string, number>;
  by_type?: Record<string, number>;
  current_concurrent?: number;
  total_success?: number;
  [k: string]: unknown;
}

/** One TTS queue item (GET /tts/queue/items). */
export interface WfNewAdminQueueItem {
  content?: string;
  text?: string;
  type?: string;
  status?: string;
  language?: string;
  [k: string]: unknown;
}

export interface WfNewAdminQueueItemsPage {
  total: number;
  start: number;
  limit: number;
  items: WfNewAdminQueueItem[];
}

/** One translation-queue task row (GET /ai_tools/translation/queue/list). */
export interface WfNewAdminTransTask {
  id?: number | string;
  word?: string;
  content?: string;
  language?: string;
  status?: string;
  priority?: number;
  [k: string]: unknown;
}

/** Translate result (POST /ai_tools/translation/translate — sanctum). */
export interface WfNewAdminTranslateResult {
  translation: string;
  detected_language?: string;
  provider?: string;
  model?: string;
  cached?: boolean;
}

/** Language option (GET /ai_tools/translation/languages — public). */
export interface WfNewAdminLangOption { code: string; name: string; native_name?: string }

// --- transport ---------------------------------------------------------------- #

/** Page-origin API base — see BASE-URL POLICY in the header. */
function adminBase(): string {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${WFNEW_API_PORT}`;
}

/** Read the live session token (fresh per call so in-session login applies). */
function sessionToken(): string | null {
  return loadToken();
}

function headers(json: boolean): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json' };
  if (json) h['Content-Type'] = 'application/json';
  const token = sessionToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Backend success/error bodies can carry repeated UTF-8 BOMs — strip them all. */
function stripBom(text: string): string {
  return text.replace(/^(﻿|ï»¿)+/, '');
}

/**
 * Shared request core: page-origin base + BOM-tolerant parse + `{success,
 * message, data}` envelope unwrap. Non-2xx throws an Error carrying the
 * backend `message` and `.status` (401 → callers show the needLogin toast).
 */
async function request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${adminBase()}${path}`, {
    method,
    headers: headers(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = stripBom(await res.text());
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const err = new Error(parsed?.message || `HTTP ${res.status} for ${path}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'data' in parsed) {
    return parsed.data as T;
  }
  return parsed as T;
}

const getJSON = <T,>(path: string): Promise<T> => request<T>('GET', path);
const postJSON = <T,>(path: string, body: Record<string, unknown>): Promise<T> => request<T>('POST', path, body);
const putJSON = <T,>(path: string, body: Record<string, unknown>): Promise<T> => request<T>('PUT', path, body);
const deleteJSON = <T,>(path: string): Promise<T> => request<T>('DELETE', path);

/** Resolve a backend-relative media path (audio/covers/images) onto the pinned base. */
function adminAbsUrl(u?: string | null): string | null {
  if (!u || typeof u !== 'string') return null;
  if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
  return `${adminBase()}${u.startsWith('/') ? u : `/${u}`}`;
}

// --- gateway ------------------------------------------------------------------ #

export const wfNewAdminApi = {
  /** Where admin calls go (shown in the banner next to the client IP). */
  baseUrl: (): string => adminBase(),

  absUrl: adminAbsUrl,

  /** True when a wordnew session token exists (sanctum-gated actions usable). */
  hasSession: (): boolean => !!sessionToken(),

  /**
   * Probe the backend loopback debug status (public, never throws). A short
   * timeout keeps a dead/remote :9000 from delaying app start — any failure
   * simply reports super mode disabled.
   */
  async probeStatus(): Promise<WfNewSuperAdminStatus> {
    const disabled: WfNewSuperAdminStatus = { enabled: false, reason: 'disabled', clientIp: '' };
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${adminBase()}${WFNEW_ADMIN_DEBUG_STATUS_PATH}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return disabled;
      const body = JSON.parse(stripBom(await res.text()));
      const data = body && typeof body === 'object' && 'data' in body ? body.data : body;
      return {
        enabled: data?.debug_mode === true,
        reason: String(data?.reason ?? 'disabled'),
        clientIp: String(data?.client_ip ?? ''),
      };
    } catch {
      return disabled;
    }
  },

  // ---- dictionary words (public management routes) ---- //

  getWords(opts: {
    language: string; filter?: WfNewAdminWordFilter; q?: string;
    sort?: WfNewAdminWordSort; order?: 'asc' | 'desc'; start?: number; limit?: number;
  }): Promise<WfNewAdminWordsPage> {
    return getJSON<WfNewAdminWordsPage>(WfNewAdminPaths.dictionaryWords(opts));
  },

  createWord(payload: { language: string; content: string } & WfNewAdminWordEditable): Promise<{ word: WfNewAdminWordRow }> {
    return postJSON(WfNewAdminPaths.dictionaryWordCreate, payload);
  },

  updateWord(md5: string, payload: { language: string } & WfNewAdminWordEditable): Promise<{ word: WfNewAdminWordRow }> {
    return putJSON(WfNewAdminPaths.dictionaryWord(md5), payload);
  },

  deleteWord(md5: string, language: string): Promise<{ deleted: number }> {
    return deleteJSON(WfNewAdminPaths.dictionaryWordDelete(md5, language));
  },

  batchWords(payload: { language: string; md5s: string[]; action: WfNewAdminBatchAction }): Promise<{ action: string; requested: number; affected: number }> {
    return postJSON(WfNewAdminPaths.dictionaryWordsBatch, payload);
  },

  /** Example sentences containing a word (lazy row expand). */
  getWordSentences(word: string, language: string, limit = 10): Promise<{ count: number; sentences: WfNewAdminSentence[] }> {
    return getJSON(WfNewAdminPaths.dictionarySentences(word, language, limit));
  },

  // ---- statistics / overview (public) ---- //

  getLanguageBreakdown(): Promise<{ languages: WfNewAdminLangRow[] }> {
    return getJSON(WfNewAdminPaths.languageBreakdown);
  },

  getStatistics(language?: string): Promise<WfNewAdminStatistics> {
    return getJSON(WfNewAdminPaths.vocabularyStatistics(language));
  },

  // ---- vocabulary libraries (public reads; delete is sanctum) ---- //

  getLibraries(opts: { language?: string; page?: number; perPage?: number; search?: string } = {}): Promise<WfNewAdminLibrariesPage> {
    return getJSON(WfNewAdminPaths.adminLibraries(opts));
  },

  /** Sanctum-gated: throws { status: 401 } without a wordnew session. */
  deleteLibrary(libraryId: number | string): Promise<unknown> {
    return deleteJSON(WfNewAdminPaths.learningLibrary(libraryId));
  },

  /** Reset failed/pending covers so the mcp-chrome image worker replaces them. */
  retryCovers(ids: Array<number | string> | 'all'): Promise<{ reset: number }> {
    return postJSON(WfNewAdminPaths.coverRetry, ids === 'all' ? { all: true } : { ids });
  },

  // ---- queues (public) ---- //

  getTtsQueueStats(): Promise<WfNewAdminTtsQueueStats> {
    return getJSON(WfNewAdminPaths.ttsQueueStats);
  },

  getTtsQueueItems(opts: { status?: string; type?: string; start?: number; limit?: number } = {}): Promise<WfNewAdminQueueItemsPage> {
    return getJSON(WfNewAdminPaths.ttsQueueItems(opts));
  },

  /** Translation-queue control plane (public, same surface pycore monitors). */
  getTranslationQueueList(): Promise<{ tasks?: WfNewAdminTransTask[]; total?: number;[k: string]: unknown }> {
    return getJSON(WfNewAdminPaths.translationQueueList);
  },

  getTranslationPendingWords(): Promise<{ total?: number; words?: unknown[];[k: string]: unknown }> {
    return getJSON(WfNewAdminPaths.translationPendingWords);
  },

  enqueuePendingTranslations(): Promise<{ enqueued?: number;[k: string]: unknown }> {
    return postJSON(WfNewAdminPaths.translationEnqueuePending, {});
  },

  /** Re-queue specific words for translation (custom.authenticate — needs session). */
  requeueTranslations(words: string[], language: string, targetLanguage = 'zh'): Promise<unknown> {
    return postJSON(WfNewAdminPaths.translationBatchAdd, {
      words, language, target_language: targetLanguage,
    });
  },

  // ---- translate / TTS tools (sanctum — need a wordnew session) ---- //

  getTranslationLanguages(): Promise<WfNewAdminLangOption[]> {
    return getJSON<WfNewAdminLangOption[] | { languages: WfNewAdminLangOption[] }>(WfNewAdminPaths.translationLanguages)
      .then((r) => (Array.isArray(r) ? r : (r?.languages ?? [])));
  },

  translate(payload: { text: string; source_language: string; target_language: string }): Promise<WfNewAdminTranslateResult> {
    return postJSON<any>(WfNewAdminPaths.translationTranslate, { ...payload, type: 'learning' })
      .then((d) => ({
        translation: String(d?.translation ?? d?.translated_text ?? ''),
        detected_language: d?.detected_language,
        provider: d?.provider,
        model: d?.model,
        cached: d?.cached,
      }));
  },

  ttsGenerate(payload: { text: string; language: string }): Promise<{ audio_url: string | null }> {
    return postJSON<any>(WfNewAdminPaths.ttsGenerate, {
      ...payload, voice_type: 'female', speed: 1.0,
    }).then((d) => ({ audio_url: adminAbsUrl(d?.audio_url ?? null) }));
  },
};
