/**
 * PyMatrix Group Batch Operations API Service
 * Handles all group-related batch operations to pyMatrix backend
 * Following Nuxt multi-app namespace architecture
 */

import { getHttpBaseUrl } from '@/apps/app_pymatrix/utils_app_pymatrix/api-urls';

export interface BatchOperationResult {
  success: boolean;
  totalDevices: number;
  successfulDevices: number;
  failedDevices: number;
  results: Array<{
    serial: string;
    success: boolean;
    error?: string;
    data?: any;
  }>;
}

export interface BatchScreenshotRequest {
  format?: 'png' | 'jpg';
}

export interface BatchRecordingRequest {
  action: 'start' | 'stop';
  format?: 'mp4' | 'mkv';
  mode?: 'normal' | 'background';
  quality?: 'high' | 'medium' | 'low';
}

export interface BatchSystemKeyRequest {
  action: 'home' | 'back' | 'recent' | 'power' | 'volume_up' | 'volume_down';
}

export interface BatchScreenPowerRequest {
  action: 'on' | 'off' | 'toggle';
}

export interface BatchBrightnessRequest {
  level: number; // 0-255
}

export class PyMatrixGroupAPI {
  private baseUrl: string;
  private apiPrefix: string;

  constructor() {
    // ✅ Using centralized config from api-urls
    this.baseUrl = getHttpBaseUrl();
    this.apiPrefix = '/api';
  }

  /**
   * Batch screenshot for all devices in group
   */
  async batchScreenshot(
    groupId: string,
    options: BatchScreenshotRequest = {}
  ): Promise<BatchOperationResult> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await $fetch<BatchOperationResult>(
        `${this.baseUrl}${this.apiPrefix}/groups/${groupId}/batch/screenshot`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: {
            format: options.format || 'png'
          }
        }
      );

      return response;
  }

  /**
   * Batch recording control for all devices in group
   */
  async batchRecording(
    groupId: string,
    request: BatchRecordingRequest
  ): Promise<BatchOperationResult> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await $fetch<BatchOperationResult>(
        `${this.baseUrl}${this.apiPrefix}/groups/${groupId}/batch/recording`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: {
            action: request.action,
            format: request.format || 'mp4',
            mode: request.mode || 'normal',
            quality: request.quality || 'high'
          }
        }
      );

      return response;
  }

  /**
   * Batch system key press for all devices in group
   */
  async batchSystemKey(
    groupId: string,
    request: BatchSystemKeyRequest
  ): Promise<BatchOperationResult> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await $fetch<BatchOperationResult>(
        `${this.baseUrl}${this.apiPrefix}/groups/${groupId}/batch/systemkey`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: {
            action: request.action
          }
        }
      );

      return response;
  }

  /**
   * Batch screen power control for all devices in group
   */
  async batchScreenPower(
    groupId: string,
    request: BatchScreenPowerRequest
  ): Promise<BatchOperationResult> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await $fetch<BatchOperationResult>(
        `${this.baseUrl}${this.apiPrefix}/groups/${groupId}/batch/screen/power`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: {
            action: request.action
          }
        }
      );

      return response;
  }

  /**
   * Batch brightness control for all devices in group
   */
  async batchBrightness(
    groupId: string,
    request: BatchBrightnessRequest
  ): Promise<BatchOperationResult> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await $fetch<BatchOperationResult>(
        `${this.baseUrl}${this.apiPrefix}/groups/${groupId}/batch/screen/brightness`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: {
            level: request.level
          }
        }
      );

      return response;
  }
}

// Export singleton instance
export const pyMatrixGroupAPI = new PyMatrixGroupAPI();
