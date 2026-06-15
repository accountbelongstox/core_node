/**
 * VocabularyTranslationCenter - Translation Enqueue + Poll System
 *
 * Mirrors VocabularyAudioCenter 1:1, but for translations. The frontend NEVER
 * translates words itself. Instead it:
 *   1. Detects visible words that lack a translation.
 *   2. ENQUEUES them on the backend translation queue (which also PRIORITIZES
 *      already-queued words by moving them to the front).
 *   3. POLLS the queue status every 5s; when a word's translation has been
 *      filled (pycore Google worker + Laravel AI filler write it into the
 *      dictionary), it notifies listeners and stops tracking that word.
 *
 * Shared backend contract (custom.authenticate, prefix /api/app_qy_v1):
 *   - POST /ai_tools/translation/queue/batch/add
 *       body { words:[string], language, target_language }
 *       -> { results:[{ word, status }], queued, skipped, moved }
 *   - POST /ai_tools/translation/queue/batch/status
 *       body { words:[string], language, target_language }
 *       -> { results:[{ word, has_translation, translation }] }
 *
 * GET /vocabulary/libraries/{id}/words also surfaces filled translations on a
 * full reload — so this center only fills the gap WHILE the page is open.
 */

import { ApiCenter } from './ApiCenter';
import { StorageCenter } from './StorageCenter';

// Minimal word shape this center consumes. Mirrors the audio center's
// VocabularyWord but keys on translation presence instead of audio.
interface VocabularyWord {
  index: number;
  word: string;
  translation?: string | null;
  translations?: any[] | null;
  has_translation?: boolean;
  language?: string;
}

// Internal per-word tracking entry while we wait for the backend fill.
interface TranslationRequest {
  word: string;
  language: string;        // source language of the word
  targetLanguage: string;  // user's native language we translate into
  index: number;
  requestTime: number;
  retryCount: number;
}

type TranslationStatusListener = (word: string, translation: string) => void;

class VocabularyTranslationCenterClass {
  // LOCAL CACHE: current page words (key -> word)
  private cachedWords: Map<string, VocabularyWord> = new Map();
  private currentLibraryId: number | null = null;
  private currentPage: number | null = null;
  // The target language is part of the context: switching native language
  // means previously "done" words may need re-querying.
  private currentTargetLanguage: string | null = null;

  // Words pending a translation fill.
  private pendingRequests: Map<string, TranslationRequest> = new Map();

  // Translation status listeners.
  private listeners: Set<TranslationStatusListener> = new Set();

  // Polling configuration (identical cadence to VocabularyAudioCenter).
  private POLL_INTERVAL = 5000;       // 5 seconds
  private MAX_RETRY = 10;             // give up after N polls per word
  private BATCH_SIZE = 100;           // max words per backend request
  private MAX_AGE = 5 * 60 * 1000;    // 5 minutes stale-request cutoff

