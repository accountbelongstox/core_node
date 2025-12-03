/**
 * ITTools HTTP Client Service
 * Standardized HTTP client with automatic endpoint selection and retry logic
 *
 * Features:
 * - Automatic API endpoint selection based on availability
 * - Retry logic with exponential backoff
 * - Automatic namespace header injection
 * - Type-safe response handling
 * - Error normalization
 */

import { apiEndpointsHelper, buildApiUrl } from '@/common/config/api-endpoints';
import type { ApiEndpoint } from '@/common/config/api-endpoints';

/**
 * Standard API Response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: number;
}

/**
 * Request options
 */
export interface RequestOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Request body (for POST/PUT) */
  body?: any;
  /** Skip automatic error handling */
  skipErrorHandling?: boolean;
}

/**
 * HTTP Methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * HTTP Client class
 */
class HttpClient {
  private readonly namespace: string = 'ittools';
  private readonly defaultTimeout: number = 30000;
  private readonly defaultRetries: number = 2;

  /**
   * Build complete URL with query parameters
   */
  private buildUrl(endpoint: ApiEndpoint, path: string, params?: Record<string, string | number | boolean>): string {
    const baseUrl = buildApiUrl(endpoint, path);

    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.append(key, String(value));
    }

    return `${baseUrl}?${searchParams.toString()}`;
  }

  /**
   * Build request headers
   */
  private buildHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App-Namespace': this.namespace,
      ...customHeaders,
    };

    return headers;
  }

  /**
   * Execute HTTP request with retry logic
   */
  private async executeRequest<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      headers: customHeaders,
      params,
      body,
      skipErrorHandling = false,
    } = options;

    let lastError: Error | null = null;
    let attempts = 0;

    // Get active endpoint
    const endpoint = apiEndpointsHelper.getActiveEndpoint();
    if (!endpoint) {
      return {
        success: false,
        error: 'No active API endpoint available',
        code: 'NO_ENDPOINT',
      };
    }

    while (attempts <= retries) {
      try {
        const url = this.buildUrl(endpoint, path, params);
        const headers = this.buildHeaders(customHeaders);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestInit: RequestInit = {
          method,
          headers,
          signal: controller.signal,
        };

        // Add body for POST/PUT/PATCH
        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          requestInit.body = JSON.stringify(body);
        }

        const response = await fetch(url, requestInit);

        clearTimeout(timeoutId);

        // Parse response
        let responseData: any;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        // Check HTTP status
        if (!response.ok) {
          // Try to extract error message from response
          const errorMessage =
            typeof responseData === 'object' && responseData.error
              ? responseData.error
              : `HTTP ${response.status}: ${response.statusText}`;

          if (!skipErrorHandling) {
            throw new Error(errorMessage);
          }

          return {
            success: false,
            error: errorMessage,
            code: `HTTP_${response.status}`,
            data: responseData,
          };
        }

        // Success response
        if (typeof responseData === 'object' && 'success' in responseData) {
          return responseData as ApiResponse<T>;
        }

        // Wrap raw data in standard response
        return {
          success: true,
          data: responseData as T,
          timestamp: Date.now(),
        };

      } catch (error) {
        lastError = error as Error;
        attempts++;

        // If this is the last attempt or a non-retryable error, throw
        if (attempts > retries) {
          break;
        }

        // Exponential backoff
        const backoffDelay = Math.min(1000 * Math.pow(2, attempts), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError?.message || 'Unknown error occurred',
      code: 'REQUEST_FAILED',
    };
  }

  /**
   * GET request
   */
  async get<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('GET', path, options);
  }

  /**
   * POST request
   */
  async post<T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('POST', path, { ...options, body });
  }

  /**
   * PUT request
   */
  async put<T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PUT', path, { ...options, body });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('DELETE', path, options);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PATCH', path, { ...options, body });
  }

  /**
   * Execute a tool with typed parameters
   */
  async executeTool<TParams = any, TResult = any>(
    toolId: string,
    params: TParams
  ): Promise<ApiResponse<TResult>> {
    return this.post<TResult>(`/api/ittools/v1/tools/${toolId}/execute`, params);
  }

  /**
   * Check server health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/api/ittools/v1/status', {
        timeout: 5000,
        retries: 0,
      });
      return response.success;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance
 */
export const httpClient = new HttpClient();

/**
 * Export as default
 */
export default httpClient;
