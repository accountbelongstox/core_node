import { apiClient } from './client';

export interface SystemInfo {
  version: string;
  uptime: number;
  environment: string;
  timezone: number;
  datastoreProvider: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  components: {
    redis?: {
      status: string;
      connected: boolean;
      ping?: number;
    };
    logger?: {
      status: string;
    };
    memory?: {
      status: string;
      used: number;
      total: number;
      percentage: number;
    };
  };
  config?: Record<string, any>;
}

export interface OEMSettings {
  siteName?: string;
  siteIcon?: string;
  adminButtonVisible?: boolean;
  publicStatsEnabled?: boolean;
}

export const systemService = {
  async getHealth(): Promise<HealthStatus> {
    const response = await apiClient.get<HealthStatus>('/health');
    if (response.success && response.data) {
      return response.data;
    }
    // health endpoint may not return success field
    return response.data as HealthStatus;
  },

  async getSystemInfo(): Promise<SystemInfo> {
    const response = await apiClient.get<SystemInfo>('/admin/system/info');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch system info');
  },

  async clearCache(): Promise<void> {
    const response = await apiClient.post('/admin/system/clear-cache');
    if (!response.success) {
      throw new Error(response.message || 'Failed to clear cache');
    }
  },

  async getLogs(params?: { level?: string; limit?: number; startTime?: string; endTime?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.append(key, String(value));
        }
      });
    }
    const path = `/admin/logs${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<any[]>(path);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.message || 'Failed to fetch logs');
  },

  async getOEMSettings(): Promise<OEMSettings> {
    const response = await apiClient.get<OEMSettings>('/admin/oem-settings');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch OEM settings');
  },

  async updateOEMSettings(settings: OEMSettings): Promise<OEMSettings> {
    const response = await apiClient.put<OEMSettings>('/admin/oem-settings', settings);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to update OEM settings');
  },

  async getPublicStats(): Promise<any> {
    const response = await apiClient.get<any>('/admin/public-stats');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch public stats');
  },
};

