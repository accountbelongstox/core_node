/**
 * wordnew's composition runs, owned by this service - not by a page: a page
 * subscribes to a task's session and asks for it (`ensure`); leaving the page
 * keeps the run going. The shared composer runs with local-first inputs, the
 * device -> pycore -> Laravel clip chain and the device duration memory.
 *
 * Resumable and idempotent: one run per task (same plan = same run); the kept
 * progress of the plan (WordNewOrchProgressStore) seeds a resumed run so the
 * page shows it at once, and is written while the run goes on - leaving the
 * page or closing the app continues where it stopped (kept clips answer from
 * the device store without network). Only the latest run of a task counts; a
 * result is written only while the task still has the plan the run composed. A
 * cache clear or clip-root change aborts runs and drops sessions.
 */
import {
  isOrchComposeAborted,
  ORCH_EMPTY_COUNTS,
  runComposition,
  totalDurationMs,
  type OrchComposeSession,
} from '../../../../shared/orchestration/orchComposer';
import type { OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { WORDNEW_ORCH_CLIP_SOURCES } from './WordNewOrchClipSources';
import { wordNewOrchClipStore } from './WordNewOrchClipStore';
import { wordNewOrchProgressStore } from './WordNewOrchProgressStore';
import { wordNewOrchSources } from './WordNewOrchSources';
import { wordNewOrchTaskStore } from './WordNewOrchTaskStore';

export type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';

export const ORCH_COMPOSE_ERROR_FAILED = 'orchCompose.error.failed';

interface ActiveRun {
  id: symbol;
  planHash: string;
  controller: AbortController;
}

type Listener = () => void;

class WordNewOrchComposerService {
  private readonly sessions = new Map<string, OrchComposeSession>();
  private readonly runs = new Map<string, ActiveRun>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly anyListeners = new Set<Listener>();

  constructor() {
    const reset = (): void => this.reset();
    wordNewOrchClipStore.onRootChanged(reset);
    wordNewOrchProgressStore.onClear(reset);
  }

  /** `useSyncExternalStore` pair for one task's session. */
  subscribe = (taskId: string, listener: Listener): (() => void) => {
    const set = this.listeners.get(taskId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(taskId, set);
    return () => { set.delete(listener); };
  };

  /** Every task's sessions (list pages). */
  subscribeAll = (listener: Listener): (() => void) => {
    this.anyListeners.add(listener);
    return () => { this.anyListeners.delete(listener); };
  };

  session(taskId: string): OrchComposeSession | null {
    return this.sessions.get(taskId) ?? null;
  }

  isRunning(taskId: string): boolean {
    return this.runs.has(taskId);
  }

  /**
   * Make sure the task's plan is (being) resolved. Idempotent: a run of the
   * same plan already going, or a finished session of it, is kept; `force`
   * restarts it with a fresh input load from Laravel.
   */
  ensure(task: OrchComposeTask, options: { force?: boolean } = {}): void {
    const active = this.runs.get(task.id);
    const session = this.sessions.get(task.id);
    if (!options.force) {
      if (active?.planHash === task.planHash) return;
      if (session?.planHash === task.planHash && (session.phase === 'ready' || session.phase === 'failed')) return;
    }
    active?.controller.abort();
    void this.run(task, options.force === true);
  }

  /** Local caches were cleared (or the clip root moved): nothing kept is valid. */
  private reset(): void {
    this.runs.forEach((run) => run.controller.abort());
    this.runs.clear();
    const ids = [...this.sessions.keys()];
    this.sessions.clear();
    ids.forEach((id) => this.emit(id));
  }

  private emit(taskId: string): void {
    this.listeners.get(taskId)?.forEach((listener) => listener());
    this.anyListeners.forEach((listener) => listener());
  }

  private async stillCurrent(task: OrchComposeTask, run: symbol): Promise<boolean> {
    if (this.runs.get(task.id)?.id !== run) return false;
    return (await wordNewOrchTaskStore.get(task.id))?.planHash === task.planHash;
  }

  private async run(task: OrchComposeTask, force: boolean): Promise<void> {
    const run: ActiveRun = { id: Symbol(task.id), planHash: task.planHash, controller: new AbortController() };
    const { signal } = run.controller;
    this.runs.set(task.id, run);
    const kept = force ? null : await wordNewOrchProgressStore.get(task.id, task.planHash);
    await wordNewOrchTaskStore.update(task.id, { status: 'resolving' });
    let last: OrchComposeSession | null = null;
    const publish = (next: OrchComposeSession): void => {
      last = next;
      if (signal.aborted || this.runs.get(task.id)?.id !== run.id) return;
      this.sessions.set(task.id, next);
      this.emit(task.id);
      if (next.items.size > 0) void wordNewOrchProgressStore.put(task.id, task.planHash, next.phase, next.counts, next.items);
    };
    try {
      const session = await runComposition(task, task.planHash, {
        loadInputs: () => wordNewOrchSources.load(task, { force }),
        sources: WORDNEW_ORCH_CLIP_SOURCES,
        durations: wordNewOrchClipStore,
        signal,
        onUpdate: publish,
        seed: kept ? { counts: kept.counts, items: wordNewOrchProgressStore.toItems(kept) } : undefined,
      });
      if (!(await this.stillCurrent(task, run.id))) return;
      await wordNewOrchProgressStore.put(task.id, task.planHash, session.phase, session.counts, session.items, true);
      const progress = {
        planHash: task.planHash,
        phase: session.phase,
        done: session.counts.total - session.counts.pending - session.counts.missing,
        total: session.counts.total,
        updatedAt: new Date().toISOString(),
      };
      if (session.phase === 'ready' && session.plan) {
        await wordNewOrchTaskStore.update(task.id, {
          progress,
          status: session.counts.missing > 0 ? 'partial' : 'ready',
          segmentCount: session.plan.segments.length,
          itemCount: session.plan.segments.reduce((total, segment) => total + segment.items.length, 0),
          durationMs: totalDurationMs(session.timelines),
        });
      } else {
        await wordNewOrchTaskStore.update(task.id, { status: 'draft' });
      }
    } catch (error) {
      if (isOrchComposeAborted(error) || !(await this.stillCurrent(task, run.id))) return;
      const failed: OrchComposeSession = {
        ...(last ?? {
          planHash: task.planHash,
          inputsFresh: false,
          plan: null,
          wordStates: new Map(),
          clips: new Map(),
          counts: ORCH_EMPTY_COUNTS,
          items: new Map(),
          transfer: { bytes: 0, bytesPerSecond: 0 },
          endpoints: {},
          timelines: [],
        }),
        phase: 'failed',
        error: ORCH_COMPOSE_ERROR_FAILED,
      };
      publish(failed);
      await wordNewOrchTaskStore.update(task.id, { status: 'draft' });
    } finally {
      if (this.runs.get(task.id)?.id === run.id) {
        this.runs.delete(task.id);
        this.emit(task.id);
      }
    }
  }
}

export const wordNewOrchComposer = new WordNewOrchComposerService();
