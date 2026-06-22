import { BaseAPI, DEFAULT_REQUEST_TIMEOUT_MS } from '../base/BaseAPI';
import { APIResponse } from '../../types';

// ==================== Global Task / Worker substrate types ====================
// laravel_main's distributed worker queue (`global_tasks` + `workers` tables).
// These are real /api routes (TaskController / WorkerController, ApiResponse
// trait) — NOT the Octane timer web routes below. BaseAPI unwraps the trait's
// `{ success, data, message }` envelope, so `response.data` is the inner shape.

/** Row shape returned by GET /api/task/list. */
export interface GlobalTaskItem {
  task_id: string;
  app_name: string;
  task_type: string;
  execution_type: string;
  status: string;
  progress: number;
  assigned_to: string | null;
  created_at: string | null;
}

/** Full task returned by GET /api/task/{taskId}/status. */
export interface GlobalTaskDetail extends GlobalTaskItem {
  result: any;
  error: string | null;
  updated_at: string | null;
  // Lifecycle metadata (optional so an older backend that omits them still renders).
  payload?: any;
  priority?: number;
  retry_count?: number;
  max_retries?: number;
  timeout_seconds?: number;
  assigned_at?: string | null;
  timeout_at?: string | null;
  completed_at?: string | null;
}

/** GET /api/task/stats → data.stats (covers the full status vocabulary). */
export interface GlobalTaskStats {
  total: number;
  pending: number;
  assigned: number;
  processing: number;
  completed: number;
  completed_demo: number;
  failed: number;
  cancelled: number;
}

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

/** Full GET /api/task-center/overview payload (envelope already unwrapped). */
export interface TaskCenterOverview {
  scheduler: {
    running: boolean;
    uptime: number | null;
    total_ticks: number;
    tasks: TaskCenterSchedulerTask[];
  };
  queue: {
    stats: GlobalTaskStats;
  };
  workers: {
    stats: GlobalWorkerStats;
  };
  relations: TaskCenterRelation[];
  timestamp: string;
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
    return this.post('/server-manager/restart', {});
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
  async cancelGlobalTask(taskId: string): Promise<APIResponse<{ task_id: string; status: string }>> {
    return this.post(`/task/${encodeURIComponent(taskId)}/cancel`, {});
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

  /**
   * Perform a GET against an Octane-tasks WEB route.
   *
   * These endpoints live under the Laravel `web` route group (no `/api`
   * prefix), so they intentionally bypass BaseAPI.request() / buildURL()
   * (which would prepend `this.prefix === '/api'`). This helper still
   * mirrors BaseAPI's reliability contract: a fail-fast AbortController
   * timeout, the module's shared headers, a non-JSON guard, and a
   * normalized network/timeout error instead of a raw fetch TypeError.
   */
  private async octaneWebGet<T>(path: string): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${path}`;
    const timeoutMs = this.timeout || DEFAULT_REQUEST_TIMEOUT_MS;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...this.headers,
        },
        signal: abortController.signal,
      });

      const contentType = response.headers.get('content-type');
      const isJson = contentType !== null && contentType.includes('application/json');

      if (!isJson) {
        const text = await response.text();
        return {
          success: false,
          data: null,
          error: `Invalid response format. Expected JSON but got: ${contentType || 'unknown'}. Response preview: ${text.slice(0, 200)}`,
          status: response.status,
        };
      }

      const data = await response.json();
      return {
        success: response.ok,
        data: response.ok ? (data.data !== undefined ? data.data : data) : null,
        error: response.ok ? null : (data.error || data.message || 'Request failed'),
        status: response.status,
      };
    } catch (error: any) {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const isTimeout = error?.name === 'AbortError' || error?.name === 'TimeoutError';
      const isNetworkError = isOffline || error?.name === 'TypeError';

      let message: string;
      if (isTimeout) {
        message = 'Request timed out';
      } else if (isOffline) {
        message = 'Network unreachable (device is offline)';
      } else if (isNetworkError) {
        message = 'Network unreachable (server did not respond)';
      } else {
        message = error?.message || 'Network error';
      }

      return {
        success: false,
        data: null,
        error: message,
        status: 0,
        isTimeout,
        isNetworkError,
      } as APIResponse<T>;
    } finally {
      clearTimeout(timeoutId);
    }
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
