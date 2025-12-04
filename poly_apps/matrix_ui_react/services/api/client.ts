// API Client - Using Key-based endpoint calls
import { API_CONFIG } from './config';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_CONFIG.baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {} } = options;

    try {
      const url = `${this.baseURL}${endpoint}`;
      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (body && method !== 'GET') {
        if (body instanceof FormData) {
          // Remove Content-Type for FormData to let browser set it
          delete config.headers!['Content-Type'];
          config.body = body;
        } else {
          config.body = JSON.stringify(body);
        }
      }

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data.error?.code || `HTTP_${response.status}`,
            message: data.error?.message || data.message || 'Request failed',
          },
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Network request failed',
        },
      };
    }
  }

  // Health Check APIs
  async getHealth(): Promise<ApiResponse> {
    return this.request('/health');
  }

  async getHealthDetailed(): Promise<ApiResponse> {
    return this.request('/health/detailed');
  }

  // Device Management APIs
  async getDevices(): Promise<ApiResponse> {
    return this.request('/api/devices');
  }

  async getDevice(serial: string): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}`);
  }

  async connectDevice(serial: string, config?: any): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/connect`, {
      method: 'POST',
      body: config || {},
    });
  }

  async disconnectDevice(serial: string): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/disconnect`, {
      method: 'POST',
    });
  }

  // Screen Control APIs
  async screenPower(serial: string, action: 'on' | 'off' | 'toggle'): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/screen/power`, {
      method: 'POST',
      body: { action },
    });
  }

  async setBrightness(serial: string, level: number): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/screen/brightness`, {
      method: 'POST',
      body: { level },
    });
  }

  async getBrightness(serial: string): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/screen/brightness`);
  }

  async setRotation(serial: string, rotation: 0 | 90 | 180 | 270): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/screen/rotation`, {
      method: 'POST',
      body: { rotation },
    });
  }

  async getRotation(serial: string): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/screen/rotation`);
  }

  async enableAutoRotation(serial: string): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/screen/auto-rotation/enable`, {
      method: 'POST',
    });
  }

  async disableAutoRotation(serial: string): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/screen/auto-rotation/disable`, {
      method: 'POST',
    });
  }

  // File Management APIs
  async pushFile(serial: string, file: File, remotePath: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('remotePath', remotePath);
    return this.request(`/api/devices/${serial}/push`, {
      method: 'POST',
      body: formData,
    });
  }

  async installApk(serial: string, file: File, reinstall = false): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reinstall', String(reinstall));
    return this.request(`/api/devices/${serial}/install`, {
      method: 'POST',
      body: formData,
    });
  }

  async uninstallPackage(serial: string, packageName: string): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/uninstall`, {
      method: 'POST',
      body: { packageName },
    });
  }

  async getPackages(serial: string, filter?: string): Promise<ApiResponse> {
    const endpoint = filter
      ? `/api/devices/${serial}/packages?filter=${encodeURIComponent(filter)}`
      : `/api/devices/${serial}/packages`;
    return this.request(endpoint);
  }

  // Control APIs
  async sendTouch(
    serial: string,
    action: string,
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number,
    pressure = 1.0
  ): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/control/touch`, {
      method: 'POST',
      body: {
        action,
        x,
        y,
        pressure,
        screenWidth,
        screenHeight,
      },
    });
  }

  async sendKey(serial: string, keyCode: number, action: string, metaState = 0): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/control/key`, {
      method: 'POST',
      body: {
        action,
        keyCode,
        metaState,
      },
    });
  }

  async sendSystemKey(serial: string, keyCode: number): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/control/systemkey`, {
      method: 'POST',
      body: { keyCode },
    });
  }

  async sendText(serial: string, text: string): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/control/text`, {
      method: 'POST',
      body: { text },
    });
  }

  async sendScroll(
    serial: string,
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number,
    hScroll = 0,
    vScroll = 0
  ): Promise<ApiResponse> {
    return this.request(`/api/devices/${serial}/control/scroll`, {
      method: 'POST',
      body: {
        x,
        y,
        screenWidth,
        screenHeight,
        hScroll,
        vScroll,
      },
    });
  }

  // Group Management APIs
  async getGroups(): Promise<ApiResponse> {
    return this.request('/api/groups');
  }

  async getGroup(groupId: string): Promise<ApiResponse> {
    return this.request(`/api/groups/${groupId}`);
  }

  async createGroup(name: string, parentId?: string): Promise<ApiResponse> {
    return this.request('/api/groups', {
      method: 'POST',
      body: { name, parentId },
    });
  }

  async updateGroup(groupId: string, name: string): Promise<ApiResponse> {
    return this.request(`/api/groups/${groupId}`, {
      method: 'PUT',
      body: { name },
    });
  }

  async deleteGroup(groupId: string): Promise<ApiResponse> {
    return this.request(`/api/groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  async addDeviceToGroup(groupId: string, serial: string): Promise<ApiResponse> {
    return this.request(`/api/groups/${groupId}/devices`, {
      method: 'POST',
      body: { serial },
    });
  }

  async removeDeviceFromGroup(groupId: string, serial: string): Promise<ApiResponse> {
    return this.request(`/api/groups/${groupId}/devices/${serial}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();

