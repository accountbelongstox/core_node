import { BaseAPI } from '../../../../core/integrations/laravel/transport/BaseAPI';
import { APIResponse } from '../../types';
import type {
  GlobalTaskCapability,
  GlobalTaskCurrentPhase,
  GlobalTaskCreateResult,
  GlobalTaskDetailBundle as CanonicalGlobalTaskDetailBundle,
  GlobalTaskDetailMetadata,
  GlobalTaskDetailRecord,
  GlobalTaskEventRecord,
  GlobalTaskStatusRecord,
  GlobalTaskStatus,
  GlobalTaskStatsRecord,
  GlobalTaskSummary,
} from '../../integrations/pycore';
import {
  GLOBAL_TASK_PRIORITIES,
  isGlobalTaskQueuePositionOrdered,
} from '../../integrations/pycore';

// ==================== Global Task / Worker substrate types ====================
// laravel_main's distributed worker queue (`global_tasks` + `workers` tables).
// These are real /api routes (TaskController / WorkerController, ApiResponse
// trait) — NOT the Octane timer web routes below. BaseAPI unwraps the trait's
// `{ success, data, message }` envelope, so `response.data` is the inner shape.

/**
 * Laravel-manager aliases for the same central records used by Pycore UI.
 * Source and cross-end adapter paths are documented in QueueCenterContract.ts.
 */
export type GlobalTaskItem = GlobalTaskSummary;
export type GlobalTaskDetail = GlobalTaskStatusRecord;

// ==================== Live task drilldown (detail / events) ====================
// laravel_main control-plane routes (no-auth), NOT under /api/app_qy_v1:
//   GET  /api/task/{id}/detail        — full detail snapshot (task + events + phase)
//   POST /api/task/{id}/bump          — move by the task type's contract ordering
// Queue Center Mercure events wake the shared detail refresh owner.

/** null means lane-only routing; non-null values come from the central capability catalog. */
export type FastCapability = GlobalTaskCapability | null;
export type GlobalTaskDetailFull = GlobalTaskDetailRecord;
export type GlobalTaskEvent = GlobalTaskEventRecord;

/** What the worker is doing right now (phase + elapsed). */
export type GlobalTaskPhase = GlobalTaskCurrentPhase;

/** Retry / timeout bookkeeping. */
export type GlobalTaskMeta = GlobalTaskDetailMetadata;

/** Full GET /api/task/{id}/detail payload (envelope already unwrapped). */
export type GlobalTaskDetailBundle = CanonicalGlobalTaskDetailBundle;

/** Laravel task statistics over the central status vocabulary. */
export type GlobalTaskStats = GlobalTaskStatsRecord;

/** Row shape returned by GET /api/worker/list. */
export interface GlobalWorkerInfo {
  worker_id: string;
  worker_name: string;
  processor_types: string[];
  status: 'online' | 'busy' | 'offline' | string;
  hostname: string | null;
  platform: string | null;
  completed_tasks: number;
  failed_tasks: number;
  current_task_id: string | null;
  last_heartbeat_at: string | null;
  created_at: string | null;
}

/** GET /api/worker/stats → data.stats. */
export interface GlobalWorkerStats {
  total: number;
  online: number;
  busy: number;
  offline: number;
  total_completed: number;
  total_failed: number;
}

// ==================== Task Center aggregate (scheduler ⇄ queue ⇄ workers) ====================
// GET /api/task-center/overview — one snapshot joining BOTH task layers:
// the in-process Octane SCHEDULER (timer tasks) and the DB-backed QUEUE
// (`global_tasks` + `workers`), plus the producer/consumer/maintainer
// relations between them. Powers the unified TaskCenter view.

/** Role a timer task plays against the global_tasks queue. */
export type TaskCenterQueueRole = 'producer' | 'consumer' | 'maintainer';

/** One scheduler (Octane timer) task in the overview snapshot. */
export interface TaskCenterSchedulerTask {
  name: string;
  interval: number;
  run_count: number;
  error_count: number;
  last_run: number;
  last_run_ago: number | null;
  last_duration: number | null;
  last_error: string | null;
  queue_role: TaskCenterQueueRole | null;
  queue_target: string | null;
}

/** One scheduler→queue relation edge. */
export interface TaskCenterRelation {
  timer: string;
  role: TaskCenterQueueRole;
  target: string;
  worker_id: string | null;
  registered: boolean;
}

export interface TaskCenterCategoryLane {
  pending: number;
  leased: number;
  processing: number;
  has_online_worker: boolean;
}

export interface TaskCenterCategory {
  capability: GlobalTaskCapability | null;
  claimants: Array<'pycore' | 'chrome' | 'laravel'>;
  fast_lane: TaskCenterCategoryLane;
  single_lane: TaskCenterCategoryLane;
}

