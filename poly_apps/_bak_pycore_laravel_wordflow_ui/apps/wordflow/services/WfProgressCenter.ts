/* [v4.1-Iris] Wf progress center — the per-group JSON progress blob for the
 * Wf shell (backend contract 2026-06-12: AUTH POST /group/get_progress_blob
 * returns the ENTIRE group's per-word progress map in ONE response — no
 * pagination, no 65k limits). Holds one blob per gid with a short ~30s TTL
 * (the blob changes with every study action) and computes every group-level
 * stat CLIENT-SIDE from it (user directive: JSON 运算尽量交由前端).
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
  wordflowApi,
  expandProgressEntry,
} from '../../../core/api-libs/wordflow/WordflowApi';
import type {
  GroupProgressStats,
  WfGroupProgressBlob,
  WfGroupProgressUpdate,
  WfProgressEntry,
} from '../../../core/api-libs/wordflow/WordflowApi';
import { wfEventBus } from './WfEventBus';

/** Short TTL — every study action changes the blob, so hold it briefly. */
const BLOB_TTL = 30 * 1000;

/** One due/recent list row: the word id with its expanded progress entry. */
export interface WfProgressWordRef {
  word_id: string;
  entry: WfProgressEntry;
}

/** A word counts as "studied" once any read/review activity exists. */
const hasActivity = (e: WfProgressEntry): boolean =>
  e.read_count > 0 ||
  e.review_count > 0 ||
  e.first_read_at != null ||
  e.last_read_at != null ||
  e.last_review_at != null;

/** Most recent study timestamp of an entry (0 when never studied). */
const lastStudiedAt = (e: WfProgressEntry): number => {
  let ts = 0;
  for (const value of [e.last_review_at, e.last_read_at, e.first_read_at]) {
    if (value != null) {
      const t = new Date(value).getTime();
      if (Number.isFinite(t) && t > ts) ts = t;
    }
  }
  return ts;
};

class WfProgressCenterClass {
  /** Held blob per gid (in-flight promise, so concurrent callers share one fetch). */
  private blobs = new Map<string, { ts: number; promise: Promise<WfGroupProgressBlob> }>();

  constructor() {
    // Any reported answer makes every held blob stale; a group-content
    // mutation makes that group's blob stale (all of them when the payload
    // carries no gid).
    wfEventBus.on('learning-stats-updated', () => this.invalidate());
    wfEventBus.on('group-sources-changed', (payload?: { gid?: string }) =>
      this.invalidate(payload?.gid)
    );
  }

  /**
   * The full progress blob of one group — fetched at most once per ~30s per
   * gid (concurrent callers share the in-flight promise). Pass force=true to
   * bypass the held copy. Rethrows on failure (callers fall back to the
   * server-side /group/get_progress_stats aggregation).
   */
  async getBlob(gid: string, force?: boolean): Promise<WfGroupProgressBlob> {
    if (!force) {
      const held = this.blobs.get(gid);
      if (held && Date.now() - held.ts < BLOB_TTL) return held.promise;
    }
    const promise = wordflowApi.getGroupProgressBlob(gid);
    this.blobs.set(gid, { ts: Date.now(), promise });
    try {
      return await promise;
    } catch (error) {
      // Never hold a rejected fetch — the next caller must retry.
      if (this.blobs.get(gid)?.promise === promise) this.blobs.delete(gid);
      throw error;
    }
  }

  /** Drop the held blob of one group (or all of them). */
  invalidate(gid?: string): void {
    if (gid) {
      this.blobs.delete(gid);
    } else {
      this.blobs.clear();
    }
  }

  /**
   * Legend-expanded progress entry of one word (null when the blob has no
   * entry for it, i.e. the word was never studied).
   */
  entryOf(blob: WfGroupProgressBlob, wordId: string | number): WfProgressEntry | null {
    const raw = blob.words[String(wordId)];
    return raw ? expandProgressEntry(raw, blob.legend) : null;
  }

  /** Proficiency of one word (0 when it has no progress entry). */
  proficiencyOf(blob: WfGroupProgressBlob, wordId: string | number): number {
    return this.entryOf(blob, wordId)?.proficiency ?? 0;
  }

  /**
   * Pure client-side replacement of /group/get_progress_stats — same field
   * names and bucket semantics as the server aggregation (see the top-of-file
   * block comment), so existing GroupProgressStats consumers render unchanged.
   */
  computeStats(blob: WfGroupProgressBlob): GroupProgressStats {
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
  dueWords(blob: WfGroupProgressBlob, limit?: number): WfProgressWordRef[] {
    const now = Date.now();
    const due: Array<WfProgressWordRef & { sortKey: number }> = [];
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
  recentlyStudied(blob: WfGroupProgressBlob, n: number): WfProgressWordRef[] {
    const studied: Array<WfProgressWordRef & { ts: number }> = [];
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
   * group's held blob and broadcasts 'learning-stats-updated' so stat views
   * re-fetch. No-ops on an empty batch.
   */
  async reportAnswers(
    gid: string | undefined,
    updates: WfGroupProgressUpdate[]
  ): Promise<any> {
    if (!updates || updates.length === 0) return null;
    const result = await wordflowApi.updateGroupProgress(
      gid ? { gid, updates } : { updates }
    );
    this.invalidate(gid);
    wfEventBus.emit('learning-stats-updated', { gid, batch: updates.length });
    return result;
  }

  /**
   * Subscribe to 'learning-stats-updated' (any reported answer — single via
   * wfLearningStatsCenter.reportAnswer or batch via reportAnswers). Returns an
   * unsubscribe function.
   */
  subscribe(cb: () => void): () => void {
    return wfEventBus.on('learning-stats-updated', () => cb());
  }
}

export const wfProgressCenter = new WfProgressCenterClass();
