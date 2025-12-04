/**
 * PyMatrix Recording and Screenshot API Service
 * Handles video recording and screenshot capture operations
 */

import { getHttpBaseUrl } from '@/app_pymatrix_pages/utils/api-urls';

export interface RecordingStartRequest {
  format?: 'mp4' | 'mkv';
  mode?: 'normal' | 'background';
  quality?: 'high' | 'medium' | 'low';
  maxDuration?: number; // seconds
}

export interface RecordingStartResponse {
  success: boolean;
  recordingId: string;
  startTime: string; // ISO8601
  format: string;
  mode: string;
}

export interface RecordingStopResponse {
  success: boolean;
  recordingId: string;
  duration: number; // seconds
  fileSize: number; // bytes
  filePath: string;
}

export interface ScreenshotRequest {
  format?: 'png' | 'jpg';
}

export interface ScreenshotResponse {
  success: boolean;
  screenshotId: string;
  filePath: string;
  timestamp: string; // ISO8601
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

class PyMatrixRecordingAPI {
  private baseUrl: string;

  constructor() {
    // ✅ Using centralized config from api-urls
    this.baseUrl = getHttpBaseUrl();
  }

  /**
   * Start recording device screen
   */
  async startRecording(
    serial: string,
    options: RecordingStartRequest = {}
  ): Promise<RecordingStartResponse | ApiErrorResponse> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await fetch(
        `${this.baseUrl}/api/devices/${serial}/recording/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            format: options.format || 'mp4',
            mode: options.mode || 'normal',
            quality: options.quality || 'high',
            maxDuration: options.maxDuration || 1800,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
        };
      }

      return data;
  }

  /**
   * Stop recording device screen
   */
  async stopRecording(
    serial: string
  ): Promise<RecordingStopResponse | ApiErrorResponse> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await fetch(
        `${this.baseUrl}/api/devices/${serial}/recording/stop`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
        };
      }

      return data;
  }

  /**
   * Capture screenshot of device screen
   */
  async captureScreenshot(
    serial: string,
    options: ScreenshotRequest = {}
  ): Promise<ScreenshotResponse | ApiErrorResponse> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await fetch(
        `${this.baseUrl}/api/devices/${serial}/screenshot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            format: options.format || 'png',
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
        };
      }

      return data;
  }

  /**
   * Get recording status (if backend supports it)
   */
  async getRecordingStatus(
    serial: string
  ): Promise<{ isRecording: boolean; recordingId?: string } | ApiErrorResponse> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await fetch(
        `${this.baseUrl}/api/devices/${serial}/recording/status`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
        };
      }

      return data;
  }
}

// Export singleton instance
export const pyMatrixRecordingAPI = new PyMatrixRecordingAPI();
