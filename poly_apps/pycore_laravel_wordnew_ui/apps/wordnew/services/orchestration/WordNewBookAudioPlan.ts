/**
 * The server-owned audio plan of a book composition. The device posts the plan
 * once (book, languages, reading position); Laravel derives the clips, raises
 * their gap rows by reading position and generates them through work leases on
 * every node. The device only follows: server counters (total / ready /
 * generating / queued / failed, per node) and the ids that became ready after a
 * cursor. A run then transfers just those ids - no per-run resolution of the
 * whole book.
 *
 * State per task: the plan id, the posted plan hash and position, the cursor
 * and the last counters (kept in `wfnew-orch/book-plans.json`; the cursor is
 * kept only while every id it covers was handled, so a restart never skips a
 * ready clip the device still lacks) plus, in memory only, the Set of ready ids
 * not yet delivered (R10: ids, never per-item objects).
 */
import { AUDIO_ORCH_BOOK_PLAN } from '../../../../core/contracts/AudioOrchestrationContract';
import type { AudioLaneKey } from '../../../../core/contracts/QueueCenterTypes';
import { serverSchemaGate } from '../../../../core/integrations/laravel/ServerSchemaGate';
import { pycoreApi } from '../../../../core/integrations/pycore';
import { Backoff } from '../../../../core/tasks/Backoff';
import type { OrchComposePlan, OrchComposeTask } from '../../../../shared/orchestration/orchTypes';
import { wfNewApi, type WfNewBookPlanStatus } from '../../api';
import { CapJsonStore, Directory } from '../../platform/capabilities';
import { wordNewPycoreLink, hostKey } from '../../integrations/WordNewPycoreLink';
import { wordNewChannels } from '../compute/WordNewCompute';
import { wordNewClipReady } from '../WordNewClipReady';
import { wordNewPycoreNodes } from '../WordNewPycoreNodes';
import {
  ASSIGN_SENTENCE_LANE,
  ASSIGN_WORD_LANE,
  buildAssignment,
  defaultDirectShare,
  type Assignment,
  type AssignmentLanguages,
} from './WordNewBookPlanAssigner';
import { wordNewOrchPlaybackStore } from './WordNewOrchPlaybackStore';

const PLAN_PATH = 'wfnew-orch/book-plans.json';
const READY_WAKE_DEBOUNCE_MS = 1_000;
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 120_000;
const WORD_STEP_TYPES: readonly string[] = ['words_new', 'words_all'];
const STEP_LANGUAGE: Record<string, string> = { sentence_en: 'en', sentence_zh: 'zh' };

interface StoredPlan {
  planId: string;
  planHash: string;
  /** Reading position (sentence seq) the server last raised priorities for. */
  position: number;
  /** Settled ready cursor: every id up to it was delivered or is on the device. */
  cursor: number;
  status: WfNewBookPlanStatus | null;
}

interface PlanDocument {
  version: 1;
  tasks: Record<string, StoredPlan>;
}

/** What the clip chain of one run is scoped by (see WordNewOrchClipSources). */
export interface OrchPlanScope {
  /** Resources the server plan owns (book sentences and words, never meaning clips). */
  covered: ReadonlySet<string>;
  /** Covered resources the server reported ready and the device has not delivered yet. */
  ready: ReadonlySet<string>;
  /** Clips per lane the app-led assignment gives the direct pycore (the default head share until one is computed). */
  direct: () => Readonly<Record<AudioLaneKey, number>>;
}

export interface WordNewBookPlanSnapshot {
  planId: string;
  status: WfNewBookPlanStatus | null;
  /** Ready ids waiting for delivery to the device. */
  undelivered: number;
}

interface LivePlan {
  stored: StoredPlan;
  covered: Set<string>;
  ready: Set<string>;
  /** Cursor of the ids merged into `ready` this process. */
  fetched: number;
  snapshot: WordNewBookPlanSnapshot;
  timer: ReturnType<typeof setTimeout> | null;
  wake: (() => void) | null;
  syncing: Promise<void> | null;
  backoff: Backoff;
  /** Delay of the next retry after a failed sync (0 while syncs succeed). */
  retryMs: number;
  onNewReady: (() => void) | null;
  /** Languages the plan voices per lane (the assignment is spread per language). */
  languages: AssignmentLanguages;
  /** The last assignment computed from the roster and the direct pycore (null before the first). */
  assignment: Assignment | null;
  assigning: Promise<void> | null;
  /** The plan heartbeat: the assignment is posted again on this timer while the plan is followed. */
  assignTimer: ReturnType<typeof setInterval> | null;
  releaseRoster: (() => void) | null;
  rosterNodes: unknown;
}

