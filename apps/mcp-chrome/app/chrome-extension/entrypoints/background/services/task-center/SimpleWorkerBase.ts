/**
 * SimpleWorkerBase
 *
 * Shared base for the lightweight unified-task workers that run inside the
 * extension (e.g. the web-AI translate worker). It owns the boring parts of
 * being a laravel_main worker — registration, heartbeat, immediate pull,
 * fast-lane re-poll, queue-ordered dispatch and result submission — and leaves each
 * subclass to declare only:
 *   - which capabilities it advertises (`capabilities`)
 *   - which task_type(s) it handles (`handlesTaskType`)
 *   - how to do one task (`executeTask`)
 *
 * Fast lane: a worker advertising a centrally fast-eligible capability also
 * subscribes to `remote_fast` (see withFastLane). The dispatcher then
 * hands it any fast-tier task whose `capability` matches one this worker
 * advertised. When a pull/heartbeat reports pending_fast>0 the worker fires an
 * immediate re-poll (jittered + coalesced) instead of waiting for the fallback
 * reconciliation interval.
 */

import {
  Task,
  ProcessorType,
  WorkerCapability,
  WORKER_CAPABILITIES,
  TaskResult,
} from '../../api/WorkerApiClient';
import { LaravelWorkerLifecycleBase } from './LaravelWorkerLifecycleBase';
import { ApiError } from '../../api/BaseApiClient';
import { logger } from '@/utils/logger';
import { tabController } from '../tab-controller';
import { LANES } from '@/utils/task-center-lanes';
import {
  FAST_LANE_CAPABILITIES,
  DIFF_DELIVERY,
  QUEUE_CENTER_REALTIME_EVENTS,
  TASK_LIMITS,
  TASK_TYPE_KEYS,
  TASK_STATUS_BY_ROLE,
  compareTasksByContract,
  workerResultStatus,
} from '@/utils/queue-center-contract';
import type { ProcessorStats } from '@/utils/task-center-types';
import { submitOutbox, isTerminalWorkerResultError } from '../outbox/submit-outbox';
import { queueCenterWakeService } from './QueueCenterWakeService';
import type { QueueCenterWakeSignal } from './QueueCenterWakeService';
import { diffTaskSegmentStore } from '@/utils/diff-task-segments';
import { IntervalController, TimeoutController, delay as wait } from '@/utils/async';

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
  /** Fallback reconciliation interval in seconds. */
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
  progressCompleted: number;
  progressTotal: number;
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
const REGISTRATION_RETRY_MS = 3000;
const QUEUE_DIFF_POLL_MS = Math.max(250, Number(DIFF_DELIVERY.poll_interval_ms || 1000));
const QUEUE_HEAD_RESERVE = Math.max(1, Math.floor(Number(DIFF_DELIVERY.head_reserve || 1)));

export abstract class SimpleWorkerBase extends LaravelWorkerLifecycleBase {
  protected config: Required<SimpleWorkerConfig> | null = null;
  protected isRunning = false;

  private pollLoopActive = false;
  private readonly heartbeatPolling = new IntervalController();
  private readonly diffPolling = new IntervalController();
  private diffPollInFlight = false;
  // Coalesce fast re-polls: at most one scheduled burst in flight.
  private readonly fastRepollTimeout = new TimeoutController();
  private readonly registrationRetryTimeout = new TimeoutController();
  private registrationPending = false;
  private wakeUnsubscribe: (() => void) | null = null;
  // Re-entrancy guard: only one cycle() may run at a time. A realtime wake that
  // fires while a pull cycle is in flight would clobber shared dispatch
  // state (terminalPosted/currentTaskId) and drive the single chat tab with two
  // tasks at once, so scheduleFastRepoll defers via needsFastRepoll instead.
  private cycleInFlight = false;
  // Set when a fast re-poll is requested while a cycle is in flight; the next
  // runPollLoop iteration then drains the fast tier immediately.
  private needsFastRepoll = false;
  private queueSliceLimits = new Map<string, number>();
  // Set true once a terminal (completed/failed) result is posted for the task
  // currently being dispatched; lets dispatchOne fail-safe a silent handler.
  private terminalPosted = false;
  // task_type of the task currently being dispatched — the typed result route
  // (/api/worker/tasks/{taskType}/result) needs it at submit time.
  private currentTaskType: string | null = null;
  private currentTaskAttempt: number | null = null;
  private readonly headPositions = new Map<string, number>();
  private readonly queueDiffCursors = new Map<string, number>();
  private readonly queueProgressByTaskType = new Map<string, { completed: number; total: number }>();
  private readonly prefetchedHeadTasks: Task[] = [];
  private headPrefetchInFlight = false;
  private bufferedTaskCount = 0;
  private pullTaskTypeCursor = 0;

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
    progressCompleted: 0,
    progressTotal: 0,
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

