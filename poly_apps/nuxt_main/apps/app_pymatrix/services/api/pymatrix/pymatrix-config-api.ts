/**
 * PyMatrix Configuration API Service
 * Provides configuration management for global and device-specific settings
 */

import { buildApiUrl } from '@/app_pymatrix_pages/utils/api-urls';
import type { DeviceConfig, PyMatrixConfigResponse } from '@/types/pymatrix';

interface ConfigAPIResponse<T = any> {
  success: boolean;
  config?: T;
  device?: string;
}

interface DeviceConfigResponse {
  success: boolean;
  device: string;
  config: DeviceConfig;
}

/**
 * PyMatrix Configuration API
 */
export const pyMatrixConfigAPI = {
  /**
   * Get full configuration (global + all device configs)
   */
  async getConfig(): Promise<PyMatrixConfigResponse> {
    const url = buildApiUrl('/config');

    const response = await $fetch<ConfigAPIResponse>(url, {
      method: 'GET',
    });

    if (!response.success || !response.config) {
      throw new Error('Failed to fetch configuration');
    }

    return {
      success: true,
      config: response.config as PyMatrixConfigResponse['config'],
    };
  },

  /**
   * Get global configuration
   */
  async getGlobal(): Promise<DeviceConfig> {
    const url = buildApiUrl('/config/global');

    const response = await $fetch<ConfigAPIResponse<DeviceConfig>>(url, {
      method: 'GET',
    });

    if (!response.success || !response.config) {
      throw new Error('Failed to fetch global configuration');
    }

    return response.config;
  },

  /**
   * Update global configuration
   */
  async updateGlobal(payload: Partial<DeviceConfig>): Promise<DeviceConfig> {
    const url = buildApiUrl('/config/global');

    const response = await $fetch<ConfigAPIResponse<DeviceConfig>>(url, {
      method: 'PATCH',
      body: payload,
    });

    if (!response.success || !response.config) {
      throw new Error('Failed to update global configuration');
    }

    return response.config;
  },

  /**
   * Get device-specific configuration
   */
  async getDevice(deviceName: string): Promise<DeviceConfig> {
    const url = buildApiUrl(`/config/device/${encodeURIComponent(deviceName)}`);

    const response = await $fetch<DeviceConfigResponse>(url, {
      method: 'GET',
    });

    if (!response.success || !response.config) {
      throw new Error(`Failed to fetch configuration for device: ${deviceName}`);
    }

    return response.config;
  },

  /**
   * Update device-specific configuration
   */
  async updateDevice(deviceName: string, payload: Partial<DeviceConfig>): Promise<DeviceConfig> {
    const url = buildApiUrl(`/config/device/${encodeURIComponent(deviceName)}`);

    const response = await $fetch<DeviceConfigResponse>(url, {
      method: 'PATCH',
      body: payload,
    });

    if (!response.success || !response.config) {
      throw new Error(`Failed to update configuration for device: ${deviceName}`);
    }

    return response.config;
  },

  /**
   * Delete device-specific configuration
   */
  async deleteDevice(deviceName: string): Promise<void> {
    const url = buildApiUrl(`/config/device/${encodeURIComponent(deviceName)}`);

    const response = await $fetch<{ success: boolean; device: string }>(url, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(`Failed to delete configuration for device: ${deviceName}`);
    }
  },
};
