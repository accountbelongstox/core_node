/** WordflowApiGroupMethods - group media sources, learning progress, and daily
 * recitation methods extracted from WordflowApiMethods so each file stays under
 * the 800-line modular limit. WordflowApiMethods extends this class. */
import type {
  WfGroupMediaSource, WfAddMediaSourceResult, WfGroupSourcesResult,
  GroupProgressStats, WfProgressEntryShort, WfProgressEntry,
  WfGroupProgressBlob, WfGroupProgressUpdate,
  WfRecitationAction, WfRecitationLogWord, WfRecitationToday,
  WfRecitationLogResult, WfRecitationPlanWord, WfRecitationTodayPlan,
  WfRecitationSummary,
} from './wordflowApiTypes';
import type { WordflowTransport } from './WordflowApi';

export class WordflowApiGroupMethods {
  protected transport!: WordflowTransport;
  protected currentLanguage!: string;
  protected token!: string | null;

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
   * Three backend shapes are supported (contract 2026-07-18 §5.7):
   *   - legacy single: { word_id, correct, gid? }
   *   - read action:   { gid?, word_id, action: 'read', play_time? } (per-word
   *                     play time; the recite loop submits this each pass)
   *   - batch:         { gid?, updates: [{ word_id, correct }] }
   * Queueable offline (idempotent replay). Invalidates the learning-stats +
   * review-queue TTL caches; the held progress blob is dropped by
   * wfProgressCenter (which is how batch reports should be sent —
   * wfProgressCenter.reportAnswers() / reportReadWithPlayTime()).
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

}