  // Polling timer handle.
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Process a page of vocabulary words: enqueue the untranslated ones and start
   * polling for their fills.
   *
   * @param libraryId      - Vocabulary library ID
   * @param page           - Current page number (part of the cache context)
   * @param words          - Array of words currently visible on the page
   * @param sourceLanguage - Language of the words (the library language)
   * @param targetLanguage - User's native language to translate into
   */
  async processVocabularyLibrary(
    libraryId: number,
    page: number,
    words: VocabularyWord[],
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<void> {
    console.log(`[VocabularyTranslationCenter] Processing library ${libraryId}, page ${page}, ${words.length} words -> ${targetLanguage}`);

    // Detect a context switch (library / page / target language change) and
    // clear the old cache + pending set so we never mix pages.
    const isNewContext =
      this.currentLibraryId !== libraryId ||
      this.currentPage !== page ||
      this.currentTargetLanguage !== targetLanguage;

    if (isNewContext) {
      console.log('[VocabularyTranslationCenter] Switching context, clearing old cache');
      this.clearCache();
      this.currentLibraryId = libraryId;
      this.currentPage = page;
      this.currentTargetLanguage = targetLanguage;
    }

    // BUILD LOCAL CACHE.
    for (const word of words) {
      const key = this.getWordKey(word.word, sourceLanguage, targetLanguage);
      this.cachedWords.set(key, word);
    }

    // Find words still missing a translation (mirrors the page's
    // wordNeedsTranslation check: no backend translations[] and no translation).
    const wordsNeedingTranslation = words.filter(w => this.wordNeedsTranslation(w));

    if (wordsNeedingTranslation.length === 0) {
      console.log('[VocabularyTranslationCenter] All words already translated');
      return;
    }

    console.log(`[VocabularyTranslationCenter] Found ${wordsNeedingTranslation.length} words without translation`);

    // Track them as pending before enqueueing.
    for (const word of wordsNeedingTranslation) {
      const key = this.getWordKey(word.word, sourceLanguage, targetLanguage);
      if (!this.pendingRequests.has(key)) {
        this.pendingRequests.set(key, {
          word: word.word,
          language: sourceLanguage,
          targetLanguage,
          index: word.index,
          requestTime: Date.now(),
          retryCount: 0,
        });
      }
    }

    // ENQUEUE (also prioritizes existing queue entries via moved_to_front).
    await this.enqueueWords(
      wordsNeedingTranslation.map(w => w.word),
      sourceLanguage,
      targetLanguage
    );

    // Start the poll loop.
    this.startPolling();
  }

  /**
   * Mirrors LibraryDetail's wordNeedsTranslation: a word needs translating when
   * it has no backend translations[] array AND no inline translation string.
   */
  private wordNeedsTranslation(w: VocabularyWord): boolean {
    const hasBackend = Array.isArray(w.translations) && w.translations.length > 0;
    return !hasBackend && !w.translation && !w.has_translation;
  }

  /**
   * ENQUEUE step: POST the untranslated words to /queue/batch/add in batches of
   * BATCH_SIZE. The backend de-dupes, queues new words, and moves already-queued
   * words to the front (prioritization). Best-effort: offline/backend-down is
   * non-critical, pending words stay tracked for the next attempt.
   */
  private async enqueueWords(
    words: string[],
    language: string,
    targetLanguage: string
  ): Promise<void> {
    if (words.length === 0) return;

    const token = await StorageCenter.auth.getToken();
    if (!token) {
      console.warn('[VocabularyTranslationCenter] No auth token available (handled, skipping enqueue)');
      return;
    }

    // Split into batches of BATCH_SIZE.
    for (let i = 0; i < words.length; i += this.BATCH_SIZE) {
      const batch = words.slice(i, i + this.BATCH_SIZE);
      try {
        const res = await ApiCenter.translation.queueBatchAdd({
          words: batch,
          language,
          target_language: targetLanguage,
        });

        if (res.success && res.data) {
          console.log(
            `[VocabularyTranslationCenter] Enqueue ok: queued=${res.data.queued ?? '?'} moved=${res.data.moved ?? '?'} skipped=${res.data.skipped ?? '?'}`
          );

          // Words the backend reports as already_translated are done — patch
          // them immediately from status on the next poll, but at minimum we
          // can drop ones flagged already_translated here once status confirms.
          if (Array.isArray(res.data.results)) {
            for (const r of res.data.results) {
              if (r.status === 'already_translated') {
                // Leave it pending so the very next status poll fetches the
                // actual translation string and notifies listeners.
                console.log(`[VocabularyTranslationCenter] Already translated (will fetch on poll): ${r.word}`);
              }
            }
          }
        } else {
          console.warn('[VocabularyTranslationCenter] Enqueue failed (handled):', res.error?.message);
        }
      } catch (error: any) {
        console.warn('[VocabularyTranslationCenter] Error enqueuing words (handled, non-critical):', error?.message || error);
      }
    }
  }

  /**
   * Start the poll loop. Idempotent: a second call while polling is a no-op.
   * Runs an immediate first poll, then every POLL_INTERVAL ms.
   */
  private startPolling(): void {
    if (this.pollingTimer) {
      return;
    }

    console.log('[VocabularyTranslationCenter] Starting translation polling (5s intervals)...');

    this.pollingTimer = setInterval(() => {
      this.pollPendingStatus();
    }, this.POLL_INTERVAL);

    // Immediate first poll.
    this.pollPendingStatus();
  }

  /**
   * Stop the poll loop.
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log('[VocabularyTranslationCenter] Polling stopped');
    }
  }

  /**
   * POLL step: query /queue/batch/status for all pending words. When a word's
   * has_translation flips to true, notify listeners with its translation string
   * and stop tracking it. Words that never resolve are dropped after MAX_RETRY
   * polls or MAX_AGE ms. Polling auto-stops when nothing remains pending.
   */
  private async pollPendingStatus(): Promise<void> {
    if (this.pendingRequests.size === 0) {
      this.stopPolling();
      return;
    }

    const token = await StorageCenter.auth.getToken();
    if (!token) {
      console.warn('[VocabularyTranslationCenter] No auth token for polling (handled, stopping)');
      this.stopPolling();
      return;
    }

    console.log(`[VocabularyTranslationCenter] Polling ${this.pendingRequests.size} pending translation(s)...`);

    let completedCount = 0;

    try {
      // Group pending requests by (language, targetLanguage) so each batch/status
      // request is internally consistent. In practice this is a single group.
      const groups = new Map<string, TranslationRequest[]>();
      for (const request of this.pendingRequests.values()) {
        const gkey = `${request.language}|${request.targetLanguage}`;
        const list = groups.get(gkey) || [];
        list.push(request);
        groups.set(gkey, list);
      }

      for (const [, requests] of groups) {
        const { language, targetLanguage } = requests[0];

        // Split into batches of BATCH_SIZE.
        for (let i = 0; i < requests.length; i += this.BATCH_SIZE) {
          const batch = requests.slice(i, i + this.BATCH_SIZE);
          const res = await ApiCenter.translation.queueBatchStatus({
            words: batch.map(r => r.word),
            language,
            target_language: targetLanguage,
          });

          if (res.success && res.data && Array.isArray(res.data.results)) {
            for (const result of res.data.results) {
              const key = this.getWordKey(result.word, language, targetLanguage);
              const request = this.pendingRequests.get(key);
              if (!request) continue;

              if (result.has_translation && result.translation) {
                // Translation filled — notify and stop tracking this word.
                console.log(`[VocabularyTranslationCenter] Translation ready for: ${request.word}`);
                this.updateCachedWord(request.word, language, targetLanguage, result.translation);
                this.notifyListeners(request.word, result.translation);
                this.pendingRequests.delete(key);
                completedCount++;
              } else {
                // Still pending — count a retry; drop after MAX_RETRY.
                request.retryCount++;
                if (request.retryCount >= this.MAX_RETRY) {
                  console.warn(`[VocabularyTranslationCenter] Timeout (max retries) for: ${request.word}`);
                  this.pendingRequests.delete(key);
                }
              }
            }
          } else {
            console.warn('[VocabularyTranslationCenter] Batch status failed (handled):', res.error?.message);
          }
        }
      }
    } catch (error: any) {
      // Best-effort poll: keep pending requests for the next tick on failure.
      console.warn('[VocabularyTranslationCenter] Error during status poll (handled, non-critical):', error?.message || error);
    }

    if (completedCount > 0) {
      console.log(`[VocabularyTranslationCenter] ${completedCount} translation(s) completed`);
    }

    // Drop stale requests, then stop polling if nothing is left.
    this.cleanupStaleRequests();

    if (this.pendingRequests.size === 0) {
      this.stopPolling();
    }
  }

  /**
   * Patch the local cache entry once a translation arrives.
   */
  private updateCachedWord(word: string, language: string, targetLanguage: string, translation: string): void {
    const key = this.getWordKey(word, language, targetLanguage);
    const cachedWord = this.cachedWords.get(key);
    if (cachedWord) {
      cachedWord.translation = translation;
      cachedWord.has_translation = true;
      this.cachedWords.set(key, cachedWord);
    }
  }

  /**
   * Drop requests older than MAX_AGE.
   */
  private cleanupStaleRequests(): void {
    const now = Date.now();
    let removedCount = 0;
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.requestTime > this.MAX_AGE) {
        console.warn(`[VocabularyTranslationCenter] Removing stale request: ${request.word}`);
        this.pendingRequests.delete(key);
        removedCount++;
      }
    }
    if (removedCount > 0) {
      console.log(`[VocabularyTranslationCenter] Cleaned up ${removedCount} stale requests`);
    }
  }

  /**
   * Subscribe to translation fills. Returns an unsubscribe function.
   */
  subscribe(listener: TranslationStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify listeners when a word's translation becomes available.
   */
  private notifyListeners(word: string, translation: string): void {
    this.listeners.forEach(listener => {
      try {
        listener(word, translation);
      } catch (error) {
        console.error('[VocabularyTranslationCenter] Error in listener:', error);
      }
    });
  }

  /**
   * Unique key for a word + source language + target language combination.
   */
  private getWordKey(word: string, language: string, targetLanguage: string): string {
    return `${language}:${targetLanguage}:${word.toLowerCase()}`;
  }

  /**
   * Current pending count.
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Whether a specific word is still pending a translation.
   */
  isPending(word: string, language: string, targetLanguage: string): boolean {
    const key = this.getWordKey(word, language, targetLanguage);
    return this.pendingRequests.has(key);
  }

  /**
   * Clear cache + pending + polling (call when switching pages / on unmount).
   */
  clearCache(): void {
    console.log('[VocabularyTranslationCenter] Clearing cache and pending requests');
    this.cachedWords.clear();
    this.pendingRequests.clear();
    this.stopPolling();
    this.currentLibraryId = null;
    this.currentPage = null;
    this.currentTargetLanguage = null;
  }
}

// Export singleton.
export const VocabularyTranslationCenter = new VocabularyTranslationCenterClass();
