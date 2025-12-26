import { getHttpBaseUrl } from '@/app_pymatrix_pages/utils/api-urls';
import type { Device } from '@/types/pymatrix';

const APP_NAMESPACE = 'pymatrix';
const JSON_HEADERS = {
  'X-App-Namespace': APP_NAMESPACE,
  'Content-Type': 'application/json'
};

export interface DeviceListResponse {
  devices: Device[];
  total: number;
}

export interface DeviceInfoResponse {
  device: Device | null;
  error?: string;
}

export interface DeviceActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  device?: Device;
}

const mapDeviceState = (backendState: string): 'connected' | 'disconnected' | 'connecting' => {
  switch (backendState) {
    case 'device':
      return 'connected';
    case 'connecting':
      return 'connecting';
    default:
      return 'disconnected';
  }
};

const transformBackendDevice = (
  backendDevice: Record<string, any>,
  overrideState?: 'connected' | 'disconnected' | 'connecting'
): Device => ({
  serial: backendDevice.serial,
  name: backendDevice.model || backendDevice.serial,
  model: backendDevice.model || 'Unknown',
  state: overrideState ?? mapDeviceState(backendDevice.state),
  resolution: {
    width: backendDevice.resolution?.width ?? 1080,
    height: backendDevice.resolution?.height ?? 2340
  },
  streaming: Boolean(backendDevice.streaming),
  controllable: backendDevice.state === 'device' || overrideState === 'connected',
  isHost: Boolean(backendDevice.isHost)
});

export class PyMatrixDeviceAPI {
  private readonly baseUrl: string;
  private readonly apiPrefix = '/api';

  constructor() {
    this.baseUrl = getHttpBaseUrl();
  }

  private buildUrl(path: string) {
    return `${this.baseUrl}${this.apiPrefix}${path}`;
  }

  private formatError(message: string, error: unknown): string {
    console.error(`[PyMatrixDeviceAPI] ${message}`, error);
    return error instanceof Error ? error.message : 'Unknown error';
  }

  async getDeviceList(): Promise<DeviceListResponse> {
    const response = await $fetch<{ devices: Record<string, any>[] }>(this.buildUrl('/devices'), {
      method: 'GET',
      headers: JSON_HEADERS
    });

    const devices = (response.devices ?? []).map((device) => transformBackendDevice(device));
    return {
      devices,
      total: devices.length
    };
  }

  async getDeviceInfo(serial: string): Promise<DeviceInfoResponse> {
    try {
      const response = await $fetch<{ device: Record<string, any> }>(
        this.buildUrl(`/devices/${serial}/info`),
        {
          method: 'GET',
          headers: JSON_HEADERS
        }
      );

      return {
        device: transformBackendDevice(response.device)
      };
    } catch (error) {
      return {
        device: null,
        error: this.formatError(`Failed to fetch device info for ${serial}`, error)
      };
    }
  }

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
        locked_video_orientation: options?.lockedVideoOrientation
      };

      Object.keys(body).forEach((key) => body[key] === undefined && delete body[key]);

      const response = await $fetch<{ success: boolean; message: string; device?: Record<string, any> }>(
        this.buildUrl(`/devices/${serial}/connect`),
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body
        }
      );

      return {
        success: response.success,
        message: response.message,
        device: response.device ? transformBackendDevice(response.device, 'connected') : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to connect device ${serial}`, error)
      };
    }
  }

  async disconnectDevice(serial: string): Promise<DeviceActionResponse> {
    try {
      const response = await $fetch<{ success: boolean; message: string }>(
        this.buildUrl(`/devices/${serial}/disconnect`),
        {
          method: 'POST',
          headers: JSON_HEADERS
        }
      );

      return {
        success: response.success,
        message: response.message
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to disconnect device ${serial}`, error)
      };
    }
  }

  async getClipboard(serial: string): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      const response = await $fetch<{ text: string }>(this.buildUrl(`/devices/${serial}/clipboard`), {
        method: 'GET',
        headers: JSON_HEADERS
      });

      return {
        success: true,
        text: response.text
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to get clipboard for ${serial}`, error)
      };
    }
  }

  async setClipboard(serial: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(this.buildUrl(`/devices/${serial}/clipboard`), {
        method: 'POST',
        headers: JSON_HEADERS,
        body: { text }
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to set clipboard for ${serial}`, error)
      };
    }
  }

  async controlScreenPower(
    serial: string,
    action: 'on' | 'off' | 'toggle'
  ): Promise<{ success: boolean; state?: string; error?: string }> {
    try {
      const response = await $fetch<{ success: boolean; state: string }>(
        this.buildUrl(`/devices/${serial}/screen/power`),
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: { action }
        }
      );

      return {
        success: response.success,
        state: response.state
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to control screen power for ${serial}`, error)
      };
    }
  }

  async setScreenBrightness(
    serial: string,
    level: number
  ): Promise<{ success: boolean; level?: number; error?: string }> {
    try {
      const response = await $fetch<{ success: boolean; level: number }>(
        this.buildUrl(`/devices/${serial}/screen/brightness`),
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: { level }
        }
      );

      return {
        success: response.success,
        level: response.level
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to set brightness for ${serial}`, error)
      };
    }
  }

  async setScreenRotation(
    serial: string,
    rotation: 0 | 90 | 180 | 270
  ): Promise<{ success: boolean; rotation?: number; error?: string }> {
    try {
      const response = await $fetch<{ success: boolean; rotation: number }>(
        this.buildUrl(`/devices/${serial}/screen/rotation`),
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: { rotation }
        }
      );

      return {
        success: response.success,
        rotation: response.rotation
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to set rotation for ${serial}`, error)
      };
    }
  }

  async enableAutoRotation(serial: string): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(this.buildUrl(`/devices/${serial}/screen/auto-rotation/enable`), {
        method: 'POST',
        headers: JSON_HEADERS
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to enable auto-rotation for ${serial}`, error)
      };
    }
  }

  async disableAutoRotation(serial: string): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(this.buildUrl(`/devices/${serial}/screen/auto-rotation/disable`), {
        method: 'POST',
        headers: JSON_HEADERS
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to disable auto-rotation for ${serial}`, error)
      };
    }
  }
}

export const pyMatrixDeviceAPI = new PyMatrixDeviceAPI();
