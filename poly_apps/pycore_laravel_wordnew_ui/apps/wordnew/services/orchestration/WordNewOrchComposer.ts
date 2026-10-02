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
 *
 * Continuing while pycore / Laravel come and go: every unfinished task of this
 * device (status `resolving` - interrupted or failed - or `partial` - clips
 * still missing), open or not, resumes when a clip channel becomes usable
 * (the shared `wordNewChannels` availability - pycore direct, relay or Laravel
 * goes from unusable to usable, debounced so a flapping link does not thrash;
 * the selection never switches by itself), when the selected pycore or
 * Laravel endpoint changes, on the browser `online` event, and once at start
 * (an app or page closed mid-run continues). A task still running then gets
 * one more pass when its run ends (what failed meanwhile is fetched). A failed
 * run keeps the task `resolving` (shown as paused) so it continues later.
 * Opening a task resumes it too (short backoff so re-renders never loop). A
 * resumed run keeps its plan, timelines and clips on screen and fetches only
 * what is still missing. Repeated "reload" presses within FORCE_DEBOUNCE_MS
 * start one run.
 */
import {
  isOrchComposeAborted,
  ORCH_EMPTY_COUNTS,
  runComposition,
  totalDurationMs,
  type OrchComposeSession,
} from '../../../../shared/orchestration/orchComposer';
import type { OrchComposeResource, OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import { Backoff } from '../../../../core/tasks/Backoff';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';
import { wordNewChannels } from '../compute/WordNewCompute';
import { wordNewClipReady } from '../WordNewClipReady';
import { serverSchemaGate } from '../../../../core/integrations/laravel/ServerSchemaGate';
import { WORDNEW_ORCH_CLIP_SOURCES, WORDNEW_ORCH_SCHEDULE } from './WordNewOrchClipSources';
import { wordNewOrchClipStore } from './WordNewOrchClipStore';
import { wordNewOrchProgressStore } from './WordNewOrchProgressStore';
import { wordNewOrchSources } from './WordNewOrchSources';
import { wordNewOrchTaskStore } from './WordNewOrchTaskStore';

export type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';

export const ORCH_COMPOSE_ERROR_FAILED = 'orchCompose.error.failed';

/** Reopening retries a failed run after this long. */
const RETRY_FAILED_MS = 5_000;
/** Reopening completes a run that missed clips after this long. */
const RETRY_MISSING_MS = 30_000;
/** A forced run of the same plan started this recently absorbs another force. */
const FORCE_DEBOUNCE_MS = 2_000;
/** A `clip.ready` push brings the generation re-check forward after this short coalescing delay. */
const READY_WAKE_DEBOUNCE_MS = 1_000;

interface ActiveRun {
  id: symbol;
  planHash: string;
  controller: AbortController;
  forcedAt: number;
}

type Listener = () => void;

class WordNewOrchComposerService {
  private readonly sessions = new Map<string, OrchComposeSession>();
  private readonly runs = new Map<string, ActiveRun>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly anyListeners = new Set<Listener>();
  /** When each task's last run ended (resume backoff). */
  private readonly finishedAt = new Map<string, number>();
  /** The selected pycore last seen ('' before the first). */
  private pycoreSelected = '';
  private laravelId: string | null = null;
  /** Channel availability last seen (a channel turning usable resumes unfinished tasks). */
  private channels = { direct: wordNewChannels.direct(), relay: wordNewChannels.relay(), laravel: wordNewChannels.laravel() };
  /** Running tasks whose connection changed mid-run: one more pass when the run ends. */
  private readonly resumeAfterRun = new Set<string>();
  /** Tasks waiting for clips a backend generates: the pending re-check. */
  private readonly generationWatch = new Map<string, ReturnType<typeof setTimeout>>();
  /** Tasks waiting for clips: the `clip.ready` subscription that brings their re-check forward. */
  private readonly generationWake = new Map<string, () => void>();
  /** Tasks whose last run had transfers that still failed after their retries: the pending re-run. */
  private readonly reruns = new Map<string, { timer: ReturnType<typeof setTimeout> | null; backoff: Backoff }>();
  /** Per task: the clips a re-check already reported as held (a held clip that still does not arrive is not chased again). */
  private readonly chased = new Map<string, Set<string>>();
  private serverPending = serverSchemaGate.getSnapshot().schema === 'pending';

  constructor() {
    const reset = (): void => this.reset();
    wordNewOrchClipStore.onRootChanged(reset);
    wordNewOrchProgressStore.onClear(reset);
    const resume = (): void => { void this.resumeUnfinished(); };
    // A channel turns usable (a backend answers again, a relay pairs, ...): what skipped it continues.
    wordNewChannels.subscribe(() => {
      const next = { direct: wordNewChannels.direct(), relay: wordNewChannels.relay(), laravel: wordNewChannels.laravel() };
      const rose = (next.direct && !this.channels.direct) || (next.relay && !this.channels.relay) || (next.laravel && !this.channels.laravel);
      this.channels = next;
      if (rose) resume();
    });
    // Another selected endpoint (availability may not change when both answer).
    wordNewPycoreLink.subscribe(() => {
      const { selectedUrl } = wordNewPycoreLink.getSnapshot();
      if (!selectedUrl || selectedUrl === this.pycoreSelected) return;
      if (this.pycoreSelected) resume();
      this.pycoreSelected = selectedUrl;
    });
    wfNewEndpoints.subscribe(() => {
      const id = wfNewEndpoints.getSnapshot().currentId;
      if (id && this.laravelId && id !== this.laravelId) resume();
      this.laravelId = id ?? this.laravelId;
    });
    // The server leaves its schema gate: everything paused by it continues (no timer polls it).
    serverSchemaGate.subscribe(() => {
      const pending = serverSchemaGate.getSnapshot().schema === 'pending';
      const cleared = this.serverPending && !pending;
      this.serverPending = pending;
      if (cleared) resume();
    });
    if (typeof window !== 'undefined') window.addEventListener('online', resume);
    // Runs the app or page left unfinished continue at start - once a channel is usable (a run with
    // every channel off would only mark clips missing; the channel turning usable resumes them).
    if (this.channels.direct || this.channels.relay || this.channels.laravel) resume();
  }

  private stopGenerationWatch(taskId: string): void {
    const timer = this.generationWatch.get(taskId);
    if (timer) clearTimeout(timer);
    this.generationWatch.delete(taskId);
    this.generationWake.get(taskId)?.();
    this.generationWake.delete(taskId);
  }

  /**
   * Clips of the last run were handed to a backend to generate: check every `generation_recheck_seconds` (for at most
   * `generation_watch_minutes`) whether a pycore holds any of them, and resume
   * the task once one does (the resumed run fetches them and re-arms this). While the realtime stream
   * is live, a `clip.ready` push for one of the clips brings the re-check forward and the timer is only
   * the long safety interval (`ready_push_safety_seconds`).
   */
  private watchGeneration(taskId: string): void {
    this.stopGenerationWatch(taskId);
    const session = this.sessions.get(taskId);
    if (!session) return;
    // The table maps indices to the plan's resources: no item copies.
    const planResources = session.plan?.resources ?? [];
    // The next generating clips in play order (the cursor flags more; those come later).
    const resources: OrchComposeResource[] = (session.table?.generatingIndices() ?? [])
      .slice(0, AUDIO_ORCH_TRANSFER.generateMaxItems)
      .map((index) => planResources[index])
      .filter((resource): resource is OrchComposeResource => Boolean(resource));
    if (resources.length === 0) return;
    const until = Date.now() + AUDIO_ORCH_TRANSFER.generationWatchMs;
    const readyIds = new Set(resources.map((resource) => resource.resourceId));
    const schedule = (delayMs: number): void => {
      const pending = this.generationWatch.get(taskId);
      if (pending) clearTimeout(pending);
      this.generationWatch.set(taskId, setTimeout(() => { void tick(); }, delayMs));
    };
    let ticking = false;
    let woken = false;
    const tick = async (): Promise<void> => {
      this.generationWatch.delete(taskId);
      ticking = true;
      woken = false;
      if (Date.now() > until || this.runs.has(taskId) || this.sessions.get(taskId) !== session) {
        if (this.sessions.get(taskId) === session) this.stopGenerationWatch(taskId);
        return;
      }
      // A paused server answers nothing useful: no request until it leaves the gate (the gate resumes the task).
      const held = serverSchemaGate.getSnapshot().schema === 'pending'
        ? new Set<string>()
        : await WORDNEW_ORCH_SCHEDULE.recheckGenerating(resources).catch(() => new Set<string>());
      const chased = this.chased.get(taskId) ?? new Set<string>();
      const fresh = [...held].filter((key) => !chased.has(key));
      if (fresh.length > 0) {
        fresh.forEach((key) => chased.add(key));
        this.chased.set(taskId, chased);
        // Generated clips lie below the transfer cursors: those stages must ask again - in the
        // kept progress and in the session a resumed run is seeded from (either may be its seed).
        const stages = ['transfer:pycore', 'transfer:relay', 'transfer:laravel'];
        await wordNewOrchProgressStore.resetCursors(taskId, stages);
        const current = this.sessions.get(taskId);
        if (current) {
          const cursors = { ...current.cursors };
          stages.forEach((stage) => { delete cursors[stage]; });
          this.sessions.set(taskId, { ...current, cursors });
        }
        const task = await wordNewOrchTaskStore.get(taskId);
        if (task && task.planHash === session.planHash) this.ensure(task, { resume: true });
        return;
      }
      ticking = false;
      if (this.sessions.get(taskId) === session) {
        schedule(woken ? READY_WAKE_DEBOUNCE_MS : wordNewClipReady.pollDelayMs(AUDIO_ORCH_TRANSFER.generationRecheckMs));
      }
    };
    this.generationWake.set(taskId, wordNewClipReady.subscribe((ids) => {
      if (ids && ![...ids].some((id) => readyIds.has(id))) return;
      if (ticking) woken = true;
      else schedule(READY_WAKE_DEBOUNCE_MS);
    }));
    schedule(wordNewClipReady.pollDelayMs(AUDIO_ORCH_TRANSFER.generationRecheckMs));
  }

  /**
   * A run whose transfers still failed after their retries runs again from its
   * cursors (only what is missing is asked), after a growing delay; a run
   * without failures resets the delay. A channel turning usable resumes sooner (R9).
   */
  private scheduleRerun(taskId: string): void {
    const session = this.sessions.get(taskId);
    const entry = this.reruns.get(taskId) ?? { timer: null, backoff: new Backoff(AUDIO_ORCH_TRANSFER.rerunMinMs, AUDIO_ORCH_TRANSFER.rerunMaxMs) };
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    const failed = session?.phase === 'failed' || Object.values(session?.stages ?? {}).some((stage) => stage.state === 'failed');
    // A paused server is not retried on a timer: its gate resumes the task when it clears.
    if (!failed || serverSchemaGate.getSnapshot().schema === 'pending') {
      this.reruns.delete(taskId);
      return;
    }
    entry.timer = setTimeout(() => {
      entry.timer = null;
      void wordNewOrchTaskStore.get(taskId).then((task) => {
        if (task && !this.runs.has(taskId)) this.ensure(task, { resume: true });
      });
    }, entry.backoff.next());
    this.reruns.set(taskId, entry);
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
  ensure(task: OrchComposeTask, options: { force?: boolean; resume?: boolean; interrupt?: boolean } = {}): void {
    const active = this.runs.get(task.id);
    const session = this.sessions.get(task.id);
    if (options.force && active?.planHash === task.planHash && Date.now() - active.forcedAt < FORCE_DEBOUNCE_MS) return;
    if (!options.force) {
      if (active?.planHash === task.planHash && !options.interrupt) return;
      if (session?.planHash === task.planHash && !this.needsResume(task.id, session, options.resume === true)) return;
    }
    active?.controller.abort();
    void this.run(task, options.force === true);
  }

  /** A kept session of the current plan with nothing running: does it continue? */
  private needsResume(taskId: string, session: OrchComposeSession, now: boolean): boolean {
    const age = Date.now() - (this.finishedAt.get(taskId) ?? 0);
    if (session.phase === 'failed') return now || age >= RETRY_FAILED_MS;
    if (session.phase === 'ready') return session.counts.missing + session.counts.pending > 0 && (now || age >= RETRY_MISSING_MS);
    // Any other phase without a run was interrupted.
    return true;
  }

  /**
   * A channel became usable (or the endpoint changed, or the app started):
   * continue every unfinished task of this device, watched or not. A task
   * without a session yet (fresh start) runs from its kept progress.
   */
  private async resumeUnfinished(): Promise<void> {
    for (const task of await wordNewOrchTaskStore.unfinished()) {
      if (this.runs.has(task.id)) {
        // A run past resolving (measuring durations can take long) restarts at once: its unresolved clips are asked again.
        const running = this.sessions.get(task.id);
        if (running?.phase === 'measure' && running.counts.missing + running.counts.pending > 0) this.ensure(task, { resume: true, interrupt: true });
        else this.resumeAfterRun.add(task.id);
        continue;
      }
      const session = this.sessions.get(task.id);
      if (session && (session.planHash !== task.planHash || !this.needsResume(task.id, session, true))) continue;
      this.ensure(task, { resume: true });
    }
  }

  /** Local caches were cleared (or the clip root moved): nothing kept is valid. */
  private reset(): void {
    this.runs.forEach((run) => run.controller.abort());
    this.runs.clear();
    this.resumeAfterRun.clear();
    this.reruns.forEach((entry) => { if (entry.timer) clearTimeout(entry.timer); });
    this.reruns.clear();
    [...this.generationWatch.keys()].forEach((taskId) => this.stopGenerationWatch(taskId));
    this.chased.clear();
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
    const run: ActiveRun = { id: Symbol(task.id), planHash: task.planHash, controller: new AbortController(), forcedAt: force ? Date.now() : 0 };
    const { signal } = run.controller;
    this.runs.set(task.id, run);
    const kept = force ? null : await wordNewOrchProgressStore.get(task.id, task.planHash);
    // A resumed run keeps what the last run of this plan showed.
    const previous = force ? null : this.sessions.get(task.id);
    const shown = previous?.planHash === task.planHash ? previous : null;
    await wordNewOrchTaskStore.update(task.id, { status: 'resolving' });
    let last: OrchComposeSession | null = null;
    const publish = (next: OrchComposeSession): void => {
      last = next;
      if (signal.aborted || this.runs.get(task.id)?.id !== run.id) return;
      this.sessions.set(task.id, next);
      this.emit(task.id);
      if (next.table) void wordNewOrchProgressStore.put(task.id, task.planHash, next.phase, next.counts, next.table, next.cursors, next.stages);
    };
    try {
      const session = await runComposition(task, task.planHash, {
        loadInputs: (report) => wordNewOrchSources.load(task, { force }, report),
        sources: WORDNEW_ORCH_CLIP_SOURCES,
        durations: wordNewOrchClipStore,
        signal,
        onUpdate: publish,
        // Local first: the kept state table and stage cursors of this plan (a resumed run continues from them).
        seed: kept || shown ? {
          counts: kept?.counts ?? shown?.counts ?? ORCH_EMPTY_COUNTS,
          table: kept?.table || shown?.table?.snapshot() || undefined,
          cursors: kept?.cursors ?? shown?.cursors,
          stages: kept?.stages ?? shown?.stages,
          ...(shown ? { plan: shown.plan, clips: shown.clips, timelines: shown.timelines, wordStates: shown.wordStates } : {}),
        } : undefined,
      });
      if (!(await this.stillCurrent(task, run.id))) return;
      await wordNewOrchProgressStore.put(task.id, task.planHash, session.phase, session.counts, session.table, session.cursors, session.stages, true);
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
          status: session.counts.missing > 0 ? 'partial' : session.counts.pending > 0 ? 'resolving' : 'ready',
          segmentCount: session.plan.segments.length,
          itemCount: session.plan.segments.reduce((total, segment) => total + segment.items.length, 0),
          durationMs: totalDurationMs(session.timelines),
        });
      } else {
        // Only a source that answered and is empty is a draft. A load that failed (no answer and
        // no kept copy) stays `resolving` - paused - and continues by R9 when a channel is back.
        const emptySource = session.phase === 'failed' && session.inputsFresh;
        await wordNewOrchTaskStore.update(task.id, { status: emptySource ? 'draft' : 'resolving' });
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
          table: null,
          cursors: {},
          transfer: { bytes: 0, bytesPerSecond: 0 },
          endpoints: {},
          stages: {},
          inputsProgress: null,
          measureProgress: null,
          timelines: [],
        }),
        phase: 'failed',
        error: ORCH_COMPOSE_ERROR_FAILED,
      };
      publish(failed);
      // Still unfinished: it continues when a channel comes back.
      await wordNewOrchTaskStore.update(task.id, { status: 'resolving' });
    } finally {
      if (this.runs.get(task.id)?.id === run.id) {
        this.finishedAt.set(task.id, Date.now());
        this.runs.delete(task.id);
        this.emit(task.id);
        if (this.resumeAfterRun.delete(task.id)) void this.resumeUnfinished();
        else this.watchGeneration(task.id);
        this.scheduleRerun(task.id);
      }
    }
  }
}

export const wordNewOrchComposer = new WordNewOrchComposerService();
