import { BaseAPI, DEFAULT_REQUEST_TIMEOUT_MS } from '../base/BaseAPI';
import { APIResponse } from '../../types';

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
