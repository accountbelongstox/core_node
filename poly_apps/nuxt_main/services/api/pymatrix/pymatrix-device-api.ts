/**
 * PyMatrix Device API Service
 *
 * Handles all device-related HTTP API calls to pyMatrix backend
 * Following Nuxt multi-app namespace architecture
 */

import type { Device } from '../../types/pymatrix';
import { getHttpBaseUrl } from '@/apps/app_pymatrix/utils_app_pymatrix/api-urls';

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

/**
 * Transform backend device response to frontend Device type
 * Single source of truth for device transformation logic
 */
function transformBackendDevice(backendDevice: any, state?: 'connected' | 'disconnected' | 'connecting'): Device {
  return {
    serial: backendDevice.serial,
    name: backendDevice.model || backendDevice.serial,
    model: backendDevice.model || 'Unknown',
    state: state || mapDeviceStateHelper(backendDevice.state),
    resolution: {
      width: backendDevice.resolution?.width || 1080,
      height: backendDevice.resolution?.height || 2340
    },
    streaming: false,
    controllable: backendDevice.state === 'device' || state === 'connected',
    isHost: false
  };
}

/**
 * Helper function to map backend device state
 */
function mapDeviceStateHelper(backendState: string): 'connected' | 'disconnected' | 'connecting' {
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

export class PyMatrixDeviceAPI {
  private baseUrl: string;
  private apiPrefix: string;

  constructor() {
    // ✅ Using centralized config from api-urls
    this.baseUrl = getHttpBaseUrl();
    this.apiPrefix = '/api';
  }

  /**
   * Get list of all devices (connected and available)
   */
  async getDeviceList(): Promise<DeviceListResponse> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await $fetch<{ devices: any[] }>(`${this.baseUrl}${this.apiPrefix}/devices`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': 'pymatrix',
          'Content-Type': 'application/json'
        }
      });

      // Transform backend response to frontend Device type
      const devices: Device[] = response.devices.map((d: any) => transformBackendDevice(d));

      return {
        devices,
        total: devices.length
      };
  }

  /**
   * Get information about a specific device
   */
  async getDeviceInfo(serial: string): Promise<DeviceInfoResponse> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await $fetch<{ device: any }>(`${this.baseUrl}${this.apiPrefix}/devices/${serial}/info`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': 'pymatrix',
          'Content-Type': 'application/json'
        }
      });

      const device: Device = transformBackendDevice(response.device);

      return { device };
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
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
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
        device = transformBackendDevice(response.device, 'connected');
      }

      return {
        success: response.success,
        message: response.message,
        device
      };
  }

  /**
   * Disconnect from a device
   */
  async disconnectDevice(serial: string): Promise<DeviceActionResponse> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
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
  }

  /**
   * Get device clipboard content
   */
  async getClipboard(serial: string): Promise<{ success: boolean; text?: string; error?: string }> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
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
  }

  /**
   * Set device clipboard content
   */
  async setClipboard(
    serial: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
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
  }

  /**
   * Control screen power
   */
  async controlScreenPower(
    serial: string,
    action: 'on' | 'off' | 'toggle'
  ): Promise<{ success: boolean; state?: string; error?: string }> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
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
  }

  /**
   * Set screen brightness
   */
  async setScreenBrightness(
    serial: string,
    level: number
  ): Promise<{ success: boolean; level?: number; error?: string }> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await $fetch<{ success: boolean; level: number }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/screen/brightness`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace'
