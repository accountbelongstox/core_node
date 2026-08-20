/**
 * Laravel worker API transport for the shared distributed-task model.
 *
 * Task values and record types come from config/queue_center_contract.json via
 * utils/queue-center-contract.ts. Laravel and Pycore use the aligned adapters
 * listed there. This class owns HTTP only; it must not redefine the model.
 */

import { BaseApiClient, ApiResponse } from './BaseApiClient';
import { getCachedBackendTimeoutMs } from '@/utils/backend-timeout';
import { diffTaskSegmentStore } from '@/utils/diff-task-segments';
import {
  WORKER_PATHS,
  TRANSLATION_QUEUE_PATHS,
  taskPath,
  workerTaskPath,
  queueCenterDiffPath,
} from '@/utils/api-paths';
import {
  PRIORITY_FAST,
  isQueuePositionOrderedTask,
  TASK_STATUS_BY_ROLE,
  TASK_LIMITS,
  type ProcessorType,
  type Task,
  type TaskResult,
  type WorkerCapability,
  type WorkerInfo,
  type WorkerRegistration,
  type WorkerReleaseOutcome,
  type WorkerSubmitOutcome,
  type QueueProgress,
  type QueueSliceDiff,
} from '@/utils/queue-center-contract';

export { PRIORITY_FAST, WORKER_CAPABILITIES } from '@/utils/queue-center-contract';
export type {
  ProcessorType,
  Task,
  TaskResult,
  TaskStatus,
  WorkerCapability,
  WorkerInfo,
  WorkerRegistration,
  WorkerReleaseOutcome,
  WorkerSubmitOutcome,
} from '@/utils/queue-center-contract';

type WorkerPullData = {
  count: number;
  pending_urgent: number;
  pending_fast: number;
  queue_cursor?: number;
  progress?: QueueProgress;
  tasks: Task[];
};

type WorkerPullOptions = {
  limit?: number;
  preferRemote?: boolean;
};

// ========== Worker API Client ==========

// Fail-fast control-plane budget for the SHORT worker RPCs (register / heartbeat
// / accept). A dead or slow Laravel must fail ONCE, fast — never retry 3x against
// a long timeout, which floods the console with `Request timeout` and hammers an
// unreachable backend. Pulls use the same bounded control budget and
// submitResult uses the configurable backend timeout (a result may be large).
const CONTROL_RPC_FAILFAST_TIMEOUT_MS = 10000;
const CONTROL_RPC_OPTS = { retries: 0, timeout: CONTROL_RPC_FAILFAST_TIMEOUT_MS } as const;

export class WorkerApiClient extends BaseApiClient {
  private workerId: string | null = null;
  private readonly taskSegmentScopes = new Map<string, string>();
  private pullOperation: Promise<void> = Promise.resolve();

  /**
   * Register worker
   */
  async register(registration: WorkerRegistration): Promise<ApiResponse<{ worker_id: string }>> {
    const response = await this.post<{ worker_id: string }>(
      WORKER_PATHS.REGISTER,
      registration,
      CONTROL_RPC_OPTS,
    );

    if (response.success && response.data) {
      this.workerId = response.data.worker_id;
    }

    return response;
  }

  /**
   * Send heartbeat to maintain online status
   */
  async heartbeat(
    workerId?: string,
    capabilities?: WorkerCapability[],
  ): Promise<ApiResponse<{ pending_urgent: number; pending_fast: number }>> {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    return this.post<{ pending_urgent: number; pending_fast: number }>(
      WORKER_PATHS.HEARTBEAT,
      { worker_id: id, capabilities },
      CONTROL_RPC_OPTS,
    );
  }

  /**
   * Mark this worker offline immediately instead of waiting for heartbeat expiry.
   */
  async unregister(workerId?: string): Promise<ApiResponse<{ worker_id: string; status: string }>> {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    const response = await this.post<{ worker_id: string; status: string }>(
      WORKER_PATHS.UNREGISTER,
      { worker_id: id },
      CONTROL_RPC_OPTS,
    );
    if (response.success && this.workerId === id) {
      this.workerId = null;
    }
    return response;
  }

