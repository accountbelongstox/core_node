/**
 * Laravel worker API transport for the shared distributed-task model.
 *
 * Task values and record types come from config/queue_center_contract.json via
 * utils/queue-center-contract.ts. Laravel and Pycore use the aligned adapters
 * listed there. This class owns HTTP only; it must not redefine the model.
 */

import { BaseApiClient, ApiResponse } from './BaseApiClient';
import { getCachedBackendTimeoutMs } from '@/utils/backend-timeout';
import {
  WORKER_PATHS,
  TRANSLATION_QUEUE_PATHS,
  taskPath,
} from '@/utils/api-paths';
import {
  PRIORITY_FAST,
  TASK_LIMITS,
  type ProcessorType,
  type Task,
  type TaskResult,
  type WorkerCapability,
  type WorkerInfo,
  type WorkerRegistration,
  type WorkerSubmitOutcome,
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
  WorkerSubmitOutcome,
} from '@/utils/queue-center-contract';

// ========== Worker API Client ==========

// Fail-fast control-plane budget for the SHORT worker RPCs (register / heartbeat
// / accept). A dead or slow Laravel must fail ONCE, fast — never retry 3x against
// a long timeout, which floods the console with `Request timeout` and hammers an
// unreachable backend. Long-poll pulls keep their own budget (see pullTasks) and
// submitResult uses the CONFIGURABLE backend timeout (a result may be large).
const CONTROL_RPC_FAILFAST_TIMEOUT_MS = 10000;
const CONTROL_RPC_OPTS = { retries: 0, timeout: CONTROL_RPC_FAILFAST_TIMEOUT_MS } as const;

export class WorkerApiClient extends BaseApiClient {
  private workerId: string | null = null;

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
  ): Promise<ApiResponse<{ pending_urgent: number; pending_fast: number }>> {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    return this.post<{ pending_urgent: number; pending_fast: number }>(
      WORKER_PATHS.HEARTBEAT,
      { worker_id: id },
      CONTROL_RPC_OPTS,
    );
  }

  /**
   * Pull tasks with long polling.
   *
   * `wait` (seconds) MUST be sent: 0 = return immediately (used for fast
   * re-polls reacting to pending_fast), a positive value asks Laravel to
   * long-poll up to that many seconds. The response carries the unified-task
   * backlog signals `pending_urgent` / `pending_fast` so the worker can decide
   * whether to fire an immediate fast re-poll.
   */
  async pullTasks(
    workerId?: string,
    options: {
      limit?: number;
      wait?: number;
    } = {},
  ): Promise<
    ApiResponse<{
      count: number;
      pending_urgent: number;
      pending_fast: number;
      tasks: Task[];
    }>
  > {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    const { limit = 5, wait = 0 } = options;
    // Clamp with the same limits Laravel validates from the central contract.
    const safeWait = Math.max(0, Math.min(TASK_LIMITS.long_poll_seconds, Math.floor(wait)));
    const safeLimit = Math.max(1, Math.min(TASK_LIMITS.worker_pull, Math.floor(limit)));

    return this.get<{ count: number; pending_urgent: number; pending_fast: number; tasks: Task[] }>(
      WORKER_PATHS.TASKS_PULL,
      {
        worker_id: id,
        // Always send wait; a missing wait makes Laravel long-poll 20s.
        wait: safeWait,
        limit: safeLimit,
      },
      {
        // Give the request enough headroom over the server-side wait.
        timeout: (safeWait + 8) * 1000,
        retries: 0, // Don't retry long polling requests
      },
    );
  }

  /**
   * Accept a task
   */
  async acceptTask(taskId: string, workerId?: string): Promise<ApiResponse<null>> {
    const id = workerId || this.workerId;

    if (!id) {
      throw new Error('Worker ID not set. Call register() first or provide workerId');
    }

    return this.post<null>(
      WORKER_PATHS.TASKS_ACCEPT,
      { task_id: taskId, worker_id: id },
      CONTROL_RPC_OPTS,
    );
  }

  /**
   * Submit task result
   */
  async submitResult(result: TaskResult): Promise<ApiResponse<WorkerSubmitOutcome | null>> {
    // Ensure worker_id is set
    if (!result.worker_id && this.workerId) {
      result.worker_id = this.workerId;
    }

    if (!result.worker_id) {
      throw new Error('Worker ID not set in result. Call register() first or provide worker_id');
    }

    return this.post<WorkerSubmitOutcome | null>(
      WORKER_PATHS.TASKS_RESULT,
      result,
      // Configurable timeout (keep retries:0 — the outbox owns durable retry).
      { retries: 0, timeout: getCachedBackendTimeoutMs() },
    );
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
   * Bump a task onto the fast tier (or to an explicit priority). Mirrors Laravel
   * `POST /api/task/{id}/bump` body {priority}. Defaults to PRIORITY_FAST so a
   * single click promotes a queued task to the front of the fast lane.
   */
  async bumpTask(
    taskId: string,
    priority: number = PRIORITY_FAST,
  ): Promise<ApiResponse<{ task_id: string; priority: number }>> {
    return this.post<{ task_id: string; priority: number }>(
      taskPath(taskId, 'bump'),
      { priority },
    );
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
