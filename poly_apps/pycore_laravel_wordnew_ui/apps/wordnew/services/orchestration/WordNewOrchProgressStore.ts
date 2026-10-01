/**
 * Kept resolve progress of every composition (native: `Directory.Data`; web:
 * the same filesystem library's browser backend). One snapshot per task, keyed
 * by the plan hash it belongs to: a snapshot of another plan is never used
 * (idempotency key). Written throttled while a run goes on and at its end, so
 * leaving the page or closing the app continues where it stopped.
 *
 * A snapshot is a cursor, not a list:
 *   - `table`: the OrchClipTable bytes as base64 (one byte per plan resource:
 *     state / origin / channel / generating) - a whole Bible is ~40 KB; no text;
 *   - `cursors`: per schedule stage, how far it got on which endpoint and when
 *     (a resumed run continues from there);
 *   - `counts` and `stages` for the views.
 * The table is encoded only when a write happens, never per progress update.
 */
import { CapJsonStore, Directory } from '../../platform/capabilities';
import type { OrchComposePhase } from '../../../../shared/orchestration/orchComposer';
import type { OrchStageCursor, OrchStageProgress } from '../../../../shared/orchestration/orchClipResolver';
import type { OrchClipTable } from '../../../../shared/orchestration/orchClipTable';
import type { OrchResolveCounts } from '../../../../shared/orchestration/orchTypes';

const PROGRESS_PATH = 'wfnew-orch/progress.json';
const SAVE_DELAY_MS = 2_000;

export interface OrchProgressSnapshot {
  planHash: string;
  phase: OrchComposePhase;
  counts: OrchResolveCounts;
  /** OrchClipTable snapshot ('' before a plan resolved; snapshots written before this format have none). */
  table: string;
  cursors: Record<string, OrchStageCursor>;
  stages: Record<string, OrchStageProgress>;
  updatedAt: number;
}

interface ProgressDocument {
  version: 2;
  tasks: Record<string, OrchProgressSnapshot>;
}

interface LiveProgress {
  planHash: string;
  phase: OrchComposePhase;
  counts: OrchResolveCounts;
  table: OrchClipTable | null;
  cursors: Record<string, OrchStageCursor>;
  stages: Record<string, OrchStageProgress>;
}

type ProgressListener = () => void;

/** A stored task of another format (the per-item list before) has no table: its counts still show. */
function normalize(snapshot: Partial<OrchProgressSnapshot> & { planHash: string; phase: OrchComposePhase; counts: OrchResolveCounts }): OrchProgressSnapshot {
  return {
    planHash: snapshot.planHash,
    phase: snapshot.phase,
    counts: snapshot.counts,
    table: typeof snapshot.table === 'string' ? snapshot.table : '',
    cursors: snapshot.cursors ?? {},
    stages: snapshot.stages ?? {},
    updatedAt: snapshot.updatedAt ?? 0,
  };
}

class WordNewOrchProgressStoreService {
  private readonly file = new CapJsonStore<ProgressDocument>(PROGRESS_PATH, { version: 2, tasks: {} }, Directory.Data);
  private tasks: Record<string, OrchProgressSnapshot> | null = null;
  private loading: Promise<Record<string, OrchProgressSnapshot>> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private readonly clearListeners = new Set<ProgressListener>();
  /** Progress reported since the last write, encoded when it is written. */
  private readonly live = new Map<string, LiveProgress>();

  private load(): Promise<Record<string, OrchProgressSnapshot>> {
    if (this.tasks) return Promise.resolve(this.tasks);
    this.loading ??= this.file.load().then((document) => {
      const tasks: Record<string, OrchProgressSnapshot> = {};
      Object.entries(document.tasks ?? {}).forEach(([taskId, snapshot]) => { tasks[taskId] = normalize(snapshot); });
      this.tasks ??= tasks;
      return this.tasks;
    });
    return this.loading;
  }

  /** The kept progress of a task for exactly this plan (null for another plan or none). */
  async get(taskId: string, planHash: string): Promise<OrchProgressSnapshot | null> {
    const tasks = await this.load();
    this.materialize(taskId);
    const snapshot = tasks[taskId];
    return snapshot && snapshot.planHash === planHash ? snapshot : null;
  }

  /** Keep the latest progress of a run (throttled write; `flush` writes at once). */
  async put(
    taskId: string,
    planHash: string,
    phase: OrchComposePhase,
    counts: OrchResolveCounts,
    table: OrchClipTable | null,
    cursors: Record<string, OrchStageCursor>,
    stages: Record<string, OrchStageProgress>,
    flush = false,
  ): Promise<void> {
    await this.load();
    this.live.set(taskId, { planHash, phase, counts: { ...counts }, table, cursors, stages });
    if (flush) await this.save();
    else this.schedule();
  }

  /** Drop stages' cursors of a task (e.g. clips were generated: its transfers must ask again). */
  async resetCursors(taskId: string, stages: readonly string[]): Promise<void> {
    const tasks = await this.load();
    this.materialize(taskId);
    const snapshot = tasks[taskId];
    if (!snapshot) return;
    const cursors = { ...snapshot.cursors };
    stages.forEach((stage) => { delete cursors[stage]; });
    tasks[taskId] = { ...snapshot, cursors };
    await this.save();
  }

  async forget(taskId: string): Promise<void> {
    const tasks = await this.load();
    this.live.delete(taskId);
    if (!tasks[taskId]) return;
    delete tasks[taskId];
    await this.save();
  }

  /** Local caches were cleared: every task reloads its resources on its next open. */
  async clear(): Promise<void> {
    this.tasks = {};
    this.live.clear();
    await this.save();
    this.clearListeners.forEach((listener) => listener());
  }

  onClear(listener: ProgressListener): () => void {
    this.clearListeners.add(listener);
    return () => { this.clearListeners.delete(listener); };
  }

  async count(): Promise<number> {
    return new Set([...Object.keys(await this.load()), ...this.live.keys()]).size;
  }

  /** Turn a task's reported progress into its kept snapshot (the table is encoded here). */
  private materialize(taskId: string): void {
    const live = this.live.get(taskId);
    if (!live || !this.tasks) return;
    this.live.delete(taskId);
    const previous = this.tasks[taskId];
    this.tasks[taskId] = {
      planHash: live.planHash,
      phase: live.phase,
      counts: live.counts,
      // A run that has no table yet keeps the snapshot of the same plan.
      table: live.table ? live.table.snapshot() : previous?.planHash === live.planHash ? previous.table : '',
      cursors: live.cursors,
      stages: live.stages,
      updatedAt: Date.now(),
    };
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save();
    }, SAVE_DELAY_MS);
  }

  private save(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    [...this.live.keys()].forEach((taskId) => this.materialize(taskId));
    const document: ProgressDocument = { version: 2, tasks: { ...(this.tasks ?? {}) } };
    this.writes = this.writes.catch(() => undefined).then(() => this.file.save(document));
    return this.writes;
  }
}

export const wordNewOrchProgressStore = new WordNewOrchProgressStoreService();
