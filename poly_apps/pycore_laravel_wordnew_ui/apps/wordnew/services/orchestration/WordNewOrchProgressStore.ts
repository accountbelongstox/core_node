/**
 * Kept resolve progress of every composition (native: `Directory.Data`; web:
 * IndexedDB through the same filesystem library). One snapshot per task, keyed
 * by the plan hash it belongs to: a snapshot of another plan is never used
 * (idempotency key). Written throttled while a run goes on and at its end, so
 * leaving the page or closing the app continues where it stopped.
 *
 * Small on purpose: counts and phase plus the MAX_KEPT_ITEMS latest settled
 * items (what the expanded list shows while a resumed run starts). The clips
 * themselves are the device store's - a resumed run finds them there - so the
 * full item list (tens of thousands for a whole book) is never written; it is
 * also built only when a write happens, not on every progress update.
 */
import { CapJsonStore, Directory } from '../../platform/capabilities';
import type { OrchComposePhase } from '../../../../shared/orchestration/orchComposer';
import type { OrchResolveItem, OrchResolveItemState } from '../../../../shared/orchestration/orchClipResolver';
import type { OrchClipOrigin, OrchResolveCounts } from '../../../../shared/orchestration/orchTypes';

const PROGRESS_PATH = 'wfnew-orch/progress.json';
const SAVE_DELAY_MS = 2_000;
/** Settled items kept per task for display. */
const MAX_KEPT_ITEMS = 200;

interface LiveProgress {
  planHash: string;
  phase: OrchComposePhase;
  counts: OrchResolveCounts;
  items: ReadonlyMap<string, OrchResolveItem>;
}

/** The latest settled items of a run, compact (a transfer in flight is not kept). */
function keptItems(items: ReadonlyMap<string, OrchResolveItem>): Record<string, OrchProgressItem> {
  const settled: OrchResolveItem[] = [];
  items.forEach((item) => {
    if (item.state === 'done' || item.state === 'missing') settled.push(item);
  });
  settled.sort((left, right) => right.updatedAt - left.updatedAt);
  const kept: Record<string, OrchProgressItem> = {};
  settled.slice(0, MAX_KEPT_ITEMS).forEach((item) => {
    kept[item.key] = {
      kind: item.kind,
      language: item.language,
      text: item.text,
      state: item.state,
      origin: item.state === 'done' ? item.origin : null,
      generating: item.state === 'missing' ? item.generating : null,
    };
  });
  return kept;
}

export interface OrchProgressItem {
  kind: OrchResolveItem['kind'];
  language: string;
  text: string;
  state: OrchResolveItemState;
  origin: OrchClipOrigin | null;
  /** Backend asked to generate a missing clip (absent in snapshots written before). */
  generating?: OrchResolveItem['generating'];
}

export interface OrchProgressSnapshot {
  planHash: string;
  phase: OrchComposePhase;
  counts: OrchResolveCounts;
  items: Record<string, OrchProgressItem>;
  updatedAt: number;
}

interface ProgressDocument {
  version: 1;
  tasks: Record<string, OrchProgressSnapshot>;
}

type ProgressListener = () => void;

class WordNewOrchProgressStoreService {
  private readonly file = new CapJsonStore<ProgressDocument>(PROGRESS_PATH, { version: 1, tasks: {} }, Directory.Data);
  private tasks: Record<string, OrchProgressSnapshot> | null = null;
  private loading: Promise<Record<string, OrchProgressSnapshot>> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private readonly clearListeners = new Set<ProgressListener>();
  /** Progress reported since the last write, materialized when it is written. */
  private readonly live = new Map<string, LiveProgress>();

  private load(): Promise<Record<string, OrchProgressSnapshot>> {
    if (this.tasks) return Promise.resolve(this.tasks);
    this.loading ??= this.file.load().then((document) => {
      this.tasks ??= { ...(document.tasks ?? {}) };
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
  async put(taskId: string, planHash: string, phase: OrchComposePhase, counts: OrchResolveCounts, items: ReadonlyMap<string, OrchResolveItem>, flush = false): Promise<void> {
    await this.load();
    this.live.set(taskId, { planHash, phase, counts: { ...counts }, items });
    if (flush) await this.save();
    else this.schedule();
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

  /** Rebuild resolve items from a snapshot (shown while a resumed run starts). */
  toItems(snapshot: OrchProgressSnapshot): Map<string, OrchResolveItem> {
    const updatedAt = snapshot.updatedAt;
    return new Map(Object.entries(snapshot.items).map(([key, item]) => [key, {
      key, ...item, generating: item.generating ?? null, loaded: 0, total: 0, updatedAt,
    }]));
  }

  async count(): Promise<number> {
    return new Set([...Object.keys(await this.load()), ...this.live.keys()]).size;
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save();
    }, SAVE_DELAY_MS);
  }

  /** Turn a task's reported progress into its kept snapshot. */
  private materialize(taskId: string): void {
    const live = this.live.get(taskId);
    if (!live || !this.tasks) return;
    this.live.delete(taskId);
    this.tasks[taskId] = { planHash: live.planHash, phase: live.phase, counts: live.counts, items: keptItems(live.items), updatedAt: Date.now() };
  }

  private save(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    [...this.live.keys()].forEach((taskId) => this.materialize(taskId));
    const document: ProgressDocument = { version: 1, tasks: { ...(this.tasks ?? {}) } };
    this.writes = this.writes.catch(() => undefined).then(() => this.file.save(document));
    return this.writes;
  }
}

export const wordNewOrchProgressStore = new WordNewOrchProgressStoreService();
