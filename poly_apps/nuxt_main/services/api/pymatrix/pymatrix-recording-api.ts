/**
 * PyMatrix Recording and Screenshot API Service
 * Handles video recording and screenshot capture operations
 */

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

  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Start recording device screen
   */
  async startRecording(
    serial: string,
    options: RecordingStartRequest = {}
  ): Promise<RecordingStartResponse | ApiErrorResponse> {
    try {
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
    } catch (error) {
      console.error('[PyMatrixRecordingAPI] Start recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Stop recording device screen
   */
  async stopRecording(
    serial: string
  ): Promise<RecordingStopResponse | ApiErrorResponse> {
    try {
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
    } catch (error) {
      console.error('[PyMatrixRecordingAPI] Stop recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Capture screenshot of device screen
   */
  async captureScreenshot(
    serial: string,
    options: ScreenshotRequest = {}
  ): Promise<ScreenshotResponse | ApiErrorResponse> {
    try {
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
    } catch (error) {
      console.error('[PyMatrixRecordingAPI] Screenshot error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get recording status (if backend supports it)
   */
  async getRecordingStatus(
    serial: string
  ): Promise<{ isRecording: boolean; recordingId?: string } | ApiErrorResponse> {
    try {
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
    } catch (error) {
      console.error('[PyMatrixRecordingAPI] Get recording status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const pyMatrixRecordingAPI = new PyMatrixRecordingAPI();
