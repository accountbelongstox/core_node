import { BaseAPI } from '../base/BaseAPI';
import { ApiResponse } from '../base/types';

/**
 * ServerManager API Module
 * Manages systemd services (local access only)
 */
export class ServerManagerAPI extends BaseAPI {
  /**
   * List all services
   */
  async listServices(): Promise<ApiResponse<{
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
  async getStatus(serviceName: string): Promise<ApiResponse<{
    service_name: string;
    status: string;
    enabled: boolean;
  }>> {
    return this.get(`/server-manager/services/${serviceName}/status`);
  }

  /**
   * Start service
   */
  async startService(serviceName: string): Promise<ApiResponse<{
    service_name: string;
    status: string;
    output: string;
  }>> {
    return this.post(`/server-manager/services/${serviceName}/start`, {});
  }

  /**
   * Stop service
   */
  async stopService(serviceName: string): Promise<ApiResponse<{
    service_name: string;
    status: string;
    output: string;
  }>> {
    return this.post(`/server-manager/services/${serviceName}/stop`, {});
  }

  /**
   * Restart service
   */
  async restartService(serviceName: string): Promise<ApiResponse<{
    service_name: string;
    status: string;
    output: string;
  }>> {
    return this.post(`/server-manager/services/${serviceName}/restart`, {});
  }

  /**
   * Get service logs
   */
  async getLogs(serviceName: string, lines: number = 50): Promise<ApiResponse<{
    service_name: string;
    lines: number;
    logs: string;
  }>> {
    return this.get(`/server-manager/services/${serviceName}/logs`, { lines });
  }

  /**
   * Toggle auto-start
   */
  async toggleAutoStart(serviceName: string): Promise<ApiResponse<{
    service_name: string;
    enabled: boolean;
    action: string;
  }>> {
    return this.post(`/server-manager/services/${serviceName}/toggle-autostart`, {});
  }

  /**
   * Restart current Octane service (auto-detect)
   */
  async restartCurrent(): Promise<ApiResponse<{
    service_name: string;
    status: string;
    output: string;
  }>> {
    return this.post('/server-manager/restart', {});
  }

  /**
   * Get Octane Timer Tasks Status
   */
  /**
   * Get Octane Timer Tasks Status
   * Note: These are web routes, not API routes, so we use direct fetch
   */
  async getOctaneTasksStatus(): Promise<ApiResponse<{
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
        last_run_ago: string | null;
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
    // These are web routes, not API routes, so we bypass the prefix
    const url = `${this.config.baseURL}/octane-tasks/status`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });
    const data = await response.json();
    return {
      success: response.ok,
      data: data.data || data,
      error: response.ok ? null : data.error || 'Request failed',
      status: response.status
    };
  }

  /**
   * Get Octane Basic Task Objects
   */
  async getOctaneBasicTasks(): Promise<ApiResponse<Array<{
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
    const url = `${this.config.baseURL}/octane-tasks/basic`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });
    const data = await response.json();
    return {
      success: response.ok,
      data: data.data || data,
      error: response.ok ? null : data.error || 'Request failed',
      status: response.status
    };
  }

  /**
   * Get Octane Task Detail
   */
  async getOctaneTaskDetail(taskName: string): Promise<ApiResponse<{
    name: string;
    class: string;
    interval: number;
    enabled: boolean;
    registered: boolean;
    running: boolean;
    status: string;
    runtime?: any;
  }>> {
    const url = `${this.config.baseURL}/octane-tasks/task/${taskName}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });
    const data = await response.json();
    return {
      success: response.ok,
      data: data.data || data,
      error: response.ok ? null : data.error || 'Request failed',
      status: response.status
    };
  }

  /**
   * Verify Octane Tasks Initialization
   */
  async verifyOctaneTasksInit(): Promise<ApiResponse<{
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
    const url = `${this.config.baseURL}/octane-tasks/verify`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });
    const data = await response.json();
    return {
      success: response.ok,
      data: data.data || data,
      error: response.ok ? null : data.error || 'Request failed',
      status: response.status
    };
  }
}
