/**
 * SimpleWorkerBase
 *
 * Shared base for the lightweight unified-task workers that run inside the
 * extension (e.g. the web-AI translate worker). It owns the boring parts of
 * being a laravel_main worker — registration, heartbeat, long-poll pull,
 * fast-lane re-poll, priority dispatch and result submission — and leaves each
 * subclass to declare only:
 *   - which capabilities it advertises (`capabilities`)
 *   - which task_type(s) it handles (`handlesTaskType`)
 *   - how to do one task (`executeTask`)
 *
 * Fast lane: a worker that advertises >=1 capability also subscribes to the
 * shared `remote_fast` processor lane (see withFastLane). The dispatcher then
 * hands it any fast-tier task whose `capability` matches one this worker
 * advertised. When a pull/heartbeat reports pending_fast>0 the worker fires an
 * immediate wait=0 re-poll (jittered + coalesced) instead of waiting for the
 * next long-poll tick.
 */

import {
  WorkerApiClient,
  Task,
  ProcessorType,
  WorkerCapability,
  WORKER_CAPABILITIES,
  TaskResult,
} from '../../api/WorkerApiClient';
import { ApiError } from '../../api/BaseApiClient';
import { logger } from '@/utils/logger';
import { tabController } from '../tab-controller';
import { LANES } from '@/utils/task-center-lanes';
import { FAST_LANE_CAPABILITIES } from '@/utils/queue-center-contract';
import type { ProcessorStats } from '@/utils/task-center-types';
import { submitOutbox, isTerminalWorkerResultError } from '../outbox/submit-outbox';

/**
 * Fast-lane eligibility comes from config/queue_center_contract.json. Worker
 * subclasses still advertise only capabilities they can actually execute; the
 * shared base merely decides whether those capabilities need remote_fast.
 */
const FAST_CAPABILITY_SET = new Set<WorkerCapability>(FAST_LANE_CAPABILITIES);

// The full allowed capability vocabulary (mirrors GlobalTask::CAPABILITIES
// minus the lanes Chrome can never serve from a tab). Anything outside this
// set is dropped during normalization so a typo can't register a bogus cap.
const ALLOWED_CAPABILITIES = new Set<WorkerCapability>(WORKER_CAPABILITIES);

export interface SimpleWorkerConfig {
  apiUrl: string;
  workerName?: string;
  /** Long-poll seconds for the steady-state pull. */
  pollWait?: number;
  /** Heartbeat cadence (seconds) — keeps the lease/registration fresh. */
  heartbeatInterval?: number;
  /** Max tasks to claim per pull. */
  batchSize?: number;
}

export interface SimpleWorkerStats extends ProcessorStats {
  // Fast-lane bookkeeping — the only fields beyond the canonical ProcessorStats
  // shape (the base pending/translated/failed/... live in ProcessorStats).
  pendingFast: number;
  pendingUrgent: number;
  currentTaskId: string | null;
  // A SimpleWorkerBase worker ALWAYS tracks the backend-reachability signals
  // (optional on ProcessorStats), so narrow them to required here — the poll
  // loop reads consecutiveFailures without a presence guard.
  backendOnline: boolean;
  consecutiveFailures: number;
  lastError: string | null;
  lastErrorAt: number | null;
  lastRequestAt: number | null;
}

// Once this many worker HTTP calls fail in a row the poll loop backs off to a
// slow cadence instead of the 1s hot-loop — a down backend must not be hammered.
const BACKEND_DOWN_THRESHOLD = 3;
const POLL_BACKOFF_FAST_MS = 1000;
const POLL_BACKOFF_SLOW_MS = 8000;

// Fast re-poll cadence when the backend signals pending_fast>0. Kept short but
// jittered so multiple workers don't stampede the endpoint in lockstep.
const FAST_REPOLL_BASE_MS = 400;
const FAST_REPOLL_JITTER_MS = 300;

export abstract class SimpleWorkerBase {
  protected workerClient: WorkerApiClient | null = null;
  protected config: Required<SimpleWorkerConfig> | null = null;
  protected isRunning = false;

