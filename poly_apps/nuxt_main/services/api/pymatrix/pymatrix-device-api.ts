/**
 * PyMatrix Device API Service
 *
 * Handles all device-related HTTP API calls to pyMatrix backend
 * Following Nuxt multi-app namespace architecture
 */

import type { Device } from '../../types/pymatrix';

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
      codec?: 'h264' | 'h265' | 'av1';
      control?: boolean;
      lockedVideoOrientation?: number;
      deviceName?: string;
    }
  ): Promise<DeviceActionResponse> {
    try {
      const body: Record<string, unknown> = {
        device_name: options?.deviceName,
        max_size: options?.maxSize,
        bit_rate: options?.bitRate,
        max_fps: options?.maxFps,
        codec: options?.codec,
        control: options?.control,
        locked_video_orientation: options?.lockedVideoOrientation,
      };

      Object.keys(body).forEach((key) => {
        if (body[key] === undefined) {
          delete body[key];
        }
      });

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
   * Get device clipboard content
   */
  async getClipboard(serial: string): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      const response = await $fetch<{ text: string }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/clipboard`,
        {
          method: 'GET',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        text: response.text
      };
    } catch (error) {
      console.error(`[PyMatrixDeviceAPI] Failed to get clipboard for ${serial}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set device clipboard content
   */
  async setClipboard(
    serial: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/clipboard`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: { text }
        }
      );

      return { success: true };
    } catch (error) {
      console.error(`[PyMatrixDeviceAPI] Failed to set clipboard for ${serial}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Control screen power
   */
  async controlScreenPower(
    serial: string,
    action: 'on' | 'off' | 'toggle'
  ): Promise<{ success: boolean; state?: string; error?: string }> {
    try {
      const response = await $fetch<{ success: boolean; state: string }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/screen/power`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: { action }
        }
      );

      return {
        success: true,
        state: response.state
      };
    } catch (error) {
      console.error(`[PyMatrixDeviceAPI] Failed to control screen power for ${serial}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set screen brightness
   */
  async setScreenBrightness(
    serial: string,
    level: number
  ): Promise<{ success: boolean; level?: number; error?: string }> {
    try {
      const response = await $fetch<{ success: boolean; level: number }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/screen/brightness`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: { level }
        }
      );

      return {
        success: true,
        level: response.level
      };
    } catch (error) {
      console.error(`[PyMatrixDeviceAPI] Failed to set brightness for ${serial}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set screen rotation
   */
  async setScreenRotation(
    serial: string,
    rotation: 0 | 90 | 180 | 270
  ): Promise<{ success: boolean; rotation?: number; error?: string }> {
    try {
      const response = await $fetch<{ success: boolean; rotation: number }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/screen/rotation`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: { rotation }
        }
      );

      return {
        success: true,
        rotation: response.rotation
      };
    } catch (error) {
      console.error(`[PyMatrixDeviceAPI] Failed to set rotation for ${serial}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
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
