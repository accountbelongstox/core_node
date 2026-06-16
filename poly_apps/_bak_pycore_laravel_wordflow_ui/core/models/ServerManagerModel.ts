import { api } from '../api';

/**
 * Service Status
 */
export type ServiceStatus = 'RUNNING' | 'STOPPED_ENABLED' | 'STOPPED_DISABLED' | 'NOT_FOUND' | 'UNKNOWN';

/**
 * Service Info
 */
export interface ServiceInfo {
  name: string;
  status: ServiceStatus;
  enabled: boolean;
}

/**
 * Service Operation Result
 */
export interface ServiceOperationResult {
  success: boolean;
  serviceName: string;
  status?: ServiceStatus;
  output?: string;
  error?: string;
}

/**
 * Service Logs Result
 */
export interface ServiceLogsResult {
  success: boolean;
  serviceName: string;
  lines: number;
  logs: string;
}

/**
 * ServerManagerModel
 * Handles system service management
 * NO try-catch - trust API response format
 * All validation and error handling in the model
 */
export class ServerManagerModel {
  private services: ServiceInfo[] = [];
  private isLocalhost: boolean = false;

  constructor() {
    this.checkLocalhost();
  }

  /**
   * Check if running on localhost
   */
  private checkLocalhost(): void {
    const hostname = window.location.hostname;
    this.isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  }

  /**
   * Check if server management is available
   */
  isAvailable(): boolean {
    return this.isLocalhost;
  }

  /**
   * Get error message for non-local access
   */
  getAccessDeniedMessage(): string {
    return 'Server management is only available on localhost for security reasons.';
  }

  /**
   * List all services
   */
  async listServices(): Promise<ServiceInfo[]> {
    if (!this.isLocalhost) {
      return [];
    }

    const response = await api.serverManager.listServices();

    if (!response.success) {
      this.services = [];
      return [];
    }

    this.services = response.data.services;
    return this.services;
  }

  /**
   * Get cached services
   */
  getServices(): ServiceInfo[] {
    return [...this.services];
  }

  /**
   * Get service by name
   */
  getService(serviceName: string): ServiceInfo | null {
    const service = this.services.find(s => s.name === serviceName);
    if (service) {
      return { ...service };
    }
    return null;
  }

  /**
   * Get service status
   */
  async getStatus(serviceName: string): Promise<ServiceInfo | null> {
    if (!this.isLocalhost) {
      return null;
    }

    const response = await api.serverManager.getStatus(serviceName);

    if (!response.success) {
      return null;
    }

    const serviceInfo: ServiceInfo = {
      name: response.data.service_name,
      status: response.data.status,
      enabled: response.data.enabled,
    };

    this.updateServiceInCache(serviceInfo);
    return serviceInfo;
  }

  /**
   * Start service
   */
  async startService(serviceName: string): Promise<ServiceOperationResult> {
    if (!this.isLocalhost) {
      return {
        success: false,
        serviceName,
        error: this.getAccessDeniedMessage(),
      };
    }

    const response = await api.serverManager.startService(serviceName);

    if (!response.success) {
      return {
        success: false,
        serviceName,
        error: response.error || 'Failed to start service',
        output: response.data?.output,
      };
    }

    const result: ServiceOperationResult = {
      success: true,
      serviceName: response.data.service_name,
      status: response.data.status,
      output: response.data.output,
    };

    this.updateServiceInCache({
      name: result.serviceName,
      status: result.status || 'RUNNING',
      enabled: true,
    });

    return result;
  }

  /**
   * Stop service
   */
  async stopService(serviceName: string): Promise<ServiceOperationResult> {
    if (!this.isLocalhost) {
      return {
        success: false,
        serviceName,
        error: this.getAccessDeniedMessage(),
      };
    }

    const response = await api.serverManager.stopService(serviceName);

    if (!response.success) {
      return {
        success: false,
        serviceName,
        error: response.error || 'Failed to stop service',
        output: response.data?.output,
      };
    }

    const result: ServiceOperationResult = {
      success: true,
      serviceName: response.data.service_name,
      status: response.data.status,
      output: response.data.output,
    };

    this.updateServiceInCache({
      name: result.serviceName,
      status: result.status || 'STOPPED_DISABLED',
      enabled: false,
    });

    return result;
  }

