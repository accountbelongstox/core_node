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
  TaskResult,
} from '../../api/WorkerApiClient';
import { logger } from '@/utils/logger';

/**
 * Capabilities the Chrome-side fast workers may advertise on the fast lane.
 *
 * NOTE: `sentence_audio` is intentionally NOT here — sentence audio is
 * generated inline server-side (edge-tts in the pycore worker), never by a
 * browser tab, so Chrome must not claim it. `ai_translate` is also NOT here:
 * it belongs ONLY to the web-AI translate worker, which advertises it
 * explicitly via its own `capabilities`. `image` is NOT here either (B17): a
 * Chrome tab cannot GENERATE a word image, so per the audio+image=pycore-only
 * downgrade Chrome must never claim image. This constant is the default set for
 * the dictionary/media style workers (Bing) that scrape pages — `translate`
 * only.
 */
export const CHROME_FAST_CAPABILITIES: WorkerCapability[] = ['translate'];

// The full allowed capability vocabulary (mirrors GlobalTask::CAPABILITIES
// minus the lanes Chrome can never serve from a tab). Anything outside this
// set is dropped during normalization so a typo can't register a bogus cap.
const ALLOWED_CAPABILITIES = new Set<WorkerCapability>([
  'audio',
  'image',
  'translate',
  'sentence_audio',
  'ai_translate',
  'subtitle',
  'poster',
]);

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

export interface SimpleWorkerStats {
  pending: number;
  translated: number;
  failed: number;
  lastRun: number | null;
  workerId: string | null;
  isOnline: boolean;
  pendingFast: number;
  pendingUrgent: number;
  currentTaskId: string | null;
  [key: string]: any;
}

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
    pendingFast: 0,
    pendingUrgent: 0,
    currentTaskId: null,
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
   * The processor lanes to register. A worker with >=1 capability also
   * subscribes to the shared `remote_fast` lane so the dispatcher can route
   * matching fast-tier tasks to it; a capability-less worker gets just its
   * explicit lanes (none, by default).
   */
  protected withFastLane(
    baseLanes: ProcessorType[],
    caps: WorkerCapability[],
  ): ProcessorType[] {
    const lanes = [...baseLanes];
    if (caps.length > 0 && !lanes.includes('remote_fast')) {
      lanes.push('remote_fast');
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
    this.stats.isOnline = false;
    this.stats.currentTaskId = null;
    logger.info(this.workerLabel, 'Worker stopped');
  }

  getStatus(): { isRunning: boolean; stats: SimpleWorkerStats } {
    return { isRunning: this.isRunning, stats: { ...this.stats } };
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

    const response = await this.workerClient.register({
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

    if (response.success && response.data) {
      this.stats.workerId = response.data.worker_id;
      this.stats.isOnline = true;
      logger.info(this.workerLabel, 'Registered', {
        worker_id: response.data.worker_id,
        processor_types: processorTypes,
        capabilities: caps,
      });
    } else {
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
        if (resp.success && resp.data) {
          this.noteFastSignals(resp.data.pending_urgent, resp.data.pending_fast);
        }
      } catch (error) {
        this.stats.isOnline = false;
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
        await this.cycle(this.config?.pollWait ?? 20);
      } catch (error) {
        logger.error(this.workerLabel, 'Poll cycle error', error);
        // Brief backoff so a hard failure doesn't hot-loop.
        await this.delay(1000);
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
    if (!this.workerClient || !this.config) return;

    this.stats.lastRun = Date.now();

    const resp = await this.workerClient.pullTasks(undefined, {
      limit: this.config.batchSize,
      wait,
    });

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
      await this.dispatchOne(task);
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
    if (this.fastRepollTimer) return; // coalesce — one burst in flight
    const jitter = Math.floor(Math.random() * FAST_REPOLL_JITTER_MS);
    this.fastRepollTimer = setTimeout(() => {
      this.fastRepollTimer = null;
      if (!this.isRunning) return;
      // wait=0: drain whatever fast-tier work matched our capabilities now.
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
      this.stats.failed++;
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
    if (status === 'completed' || status === 'failed') {
      this.terminalPosted = true;
    }
    if (!this.workerClient) return;
    const payload: TaskResult = {
      task_id: taskId,
      worker_id: this.stats.workerId || '',
      status,
    };
    if (result !== undefined) payload.result = result;
    if (extra?.error !== undefined) payload.error = extra.error;
    if (extra?.progress !== undefined) payload.progress = extra.progress;
    if (status === 'completed') this.stats.translated++;
    await this.workerClient.submitResult(payload);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
