/**
 * PyMatrix Configuration API Service
 * Provides configuration management for global and device-specific settings
 */

import type { DeviceConfig, PyMatrixConfigResponse } from '../../../../types/pymatrix';

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
    const config = useRuntimeConfig();
    const baseURL = config.public.pyMatrixAPI || 'http://localhost:8889';

    const response = await $fetch<ConfigAPIResponse>(`${baseURL}/config`, {
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
    const config = useRuntimeConfig();
    const baseURL = config.public.pyMatrixAPI || 'http://localhost:8889';

    const response = await $fetch<ConfigAPIResponse<DeviceConfig>>(`${baseURL}/config/global`, {
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
    const config = useRuntimeConfig();
    const baseURL = config.public.pyMatrixAPI || 'http://localhost:8889';

    const response = await $fetch<ConfigAPIResponse<DeviceConfig>>(`${baseURL}/config/global`, {
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
    const config = useRuntimeConfig();
    const baseURL = config.public.pyMatrixAPI || 'http://localhost:8889';

    const response = await $fetch<DeviceConfigResponse>(`${baseURL}/config/device/${encodeURIComponent(deviceName)}`, {
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
    const config = useRuntimeConfig();
    const baseURL = config.public.pyMatrixAPI || 'http://localhost:8889';

    const response = await $fetch<DeviceConfigResponse>(`${baseURL}/config/device/${encodeURIComponent(deviceName)}`, {
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
    const config = useRuntimeConfig();
    const baseURL = config.public.pyMatrixAPI || 'http://localhost:8889';

    const response = await $fetch<{ success: boolean; device: string }>(`${baseURL}/config/device/${encodeURIComponent(deviceName)}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(`Failed to delete configuration for device: ${deviceName}`);
    }
  },
};
