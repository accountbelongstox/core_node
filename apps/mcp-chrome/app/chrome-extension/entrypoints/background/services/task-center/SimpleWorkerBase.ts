import { Task, TaskResult } from '../../api/WorkerApiClient';
import { logger } from '@/utils/logger';
import {
  QUEUE_CENTER_REALTIME_EVENTS,
  TASK_STATUS_BY_ROLE,
  compareTasksByContract,
  workerResultStatus,
} from '@/utils/queue-center-contract';
import { submitOutbox, isTerminalWorkerResultError } from '../outbox/submit-outbox';
import type { QueueCenterWakeSignal } from './QueueCenterWakeService';
import { diffTaskSegmentStore } from '@/utils/diff-task-segments';
import { delay as wait } from '@/utils/async';
import { tabController } from '../tab-controller';
import {
  SimpleWorkerRuntimeBase,
  FAST_REPOLL_BASE_MS,
  FAST_REPOLL_JITTER_MS,
  QUEUE_HEAD_RESERVE,
} from './SimpleWorkerRuntimeBase';

export type { SimpleWorkerConfig, SimpleWorkerStats } from './SimpleWorkerRuntimeBase';

export abstract class SimpleWorkerBase extends SimpleWorkerRuntimeBase {
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
