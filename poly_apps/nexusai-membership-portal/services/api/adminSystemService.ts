import { apiClient } from './client';
import { SystemInfo, OEMSettings } from './systemService';

/**
 * Admin System Service
 * For administrators to manage system settings
 */
export const adminSystemService = {
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

  async updateOEMSettings(settings: OEMSettings): Promise<OEMSettings> {
    const response = await apiClient.put<OEMSettings>('/admin/oem-settings', settings);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to update OEM settings');
  },
};