export interface TaskCenterLiveTypeCounts {
  pending: number;
  leased: number;
  processing: number;
}

/** Full GET /api/task-center/overview payload (envelope already unwrapped). */
export interface TaskCenterOverview {
  scheduler: {
    running: boolean;
    uptime: number | null;
    total_ticks: number;
    summary: {
      total_discovered: number;
      total_registered: number;
      total_running: number;
      timer_running: boolean;
      timer_uptime: number | null;
      total_ticks: number;
    };
    heartbeat: {
      exists: boolean;
      last_modified?: string;
      seconds_ago?: number;
      is_fresh?: boolean;
      status?: string;
      message?: string;
    };
    tasks: TaskCenterSchedulerTask[];
  };
  queue: {
    stats: GlobalTaskStats;
    items: GlobalTaskItem[];
    total: number;
    categories: TaskCenterCategory[];
    by_type: Record<string, TaskCenterLiveTypeCounts>;
  };
  workers: {
    stats: GlobalWorkerStats;
    items: GlobalWorkerInfo[];
  };
  relations: TaskCenterRelation[];
  timestamp: string;
}

// ==================== Assist requests (CoreBook §6) ====================
// Record-scoped assist-request layer on top of the worker-pull assist pool.
// Real /api routes under /api/app_qy_v1/assist/requests (no-auth, same trust
// level as media/ingest). The Task Center "Assist Requests" panel + per-record
// modal drive these.

/** A record-scoped assist request row. */
export interface AssistRequestItem {
  id: number;
  record_type: 'book' | 'subtitle' | string;
  source_key: string;
  request_type: 'add_language' | 'fill_audio' | 'cover' | 'poster' | string;
  language: string | null;
  status: 'pending' | 'claimed' | 'processing' | 'completed' | 'failed' | string;
  priority: number;
  claimed_by: string | null;
  claimed_at: string | null;
  payload: any;
  result: any;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** One item in a create request: which gap to fill for the record. */
export interface AssistRequestCreateItem {
  request_type: 'add_language' | 'fill_audio' | 'cover' | 'poster';
  language?: string | null;
  payload?: any;
}

/**
 * ServerManager API Module
 * Manages systemd services (local access only)
 */
export class ServerManagerAPI extends BaseAPI {
  /**
   * List all services
   */
  async listServices(): Promise<APIResponse<{
    services: Array<{
      name: string;
      status: string;
      enabled: boolean;
    }>;
  }>> {
    return this.get('/server-manager/services');
  }

  /**
   * Get service status
   */
  async getStatus(serviceName: string): Promise<APIResponse<{
    service_name: string;
    status: string;
    enabled: boolean;
  }>> {
    return this.get(`/server-manager/services/${serviceName}/status`);
  }

  /**
   * Start service
   */
  async startService(serviceName: string): Promise<APIResponse<{
    service_name: string;
    status: string;
    output: string;
  }>> {
    return this.post(`/server-manager/services/${serviceName}/start`, {});
  }

  /**
   * Stop service
   */
  async stopService(serviceName: string): Promise<APIResponse<{
    service_name: string;
    status: string;
    output: string;
  }>> {
    return this.post(`/server-manager/services/${serviceName}/stop`, {});
  }

  /**
   * Restart service
   */
  async restartService(serviceName: string): Promise<APIResponse<{
    service_name: string;
    status: string;
    output: string;
  }>> {
    return this.post(`/server-manager/services/${serviceName}/restart`, {});
  }

  /**
   * Get service logs
   */
  async getLogs(serviceName: string, lines: number = 50): Promise<APIResponse<{
    service_name: string;
    lines: number;
    logs: string;
  }>> {
    return this.get(`/server-manager/services/${serviceName}/logs`, { lines });
  }

  /**
   * Toggle auto-start
   */
  async toggleAutoStart(serviceName: string): Promise<APIResponse<{
    service_name: string;
    enabled: boolean;
    action: string;
  }>> {
    return this.post(`/server-manager/services/${serviceName}/toggle-autostart`, {});
  }

  /**
   * Restart current Octane service (auto-detect)
   */
  async restartCurrent(): Promise<APIResponse<{
    service_name: string;
    status: string;
    output: string;
  }>> {
    return this.request({ url: '/server-manager/restart', method: 'POST', data: {}, retry: false });
  }

  // ==================== Global Task / Worker substrate ====================
  // Standard API-prefixed routes (`this.get`/`this.post` → `/api/...`).

  /**
   * Get global task statistics (distributed worker queue).
   * GET /api/task/stats
   */
  async getGlobalTaskStats(): Promise<APIResponse<{ stats: GlobalTaskStats }>> {
    return this.get('/task/stats');
  }

