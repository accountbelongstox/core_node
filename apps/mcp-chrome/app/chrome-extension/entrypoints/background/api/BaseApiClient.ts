/**
 * Base API Client
 * Foundation class for all API clients with extensibility and error handling
 * Under 200 lines
 */

import { getCachedBackendTimeoutMs } from '@/utils/backend-timeout';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export abstract class BaseApiClient {
  protected baseUrl: string;
  protected defaultHeaders: Record<string, string>;
  protected defaultTimeout: number;

  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };
    // Seed from the configurable backend-timeout cache (default 10 min). Live
    // changes are picked up per-request via getCachedBackendTimeoutMs() below,
    // so a settings change takes effect without reconstructing this client.
    this.defaultTimeout = getCachedBackendTimeoutMs();
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async request<T = any>(
    endpoint: string,
    config: RequestConfig = {},
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      retries = 3,
      retryDelay = 1000,
    } = config;
    // An explicit per-call timeout (e.g. pullTasks long-poll) wins; otherwise
    // resolve the configurable backend timeout live from the cache.
    const timeout = config.timeout ?? getCachedBackendTimeoutMs();

    const url = `${this.baseUrl}${endpoint}`;
    const requestHeaders = { ...this.defaultHeaders, ...headers };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let response: Response;
        try {
          response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });
        } finally {
          // Clear the abort timer on every path - a fetch rejection (network
          // error / AbortError) skips the success-path clearTimeout and would
          // otherwise leave a dangling timer per failed attempt. Mirrors the
          // finally block in api-health-listener.ts.
          clearTimeout(timeoutId);
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new ApiError(
            data?.message || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            data,
          );
        }

        return data as ApiResponse<T>;
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error instanceof ApiError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        // Don't retry on abort
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout', 408);
        }

        // Retry on network errors or server errors (5xx)
        if (attempt < retries) {
          console.warn(`[API] Request failed, retrying (${attempt + 1}/${retries})...`);
          await this.delay(retryDelay * (attempt + 1));
          continue;
        }

        // All retries exhausted
        throw error;
      }
    }

    throw lastError || new ApiError('Request failed');
  }

  /**
   * GET request
   */
  protected async get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    config?: Omit<RequestConfig, 'method' | 'body'>,
  ): Promise<ApiResponse<T>> {
    const queryString = params ? this.buildQueryString(params) : '';
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    return this.request<T>(url, { ...config, method: 'GET' });
  }

  /**
   * POST request
   */
  protected async post<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, 'method'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  /**
   * PUT request
   */
  protected async put<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<RequestConfig, 'method'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  /**
   * DELETE request
   */
  protected async delete<T = any>(
    endpoint: string,
    config?: Omit<RequestConfig, 'method' | 'body'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  /**
   * Build query string from params
   */
  protected buildQueryString(params: Record<string, any>): string {
    const entries = Object.entries(params).filter(([_, value]) => value !== undefined && value !== null);
    return new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString();
  }

  /**
   * Delay utility
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update base URL
   */
  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Get current base URL
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }
}
