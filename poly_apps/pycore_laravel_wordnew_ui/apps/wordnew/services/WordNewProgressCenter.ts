/* [v4.1-Iris] Wf progress center — the per-group JSON progress blob for the
 * Wf shell (backend contract 2026-06-12: AUTH POST /group/get_progress_blob
 * returns the ENTIRE group's per-word progress map in ONE response — no
 * pagination, no 65k limits). Blob caching and request deduplication live in
 * the shared resource package; this center computes every group-level stat
 * CLIENT-SIDE from it (user directive: JSON 运算尽量交由前端).
 *
 * computeStats() mirrors the backend bucket semantics EXACTLY
 * (AppQyV1WordGroupProgressController::getProgressStats +
 * AppQyV1UserWordProgressModel scopes / blob contract):
 *   mastered_words   proficiency >= 90
 *   learning_words   60 <= proficiency < 90
 *   struggling_words proficiency < 60 AND the word has activity
 *   due_for_review   next_review_at null OR <= now
 *   avg_proficiency  mean over blob entries, rounded to 2 decimals
 *   total_words      the blob's total_words (gwords + pivot count — NOT the
 *                    entry count: words without progress entries still count)
 *
 * Invalidation: 'group-sources-changed' (group contents moved, scoped to the
 * gid when the payload carries one), 'learning-stats-updated' (an answer was
 * reported anywhere) and after reportAnswers() batch updates. */

import {
  wfNewApi,
  expandProgressEntry,
  invalidateGroupProgressCache,
} from '../api';
import type {
  GroupProgressStats,
  WordNewGroupProgressBlob,
  WordNewGroupProgressUpdate,
  WordNewProgressEntry,
} from '../api';
import { isQueuedError } from '../../../core/network/api-client';
import { wordNewEventBus } from './WordNewEventBus';
import { markSentenceWordsPlayed } from './WordNewSentenceWordTable';

const PROGRESS_FLUSH_MS = 5000;

interface PendingSentenceRead {
  word: string;
  count: number;
}

interface PendingSentenceReadBatch {
  language: string;
  groupId: string | null;
  reads: Map<string, PendingSentenceRead>;
}

/** One due/recent list row: the word id with its expanded progress entry. */
export interface WordNewProgressWordRef {
  word_id: string;
  entry: WordNewProgressEntry;
}

/** A word counts as "studied" once any read/review activity exists. */
const hasActivity = (e: WordNewProgressEntry): boolean =>
  e.read_count > 0 ||
  e.review_count > 0 ||
  e.first_read_at != null ||
  e.last_read_at != null ||
  e.last_review_at != null;

/** Most recent study timestamp of an entry (0 when never studied). */
const lastStudiedAt = (e: WordNewProgressEntry): number => {
  let ts = 0;
  for (const value of [e.last_review_at, e.last_read_at, e.first_read_at]) {
    if (value != null) {
      const t = new Date(value).getTime();
      if (Number.isFinite(t) && t > ts) ts = t;
    }
  }
  return ts;
};

class WordNewProgressCenterClass {
  /** Group ids seen by this domain center, used only for scoped invalidation. */
  private knownGids = new Set<string>();
  private pendingGroupUpdates = new Map<string, WordNewGroupProgressUpdate[]>();
  private pendingSentenceReads = new Map<string, PendingSentenceReadBatch>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushChain: Promise<void> = Promise.resolve();

