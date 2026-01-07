import { apiManager } from './ApiManager';
import { ErrorHandler } from '../../utils/errorHandler';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private getAuthToken(): string | null {
    return localStorage.getItem('token');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const baseUrl = apiManager.getCurrentBaseUrl();
    const token = this.getAuthToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });

      // Handle non-JSON responses
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = text ? { message: text } : {};
      }

      if (!response.ok) {
        // 401 Unauthorized - Clear token and redirect to login
        if (response.status === 401) {
          localStorage.removeItem('token');
          if (window.location.hash !== '#/') {
            window.location.hash = '/';
          }
        }

        const errorResponse: ApiResponse<T> = {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          message: data.message || 'Request failed',
        };

        // Unified error handling (don't show toast here, let caller decide)
        return errorResponse;
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      // Unified network error handling
      const errorResponse: ApiResponse<T> = {
        success: false,
        error: 'Network error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      return errorResponse;
    }
  }

  async get<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  async delete<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  async patch<T>(path: string, body?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }
}

export const apiClient = new ApiClient();