  /**
   * List global tasks with optional filters.
   * GET /api/task/list
   * NOTE: only pass non-empty filters — the controller uses `$request->has()`,
   * so `status=` (empty string) would filter by '' instead of "no filter".
   */
  async getGlobalTaskList(params?: {
    status?: string;
    app_name?: string;
    execution_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<APIResponse<{ total: number; count: number; tasks: GlobalTaskItem[] }>> {
    return this.get('/task/list', params);
  }

  /**
   * Get full detail (incl. result / error) for one global task.
   * GET /api/task/{taskId}/status
   */
  async getGlobalTaskDetail(taskId: string): Promise<APIResponse<{ task: GlobalTaskDetail }>> {
    return this.get(`/task/${encodeURIComponent(taskId)}/status`);
  }

  /**
   * Cancel a pending/assigned/processing global task.
   * POST /api/task/{taskId}/cancel — 409-style error if not cancellable.
   */
  async cancelGlobalTask(taskId: string): Promise<APIResponse<{ task_id: string; status: GlobalTaskStatus }>> {
    return this.post(`/task/${encodeURIComponent(taskId)}/cancel`, {});
  }

  // ==================== Live task drilldown (detail / events / bump / SSE) ====================

  /**
   * Full live detail for one global task — the richer bundle (task + event
   * timeline + current phase + retry/timeout metadata) that powers the queue
   * drilldown modal. GET /api/task/{taskId}/detail.
   *
   * NOTE: distinct from getGlobalTaskDetail() (GET …/status), which returns the
   * leaner single-task row used by the table.
   */
  async getTaskDetail(taskId: string): Promise<APIResponse<GlobalTaskDetailBundle>> {
    return this.get(`/task/${encodeURIComponent(taskId)}/detail`);
  }

  /**
   * Move a pending task to the front of its queue. POST /api/task/{taskId}/bump.
   * Queue-position-ordered (audio) tasks move by head ticket and return
   * `queue_position`; priority-ordered tasks return the bumped `priority`.
   * 404 if unknown, 409 if the task is no longer pending.
   */
  async bumpTaskToFront(
    taskId: string,
    taskType: string,
    priority: number = GLOBAL_TASK_PRIORITIES.fast,
  ): Promise<APIResponse<{
    task_id: string;
    priority?: number;
    queue_position?: number;
    status: GlobalTaskStatus;
  }>> {
    const body = isGlobalTaskQueuePositionOrdered(taskType) ? {} : { priority };
    return this.post(`/task/${encodeURIComponent(taskId)}/bump`, body);
  }

  /**
   * Enqueue a USER-INITIATED single request on the interactive fast lane.
   * POST /api/task/create with `interactive:true` so the created GlobalTask
   * lands on the central fast lane/priority when the task definition permits.
   * `capability` must be one of the central task definition's eligible values.
   * Batch/scan enqueues stay interactive:false and MUST NOT use this method.
   */
  async createInteractiveTask(data: {
    app_name: string;
    task_type: string;
    payload: any;
    capability?: FastCapability;
    timeout_seconds?: number;
  }): Promise<APIResponse<GlobalTaskCreateResult>> {
    return this.post('/task/create', {
      ...data,
      interactive: true,
      capability: data.capability ?? null,
    });
  }

  /**
   * List registered workers.
   * GET /api/worker/list
   */
  async getWorkerList(): Promise<APIResponse<{ count: number; workers: GlobalWorkerInfo[] }>> {
    return this.get('/worker/list');
  }

  /**
   * Get worker statistics.
   * GET /api/worker/stats
   */
  async getWorkerStats(): Promise<APIResponse<{ stats: GlobalWorkerStats }>> {
    return this.get('/worker/stats');
  }

  /**
   * Task Center aggregate overview — scheduler + queue + workers + relations
   * in ONE round-trip. GET /api/task-center/overview (ApiResponse envelope,
   * unwrapped by BaseAPI).
   */
  async getTaskCenterOverview(): Promise<APIResponse<TaskCenterOverview>> {
    return this.get('/task-center/overview');
  }

  // ==================== Assist requests (CoreBook §6) ====================
  // Record-scoped assist requests under /api/app_qy_v1/assist/requests.
  // Same no-auth trust level as media/ingest (server-side caller).

  /**
   * List assist requests with optional filters (Task Center panel).
   * GET /api/app_qy_v1/assist/requests
   */
  async listAssistRequests(params?: {
    record_type?: string;
    source_key?: string;
    status?: string;
    request_type?: string;
    per_page?: number;
  }): Promise<APIResponse<{
    success: boolean;
    items: AssistRequestItem[];
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  }>> {
    return this.get('/app_qy_v1/assist/requests', params);
  }

  /**
   * File assist requests for ONE record (idempotent upsert per item).
   * POST /api/app_qy_v1/assist/requests
   */
  async createAssistRequests(data: {
    record_type: string;
    source_key: string;
    priority?: number;
    items: AssistRequestCreateItem[];
  }): Promise<APIResponse<{
    success: boolean;
    created: number;
    existing: number;
    items: AssistRequestItem[];
  }>> {
    return this.post('/app_qy_v1/assist/requests', data);
  }

  /**
   * Worker lease pull (60-minute lease).
   * POST /api/app_qy_v1/assist/requests/claim
   */
  async claimAssistRequests(data: {
    types: string[];
    limit?: number;
    claimer: string;
  }): Promise<APIResponse<{
    success: boolean;
    items: AssistRequestItem[];
    lease_minutes: number;
  }>> {
    return this.post('/app_qy_v1/assist/requests/claim', data);
  }

  /**
   * Report a request result (completed / failed / processing).
   * POST /api/app_qy_v1/assist/requests/submit
   */
  async submitAssistRequest(data: {
    id: number;
    status: 'completed' | 'failed' | 'processing';
    result?: any;
    error?: string;
  }): Promise<APIResponse<{ ok: boolean; status: string; already_done?: boolean }>> {
    return this.post('/app_qy_v1/assist/requests/submit', data);
  }

  /**
   * Release leased request(s) back to pending.
   * POST /api/app_qy_v1/assist/requests/release
   */
  async releaseAssistRequests(data: {
    ids: number[];
    error?: string;
  }): Promise<APIResponse<{ success: boolean; released: number }>> {
    return this.post('/app_qy_v1/assist/requests/release', data);
  }

  /**
   * Delete one assist request.
   * DELETE /api/app_qy_v1/assist/requests/{id}
   */
  async deleteAssistRequest(id: number): Promise<APIResponse<{ success: boolean; deleted: number }>> {
    return this.delete(`/app_qy_v1/assist/requests/${encodeURIComponent(String(id))}`);
  }

  /**
   * Perform a GET against an Octane-tasks WEB route.
   *
   * These endpoints live under the Laravel `web` route group (no `/api`
   * prefix). BaseAPI owns timeout, auth, decoding, logging, and errors.
   */
  private async octaneWebGet<T>(path: string): Promise<APIResponse<T>> {
    return this.request<T>({ url: path, method: 'GET', root: true, retry: false });
  }

  /**
   * Get Octane Timer Tasks Status
   * Note: web route (no /api prefix) — see octaneWebGet().
   */
  async getOctaneTasksStatus(): Promise<APIResponse<{
    summary: {
      total_discovered: number;
      total_registered: number;
      total_running: number;
      timer_running: boolean;
      timer_uptime: number | null;
      total_ticks: number;
    };
    tasks: Array<{
      name: string;
      class: string;
      interval: number;
      enabled: boolean;
      registered: boolean;
      running: boolean;
      status: string;
      runtime?: {
        interval: number;
        run_count: number;
        error_count: number;
        last_run: number;
        last_run_ago: number | null;
        last_duration: number | null;
        last_error: string | null;
      };
    }>;
    heartbeat: {
      exists: boolean;
      last_modified?: string;
      seconds_ago?: number;
      is_fresh?: boolean;
      status?: string;
      message?: string;
    };
    timestamp: string;
  }>> {
    return this.octaneWebGet('/octane-tasks/status');
  }

  /**
   * Get Octane Basic Task Objects
   */
  async getOctaneBasicTasks(): Promise<APIResponse<Array<{
    name: string;
    class: string;
    interval: number;
    enabled: boolean;
    registered: boolean;
    status: string;
    last_run: number | null;
    run_count: number;
    error_count: number;
  }>>> {
    return this.octaneWebGet('/octane-tasks/basic');
  }

  /**
   * Get Octane Task Detail
   */
  async getOctaneTaskDetail(taskName: string): Promise<APIResponse<{
    name: string;
    class: string;
    interval: number;
    enabled: boolean;
    registered: boolean;
    running: boolean;
    status: string;
    runtime?: any;
  }>> {
    return this.octaneWebGet(`/octane-tasks/task/${encodeURIComponent(taskName)}`);
  }

  /**
   * Verify Octane Tasks Initialization
   */
  async verifyOctaneTasksInit(): Promise<APIResponse<{
    success: boolean;
    issues: string[];
    summary: {
      total_discovered: number;
      total_registered: number;
      total_running: number;
      timer_running: boolean;
      timer_uptime: number | null;
      total_ticks: number;
    };
    timestamp: string;
  }>> {
    return this.octaneWebGet('/octane-tasks/verify');
  }
}
