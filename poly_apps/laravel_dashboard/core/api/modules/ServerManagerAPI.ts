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
}
