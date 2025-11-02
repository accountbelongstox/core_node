import type { DeviceConfig, PyMatrixConfigResponse } from '../../../types/pymatrix';

interface ConfigUpdatePayload {
  max_size?: number;
  bit_rate?: number;
  max_fps?: number;
  codec?: 'h264' | 'h265' | 'av1';
  control?: boolean;
  locked_video_orientation?: number;
}

class PyMatrixConfigAPI {
  private baseUrl: string;
  private apiPrefix: string;

  constructor() {
    this.baseUrl = 'http://localhost:8000';
    this.apiPrefix = '/api';
  }

  async getConfig(): Promise<PyMatrixConfigResponse> {
    return await $fetch<PyMatrixConfigResponse>(`${this.baseUrl}${this.apiPrefix}/config`, {
      method: 'GET',
      headers: {
        'X-App-Namespace': 'pymatrix',
      },
    });
  }

  async getGlobal(): Promise<DeviceConfig> {
    const response = await $fetch<{ success: boolean; config: DeviceConfig }>(`${this.baseUrl}${this.apiPrefix}/config/global`, {
      method: 'GET',
      headers: {
        'X-App-Namespace': 'pymatrix',
      },
    });
    return response.config;
  }

  async updateGlobal(payload: ConfigUpdatePayload): Promise<DeviceConfig> {
    const response = await $fetch<{ success: boolean; config: DeviceConfig }>(`${this.baseUrl}${this.apiPrefix}/config/global`, {
      method: 'PATCH',
      headers: {
        'X-App-Namespace': 'pymatrix',
        'Content-Type': 'application/json',
      },
      body: payload,
    });
    return response.config;
  }

  async updateDevice(deviceName: string, payload: ConfigUpdatePayload): Promise<DeviceConfig> {
    const response = await $fetch<{ success: boolean; config: DeviceConfig }>(`${this.baseUrl}${this.apiPrefix}/config/device/${encodeURIComponent(deviceName)}`, {
      method: 'PATCH',
      headers: {
        'X-App-Namespace': 'pymatrix',
        'Content-Type': 'application/json',
      },
      body: payload,
    });
    return response.config;
  }

  async deleteDevice(deviceName: string): Promise<void> {
    await $fetch(`${this.baseUrl}${this.apiPrefix}/config/device/${encodeURIComponent(deviceName)}`, {
      method: 'DELETE',
      headers: {
        'X-App-Namespace': 'pymatrix',
      },
    });
  }
}

export const pyMatrixConfigAPI = new PyMatrixConfigAPI();