type Listener = () => void;

const EMPTY_DOCUMENT: PlanDocument = { version: 1, tasks: {} };

function planLanguages(task: OrchComposeTask): string[] {
  const languages = new Set<string>();
  task.config.pattern.forEach((step) => { const language = STEP_LANGUAGE[step.type]; if (language) languages.add(language); });
  return [...languages];
}

/** Sentence seq the reader is at: the first sentence of the segment the task resumes at (0 before any playback). */
async function readingPosition(taskId: string, plan: OrchComposePlan): Promise<number> {
  const resume = (await wordNewOrchPlaybackStore.ready(taskId))?.resume;
  const start = resume ? plan.segments[resume.segment]?.start : undefined;
  return start === undefined ? 0 : plan.sentences[start]?.seq ?? 0;
}

/** Languages per lane of the covered clips: the clips the plan owns decide which windows are worth posting. */
function coveredLanguages(plan: OrchComposePlan, covered: ReadonlySet<string>): AssignmentLanguages {
  const sentence = new Set<string>();
  const word = new Set<string>();
  plan.resources.forEach((resource) => {
    if (covered.has(resource.key)) (resource.kind === 'word' ? word : sentence).add(resource.language);
  });
  return { sentence_audio: [...sentence], word_audio: [...word] };
}

function complete(status: WfNewBookPlanStatus | null): boolean {
  return status !== null && status.state === 'ready' && status.total > 0 && status.ready >= status.total;
}

