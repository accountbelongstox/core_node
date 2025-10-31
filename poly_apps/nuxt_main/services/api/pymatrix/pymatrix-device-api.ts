/**
 * PyMatrix Device API Service
 *
 * Handles all device-related HTTP API calls to pyMatrix backend
 * Following Nuxt multi-app namespace architecture
 */

import type { Device } from '~/types/pymatrix';

export interface DeviceListResponse {
  devices: Device[];
  total: number;
}

export interface DeviceInfoResponse {
  device: Device;
}

export interface DeviceActionResponse {
  success: boolean;
  message: string;
  device?: Device;
}

export class PyMatrixDeviceAPI {
  private baseUrl: string;
  private apiPrefix: string;

  constructor() {
    // Get from pymatrix config
    this.baseUrl = 'http://localhost:8000';
    this.apiPrefix = '/api';
  }

  /**
   * Get list of all devices (connected and available)
   */
  async getDeviceList(): Promise<DeviceListResponse> {
    try {
      const response = await $fetch<{ devices: any[] }>(`${this.baseUrl}${this.apiPrefix}/devices/list`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': 'pymatrix',
          'Content-Type': 'application/json'
        }
      });

      // Transform backend response to frontend Device type
      const devices: Device[] = response.devices.map((d: any) => ({
        serial: d.serial,
        name: d.model || d.serial,
        model: d.model || 'Unknown',
        state: this.mapDeviceState(d.state),
        resolution: {
          width: d.resolution?.width || 1080,
          height: d.resolution?.height || 2340
        },
        streaming: false,
        controllable: d.state === 'device',
        isHost: false
      }));

      return {
        devices,
        total: devices.length
      };
    } catch (error) {
      console.error('[PyMatrixDeviceAPI] Failed to get device list:', error);
      throw error;
    }
  }

  /**
   * Get information about a specific device
   */
  async getDeviceInfo(serial: string): Promise<DeviceInfoResponse> {
    try {
      const response = await $fetch<{ device: any }>(`${this.baseUrl}${this.apiPrefix}/devices/${serial}/info`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': 'pymatrix',
          'Content-Type': 'application/json'
        }
      });

      const device: Device = {
        serial: response.device.serial,
        name: response.device.model || response.device.serial,
        model: response.device.model || 'Unknown',
        state: this.mapDeviceState(response.device.state),
        resolution: {
          width: response.device.resolution?.width || 1080,
          height: response.device.resolution?.height || 2340
        },
        streaming: false,
        controllable: response.device.state === 'device',
        isHost: false
      };

      return { device };
    } catch (error) {
      console.error(`[PyMatrixDeviceAPI] Failed to get device info for ${serial}:`, error);
      throw error;
    }
  }

  /**
   * Connect to a device
   */
  async connectDevice(
    serial: string,
    options?: {
      maxSize?: number;
      bitRate?: number;
      maxFps?: number;
    }
  ): Promise<DeviceActionResponse> {
    try {
      // Convert bitRate from Mbps to bps if provided
      const body = {
        max_size: options?.maxSize || 720,
        bit_rate: options?.bitRate ? options.bitRate * 1000000 : 8000000,
        max_fps: options?.maxFps || 60
      };

      const response = await $fetch<{ success: boolean; message: string; device?: any }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/connect`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body
        }
      );

      let device: Device | undefined;
      if (response.device) {
        device = {
          serial: response.device.serial,
          name: response.device.model || response.device.serial,
          model: response.device.model || 'Unknown',
          state: 'connected',
          resolution: {
            width: response.device.resolution?.width || 1080,
            height: response.device.resolution?.height || 2340
          },
          streaming: false,
          controllable: true,
          isHost: false
        };
      }

      return {
        success: response.success,
        message: response.message,
        device
      };
    } catch (error) {
      console.error(`[PyMatrixDeviceAPI] Failed to connect device ${serial}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from a device
   */
  async disconnectDevice(serial: string): Promise<DeviceActionResponse> {
    try {
      const response = await $fetch<{ success: boolean; message: string }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/disconnect`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: response.success,
        message: response.message
      };
    } catch (error) {
      console.error(`[PyMatrixDeviceAPI] Failed to disconnect device ${serial}:`, error);
      throw error;
    }
  }

  /**
   * Map backend device state to frontend state
   */
  private mapDeviceState(backendState: string): 'connected' | 'disconnected' | 'connecting' {
    switch (backendState) {
      case 'device':
        return 'connected';
      case 'offline':
      case 'unauthorized':
        return 'disconnected';
      default:
        return 'disconnected';
    }
  }
}

// Export singleton instance
export const pyMatrixDeviceAPI = new PyMatrixDeviceAPI();
