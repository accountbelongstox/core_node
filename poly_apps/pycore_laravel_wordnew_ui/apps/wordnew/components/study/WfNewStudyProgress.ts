/**
 * WfNewStudyProgress — per-group study progress for the shelf study experience.
 *
 * Ports the legacy client's `dictiongroupmap` semantics (per-word read count +
 * last-read time + review flag, least-recently-studied first) to a LOCAL,
 * device-persisted store so the shelf study surface works fully offline / as a
 * guest. For a logged-in user it is ENRICHED, best-effort, from the real backend
 * progress blob (ingestBlob) and every mark is MIRRORED, fire-and-forget, to the
 * live endpoints via the wordnew service centers — the UI never blocks on or
 * fails because of the network.
 *
 * Reused live stack (best-effort, never load-bearing):
 *   - wordNewProgressCenter.getBlob / reportAnswers  → POST /group/get_progress_blob,
 *     /group/update_progress
 *   - wordNewRecitationCenter.recordAction           → POST /recitation/log
 * Local truth lives here so a mirror failure (e.g. the standby center is not
 * authenticated) degrades to on-device progress with no user-visible error.
 */

import { wfNewApi, type Word } from '../../api';
import { wordNewProgressCenter, wordNewRecitationCenter } from '../../services';
import type { WordNewGroupProgressBlob } from '../../api';
import { expandProgressEntry } from '../../api';
import { StorageManager } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';

/** One word's local study record (compact keys, JSON-persisted). */
interface WordRecord {
  /** read/seen count. */
  rc: number;
  /** last-studied epoch ms (0 = never). */
  ls: number;
  /** needs review (forgot / backend-scheduled due). */
  nr: boolean;
  /** proficiency 0-100 (backend-seeded when available, else derived). */
  pf: number;
}

interface GroupRecord {
  words: Record<string, WordRecord>;
  /** local calendar day (YYYY-MM-DD) the daily set belongs to. */
  dailyDate: string;
  /** unique word ids studied today (for the daily-goal bar). */
  daily: string[];
}

interface PersistShape {
  groups: Record<string, GroupRecord>;
}

/** Blended per-group aggregate for the stats header. */
export interface StudyStats {
  total: number;
  mastered: number;
  learning: number;
  due: number;
  /** unique words handled THIS session (resets on reload). */
  sessionHandled: number;
  /** unique words studied today (survives reload, resets at local midnight). */
  dailyHandled: number;
}

/** Whole-library aggregate for the arena progress popup (see computeLibraryStats). */
export interface LibraryStats {
  total: number;
  readWords: number;
  unreadRemaining: number;
  dueWords: number;
  reviewedWords: number;
  fullPasses: number;
}

const localDateKey = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const nowMs = (): number => Date.now();

class WfNewStudyProgressClass {
  private data: PersistShape = { groups: {} };
  /** In-memory only — the "this session" handled set per gid. */
  private session = new Map<string, Set<string>>();
  private listeners = new Set<() => void>();

  constructor() {
    this.load();
  }

  // ---- persistence ----

  private load(): void {
    try {
      const parsed = StorageManager.get<PersistShape | null>(StorageKeys.WORDNEW_STUDY_PROGRESS, null);
      if (parsed && typeof parsed === 'object' && parsed.groups) this.data = parsed;
    } catch {
      /* corrupt / unavailable → start empty */
    }
  }

  private save(): void {
    try {
      StorageManager.set(StorageKeys.WORDNEW_STUDY_PROGRESS, this.data);
    } catch {
      /* quota / unavailable → keep the in-memory copy */
    }
  }

  private group(gid: string): GroupRecord {
    let g = this.data.groups[gid];
    const today = localDateKey();
    if (!g) {
      g = { words: {}, dailyDate: today, daily: [] };
      this.data.groups[gid] = g;
    }
    if (g.dailyDate !== today) {
      g.dailyDate = today;
      g.daily = [];
    }
    return g;
  }

  private sessionSet(gid: string): Set<string> {
    let s = this.session.get(gid);
    if (!s) {
      s = new Set<string>();
      this.session.set(gid, s);
    }
    return s;
  }