  private pollLoopActive = false;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  // Coalesce fast re-polls: at most one scheduled burst in flight.
  private fastRepollTimer: ReturnType<typeof setTimeout> | null = null;
  // Re-entrancy guard: only one cycle() may run at a time. A fast re-poll that
  // fires while a long-poll cycle is in flight would clobber shared dispatch
  // state (terminalPosted/currentTaskId) and drive the single chat tab with two
  // tasks at once, so scheduleFastRepoll defers via needsFastRepoll instead.
  private cycleInFlight = false;
  // Set when a fast re-poll is requested while a cycle is in flight; the next
  // runPollLoop iteration then drains the fast tier with wait=0.
  private needsFastRepoll = false;
  // Set true once a terminal (completed/failed) result is posted for the task
  // currently being dispatched; lets dispatchOne fail-safe a silent handler.
  private terminalPosted = false;

  protected stats: SimpleWorkerStats = {
    pending: 0,
    translated: 0,
    failed: 0,
    lastRun: null,
    workerId: null,
    isOnline: false,
    // Required by the inherited ProcessorStats shape; these workers don't track
    // a local queue, so they stay 0 (consumers remap stats and never read them).
    queueTotal: 0,
    newTasks: 0,
    duplicateTasks: 0,
    pendingFast: 0,
    pendingUrgent: 0,
    currentTaskId: null,
    // Optimistic default: assume reachable until a request proves otherwise, so
    // a freshly-registered worker isn't reported down before its first call.
    backendOnline: true,
    consecutiveFailures: 0,
    lastError: null,
    lastErrorAt: null,
    lastRequestAt: null,
  };

  // ------------------------------------------------------------------
  // Subclass contract
  // ------------------------------------------------------------------

  /** Stable processor key, used in logs and as the worker_id prefix. */
  protected abstract get processorKey(): string;

  /** chrome.storage key under which this worker's id is persisted/reused. */
  protected abstract get workerIdStorageKey(): string;

  /** Capabilities advertised to the dispatcher (e.g. ['ai_translate']). */
  protected abstract get capabilities(): WorkerCapability[];

  /** True if this worker handles the given backend task_type. */
  protected abstract handlesTaskType(taskType: string): boolean;

  /**
   * Do one task. Implementations should submit their own completed/failed
   * result via submitResult(); returning normally without submitting is a bug,
   * so the base will defensively submit a 'failed' if nothing was posted.
   */
  protected abstract executeTask(task: Task): Promise<void>;

  /** Human label for logs. */
  protected get workerLabel(): string {
    return this.processorKey;
  }

  // ------------------------------------------------------------------
  // Capability / processor-type derivation
  // ------------------------------------------------------------------