  constructor() {
    // Any reported answer makes cached progress stale; a group-content
    // mutation makes that group's blob stale (all of them when the payload
    // carries no gid).
    wordNewEventBus.on('learning-stats-updated', (payload?: { gid?: string }) => {
      void this.invalidate(payload?.gid);
    });
    wordNewEventBus.on('group-sources-changed', (payload?: { gid?: string }) =>
      void this.invalidate(payload?.gid)
    );
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => {
        void this.flushNow();
      });
    }
  }

  /**
   * The full progress blob of one group. The shared resource package owns TTL
   * and in-flight deduplication. Pass force=true to evict its cached copy.
   * Rethrows on failure (callers fall back to the
   * server-side /group/get_progress_stats aggregation).
   */
  async getBlob(gid: string, force?: boolean): Promise<WordNewGroupProgressBlob> {
    this.knownGids.add(gid);
    if (force) await invalidateGroupProgressCache(gid);
    return wfNewApi.getGroupProgressBlob(gid);
  }

  /** Drop the shared cached blob of one group (or every group seen here). */
  async invalidate(gid?: string): Promise<void> {
    if (gid) {
      this.knownGids.add(gid);
      await invalidateGroupProgressCache(gid);
    } else {
      const gids = [...this.knownGids];
      await Promise.all(gids.map((knownGid) => invalidateGroupProgressCache(knownGid)));
    }
  }

  /**
   * Legend-expanded progress entry of one word (null when the blob has no
   * entry for it, i.e. the word was never studied).
   */
  entryOf(blob: WordNewGroupProgressBlob, wordId: string | number): WordNewProgressEntry | null {
    const raw = blob.words[String(wordId)];
    return raw ? expandProgressEntry(raw, blob.legend) : null;
  }

  /** Proficiency of one word (0 when it has no progress entry). */
  proficiencyOf(blob: WordNewGroupProgressBlob, wordId: string | number): number {
    return this.entryOf(blob, wordId)?.proficiency ?? 0;
  }

  /**
   * Pure client-side replacement of /group/get_progress_stats — same field
   * names and bucket semantics as the server aggregation (see the top-of-file
   * block comment), so existing GroupProgressStats consumers render unchanged.
   */
  computeStats(blob: WordNewGroupProgressBlob): GroupProgressStats {
    const now = Date.now();
    let mastered = 0;
    let learning = 0;
    let struggling = 0;
    let due = 0;
    let reads = 0;
    let reviews = 0;
    let proficiencySum = 0;
    let entryCount = 0;

    for (const raw of Object.values(blob.words)) {
      const e = expandProgressEntry(raw, blob.legend);
      entryCount += 1;
      proficiencySum += e.proficiency;
      reads += e.read_count;
      reviews += e.review_count;

      if (e.proficiency >= 90) {
        mastered += 1;
      } else if (e.proficiency >= 60) {
        learning += 1;
      } else if (hasActivity(e)) {
        struggling += 1;
      }

      if (e.next_review_at == null) {
        due += 1;
      } else {
        const t = new Date(e.next_review_at).getTime();
        if (!Number.isFinite(t) || t <= now) due += 1;
      }
    }

    return {
      total_words: blob.total_words,
      avg_proficiency:
        entryCount > 0 ? Math.round((proficiencySum / entryCount) * 100) / 100 : 0,
      total_reads: reads,
      total_reviews: reviews,
      mastered_words: mastered,
      learning_words: learning,
      struggling_words: struggling,
      due_for_review: due,
    };
  }

  /**
   * Words due for review (next_review_at null or <= now), most-overdue first
   * (never-scheduled words sort as immediately due, i.e. first). Optional
   * `limit` caps the list.
   */
  dueWords(blob: WordNewGroupProgressBlob, limit?: number): WordNewProgressWordRef[] {
    const now = Date.now();
    const due: Array<WordNewProgressWordRef & { sortKey: number }> = [];
    for (const [wordId, raw] of Object.entries(blob.words)) {
      const entry = expandProgressEntry(raw, blob.legend);
      let sortKey = 0; // null next_review_at → due since forever
      if (entry.next_review_at != null) {
        const t = new Date(entry.next_review_at).getTime();
        if (Number.isFinite(t) && t > now) continue; // not due yet
        sortKey = Number.isFinite(t) ? t : 0;
      }
      due.push({ word_id: wordId, entry, sortKey });
    }
    due.sort((a, b) => a.sortKey - b.sortKey);
    const sliced = limit != null && limit >= 0 ? due.slice(0, limit) : due;
    return sliced.map(({ word_id, entry }) => ({ word_id, entry }));
  }

  /** The n most recently studied words (latest read/review first). */
  recentlyStudied(blob: WordNewGroupProgressBlob, n: number): WordNewProgressWordRef[] {
    const studied: Array<WordNewProgressWordRef & { ts: number }> = [];
    for (const [wordId, raw] of Object.entries(blob.words)) {
      const entry = expandProgressEntry(raw, blob.legend);
      if (!hasActivity(entry)) continue;
      studied.push({ word_id: wordId, entry, ts: lastStudiedAt(entry) });
    }
    studied.sort((a, b) => b.ts - a.ts);
    return studied.slice(0, Math.max(0, n)).map(({ word_id, entry }) => ({ word_id, entry }));
  }

  /**
   * Batch-report study answers (POST /group/update_progress { gid, updates }
   * — the API layer also still supports the legacy single shape). Drops the
   * group's shared cached blob and broadcasts 'learning-stats-updated' so stat views
   * re-fetch. No-ops on an empty batch.
   */
  async reportAnswers(
    gid: string | undefined,
    updates: WordNewGroupProgressUpdate[]
  ): Promise<any> {
    if (!updates || updates.length === 0 || !wfNewApi.isAuthenticated()) return null;
    const key = gid ?? '';
    const pending = this.pendingGroupUpdates.get(key) ?? [];
    pending.push(...updates);
    this.pendingGroupUpdates.set(key, pending);
    this.scheduleFlush();
    return null;
  }

  /**
   * Report ONE word's read event with its play_time (POST /group/update_progress
   * { gid, word_id, action: 'read', play_time }). Used by the recite loop to
   * submit per-word play time so the Default Vocabulary Group's progress map
   * accumulates read/reread duration (the §5.5 word mapping table). Mirrors
   * reportAnswers: drops the shared cached blob + broadcasts 'learning-stats-updated'.
   * Rethrows on failure (callers wrap fire-and-forget).
   */
  async reportReadWithPlayTime(
    gid: string | undefined,
    wordId: string | number,
    playTimeSeconds: number,
  ): Promise<any> {
    const update: WordNewGroupProgressUpdate = {
      word_id: wordId,
      action: 'read',
      play_time: playTimeSeconds,
    };
    return this.reportAnswers(gid, [update]);
  }

  /** Cache sentence-player reads and submit one request per language+group every five seconds. */
  reportSentenceReads(words: string[], language = 'en', groupId: string | null = null): void {
    if (words.length === 0 || !wfNewApi.isAuthenticated()) return;
    const languageKey = language.trim().toLowerCase() || 'en';
    const normalizedGroupId = groupId?.trim() || null;
    const batchKey = JSON.stringify([languageKey, normalizedGroupId]);
    const batch = this.pendingSentenceReads.get(batchKey) ?? {
      language: languageKey,
      groupId: normalizedGroupId,
      reads: new Map<string, PendingSentenceRead>(),
    };
    for (const rawWord of words) {
      const word = rawWord.trim();
      const key = word.toLowerCase();
      if (!word || !key) continue;
      const current = batch.reads.get(key);
      batch.reads.set(key, { word: current?.word ?? word, count: (current?.count ?? 0) + 1 });
    }
    if (batch.reads.size === 0) return;
    this.pendingSentenceReads.set(batchKey, batch);
    this.scheduleFlush();
  }

  /** Flush all cached read/review events in serialized batches. */
  flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushChain = this.flushChain
      .then(() => this.flushPending())
      .catch(() => undefined);
    return this.flushChain;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushNow();
    }, PROGRESS_FLUSH_MS);
  }

  private async flushPending(): Promise<void> {
    const groupBatches = this.pendingGroupUpdates;
    const sentenceBatches = this.pendingSentenceReads;
    this.pendingGroupUpdates = new Map<string, WordNewGroupProgressUpdate[]>();
    this.pendingSentenceReads = new Map<string, PendingSentenceReadBatch>();

    for (const [gidKey, updates] of groupBatches) {
      const gid = gidKey || undefined;
      try {
        await wfNewApi.updateGroupProgress(gid ? { gid, updates } : { updates });
      } catch (error) {
        if (isQueuedError(error) || this.isAuthFailure(error)) continue;
        const current = this.pendingGroupUpdates.get(gidKey) ?? [];
        this.pendingGroupUpdates.set(gidKey, [...updates, ...current]);
        continue;
      }
      await this.invalidate(gid).catch(() => undefined);
      wordNewEventBus.emit('learning-stats-updated', { gid, batch: updates.length });
    }

    for (const [batchKey, batch] of sentenceBatches) {
      const words: string[] = [];
      for (const item of batch.reads.values()) {
        for (let index = 0; index < item.count; index += 1) words.push(item.word);
      }
      try {
        await markSentenceWordsPlayed(words, batch.language, batch.groupId);
        wordNewEventBus.emit('learning-stats-updated', {
          sentenceWords: words.length,
          language: batch.language,
          gid: batch.groupId ?? undefined,
        });
      } catch (error) {
        if (isQueuedError(error) || this.isAuthFailure(error)) continue;
        const current = this.pendingSentenceReads.get(batchKey) ?? {
          language: batch.language,
          groupId: batch.groupId,
          reads: new Map<string, PendingSentenceRead>(),
        };
        for (const [key, item] of batch.reads) {
          const existing = current.reads.get(key);
          current.reads.set(key, {
            word: existing?.word ?? item.word,
            count: (existing?.count ?? 0) + item.count,
          });
        }
        this.pendingSentenceReads.set(batchKey, current);
      }
    }

    if (this.pendingGroupUpdates.size > 0 || this.pendingSentenceReads.size > 0) {
      this.scheduleFlush();
    }
  }

  private isAuthFailure(error: unknown): boolean {
    const status = (error as { status?: number } | null)?.status;
    return status === 401 || status === 403;
  }

  /**
   * Subscribe to 'learning-stats-updated' (any reported answer — single via
   * wordNewLearningStatsCenter.reportAnswer or batch via reportAnswers). Returns an
   * unsubscribe function.
   */
  subscribe(cb: () => void): () => void {
    return wordNewEventBus.on('learning-stats-updated', () => cb());
  }
}

export const wordNewProgressCenter = new WordNewProgressCenterClass();