  // ---- subscribe ----

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        /* a subscriber throwing must not break the others */
      }
    });
  }

  // ---- reads ----

  /** The stored record for one word (null when never touched locally). */
  recordOf(gid: string, wordId: string): WordRecord | null {
    return this.data.groups[gid]?.words?.[wordId] ?? null;
  }

  /** Whether a word is flagged needs-review locally. */
  isDue(gid: string, wordId: string): boolean {
    return this.recordOf(gid, wordId)?.nr === true;
  }

  /**
   * Effective proficiency 0-100: the local record's proficiency when the word
   * has any local activity, else the word's backend masteryLevel (fresh words
   * report 0).
   */
  proficiencyOf(gid: string, word: Word): number {
    const rec = this.recordOf(gid, word.id);
    if (rec && (rec.rc > 0 || rec.ls > 0)) return rec.pf;
    return typeof word.masteryLevel === 'number' ? word.masteryLevel : 0;
  }

  /**
   * Words due for review, least-recently-studied first: locally flagged
   * needs-review words. Never-studied words are NOT auto-due (they are "new",
   * surfaced by Recite), matching the legacy review-bucket behavior.
   */
  dueWords(gid: string, words: Word[]): Word[] {
    const due = words.filter((w) => this.isDue(gid, w.id));
    return this.orderByLeastRecent(gid, due);
  }

  /** Order a word list least-recently-studied first (never-studied first). */
  orderByLeastRecent(gid: string, words: Word[]): Word[] {
    return [...words].sort((a, b) => {
      const la = this.recordOf(gid, a.id)?.ls ?? 0;
      const lb = this.recordOf(gid, b.id)?.ls ?? 0;
      return la - lb;
    });
  }

  /** Blended aggregate for the stats header (works offline / as a guest). */
  computeStats(gid: string, words: Word[]): StudyStats {
    let mastered = 0;
    let learning = 0;
    let due = 0;
    for (const w of words) {
      const pf = this.proficiencyOf(gid, w);
      if (this.isDue(gid, w.id)) due += 1;
      if (pf >= 90) mastered += 1;
      else if (pf >= 60) learning += 1;
    }
    const g = this.data.groups[gid];
    const dailyHandled = g && g.dailyDate === localDateKey() ? g.daily.length : 0;
    return {
      total: words.length,
      mastered,
      learning,
      due,
      sessionHandled: this.session.get(gid)?.size ?? 0,
      dailyHandled,
    };
  }

  /**
   * Whole-library stats for the arena progress popup. Unlike computeStats
   * (current page only), this reads the group's FULL local record map, so the
   * numbers cover every word ever ingested for the group; `groupTotal` is the
   * backend grand total (pager.total) so unread words never seen locally are
   * still counted as remaining.
   *   - readWords:       rc > 0 (已读)
   *   - unreadRemaining: groupTotal - readWords (待读)
   *   - dueWords:        nr === true (待复习)
   *   - reviewedWords:   rc >= 2 — re-read after the first pass (复习过)
   *   - fullPasses:      min rc across the whole library — how many COMPLETE
   *                      cycles the group has been read through (整遍).
   */
  computeLibraryStats(gid: string, groupTotal: number): LibraryStats {
    const records = this.data.groups[gid]?.words ?? {};
    let read = 0;
    let due = 0;
    let reviewed = 0;
    let minRc = Infinity;
    for (const rec of Object.values(records)) {
      if (rec.rc > 0) read += 1;
      if (rec.rc >= 2) reviewed += 1;
      if (rec.nr) due += 1;
      if (rec.rc < minRc) minRc = rec.rc;
    }
    const total = Math.max(groupTotal, Object.keys(records).length);
    const seenAll = Object.keys(records).length >= total && total > 0;
    return {
      total,
      readWords: read,
      unreadRemaining: Math.max(0, total - read),
      dueWords: due,
      reviewedWords: reviewed,
      fullPasses: seenAll && Number.isFinite(minRc) ? minRc : 0,
    };
  }

  // ---- writes ----

  /** Count a word as seen/played (Recite pass) — bumps read count + timestamps. */
  recordSeen(gid: string, word: Word, language?: string, playTimeSeconds?: number): void {
    const g = this.group(gid);
    const rec = g.words[word.id] ?? { rc: 0, ls: 0, nr: false, pf: this.seedPf(word) };
    rec.rc += 1;
    rec.ls = nowMs();
    g.words[word.id] = rec;
    this.markDaily(g, word.id);
    this.sessionSet(gid).add(word.id);
    this.save();
    this.emit();
    // best-effort play_time submission to the group progress map (never throws).
    // Mirrors the mark() -> reportAnswers pattern; the read action with
    // play_time accumulates the word's read/reread duration server-side (§5.5).
    // Logged-in users only — a guest has no credential, so firing the
    // authenticated endpoints would just 401-flood the backend.
    if (playTimeSeconds != null && playTimeSeconds > 0 && wfNewApi.isAuthenticated()) {
      try {
        void wordNewProgressCenter
          .reportReadWithPlayTime(gid, word.id, playTimeSeconds)
          .catch(() => undefined);
      } catch {
        /* ignore - local progress already recorded */
      }
    }
    // best-effort recitation log (never throws)
    if (wfNewApi.isAuthenticated()) {
      try {
        wordNewRecitationCenter.recordAction(word.text, 'read', language);
      } catch {
        /* standby center not wired — local progress already recorded */
      }
    }
  }

  /**
   * Mark a word known (correct) or forgot (needs review). Updates the local
   * record, the daily/session sets, and mirrors best-effort to the backend.
   */
  mark(gid: string, word: Word, known: boolean, language?: string): void {
    const g = this.group(gid);
    const rec = g.words[word.id] ?? { rc: 0, ls: 0, nr: false, pf: this.seedPf(word) };
    rec.rc += 1;
    rec.ls = nowMs();
    if (known) {
      rec.pf = Math.min(100, Math.max(rec.pf, 0) + 20);
      rec.nr = false;
    } else {
      rec.pf = Math.max(0, rec.pf - 15);
      rec.nr = true;
    }
    g.words[word.id] = rec;
    this.markDaily(g, word.id);
    this.sessionSet(gid).add(word.id);
    this.save();
    this.emit();
    this.mirror(gid, word, known, language);
  }

  /** Clear only the in-memory session counter for a group (keeps persisted marks). */
  resetSession(gid: string): void {
    this.session.delete(gid);
    this.emit();
  }

  private markDaily(g: GroupRecord, wordId: string): void {
    if (!g.daily.includes(wordId)) g.daily.push(wordId);
  }

  private seedPf(word: Word): number {
    return typeof word.masteryLevel === 'number' ? word.masteryLevel : 0;
  }

  // ---- backend enrichment / mirror (best-effort) ----

  /**
   * Seed local records from the real per-group progress blob (logged-in users).
   * Backend proficiency / read-count / due-schedule win; the local session set
   * is untouched. Safe to call repeatedly; silently ignores a malformed blob.
   */
  ingestBlob(gid: string, blob: WordNewGroupProgressBlob): void {
    if (!blob || typeof blob.words !== 'object') return;
    const g = this.group(gid);
    const now = nowMs();
    for (const [wordId, raw] of Object.entries(blob.words)) {
      const e = expandProgressEntry(raw, blob.legend);
      const due =
        e.next_review_at == null || new Date(e.next_review_at).getTime() <= now;
      const ls = this.lastStudied(e.last_review_at, e.last_read_at, e.first_read_at);
      const prev = g.words[wordId];
      g.words[wordId] = {
        rc: Math.max(prev?.rc ?? 0, e.read_count + e.review_count),
        ls: Math.max(prev?.ls ?? 0, ls),
        nr: due && (e.read_count > 0 || e.review_count > 0) ? true : prev?.nr ?? false,
        pf: e.proficiency,
      };
    }
    this.save();
    this.emit();
  }

  private lastStudied(...values: Array<string | null>): number {
    let ts = 0;
    for (const v of values) {
      if (v != null) {
        const t = new Date(v).getTime();
        if (Number.isFinite(t) && t > ts) ts = t;
      }
    }
    return ts;
  }

  private mirror(gid: string, word: Word, known: boolean, language?: string): void {
    // Fire-and-forget; the standby centers own their own auth/base and may not
    // be wired in every runtime — a rejection here is expected and ignored.
    // Guests skip the mirror entirely (the endpoints require auth).
    if (!wfNewApi.isAuthenticated()) return;
    try {
      void wordNewProgressCenter
        .reportAnswers(gid, [{ word_id: word.id, correct: known }])
        .catch(() => undefined);
    } catch {
      /* ignore */
    }
    try {
      wordNewRecitationCenter.recordAction(
        word.text,
        known ? 'review_correct' : 'review_wrong',
        language,
      );
    } catch {
      /* ignore */
    }
  }
}

/** Global singleton — one study-progress store for the whole /wordnew shelf. */
export const wfNewStudyProgress = new WfNewStudyProgressClass();