  /** Pull one bounded typed task segment without retaining an HTTP worker. */
  async pullTasks(
    taskType: string,
    workerId?: string,
    options: WorkerPullOptions = {},
  ): Promise<ApiResponse<WorkerPullData>> {
    const operation = this.pullOperation.then(
      () => this.pullTasksUnlocked(taskType, workerId, options),
      () => this.pullTasksUnlocked(taskType, workerId, options),
    );
    this.pullOperation = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async pullTasksUnlocked(
    taskType: string,
    workerId?: string,
    options: WorkerPullOptions = {},
  ): Promise<ApiResponse<WorkerPullData>> {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    const { limit = TASK_LIMITS.worker_pull_default, preferRemote = false } = options;
    const safeLimit = Math.max(1, Math.min(TASK_LIMITS.worker_pull, Math.floor(limit)));
    const scope = `${this.getBaseUrl()}:${id}:${taskType}`;
    let recovered: Task[] = [];
    let staged: Task[] = [];
    let response: ApiResponse<WorkerPullData> | null = null;

    if (!preferRemote) {
      recovered = await diffTaskSegmentStore.pending(scope, safeLimit);
    }

    let remaining = Math.max(0, safeLimit - recovered.length);
    if (remaining > 0) {
      const segmentCapacity = await diffTaskSegmentStore.availableCapacity(scope);
      const remoteLimit = Math.min(remaining, segmentCapacity);
      if (remoteLimit > 0) {
        response = await this.post<WorkerPullData>(
          workerTaskPath(taskType, 'pull'),
          {
            worker_id: id,
            limit: remoteLimit,
          },
          {
            timeout: CONTROL_RPC_FAILFAST_TIMEOUT_MS,
            retries: 0,
          },
        );
        if (!response.success || !response.data || !Array.isArray(response.data.tasks)) {
          if (recovered.length > 0) {
            await diffTaskSegmentStore.release(scope, recovered.map((task) => task.task_id));
          }
          return response;
        }
        staged = await diffTaskSegmentStore.stage(scope, response.data.tasks);
        if (response.data.queue_cursor != null) {
          await diffTaskSegmentStore.setRemoteRevision(
            scope,
            Number(response.data.queue_cursor),
          );
        }
        remaining = Math.max(0, remaining - staged.length);
      }
    }

    if (preferRemote && remaining > 0) {
      recovered = await diffTaskSegmentStore.pending(scope, remaining);
    }

    const tasks = preferRemote ? [...staged, ...recovered] : [...recovered, ...staged];
    for (const task of tasks) this.taskSegmentScopes.set(task.task_id, scope);
    if (!response?.data) {
      return {
        success: true,
        message: tasks.length > 0
          ? 'Recovered locally owned task segment'
          : 'No bounded task segment capacity available',
        data: { count: tasks.length, pending_urgent: 0, pending_fast: 0, tasks },
      };
    }
    return {
      ...response,
      data: { ...response.data, count: tasks.length, tasks },
    };
  }

  async queueDiff(taskType: string, cursor: number): Promise<ApiResponse<QueueSliceDiff>> {
    const id = this.workerId;
    if (!id) {
      throw new Error('Worker ID not set. Call register() first');
    }
    const scope = `${this.getBaseUrl()}:${id}:${taskType}`;
    const storedCursor = await diffTaskSegmentStore.remoteRevision(scope);
    return this.get<QueueSliceDiff>(
      queueCenterDiffPath(taskType),
      { cursor: Math.max(0, Math.floor(cursor), storedCursor) },
      CONTROL_RPC_OPTS,
    );
  }

  /**
   * Accept a task
   */
  async acceptTask(taskType: string, taskId: string, workerId?: string): Promise<ApiResponse<null>> {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    return this.post<null>(
      workerTaskPath(taskType, 'accept'),
      { task_id: taskId, worker_id: id },
      CONTROL_RPC_OPTS,
    );
  }

  /**
   * Submit task result
   */
  async submitResult(taskType: string, result: TaskResult): Promise<ApiResponse<WorkerSubmitOutcome | null>> {
    // Ensure worker_id is set
    if (!result.worker_id && this.workerId) {
      result.worker_id = this.workerId;
    }

    if (!result.worker_id) {
      throw new Error('Worker ID not set in result. Call register() first or provide worker_id');
    }

    const response = await this.post<WorkerSubmitOutcome | null>(
      workerTaskPath(taskType, 'result'),
      result,
      // Configurable timeout (keep retries:0 — the outbox owns durable retry).
      { retries: 0, timeout: getCachedBackendTimeoutMs() },
    );
    if (response.success && (
      result.status === TASK_STATUS_BY_ROLE.completed
      || result.status === TASK_STATUS_BY_ROLE.failed
    )) {
      await this.compactTask(result.task_id);
    }
    return response;
  }

  /**
   * Get worker list
   */
  async getWorkerList(): Promise<ApiResponse<{ count: number; workers: WorkerInfo[] }>> {
    return this.get<{ count: number; workers: WorkerInfo[] }>(WORKER_PATHS.LIST);
  }

  /**
   * Fetch the full detail bundle for a task. Mirrors Laravel
   * `GET /api/task/{id}/detail` (the same shape the SSE detail stream emits as
   * its task.detail-initial frame), used by the popup TaskDetailModal drilldown.
   * A control read — no worker_id required.
   */
  async getTaskDetail(taskId: string): Promise<ApiResponse<any>> {
    return this.get<any>(taskPath(taskId, 'detail'));
  }

  /**
   * Move a task to the front using its contract-owned ordering authority.
   * Queue-position tasks send no numeric priority; priority lanes keep the
   * explicit fast-tier value.
   */
  async bumpTask(
    taskId: string,
    taskType: string,
    priority: number = PRIORITY_FAST,
  ): Promise<ApiResponse<{ task_id: string; priority?: number; queue_position?: number; status?: string }>> {
    const usesQueuePosition = isQueuePositionOrderedTask(taskType);
    const response = await this.post<{
      task_id: string;
      priority?: number;
      queue_position?: number;
      status?: string;
    }>(
      taskPath(taskId, 'bump'),
      usesQueuePosition ? {} : { priority },
    );
    if (response.success && usesQueuePosition) {
      await diffTaskSegmentStore.moveToHead(taskId, Number(response.data?.queue_position ?? 0));
    } else if (response.success) {
      await diffTaskSegmentStore.promote(taskId, priority);
    }
    return response;
  }

  async compactTask(taskId: string): Promise<void> {
    const scope = this.taskSegmentScopes.get(taskId);
    if (!scope) return;
    await diffTaskSegmentStore.consume(scope, taskId);
    this.taskSegmentScopes.delete(taskId);
  }

  async releaseTasks(tasks: Task[]): Promise<void> {
    const id = this.workerId;
    if (!id) {
      throw new Error('Worker ID not set. Call register() first');
    }

    const tasksByType = new Map<string, Task[]>();
    for (const task of tasks) {
      const scope = this.taskSegmentScopes.get(task.task_id);
      if (!scope) continue;
      const groupedTasks = tasksByType.get(task.task_type) || [];
      if (!groupedTasks.some((candidate) => candidate.task_id === task.task_id)) {
        groupedTasks.push(task);
      }
      tasksByType.set(task.task_type, groupedTasks);
    }

    for (const [taskType, groupedTasks] of tasksByType) {
      const taskIds = groupedTasks.map((task) => task.task_id);
      try {
        const response = await this.post<WorkerReleaseOutcome>(
          workerTaskPath(taskType, 'release'),
          { worker_id: id, task_ids: taskIds },
          CONTROL_RPC_OPTS,
        );
        if (!response.success) {
          throw new Error(response.message);
        }
        for (const task of groupedTasks) {
          await this.compactTask(task.task_id);
        }
      } catch (error) {
        for (const task of groupedTasks) {
          const scope = this.taskSegmentScopes.get(task.task_id);
          if (scope) await diffTaskSegmentStore.release(scope, [task.task_id]);
        }
        throw error;
      }
    }
  }

  /**
   * Translation queue overview: summary counts + the pending task list (the
   * "untranslated data" with how many entries).
   *
   * B12: this is a NO-AUTH control read. It targets the translation-queue
   * CONTROL plane (laravel `GET .../translation/queue/list`, registered under the
   * `withoutMiddleware([EnsureFrontendRequestsAreStateful])` group alongside
   * /pending-words and /enqueue-pending), NOT the auth-required FE
   * `translation/queue/batch/*` surface — so the token-less worker never hits an
   * auth wall. pycore exposes the identical control read at
   * /api/local/translation/queue; both are interchangeable. No worker_id needed.
   */
  async getTranslationQueue(
    options: { status?: string; limit?: number; page?: number; offset?: number } = {},
  ): Promise<
    ApiResponse<{
      summary: {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        total: number;
      };
      items: Array<{
        task_id: string;
        words: string[];
        word_count: number;
        language: string;
        target_language: string;
        priority: number;
        status: string;
        created_at: string;
        age_seconds: number;
        assigned_to: string | null;
      }>;
      // Server-side pagination metadata (laravel_main controlList).
      pagination?: {
        limit: number;
        offset: number;
        page: number;
        total: number;
        has_more: boolean;
      };
    }>
  > {
    const { status, limit = 10, page, offset } = options;
    const params: Record<string, any> = { limit: Math.max(1, Math.min(1000, limit)) };
    if (status) params.status = status;
    // `page` (1-based) takes precedence; else a raw `offset`.
    if (page != null) params.page = Math.max(1, Math.floor(page));
    else if (offset != null) params.offset = Math.max(0, Math.floor(offset));
    return this.get(TRANSLATION_QUEUE_PATHS.LIST, params);
  }

  /**
   * DICTIONARY-driven pending words: the words that still need a translation
   * (no translation yet AND not explicitly invalid), straight from laravel_main's
   * per-language dictionary. This is what the Bing-assist panel previews on
   * "Load queue" — distinct from getTranslationQueue (the global_tasks queue).
   * Same response shape so the panel renders it unchanged.
   */
  async getPendingWords(
    options: {
      language?: string;
      target_language?: string;
      limit?: number;
      page?: number;
      offset?: number;
    } = {},
  ): Promise<
    ApiResponse<{
      summary: {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        total: number;
      };
      items: Array<{
        task_id: string;
        words: string[];
        word_count: number;
        language: string;
        target_language: string;
        priority: number;
        status: string;
        created_at: string | null;
        age_seconds: number;
        assigned_to: string | null;
      }>;
      pagination?: {
        limit: number;
        offset: number;
        page: number;
        total: number;
        has_more: boolean;
      };
    }>
  > {
    const { language = 'en', target_language = 'zh', limit = 10, page, offset } = options;
    const params: Record<string, any> = {
      language,
      target_language,
      limit: Math.max(1, Math.min(1000, limit)),
    };
    if (page != null) params.page = Math.max(1, Math.floor(page));
    else if (offset != null) params.offset = Math.max(0, Math.floor(offset));
    return this.get(TRANSLATION_QUEUE_PATHS.PENDING_WORDS, params);
  }

  /**
   * Enqueue dictionary-pending words into the shared word_translation queue at
   * HIGH priority so a worker that just started pulls them first. Called on
   * "Confirm & Start". Safe to call repeatedly (server dedups / moves-to-front).
   */
  async enqueuePending(
    options: { language?: string; target_language?: string; limit?: number } = {},
  ): Promise<ApiResponse<{ queued: number; moved: number; skipped: number; task_ids: string[] }>> {
    const { language = 'en', target_language = 'zh', limit = 500 } = options;
    return this.post(TRANSLATION_QUEUE_PATHS.ENQUEUE_PENDING, {
      language,
      target_language,
      limit: Math.max(1, Math.min(2000, limit)),
    });
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(): Promise<
    ApiResponse<{
      stats: {
        total: number;
        online: number;
        offline: number;
        idle: number;
        working: number;
      };
    }>
  > {
    return this.get(WORKER_PATHS.STATS);
  }

  /**
   * Get current worker ID
   */
  getWorkerId(): string | null {
    return this.workerId;
  }

  /**
   * Set worker ID manually
   */
  setWorkerId(workerId: string): void {
    this.workerId = workerId;
  }

  /**
   * Check if worker is registered
   */
  isRegistered(): boolean {
    return this.workerId !== null;
  }
}