  /**
   * Drop anything outside the allowed vocabulary and de-dupe. A worker that
   * advertises nothing valid registers with no capabilities (and therefore no
   * fast lane — see withFastLane).
   */
  protected normalizeCapabilities(caps: WorkerCapability[]): WorkerCapability[] {
    const out: WorkerCapability[] = [];
    const seen = new Set<WorkerCapability>();
    for (const c of caps) {
      if (ALLOWED_CAPABILITIES.has(c) && !seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
    return out;
  }

  /**
   * The processor lanes to register. A worker with a fast-eligible capability
   * subscribes to the shared `remote_fast` lane so the dispatcher can route
   * matching fast-tier tasks to it; a capability-less worker gets just its
   * explicit lanes (none, by default).
   */
  protected withFastLane(
    baseLanes: ProcessorType[],
    caps: WorkerCapability[],
  ): ProcessorType[] {
    const lanes = [...baseLanes];
    if (caps.some((capability) => FAST_CAPABILITY_SET.has(capability))
      && !lanes.includes(LANES.REMOTE_FAST)) {
      lanes.push(LANES.REMOTE_FAST);
    }
    return lanes;
  }

  /** Dedicated lanes beyond remote_fast. Most fast workers own none. */
  protected get baseProcessorTypes(): ProcessorType[] {
    return [];
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  async start(config: SimpleWorkerConfig): Promise<void> {
    if (this.isRunning) {
      logger.warn(this.workerLabel, 'Worker already running');
      return;
    }
    if (!config.apiUrl) {
      throw new Error('API URL is required');
    }

    // A rapid Stop -> Start must not replace workerClient/config while the
    // previous claimed task is still submitting its terminal result. Wait for
    // that single serialized cycle to settle, then register the new run.
    while (this.cycleInFlight) {
      await this.delay(50);
    }

    this.config = {
      apiUrl: config.apiUrl.trim().replace(/\/+$/, ''),
      workerName: config.workerName || `MCP Chrome ${this.processorKey} Worker`,
      pollWait: config.pollWait ?? 20,
      heartbeatInterval: config.heartbeatInterval ?? 12,
      batchSize: config.batchSize ?? 3,
    };

    this.workerClient = new WorkerApiClient(this.config.apiUrl);
    await this.register();

    this.isRunning = true;
    this.startHeartbeat();
    this.startPollLoop();

    logger.info(this.workerLabel, 'Worker started', {
      capabilities: this.normalizeCapabilities(this.capabilities),
    });
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.heartbeatId) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
    if (this.fastRepollTimer) {
      clearTimeout(this.fastRepollTimer);
      this.fastRepollTimer = null;
    }
    // Do not clear pollLoopActive/cycleInFlight here. A browser task may still
    // be unwinding after Stop; clearing its mutex would let a rapid off/on
    // toggle launch a second task against the same tab. If Start arrives before
    // the loop observes isRunning=false, that loop is safely reused. Otherwise
    // runPollLoop clears pollLoopActive when it exits and the next Start creates
    // a fresh loop.
    this.needsFastRepoll = false;
    this.stats.isOnline = false;
    logger.info(this.workerLabel, 'Worker stopped');
  }

  getStatus(): { isRunning: boolean; stats: SimpleWorkerStats } {
    return { isRunning: this.isRunning, stats: { ...this.stats } };
  }

  /**
   * Backend-reachability snapshot for the Task Center aggregate (get_status).
   * Reflects this worker's most recent HTTP outcome against Laravel.
   */
  getBackendHealth(): {
    online: boolean;
    lastError: string | null;
    lastRequestAt: number | null;
    consecutiveFailures: number;
  } {
    return {
      online: this.stats.backendOnline,
      lastError: this.stats.lastError,
      lastRequestAt: this.stats.lastRequestAt,
      consecutiveFailures: this.stats.consecutiveFailures,
    };
  }

  // ------------------------------------------------------------------
  // Backend-reachability bookkeeping
  // ------------------------------------------------------------------

  /** Record a successful worker HTTP call: backend is up, failure streak reset. */
  protected noteBackendSuccess(): void {
    this.stats.backendOnline = true;
    this.stats.consecutiveFailures = 0;
    this.stats.lastRequestAt = Date.now();
  }

  /** Record a failed worker HTTP call: backend is down, bump the failure streak. */
  protected noteBackendFailure(error: unknown): void {
    this.stats.backendOnline = false;
    this.stats.consecutiveFailures++;
    this.stats.lastError = this.describeError(error);
    this.stats.lastErrorAt = Date.now();
  }

  /**
   * True for an EXPECTED long-poll timeout — the server accepted the poll but did
   * not return within our client budget (ApiError 408 / 'Request timeout' /
   * AbortError). These are normal for a wait>0 pull and must NOT be logged at
   * error or counted as a backend failure.
   */
  protected isExpectedTimeout(error: unknown): boolean {
    const e = error as any;
    if (e instanceof ApiError && e.statusCode === 408) return true;
    const name = typeof e?.name === 'string' ? e.name : '';
    const msg = typeof e?.message === 'string' ? e.message : '';
    return name === 'AbortError' || name === 'Request timeout' || msg === 'Request timeout';
  }

  private describeError(error: unknown): string {
    const e = error as any;
    if (e?.message) return String(e.message);
    return String(e ?? 'unknown error');
  }

  // ------------------------------------------------------------------
  // Registration / heartbeat
  // ------------------------------------------------------------------

  protected async register(): Promise<void> {
    if (!this.workerClient || !this.config) {
      throw new Error('Worker client not initialized');
    }

    const caps = this.normalizeCapabilities(this.capabilities);
    const processorTypes = this.withFastLane(this.baseProcessorTypes, caps);

    // Reuse a persisted worker_id when present so re-registration keeps lease
    // continuity; otherwise mint a fresh namespaced id.
    let workerId: string | null = null;
    try {
      const stored = await chrome.storage.session.get(this.workerIdStorageKey);
      workerId = stored?.[this.workerIdStorageKey] || null;
    } catch {
      /* storage optional */
    }
    if (!workerId) {
      workerId = `mcp-chrome-${this.processorKey}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 11)}`;
      try {
        await chrome.storage.session.set({ [this.workerIdStorageKey]: workerId });
      } catch {
        /* best-effort */
      }
    }

    let response;
    try {
      response = await this.workerClient.register({
        worker_id: workerId,
        worker_name: this.config.workerName,
        processor_types: processorTypes,
        capabilities: caps,
        hostname: 'chrome-extension',
        platform: navigator.userAgent,
        metadata: {
          version: chrome.runtime.getManifest().version,
          extensionId: chrome.runtime.id,
          processor: this.processorKey,
        },
      });
    } catch (error) {
      this.noteBackendFailure(error);
      throw error;
    }

    if (response.success && response.data) {
      this.stats.workerId = response.data.worker_id;
      this.stats.isOnline = true;
      this.noteBackendSuccess();
      logger.info(this.workerLabel, 'Registered', {
        worker_id: response.data.worker_id,
        processor_types: processorTypes,
        capabilities: caps,
      });
    } else {
      this.noteBackendFailure(new Error(response.message || 'Registration failed'));
      throw new Error(response.message || 'Registration failed');
    }
  }

  private startHeartbeat(): void {
    if (!this.workerClient || !this.config) return;
    const beat = async () => {
      if (!this.isRunning || !this.workerClient) return;
      try {
        const resp = await this.workerClient.heartbeat();
        this.stats.isOnline = true;
        this.noteBackendSuccess();
        if (resp.success && resp.data) {
          this.noteFastSignals(resp.data.pending_urgent, resp.data.pending_fast);
        }
      } catch (error) {
        this.stats.isOnline = false;
        // Heartbeat failures stay quiet (warn) but still flip backendOnline off.
        this.noteBackendFailure(error);
        logger.warn(this.workerLabel, 'Heartbeat failed', error);
      }
    };
    beat();
    this.heartbeatId = setInterval(beat, this.config.heartbeatInterval * 1000);
  }

  // ------------------------------------------------------------------
  // Poll loop + fast lane
  // ------------------------------------------------------------------

  private startPollLoop(): void {
    if (this.pollLoopActive) return;
    this.pollLoopActive = true;
    void this.runPollLoop();
  }

  /**
   * Steady-state long-poll loop. Each iteration runs one cycle() with the
   * configured wait; cycle() reacts to pending_fast by scheduling an immediate
   * wait=0 burst. The ~heartbeatInterval keeps the lease fresh independently.
   */
  private async runPollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // If a fast re-poll was deferred while a cycle was in flight, drain the
        // fast tier now with wait=0 instead of a long poll.
        const wait = this.needsFastRepoll ? 0 : (this.config?.pollWait ?? 20);
        this.needsFastRepoll = false;
        await this.cycle(wait);
      } catch (error) {
        if (this.isExpectedTimeout(error)) {
          // Expected long-poll timeout: the server just didn't hand us work in
          // time. Quiet (debug) and NOT a backend failure — don't flip online.
          logger.debug(this.workerLabel, 'Long-poll pull timed out (expected)', error);
        } else {
          this.noteBackendFailure(error);
          logger.error(this.workerLabel, 'Poll cycle error', error);
        }
        // Back off longer once the backend looks down so a dead Laravel is not
        // hammered every second; otherwise a brief pause avoids a hot-loop.
        const backoff =
          this.stats.consecutiveFailures >= BACKEND_DOWN_THRESHOLD
            ? POLL_BACKOFF_SLOW_MS
            : POLL_BACKOFF_FAST_MS;
        await this.delay(backoff);
      }
    }
    this.pollLoopActive = false;
  }

  /**
   * One pull+dispatch cycle.
   *
   * 1. Pull a batch (long-poll `wait` seconds, or 0 for a fast burst).
   * 2. Record pending_fast/pending_urgent; if pending_fast>0 schedule an
   *    immediate jittered+coalesced wait=0 re-poll.
   * 3. Sort the claimed tasks by priority desc and dispatch each.
   */
  protected async cycle(wait: number): Promise<void> {
    // Serialize: never run two cycles concurrently. A fast re-poll firing while
    // a long-poll cycle is in flight would interleave two dispatchOne calls on
    // shared terminalPosted/currentTaskId and drive the single chat tab with two
    // tasks at once. Concurrent callers no-op; scheduleFastRepoll defers via
    // needsFastRepoll so the fast tier is still drained promptly.
    if (this.cycleInFlight) return;
    this.cycleInFlight = true;
    try {
      if (!this.workerClient || !this.config) return;

      // Yield to the user: if a human is actively switching tabs (TabController),
      // skip pulling/driving a page this cycle. Transient - auto-resumes when the
      // interference pause clears. (Interactive, user-invoked tool calls are NOT
      // gated - only these background worker cycles.)
      if (tabController.isPaused()) return;

      this.stats.lastRun = Date.now();

      const resp = await this.workerClient.pullTasks(undefined, {
        limit: this.config.batchSize,
        wait,
      });

      // A returned response (even an empty batch) proves the backend is up.
      this.noteBackendSuccess();

      if (!resp.success || !resp.data) {
        return;
      }

      this.noteFastSignals(resp.data.pending_urgent, resp.data.pending_fast);

      const tasks = Array.isArray(resp.data.tasks) ? resp.data.tasks : [];
      this.stats.pending = tasks.length;
      if (tasks.length === 0) return;

      // Highest priority first.
      tasks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      for (const task of tasks) {
        // Honor stop() between batch items so a Stop halts further dispatch
        // promptly instead of draining the whole claimed batch.
        if (!this.isRunning) break;
        await this.dispatchOne(task);
      }
    } finally {
      this.cycleInFlight = false;
    }
  }

  /**
   * Record fast/urgent backlog signals and trigger a fast re-poll burst when
   * the backend says there is fast-tier work waiting. The burst is jittered and
   * coalesced (only one scheduled at a time) so concurrent workers don't
   * stampede the pull endpoint.
   */
  protected noteFastSignals(pendingUrgent?: number, pendingFast?: number): void {
    this.stats.pendingUrgent = pendingUrgent ?? 0;
    this.stats.pendingFast = pendingFast ?? 0;
    if ((pendingFast ?? 0) > 0) {
      this.scheduleFastRepoll();
    }
  }

  private scheduleFastRepoll(): void {
    if (!this.isRunning) return;
    // Ensure the next poll-loop iteration drains the fast tier with wait=0,
    // even if the immediate cycle(0) below no-ops because a cycle is in flight.
    this.needsFastRepoll = true;
    if (this.fastRepollTimer) return; // coalesce - one burst in flight
    const jitter = Math.floor(Math.random() * FAST_REPOLL_JITTER_MS);
    this.fastRepollTimer = setTimeout(() => {
      this.fastRepollTimer = null;
      if (!this.isRunning) return;
      // wait=0: drain whatever fast-tier work matched our capabilities now.
      // cycle()'s cycleInFlight guard prevents overlap with an in-flight cycle;
      // needsFastRepoll (set above) guarantees the poll loop re-drains if this
      // no-opped because a cycle was in flight.
      this.cycle(0).catch((error) =>
        logger.warn(this.workerLabel, 'Fast re-poll failed', error),
      );
    }, FAST_REPOLL_BASE_MS + jitter);
  }

  // ------------------------------------------------------------------
  // Dispatch + result
  // ------------------------------------------------------------------

  /**
   * Route one task. Unhandled task_types are NOT silently dropped — per
   * CHROME-CAP-1 we submit a 'failed' result so the task is released and
   * re-routed to a worker that can serve it.
   */
  private async dispatchOne(task: Task): Promise<void> {
    if (!this.workerClient) return;
    // Honor stop(): if the worker was stopped while this task was queued in the
    // claimed batch, skip dispatch (the backend reclaims it on timeout).
    if (!this.isRunning) return;

    if (!this.handlesTaskType(task.task_type)) {
      // CHROME-CAP-1: release-by-failure, never a silent skip.
      try {
        await this.submitResult(task.task_id, 'failed', undefined, {
          error: `unhandled task_type: ${task.task_type}`,
        });
      } catch (error) {
        logger.warn(this.workerLabel, 'Failed to release unhandled task', error);
      }
      return;
    }

    this.stats.currentTaskId = task.task_id;
    this.terminalPosted = false;

    try {
      await this.executeTask(task);
      if (!this.terminalPosted) {
        // Defensive: a handler that returned without posting a terminal result.
        await this.submitResult(task.task_id, 'failed', undefined, {
          error: 'worker produced no result',
        });
      }
    } catch (error: any) {
      try {
        await this.submitResult(task.task_id, 'failed', undefined, {
          error: error?.message || 'Unknown worker error',
        });
      } catch (submitError) {
        logger.error(this.workerLabel, 'Failed to submit error result', submitError);
      }
      // stats.failed is incremented inside submitResult('failed') above;
      // no separate increment here to avoid double-counting.
    } finally {
      this.stats.currentTaskId = null;
    }
  }

  /**
   * Submit a result to the worker result endpoint. Subclasses call this from
   * executeTask. Tracks whether a terminal (completed/failed) result was posted
   * so dispatchOne can fail-safe a handler that returned without one.
   */
  protected async submitResult(
    taskId: string,
    status: TaskResult['status'],
    result?: TaskResult['result'],
    extra?: { error?: string; progress?: number },
  ): Promise<void> {
    if (!this.workerClient) return;
    const payload: TaskResult = {
      task_id: taskId,
      worker_id: this.stats.workerId || '',
      status,
    };
    if (result !== undefined) payload.result = result;
    if (extra?.error !== undefined) payload.error = extra.error;
    if (extra?.progress !== undefined) payload.progress = extra.progress;
    // Submit; on a NON-terminal failure hand the result to the persistent outbox
    // so it is durably owned and retried forever (the "results are LOST on
    // backend interruption" fix). A TERMINAL failure (409 / task reassigned) can
    // never be accepted, so it is dropped, not enqueued.
    try {
      await this.workerClient.submitResult(payload);
      // Backend proved reachable — opportunistically flush queued retries.
      submitOutbox.drainNow();
    } catch (error) {
      if (isTerminalWorkerResultError(error)) {
        logger.warn(
          this.workerLabel,
          'Result submit terminal (task reassigned) — dropping result',
          error,
        );
      } else {
        await submitOutbox.enqueue({
          kind: 'worker_result',
          baseUrl: this.config?.apiUrl || this.workerClient.getBaseUrl(),
          payload,
        });
        logger.warn(this.workerLabel, 'Result submit failed — queued to outbox for retry', error);
      }
    }
    // The result is now delivered OR durably owned by the outbox (or terminal):
    // mark terminal + bump stats so dispatchOne's safety-net does not re-submit.
    if (status === 'completed' || status === 'failed') {
      this.terminalPosted = true;
    }
    if (status === 'completed') this.stats.translated++;
    if (status === 'failed') this.stats.failed++;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
