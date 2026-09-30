/**
 * Kept resolve progress of every composition (native: `Directory.Data`; web:
 * IndexedDB through the same filesystem library). One snapshot per task, keyed
 * by the plan hash it belongs to: a snapshot of another plan is never used
 * (idempotency key). Written throttled while a run goes on and at its end, so
 * leaving the page or closing the app continues where it stopped.
 */
import { CapJsonStore, Directory } from '../../platform/capabilities';
import type { OrchComposePhase } from '../../../../shared/orchestration/orchComposer';
import type { OrchResolveItem, OrchResolveItemState } from '../../../../shared/orchestration/orchClipResolver';
import type { OrchClipOrigin, OrchResolveCounts } from '../../../../shared/orchestration/orchTypes';

const PROGRESS_PATH = 'wfnew-orch/progress.json';
const SAVE_DELAY_MS = 2_000;

export interface OrchProgressItem {
  kind: OrchResolveItem['kind'];
  language: string;
  text: string;
  state: OrchResolveItemState;
  origin: OrchClipOrigin | null;
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
    const snapshot = (await this.load())[taskId];
    return snapshot && snapshot.planHash === planHash ? snapshot : null;
  }

  /** Keep the latest progress of a run (throttled write; `flush` writes at once). */
  async put(taskId: string, planHash: string, phase: OrchComposePhase, counts: OrchResolveCounts, items: ReadonlyMap<string, OrchResolveItem>, flush = false): Promise<void> {
    const tasks = await this.load();
    const kept: Record<string, OrchProgressItem> = {};
    items.forEach((item, key) => {
      // A transfer in flight is kept as queued: it restarts on the next run.
      const state = item.state === 'loading' ? 'queued' : item.state;
      kept[key] = { kind: item.kind, language: item.language, text: item.text, state, origin: state === 'done' ? item.origin : null };
    });
    tasks[taskId] = { planHash, phase, counts: { ...counts }, items: kept, updatedAt: Date.now() };
    if (flush) await this.save();
    else this.schedule();
  }

  async forget(taskId: string): Promise<void> {
    const tasks = await this.load();
    if (!tasks[taskId]) return;
    delete tasks[taskId];
    await this.save();
  }

  /** Local caches were cleared: every task reloads its resources on its next open. */
  async clear(): Promise<void> {
    this.tasks = {};
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
      key, ...item, loaded: 0, total: 0, updatedAt,
    }]));
  }

  async count(): Promise<number> {
    return Object.keys(await this.load()).length;
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
    const document: ProgressDocument = { version: 1, tasks: { ...(this.tasks ?? {}) } };
    this.writes = this.writes.catch(() => undefined).then(() => this.file.save(document));
    return this.writes;
  }
}

export const wordNewOrchProgressStore = new WordNewOrchProgressStoreService();