  /**
   * Restart service
   */
  async restartService(serviceName: string): Promise<ServiceOperationResult> {
    if (!this.isLocalhost) {
      return {
        success: false,
        serviceName,
        error: this.getAccessDeniedMessage(),
      };
    }

    const response = await api.serverManager.restartService(serviceName);

    if (!response.success) {
      return {
        success: false,
        serviceName,
        error: response.error || 'Failed to restart service',
        output: response.data?.output,
      };
    }

    const result: ServiceOperationResult = {
      success: true,
      serviceName: response.data.service_name,
      status: response.data.status,
      output: response.data.output,
    };

    this.updateServiceInCache({
      name: result.serviceName,
      status: result.status || 'RUNNING',
      enabled: true,
    });

    return result;
  }

  /**
   * Get service logs
   */
  async getLogs(serviceName: string, lines: number = 50): Promise<ServiceLogsResult> {
    if (!this.isLocalhost) {
      return {
        success: false,
        serviceName,
        lines: 0,
        logs: this.getAccessDeniedMessage(),
      };
    }

    const response = await api.serverManager.getLogs(serviceName, lines);

    if (!response.success) {
      return {
        success: false,
        serviceName,
        lines: 0,
        logs: response.error || 'Failed to retrieve logs',
      };
    }

    return {
      success: true,
      serviceName: response.data.service_name,
      lines: response.data.lines,
      logs: response.data.logs,
    };
  }

  /**
   * Toggle auto-start
   */
  async toggleAutoStart(serviceName: string): Promise<ServiceOperationResult> {
    if (!this.isLocalhost) {
      return {
        success: false,
        serviceName,
        error: this.getAccessDeniedMessage(),
      };
    }

    const response = await api.serverManager.toggleAutoStart(serviceName);

    if (!response.success) {
      return {
        success: false,
        serviceName,
        error: response.error || 'Failed to toggle auto-start',
      };
    }

    const result: ServiceOperationResult = {
      success: true,
      serviceName: response.data.service_name,
    };

    const service = this.getService(serviceName);
    if (service) {
      this.updateServiceInCache({
        ...service,
        enabled: response.data.enabled,
      });
    }

    return result;
  }

  /**
   * Update service in cache
   */
  private updateServiceInCache(serviceInfo: ServiceInfo): void {
    const index = this.services.findIndex(s => s.name === serviceInfo.name);
    if (index > -1) {
      this.services[index] = serviceInfo;
    } else {
      this.services.push(serviceInfo);
    }
  }

  /**
   * Get status display text
   */
  getStatusText(status: ServiceStatus): string {
    if (status === 'RUNNING') {
      return 'Running';
    }
    if (status === 'STOPPED_ENABLED') {
      return 'Stopped (Auto-start enabled)';
    }
    if (status === 'STOPPED_DISABLED') {
      return 'Stopped';
    }
    if (status === 'NOT_FOUND') {
      return 'Not Found';
    }
    return 'Unknown';
  }

  /**
   * Get status color
   */
  getStatusColor(status: ServiceStatus): string {
    if (status === 'RUNNING') {
      return 'green';
    }
    if (status === 'STOPPED_ENABLED' || status === 'STOPPED_DISABLED') {
      return 'yellow';
    }
    if (status === 'NOT_FOUND') {
      return 'red';
    }
    return 'gray';
  }

  /**
   * Restart current Octane service (auto-detect)
   * Automatically detects and restarts the service for current Laravel installation
   */
  async restartCurrent(): Promise<ServiceOperationResult> {
    if (!this.isLocalhost) {
      return {
        success: false,
        serviceName: 'unknown',
        error: this.getAccessDeniedMessage(),
      };
    }

    const response = await api.serverManager.restartCurrent();

    if (!response.success) {
      return {
        success: false,
        serviceName: 'unknown',
        error: response.error || 'Failed to restart current service',
        output: response.data?.output,
      };
    }

    const result: ServiceOperationResult = {
      success: true,
      serviceName: response.data.service_name,
      status: response.data.status,
      output: response.data.output,
    };

    this.updateServiceInCache({
      name: result.serviceName,
      status: result.status || 'RUNNING',
      enabled: true,
    });

    return result;
  }
}

export const serverManagerModel = new ServerManagerModel();
