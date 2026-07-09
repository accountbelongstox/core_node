/**
 * Worker API Client
 * Implements Worker Task System API according to BACKEND_WORKER_API.md
 * Under 300 lines
 */

import { BaseApiClient, ApiResponse } from './BaseApiClient';

// ========== Type Definitions ==========

export type ProcessorType =
  | 'remote_client'
  | 'remote_compute'
  | 'remote_ocr'
  | 'remote_translation'
  | 'remote_video'
  | 'remote_io'
  // Unified-task fast lane: a worker that advertises >=1 capability also
  // subscribes to `remote_fast` so the dispatcher can hand it any fast-tier
  // task that matches one of its capabilities (see SimpleWorkerBase.withFastLane).
  | 'remote_fast'
  // Dedicated lanes Chrome may advertise in the future; minimally the fast lane
  // above is required today. Kept here so the union mirrors the Laravel
  // GlobalTask::EXECUTION_TYPES vocabulary exactly.
  | 'remote_subtitle'
  | 'remote_poster'
  | 'remote_sentence_audio'
  // Dedicated chrome web-LLM invalid-word detection lane (word_validity tasks).
  // Own lane so it never co-mingles with word_translation/prompt_translation on
  // remote_translation (pull assigns by execution_type with no task_type filter).
  | 'remote_validity'
  // Dedicated Task Center v3 lanes (own execution_type each — pull assigns by
  // execution_type with an atomic claim, so a shared lane would let one
  // feature's worker claim and starve another's tasks):
  //   remote_notebooklm -> notebooklm task_type, remote_gemini -> gemini_image,
  //   remote_gemini_text -> gemini_chat (text-only completion).
  | 'remote_notebooklm'
  | 'remote_gemini'
  | 'remote_gemini_text';

/**
 * Capability vocabulary — mirrors Laravel GlobalTask::CAPABILITIES. A worker
 * advertises the kinds of work it can actually do; the dispatcher matches a
 * fast-tier task's `capability` against this set before assigning it.
 */
export type WorkerCapability =
  | 'audio'
  | 'image'
  | 'translate'
  | 'sentence_audio'
  | 'ai_translate'
  | 'puter_translate'
  | 'subtitle'
  | 'poster';

export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'processing'
  | 'completed'
  | 'completed_demo'
  | 'failed'
  | 'cancelled';

export interface WorkerRegistration {
  worker_id: string;
  worker_name: string;
  processor_types: ProcessorType[];
  // The capability set advertised to the dispatcher. Optional for legacy
  // single-lane workers; unified workers always send it.
  capabilities?: WorkerCapability[];
  hostname?: string;
  platform?: string;
  metadata?: Record<string, any>;
}

export interface Task {
  task_id: string;
  app_name: string;
  task_type: string;
  execution_type: string;
  status: TaskStatus;
  payload: {
    words?: Array<{
      word: string;
      md5: string;
      query_count: number;
    }>;
    language?: string;
    is_demo_mode?: boolean;
    word_count?: number;
    [key: string]: any;
  };
  timeout_seconds: number;
  priority: number;
  // Capability the task requires (unified-task routing). null/undefined => any
  // worker on the lane may take it.
  capability?: WorkerCapability | null;
  // True when the task was dispatched on the fast tier (priority>=PRIORITY_FAST).
  is_fast_tier?: boolean;
  created_at: string;
}

export interface TaskResult {
  task_id: string;
  worker_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: {
    explanations?: Array<{
      word: string;
      md5: string;
      explanation: string;
      phonetic?: string;
      us_phonetic?: string;
      uk_phonetic?: string;
      provider: string;
    }>;
    [key: string]: any;
  };
  error?: string;
}

/**
 * Backend reception summary returned by POST /api/worker/tasks/result (the
 * $outcome surfaced by TaskManagerService::submitResult). Lets a worker log
 * exactly what the server stored. All fields optional — only the
 * word-translation write-back reports the granular saved/invalid/audio/images
 * breakdown; other task types return just status/stored_count/failed_count.
 */
export interface WorkerSubmitOutcome {
  status: string;
  stored_count: number;
  failed_count: number;
  synced_to_dict?: boolean;
  saved?: number;
  invalid?: number;
  audio_saved?: number;
  images_saved?: number;
}

export interface WorkerInfo {
  worker_id: string;
  worker_name: string;
  processor_types: ProcessorType[];
  status: 'online' | 'offline';
  hostname?: string;
  platform?: string;
  completed_tasks: number;
  failed_tasks: number;
  current_task_id: string | null;
  last_heartbeat_at: string;
  created_at: string;
}

// ========== Worker API Client ==========

/**
 * Default priority a fast-tier bump uses. Mirrors Laravel
 * GlobalTask::PRIORITY_FAST. A task at or above this priority is treated as
 * fast-tier (is_fast_tier=true) by the dispatcher.
 */
export const PRIORITY_FAST = 100;

export class WorkerApiClient extends BaseApiClient {
  private workerId: string | null = null;

  /**
   * Register worker
   */
  async register(registration: WorkerRegistration): Promise<ApiResponse<{ worker_id: string }>> {
    const response = await this.post<{ worker_id: string }>('/api/worker/register', registration);

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

    return this.post<{ pending_urgent: number; pending_fast: number }>('/api/worker/heartbeat', {
      worker_id: id,
    });
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
    // Clamp: wait 0..30s, limit 1..50.
    const safeWait = Math.max(0, Math.min(30, Math.floor(wait)));
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));

    return this.get<{ count: number; pending_urgent: number; pending_fast: number; tasks: Task[] }>(
      '/api/worker/tasks/pull',
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

    return this.post<null>('/api/worker/tasks/accept', {
      task_id: taskId,
      worker_id: id,
    });
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

    return this.post<WorkerSubmitOutcome | null>('/api/worker/tasks/result', result);
  }

  /**
   * Get worker list
   */
  async getWorkerList(): Promise<ApiResponse<{ count: number; workers: WorkerInfo[] }>> {
    return this.get<{ count: number; workers: WorkerInfo[] }>('/api/worker/list');
  }

  /**
   * Fetch the full detail bundle for a task. Mirrors Laravel
   * `GET /api/task/{id}/detail` (the same shape the SSE detail stream emits as
   * its task.detail-initial frame), used by the popup TaskDetailModal drilldown.
   * A control read — no worker_id required.
   */
  async getTaskDetail(taskId: string): Promise<ApiResponse<any>> {
    return this.get<any>(`/api/task/${encodeURIComponent(taskId)}/detail`);
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
      `/api/task/${encodeURIComponent(taskId)}/bump`,
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
    return this.get('/api/app_qy_v1/ai_tools/translation/queue/list', params);
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
    return this.get('/api/app_qy_v1/ai_tools/translation/queue/pending-words', params);
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
    return this.post('/api/app_qy_v1/ai_tools/translation/queue/enqueue-pending', {
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
    return this.get('/api/worker/stats');
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