class WordNewBookAudioPlanService {
  private readonly file = new CapJsonStore<PlanDocument>(PLAN_PATH, EMPTY_DOCUMENT, Directory.Data);
  private readonly live = new Map<string, LivePlan>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** `useSyncExternalStore` pair for one task's plan state. */
  subscribe = (taskId: string, listener: Listener): (() => void) => {
    const set = this.listeners.get(taskId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(taskId, set);
    return () => { set.delete(listener); };
  };

  snapshot = (taskId: string): WordNewBookPlanSnapshot | null => this.live.get(taskId)?.snapshot ?? null;

  /** The plan owns this task's book clips. */
  isManaged(taskId: string): boolean {
    return this.live.has(taskId);
  }

  covered(taskId: string): ReadonlySet<string> | null {
    return this.live.get(taskId)?.covered ?? null;
  }

  /** Called when ready ids arrive that a finished run has not delivered. */
  onNewReady(taskId: string, handler: (() => void) | null): void {
    const live = this.live.get(taskId);
    if (live) live.onNewReady = handler;
  }

  /**
   * Make sure the server holds this task's plan and follow it. Returns the scope
   * the run's clip chain is limited by, or null when the plan cannot be used (no
   * book, no session, an older server): the run then resolves as before.
   */
  async ensurePlan(task: OrchComposeTask, plan: OrchComposePlan, covered: Set<string>): Promise<OrchPlanScope | null> {
    const book = task.config.book;
    const languages = planLanguages(task);
    if (!book || languages.length === 0 || serverSchemaGate.getSnapshot().schema === 'pending') return null;
    const document = await this.file.load();
    let live = this.live.get(task.id);
    if (!live) {
      const stored = document.tasks[task.id];
      const kept = stored && stored.planHash === task.planHash ? stored : null;
      live = {
        stored: kept ?? { planId: '', planHash: task.planHash, position: 0, cursor: 0, status: null },
        covered,
        ready: new Set(),
        fetched: kept?.cursor ?? 0,
        snapshot: { planId: kept?.planId ?? '', status: kept?.status ?? null, undelivered: 0 },
        timer: null,
        wake: null,
        syncing: null,
        backoff: new Backoff(RETRY_MIN_MS, RETRY_MAX_MS, { jitter: 'half' }),
        retryMs: 0,
        onNewReady: null,
        languages: coveredLanguages(plan, covered),
        assignment: null,
        assigning: null,
        assignTimer: null,
        releaseRoster: null,
        rosterNodes: null,
      };
      this.live.set(task.id, live);
    }
    live.covered = covered;
    live.languages = coveredLanguages(plan, covered);
    const position = await readingPosition(task.id, plan);
    const moved = Math.abs(position - live.stored.position) >= AUDIO_ORCH_BOOK_PLAN.reprioritizeMinMove;
    if (!live.stored.planId || live.stored.planHash !== task.planHash || moved) {
      try {
        const posted = await wfNewApi.postBookAudioPlan({
          sourceKey: book.sourceKey,
          chapterIndex: book.chapterIndex,
          languages,
          includeWords: task.config.pattern.some((step) => WORD_STEP_TYPES.includes(step.type)),
          position,
          planHash: task.planHash,
        });
        if (!posted.planId) throw new Error('BOOK_PLAN_EMPTY');
        if (posted.planId !== live.stored.planId) {
          live.fetched = 0;
          live.stored.cursor = 0;
          live.ready.clear();
        }
        live.stored = { ...live.stored, planId: posted.planId, planHash: task.planHash, position, status: posted };
        this.publish(task.id, live);
        this.persist(task.id);
        void pycoreApi.bookPlanHint(posted.planId).catch(() => undefined);
      } catch (error) {
        if (serverSchemaGate.observeError(error)) return null;
        if (!live.stored.planId) {
          this.live.delete(task.id);
          return null;
        }
      }
    }
    await this.sync(task.id);
    this.arm(task.id);
    void this.assign(task.id, live);
    return { covered: live.covered, ready: live.ready, direct: () => live.assignment?.direct ?? defaultDirectShare() };
  }

  /** Delivered clips leave the undelivered set; the cursor settles once nothing is left behind it. */
  consume(taskId: string, delivered: (key: string) => boolean): void {
    const live = this.live.get(taskId);
    if (!live) return;
    live.ready.forEach((key) => { if (delivered(key)) live.ready.delete(key); });
    if (live.ready.size === 0 && live.fetched > live.stored.cursor) {
      live.stored.cursor = live.fetched;
      this.persist(taskId);
    }
    this.publish(taskId, live);
  }

  /** One cursor delta: ready ids after the cursor (paged), then the counters. */
  sync(taskId: string): Promise<void> {
    const live = this.live.get(taskId);
    if (!live || !live.stored.planId) return Promise.resolve();
    live.syncing ??= this.pull(taskId, live).finally(() => { live.syncing = null; });
    return live.syncing;
  }

  private async pull(taskId: string, live: LivePlan): Promise<void> {
    if (serverSchemaGate.getSnapshot().schema === 'pending') return;
    const planId = live.stored.planId;
    let fresh = 0;
    try {
      for (;;) {
        const page = await wfNewApi.getBookAudioPlanReady(planId, live.fetched, AUDIO_ORCH_BOOK_PLAN.readyPageDefault);
        page.ids.forEach((key) => {
          if (!live.ready.has(key)) { live.ready.add(key); fresh += 1; }
        });
        live.fetched = Math.max(live.fetched, page.cursor);
        if (!page.more || page.ids.length === 0) break;
      }
      const status = await wfNewApi.getBookAudioPlan(planId);
      if (!status.planId) throw new Error('BOOK_PLAN_EMPTY');
      live.stored.status = status;
      live.backoff.reset();
      live.retryMs = 0;
    } catch (error) {
      serverSchemaGate.observeError(error);
      live.retryMs = live.backoff.next();
    }
    this.publish(taskId, live);
    if (fresh > 0) live.onNewReady?.();
  }

  /** Follow the plan: the `clip.ready` push brings a sync forward, a timer is the (relaxed) safety. */
  /**
   * App-led scheduling: spreads the plan's next pending clips over the roster and the direct pycore and
   * posts the windows (the heartbeat Laravel honors them for). Single-flight; nothing is posted while
   * Laravel is away or the plan is complete (Laravel then schedules by itself).
   */
  private assign(taskId: string, live: LivePlan): Promise<void> {
    if (!live.stored.planId || complete(live.stored.status) || !wordNewChannels.laravel()) return Promise.resolve();
    live.assigning ??= this.postAssignment(taskId, live).finally(() => { live.assigning = null; });
    return live.assigning;
  }

  private async postAssignment(taskId: string, live: LivePlan): Promise<void> {
    const directHost = wordNewChannels.direct() ? hostKey(wordNewPycoreLink.getSnapshot().selectedUrl) : '';
    live.assignment = buildAssignment({ roster: wordNewPycoreNodes.getSnapshot().nodes, directHost, languages: live.languages });
    if (live.assignment.windows.length === 0 || serverSchemaGate.getSnapshot().schema === 'pending') return;
    try {
      const assignments = await wfNewApi.postBookAudioPlanAssignments(live.stored.planId, live.stored.position, live.assignment.windows);
      if (live.stored.status) live.stored = { ...live.stored, status: { ...live.stored.status, assignments } };
      this.publish(taskId, live);
    } catch (error) {
      serverSchemaGate.observeError(error);
    }
  }

  private arm(taskId: string): void {
    const live = this.live.get(taskId);
    if (!live || live.wake) return;
    const schedule = (delayMs: number): void => {
      if (live.timer) clearTimeout(live.timer);
      live.timer = setTimeout(() => { void tick(); }, delayMs);
    };
    const tick = async (): Promise<void> => {
      live.timer = null;
      await this.sync(taskId);
      if (this.live.get(taskId) !== live) return;
      if (complete(live.stored.status)) {
        this.disarm(live);
        return;
      }
      schedule(live.retryMs > 0 ? live.retryMs : wordNewClipReady.pollDelayMs(AUDIO_ORCH_BOOK_PLAN.statusPollMs));
    };
    const stopReady = wordNewClipReady.subscribe((ids) => {
      if (ids && ![...ids].some((id) => live.covered.has(id))) return;
      schedule(READY_WAKE_DEBOUNCE_MS);
    });
    // The roster feeds the assignment: hold it while the plan is followed and post again when it changes.
    live.releaseRoster = wordNewPycoreNodes.start();
    live.rosterNodes = wordNewPycoreNodes.getSnapshot().nodes;
    const stopRoster = wordNewPycoreNodes.subscribe(() => {
      const nodes = wordNewPycoreNodes.getSnapshot().nodes;
      if (nodes === live.rosterNodes) return;
      live.rosterNodes = nodes;
      void this.assign(taskId, live);
    });
    live.assignTimer = setInterval(() => { void this.assign(taskId, live); }, AUDIO_ORCH_BOOK_PLAN.assignmentRefreshMs);
    live.wake = () => { stopReady(); stopRoster(); };
    schedule(wordNewClipReady.pollDelayMs(AUDIO_ORCH_BOOK_PLAN.statusPollMs));
  }

  private disarm(live: LivePlan): void {
    if (live.timer) clearTimeout(live.timer);
    live.timer = null;
    live.wake?.();
    live.wake = null;
    if (live.assignTimer) clearInterval(live.assignTimer);
    live.assignTimer = null;
    live.releaseRoster?.();
    live.releaseRoster = null;
  }

  private publish(taskId: string, live: LivePlan): void {
    live.snapshot = { planId: live.stored.planId, status: live.stored.status, undelivered: live.ready.size };
    this.listeners.get(taskId)?.forEach((listener) => listener());
  }

  private persist(taskId: string): void {
    const live = this.live.get(taskId);
    if (!live) return;
    this.saveTimer ??= setTimeout(() => {
      this.saveTimer = null;
      const tasks: Record<string, StoredPlan> = {};
      this.live.forEach((entry, id) => { tasks[id] = { ...entry.stored }; });
      void this.file.load().then((document) => this.file.save({ version: 1, tasks: { ...document.tasks, ...tasks } }));
    }, 2_000);
  }

  /** Local caches were cleared: the plans are re-posted (idempotent) on the next run. */
  async reset(): Promise<void> {
    this.live.forEach((live) => this.disarm(live));
    this.live.clear();
    await this.file.save({ version: 1, tasks: {} });
  }
}

export const wordNewBookAudioPlan = new WordNewBookAudioPlanService();