  /** Task types pulled via the typed pull route (/api/worker/tasks/{type}/pull).
   * Every type uses the same immediate-return transport. */
  protected abstract get pullTaskTypes(): string[];

  /** False for assist-only workers that do not register with global_tasks. */
  protected get globalTaskPollingEnabled(): boolean {
    return true;
  }

  /** Shared processor adapters delegate here instead of duplicating task rules. */
  public canHandleTaskType(taskType: string): boolean {
    return this.handlesTaskType(taskType);
  }

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
      pollWait: config.pollWait ?? TASK_LIMITS.long_poll_seconds,
      heartbeatInterval: config.heartbeatInterval ?? 12,
      batchSize: config.batchSize ?? TASK_LIMITS.worker_pull_default,
    };

    this.isRunning = true;
    this.connectWorkerApi(this.config.apiUrl);
    if (!this.globalTaskPollingEnabled) {
      this.stats.isOnline = true;
      logger.info(this.workerLabel, 'Assist-only worker started');
      return;
    }
    try {
      await this.register();
      this.activateRegisteredWorker();
    } catch (error) {
      if (!this.isTransientRegistrationError(error)) {
        this.isRunning = false;
        throw error;
      }
      logger.warn(this.workerLabel, 'Worker registration deferred; automatic recovery is active', error);
      this.scheduleRegistrationRetry();
    }
  }

  stop(): void {
    const workerId = this.stats.workerId;
    const prefetchedTasks = this.prefetchedHeadTasks.splice(0);

    if (!this.isRunning) return;
    this.isRunning = false;
    this.heartbeatPolling.stop();
    this.diffPolling.stop();
    this.fastRepollTimeout.cancel();
    this.registrationRetryTimeout.cancel();
    if (this.wakeUnsubscribe) {
      this.wakeUnsubscribe();
      this.wakeUnsubscribe = null;
    }
    // Do not clear pollLoopActive/cycleInFlight here. A browser task may still
    // be unwinding after Stop; clearing its mutex would let a rapid off/on
    // toggle launch a second task against the same tab. If Start arrives before
    // the loop observes isRunning=false, that loop is safely reused. Otherwise
    // runPollLoop clears pollLoopActive when it exits and the next Start creates
    // a fresh loop.
    this.needsFastRepoll = false;
    this.stats.isOnline = false;
    if (!this.globalTaskPollingEnabled) {
      logger.info(this.workerLabel, 'Assist-only worker stopped');
      return;
    }
    if (this.workerClient && prefetchedTasks.length > 0) {
      void this.workerClient.releaseTasks(prefetchedTasks).catch((error) => {
        logger.warn(this.workerLabel, 'Failed to release prefetched tasks during stop', error);
      });
    }
    this.unregisterWorkerPresence(workerId, (error) => {
      logger.warn(this.workerLabel, 'Worker unregister failed; heartbeat expiry remains active', error);
    });
    logger.info(this.workerLabel, 'Worker stopped');
  }

  private activateRegisteredWorker(): void {
    if (!this.isRunning) return;
    if (!this.wakeUnsubscribe && this.config) {
      this.wakeUnsubscribe = queueCenterWakeService.subscribe(
        this.config.apiUrl,
        (signal) => {
          this.applyHeadSignal(signal);
          this.needsFastRepoll = true;
          void this.prefetchChangedHead().finally(() => this.scheduleFastRepoll());
        },
      );
    }
    this.startHeartbeat();
    this.startQueueDiffPoll();
    this.startPollLoop();
    logger.info(this.workerLabel, 'Worker started', {
      capabilities: this.normalizeCapabilities(this.capabilities),
    });
  }

  private isTransientRegistrationError(error: unknown): boolean {
    if (error instanceof ApiError) {
      return error.statusCode === 408 || (error.statusCode ?? 0) >= 500;
    }
    return error instanceof TypeError;
  }

  private scheduleRegistrationRetry(): void {
    if (
      !this.isRunning
      || this.registrationRetryTimeout.isScheduled
      || this.registrationPending
    ) return;
    this.registrationRetryTimeout.schedule(async () => {
      if (!this.isRunning) return;
      this.registrationPending = true;
      try {
        await this.register();
        this.activateRegisteredWorker();
      } catch (error) {
        if (!this.isTransientRegistrationError(error)) {
          this.isRunning = false;
          logger.error(this.workerLabel, 'Worker registration rejected', error);
          return;
        }
        logger.warn(this.workerLabel, 'Worker registration retry failed', error);
      } finally {
        this.registrationPending = false;
      }
      if (this.isRunning && !this.stats.isOnline) {
        this.scheduleRegistrationRetry();
      }
    }, REGISTRATION_RETRY_MS);
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
    this.stats.lastError = null;
    this.stats.lastErrorAt = null;
    this.stats.lastRequestAt = Date.now();
  }

  /** Record a failed worker HTTP call: backend is down, bump the failure streak. */
  protected noteBackendFailure(error: unknown): void {
    this.stats.backendOnline = false;
    this.stats.consecutiveFailures++;
    this.stats.lastError = this.describeError(error);
    this.stats.lastErrorAt = Date.now();
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
      response = await this.registerWorkerPresence({
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
    if (this.heartbeatPolling.isRunning) return;
    const beat = async () => {
      if (!this.isRunning || !this.workerClient) return;
      try {
        const resp = await this.heartbeatWorkerPresence(
          this.normalizeCapabilities(this.capabilities),
        );
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
    this.heartbeatPolling.start(() => void beat(), this.config.heartbeatInterval * 1000);
  }

  // ------------------------------------------------------------------
  // Poll loop + fast lane
  // ------------------------------------------------------------------

  private startQueueDiffPoll(): void {
    if (this.diffPolling.isRunning) return;
    const poll = async () => {
      if (!this.isRunning || !this.workerClient || this.diffPollInFlight) return;
      this.diffPollInFlight = true;
      try {
        const changedTaskTypes: string[] = [];
        for (const taskType of this.pullTaskTypes) {
          const cursor = this.queueDiffCursors.get(taskType) ?? 0;
          const response = await this.workerClient.queueDiff(taskType, cursor);
          if (!response.success || !response.data) continue;
          this.updateQueueProgress(taskType, response.data.progress);
          const sliceLimit = Number(response.data.slice_limit || 0);
          if (sliceLimit > 0) this.queueSliceLimits.set(taskType, sliceLimit);
          if (!response.data.changed) continue;
          changedTaskTypes.push(taskType);
        }
        this.noteBackendSuccess();
        if (changedTaskTypes.length > 0) {
          this.needsFastRepoll = true;
          await this.prefetchChangedHead(changedTaskTypes);
          this.scheduleFastRepoll();
        }
      } catch (error) {
        this.noteBackendFailure(error);
      } finally {
        this.diffPollInFlight = false;
      }
    };
    void poll();
    this.diffPolling.start(() => void poll(), QUEUE_DIFF_POLL_MS);
  }

  private startPollLoop(): void {
    if (this.pollLoopActive) return;
    this.pollLoopActive = true;
    void this.runPollLoop();
  }

  /**
   * Fallback reconciliation loop. Realtime wakes schedule immediate pulls;
   * this bounded interval recovers work if a socket signal is missed.
   */
  private async runPollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.needsFastRepoll = false;
        await this.cycle();
        await this.delay(Math.max(1, this.config?.pollWait ?? 5) * 1000);
      } catch (error) {
        this.noteBackendFailure(error);
        logger.error(this.workerLabel, 'Poll cycle error', error);
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
   * 1. Pull an immediate bounded batch.
   * 2. Record pending_fast/pending_urgent; if pending_fast>0 schedule an
   *    immediate jittered and coalesced re-poll.
   * 3. Dispatch every task by its contract-owned ordering field.
   */
  /**
   * Pull across this worker's declared task types via the typed pull route.
   * The merged response mirrors one Laravel pull body.
   */
  private async pullTasksAcrossTypes(options: {
    limit: number;
    preferRemote?: boolean;
    taskTypes?: string[];
  }) {
    const configuredTypes = this.pullTaskTypes;
    const declaredTypes = new Set(configuredTypes);
    const sourceTypes = options.taskTypes?.length ? options.taskTypes : configuredTypes;
    const types = sourceTypes.filter(
      (taskType) => declaredTypes.has(taskType) && typeof taskType === 'string' && taskType.length > 0,
    );
    if (types.length > 1) {
      const offset = this.pullTaskTypeCursor % types.length;
      this.pullTaskTypeCursor = (offset + 1) % types.length;
      types.push(...types.splice(0, offset));
    }
    if (!this.workerClient || types.length === 0) {
      return {
        success: true,
        data: { count: 0, pending_urgent: 0, pending_fast: 0, tasks: [] as Task[] },
      };
    }
    const merged: Task[] = [];
    let lastData: any = { count: 0, pending_urgent: 0, pending_fast: 0, tasks: [] as Task[] };
    let pendingUrgent = 0;
    let pendingFast = 0;
    for (let i = 0; i < types.length; i++) {
      const remaining = Math.max(0, options.limit - merged.length);
      if (remaining <= 0) break;
      const contractLimit = Number(DIFF_DELIVERY.consumer_batch_limits?.[types[i]] || remaining);
      const sliceLimit = this.queueSliceLimits.get(types[i]) ?? contractLimit;
      const resp = await this.workerClient.pullTasks(types[i], undefined, {
        limit: Math.min(remaining, Math.max(1, sliceLimit)),
        preferRemote: options.preferRemote,
      });
      if (!resp.success || !resp.data) {
        if (merged.length === 0) return resp;
        break;
      }
      lastData = resp.data;
      pendingUrgent += Number(resp.data.pending_urgent || 0);
      pendingFast += Number(resp.data.pending_fast || 0);
      if (Array.isArray(resp.data.tasks)) merged.push(...resp.data.tasks);
      if (resp.data.queue_cursor != null) {
        this.queueDiffCursors.set(types[i], Number(resp.data.queue_cursor));
      }
      if (resp.data.progress) {
        this.updateQueueProgress(types[i], resp.data.progress);
      }
      if (merged.length >= options.limit) break;
    }
    lastData = {
      ...lastData,
      pending_urgent: pendingUrgent,
      pending_fast: pendingFast,
      tasks: merged,
      count: merged.length,
    };
    return { success: true, data: lastData };
  }

  private async prefetchChangedHead(taskTypes?: string[]): Promise<void> {
    if (!this.isRunning || !this.workerClient || !this.config || this.headPrefetchInFlight) return;
    if (tabController.isPaused()) return;
    const batchSize = Math.max(1, Math.floor(this.config.batchSize));
    const activeCount = this.bufferedTaskCount
      + this.prefetchedHeadTasks.length
      + (this.stats.currentTaskId ? 1 : 0);
    const limit = Math.min(QUEUE_HEAD_RESERVE, Math.max(0, batchSize - activeCount));
    if (limit <= 0) return;

    this.headPrefetchInFlight = true;
    try {
      const response = await this.pullTasksAcrossTypes({
        limit,
        preferRemote: true,
        taskTypes,
      });
      if (!response.success || !response.data || !Array.isArray(response.data.tasks)) return;
      this.noteBackendSuccess();
      this.noteFastSignals(response.data.pending_urgent, response.data.pending_fast);
      if (!this.isRunning) {
        await this.workerClient.releaseTasks(response.data.tasks);
        return;
      }
      const knownTaskIds = new Set(this.prefetchedHeadTasks.map((task) => task.task_id));
      if (this.stats.currentTaskId) knownTaskIds.add(this.stats.currentTaskId);
      for (const task of response.data.tasks) {
        if (knownTaskIds.has(task.task_id)) continue;
        this.prefetchedHeadTasks.push(task);
        knownTaskIds.add(task.task_id);
      }
    } catch (error) {
      this.noteBackendFailure(error);
    } finally {
      this.headPrefetchInFlight = false;
    }
  }

  private takePrefetchedHeadTasks(): Task[] {
    return this.prefetchedHeadTasks.splice(0);
  }

  protected async cycle(): Promise<void> {
    // Serialize: never run two cycles concurrently. A fast re-poll firing while
    // a pull cycle is in flight would interleave two dispatchOne calls on
    // shared terminalPosted/currentTaskId and drive the single chat tab with two
    // tasks at once. Concurrent callers no-op; scheduleFastRepoll defers via
    // needsFastRepoll so the fast tier is still drained promptly.
    if (this.cycleInFlight) return;
    this.cycleInFlight = true;
    const pendingTasks: Task[] = [];
    try {
      if (!this.workerClient || !this.config) return;

      // Yield to the user: if a human is actively switching tabs (TabController),
      // skip pulling/driving a page this cycle. Transient - auto-resumes when the
      // interference pause clears. (Interactive, user-invoked tool calls are NOT
      // gated - only these background worker cycles.)
      if (tabController.isPaused()) return;

      this.stats.lastRun = Date.now();
      const batchSize = Math.max(1, Math.floor(this.config.batchSize));
      const reserve = Math.min(Math.max(0, batchSize - 1), QUEUE_HEAD_RESERVE);
      const normalWindowLimit = Math.max(1, batchSize - reserve);
      pendingTasks.push(...this.takePrefetchedHeadTasks());
      const initialLimit = Math.max(0, normalWindowLimit - pendingTasks.length);
      if (initialLimit > 0) {
        const preferRemote = this.needsFastRepoll;
        if (preferRemote) this.needsFastRepoll = false;
        const response = await this.pullTasksAcrossTypes({ limit: initialLimit, preferRemote });
        this.noteBackendSuccess();
        if (!response.success || !response.data) return;
        this.noteFastSignals(response.data.pending_urgent, response.data.pending_fast);
        if (Array.isArray(response.data.tasks)) pendingTasks.push(...response.data.tasks);
      }

      this.bufferedTaskCount = pendingTasks.length;
      this.stats.pending = pendingTasks.length;
      while (this.isRunning) {
        pendingTasks.push(...this.takePrefetchedHeadTasks());
        if (pendingTasks.length === 0) {
          if (!this.needsFastRepoll) break;
          this.needsFastRepoll = false;
          const response = await this.pullTasksAcrossTypes({
            limit: batchSize,
            preferRemote: true,
          });
          if (!response.success || !response.data) break;
          this.noteFastSignals(response.data.pending_urgent, response.data.pending_fast);
          if (Array.isArray(response.data.tasks)) pendingTasks.push(...response.data.tasks);
          if (pendingTasks.length === 0) break;
        }
        pendingTasks.sort((left, right) => this.compareTasks(left, right));
        const task = pendingTasks.shift();
        this.bufferedTaskCount = pendingTasks.length;
        if (!task) break;
        // Honor stop() between batch items so a Stop halts further dispatch
        // promptly instead of draining the whole claimed batch.
        if (!this.isRunning) break;
        await this.dispatchOne(task);
        this.headPositions.delete(task.task_id);
        pendingTasks.push(...this.takePrefetchedHeadTasks());
        const preferRemote = this.needsFastRepoll;
        const targetWindow = preferRemote ? batchSize : normalWindowLimit;
        const refillLimit = Math.max(0, targetWindow - pendingTasks.length);
        if (refillLimit > 0) {
          if (preferRemote) this.needsFastRepoll = false;
          const refill = await this.pullTasksAcrossTypes({
            limit: refillLimit,
            preferRemote,
          });
          if (!refill.success || !refill.data) break;
          if (Array.isArray(refill.data.tasks)) pendingTasks.push(...refill.data.tasks);
          this.noteFastSignals(refill.data.pending_urgent, refill.data.pending_fast);
        } else if (preferRemote) {
          // Keep the diff wake pending until a bounded window slot becomes free.
          this.needsFastRepoll = true;
        }
        this.bufferedTaskCount = pendingTasks.length;
        this.stats.pending = pendingTasks.length;
        if (this.needsFastRepoll && pendingTasks.length < batchSize) {
          this.needsFastRepoll = false;
          const refill = await this.pullTasksAcrossTypes({
            limit: batchSize - pendingTasks.length,
            preferRemote: true,
          });
          if (refill.success && refill.data && Array.isArray(refill.data.tasks)) {
            pendingTasks.push(...refill.data.tasks);
            this.noteFastSignals(refill.data.pending_urgent, refill.data.pending_fast);
          }
        }
      }
    } finally {
      this.bufferedTaskCount = 0;
      if (this.workerClient && pendingTasks.length > 0) {
        try {
          await this.workerClient.releaseTasks(pendingTasks);
        } catch (error) {
          logger.warn(this.workerLabel, 'Failed to release undispatched task segment', error);
        }
      }
      this.cycleInFlight = false;
      if (this.isRunning && this.prefetchedHeadTasks.length > 0) this.scheduleFastRepoll();
    }
  }

  private applyHeadSignal(signal?: QueueCenterWakeSignal): void {
    if (signal?.event !== QUEUE_CENTER_REALTIME_EVENTS.word_audio_head
      && signal?.event !== QUEUE_CENTER_REALTIME_EVENTS.sentence_audio_head) return;
    const rawItems = signal.payload?.items;
    const items = Array.isArray(rawItems) ? rawItems : [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const taskId = String((item as any).task_id || '').trim();
      const queuePosition = Number((item as any).queue_position || 0);
      if (!taskId) continue;
      this.headPositions.set(taskId, queuePosition);
      void diffTaskSegmentStore.moveToHead(taskId, queuePosition);
    }
  }

  private compareTasks(left: Task, right: Task): number {
    return compareTasksByContract(
      {
        ...left,
        queue_position: this.headPositions.get(left.task_id) ?? left.queue_position ?? 0,
      },
      {
        ...right,
        queue_position: this.headPositions.get(right.task_id) ?? right.queue_position ?? 0,
      },
    );
  }

  private updateQueueProgress(
    taskType: string,
    progress?: { completed?: number; total?: number } | null,
  ): void {
    if (!progress) return;
    this.queueProgressByTaskType.set(taskType, {
      completed: Number(progress.completed || 0),
      total: Number(progress.total || 0),
    });
    let completed = 0;
    let total = 0;
    for (const item of this.queueProgressByTaskType.values()) {
      completed += item.completed;
      total += item.total;
    }
    this.stats.progressCompleted = completed;
    this.stats.progressTotal = total;
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
    // Ensure the next poll-loop iteration drains the fast tier immediately,
    // even if the immediate cycle below no-ops because a cycle is in flight.
    this.needsFastRepoll = true;
    if (this.fastRepollTimeout.isScheduled) return; // coalesce - one burst in flight
    const jitter = Math.floor(Math.random() * FAST_REPOLL_JITTER_MS);
    this.fastRepollTimeout.schedule(() => {
      if (!this.isRunning) return;
      // Drain whatever fast-tier work matched our capabilities now.
      // cycle()'s cycleInFlight guard prevents overlap with an in-flight cycle;
      // needsFastRepoll (set above) guarantees the poll loop re-drains if this
      // no-opped because a cycle was in flight.
      this.cycle().catch((error) =>
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

    this.currentTaskType = task.task_type;
    this.currentTaskAttempt = Math.max(0, Number(task.retry_count) || 0);
    if (!this.handlesTaskType(task.task_type)) {
      // CHROME-CAP-1: release-by-failure, never a silent skip.
      try {
        await this.submitResult(task.task_id, 'failed', undefined, {
          error: `unhandled task_type: ${task.task_type}`,
        });
      } catch (error) {
        logger.warn(this.workerLabel, 'Failed to release unhandled task', error);
      }
      this.currentTaskType = null;
      this.currentTaskAttempt = null;
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
      this.currentTaskType = null;
      this.currentTaskAttempt = null;
    }
  }

  /**
   * Submit a result to the worker result endpoint. Subclasses call this from
   * executeTask. Tracks whether a terminal (completed/failed) result was posted
   * so dispatchOne can fail-safe a handler that returned without one.
   */
  protected async submitResult(
    taskId: string,
    statusRole: string,
    result?: TaskResult['result'],
    extra?: { error?: string; progress?: number },
  ): Promise<void> {
    if (!this.workerClient) return;
    const status = workerResultStatus(statusRole);
    const payload: TaskResult = {
      task_id: taskId,
      worker_id: this.stats.workerId || '',
      status,
    };
    if (this.currentTaskAttempt !== null) payload.attempt = this.currentTaskAttempt;
    if (result !== undefined) payload.result = result;
    if (extra?.error !== undefined) payload.error = extra.error;
    if (extra?.progress !== undefined) payload.progress = extra.progress;
    // Submit; on a NON-terminal failure hand the result to the persistent outbox
    // so it is durably owned and retried forever (the "results are LOST on
    // backend interruption" fix). A TERMINAL failure (409 / task reassigned) can
    // never be accepted, so it is dropped, not enqueued.
    try {
      await this.workerClient.submitResult(this.currentTaskType || '', payload);
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
          taskType: this.currentTaskType || '',
          payload,
        });
        logger.warn(this.workerLabel, 'Result submit failed — queued to outbox for retry', error);
      }
    }
    // The result is now delivered OR durably owned by the outbox (or terminal):
    // mark terminal + bump stats so dispatchOne's safety-net does not re-submit.
    if (status === TASK_STATUS_BY_ROLE.completed || status === TASK_STATUS_BY_ROLE.failed) {
      this.terminalPosted = true;
      await this.workerClient.compactTask(taskId);
    }
    if (status === TASK_STATUS_BY_ROLE.completed) this.stats.translated++;
    if (status === TASK_STATUS_BY_ROLE.failed) this.stats.failed++;
  }

  protected delay(ms: number): Promise<void> {
    return wait(ms);
  }
}
