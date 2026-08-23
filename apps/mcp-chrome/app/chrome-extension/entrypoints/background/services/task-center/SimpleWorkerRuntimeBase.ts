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
export const FAST_CAPABILITY_SET = new Set<WorkerCapability>(FAST_LANE_CAPABILITIES);

// The full allowed capability vocabulary (mirrors GlobalTask::CAPABILITIES
// minus the lanes Chrome can never serve from a tab). Anything outside this
// set is dropped during normalization so a typo can't register a bogus cap.
export const ALLOWED_CAPABILITIES = new Set<WorkerCapability>(WORKER_CAPABILITIES);

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
export const BACKEND_DOWN_THRESHOLD = 3;
export const POLL_BACKOFF_FAST_MS = 1000;
export const POLL_BACKOFF_SLOW_MS = 8000;

// Fast re-poll cadence when the backend signals pending_fast>0. Kept short but
// jittered so multiple workers don't stampede the endpoint in lockstep.
export const FAST_REPOLL_BASE_MS = 400;
export const FAST_REPOLL_JITTER_MS = 300;
export const REGISTRATION_RETRY_MS = 3000;
export const QUEUE_DIFF_POLL_MS = Math.max(250, Number(DIFF_DELIVERY.poll_interval_ms || 1000));
export const QUEUE_HEAD_RESERVE = Math.max(1, Math.floor(Number(DIFF_DELIVERY.head_reserve || 1)));

export abstract class SimpleWorkerRuntimeBase extends LaravelWorkerLifecycleBase {
  protected config: Required<SimpleWorkerConfig> | null = null;
  protected isRunning = false;

  protected pollLoopActive = false;
  protected readonly heartbeatPolling = new IntervalController();
  protected readonly diffPolling = new IntervalController();
  protected diffPollInFlight = false;
  // Coalesce fast re-polls: at most one scheduled burst in flight.
  protected readonly fastRepollTimeout = new TimeoutController();
  protected readonly registrationRetryTimeout = new TimeoutController();
  protected registrationPending = false;
  protected wakeUnsubscribe: (() => void) | null = null;
  // Re-entrancy guard: only one cycle() may run at a time. A realtime wake that
  // fires while a pull cycle is in flight would clobber shared dispatch
  // state (terminalPosted/currentTaskId) and drive the single chat tab with two
  // tasks at once, so scheduleFastRepoll defers via needsFastRepoll instead.
  protected cycleInFlight = false;
  // Set when a fast re-poll is requested while a cycle is in flight; the next
  // runPollLoop iteration then drains the fast tier immediately.
  protected needsFastRepoll = false;
  protected queueSliceLimits = new Map<string, number>();
  // Set true once a terminal (completed/failed) result is posted for the task
  // currently being dispatched; lets dispatchOne fail-safe a silent handler.
  protected terminalPosted = false;
  // task_type of the task currently being dispatched — the typed result route
  // (/api/worker/tasks/{taskType}/result) needs it at submit time.
  protected currentTaskType: string | null = null;
  protected currentTaskAttempt: number | null = null;
  protected readonly headPositions = new Map<string, number>();
  protected readonly queueDiffCursors = new Map<string, number>();
  protected readonly queueProgressByTaskType = new Map<string, { completed: number; total: number }>();
  protected readonly prefetchedHeadTasks: Task[] = [];
  protected headPrefetchInFlight = false;
  protected bufferedTaskCount = 0;
  protected pullTaskTypeCursor = 0;

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

  protected activateRegisteredWorker(): void {
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

  protected isTransientRegistrationError(error: unknown): boolean {
    if (error instanceof ApiError) {
      return error.statusCode === 408 || (error.statusCode ?? 0) >= 500;
    }
    return error instanceof TypeError;
  }

  protected scheduleRegistrationRetry(): void {
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

  protected describeError(error: unknown): string {
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

  protected startHeartbeat(): void {
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

  protected startQueueDiffPoll(): void {
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

  protected startPollLoop(): void {
    if (this.pollLoopActive) return;
    this.pollLoopActive = true;
    void this.runPollLoop();
  }

  /**
   * Fallback reconciliation loop. Realtime wakes schedule immediate pulls;
   * this bounded interval recovers work if a socket signal is missed.
   */
  protected async runPollLoop(): Promise<void> {
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
  protected async pullTasksAcrossTypes(options: {
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

  protected async prefetchChangedHead(taskTypes?: string[]): Promise<void> {
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

  protected takePrefetchedHeadTasks(): Task[] {
    return this.prefetchedHeadTasks.splice(0);
  }

  protected abstract cycle(): Promise<void>;
}

