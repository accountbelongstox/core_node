import { getHttpBaseUrl } from '@/app_pymatrix_pages/utils/api-urls';
/**
 * PyMatrix Health Check API
 * API service for system health monitoring and status checks
 */

export interface BasicHealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export interface DetailedHealthResponse {
  status: string;
  service: {
    name: string;
    version: string;
    description: string;
  };
  timestamp: string;
  uptime_seconds: number;
  system: {
    platform: string;
    platform_version: string;
    python_version: string;
    architecture: string;
  };
  resources: {
    cpu: {
      usage_percent: number;
      cores: number;
    };
    memory: {
      total_mb: number;
      available_mb: number;
      used_percent: number;
    };
    disk: {
      total_gb: number;
      free_gb: number;
      used_percent: number;
    };
  };
  performance_metrics: Record<string, any>;
}

class PyMatrixHealthAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getHttpBaseUrl();
  }

  /**
   * Basic health check
   */
  async getBasicHealth(): Promise<BasicHealthResponse> {
    const response = await fetch(`${this.baseUrl}/api/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Detailed health check with system information
   */
  async getDetailedHealth(): Promise<DetailedHealthResponse> {
    const response = await fetch(`${this.baseUrl}/api/health/detailed`);

    if (!response.ok) {
      throw new Error(`Detailed health check failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Format uptime seconds to human-readable string
   */
  formatUptime(uptimeSeconds: number): string {
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join(' ') : '< 1m';
  }

  /**
   * Get resource status level (ok, warning, critical)
   */
  getResourceStatus(usagePercent: number): 'ok' | 'warning' | 'critical' {
    if (usagePercent < 70) return 'ok';
    if (usagePercent < 90) return 'warning';
    return 'critical';
  }
}

export const pyMatrixHealthAPI = new PyMatrixHealthAPI();
