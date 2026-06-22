import { APIResponse, APIRequestConfig, APIModuleConfig } from '../../types';
import { apiCache } from './APICache';
import { htmlErrorManager } from '../../../services/HtmlErrorManager';
import { appendLog } from '../../logstore/logStore';

/**
 * Endpoints excluded from the global log panel: high-frequency background
 * probes (health detection, debug-status) would drown real operations.
 */
const LOG_EXCLUDED_PATHS = ['/api_info', '/debug-status', '/health'];

/** Append a request outcome to the global log store (noise-filtered). */
function logRequestOutcome(
  method: string,
  url: string,
  status: number,
  ms: number,
  error?: string | null
): void {
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  if (LOG_EXCLUDED_PATHS.some((p) => path.includes(p))) return;
  const base = `${method} ${path} → ${status || 'ERR'} (${Math.round(ms)}ms)`;
  if (error) {
    appendLog('error', 'api', `${base} — ${error}`);
  } else {
    appendLog(method === 'GET' ? 'info' : 'success', 'api', base);
  }
}

/**
 * Default per-request timeout (ms). Used as a fail-fast ceiling when neither
 * the per-call config nor the module config provides a timeout, and as a hard
 * cap so an unreachable backend can never hang a request indefinitely.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

/**
 * Single source of truth for the active API base URL.
 *
 * Previously every API module froze `baseURL` at construction time and
 * `APIService.updateBaseURL()` had to recreate each module to change it. Any
 * module the recreation list forgot (serverManager, systemConfig) silently
 * kept the stale construction-time host (the window-hostname guess), so its
 * requests hit a different endpoint than the one the ApiManager/UI resolved —
 * e.g. octane-tasks calls timing out against the LAN IP while the switcher
 * showed localhost.
 *
 * Now the base URL lives here, shared by every BaseAPI instance via a getter.
 * `updateBaseURL()` only updates this value, so a single write re-points
 * EVERY module at once (and module auth/headers are no longer dropped by a
 * recreate). "以能使用的为准": whatever the ApiManager resolves becomes the
 * one base URL all modules use — there is no per-module snapshot to desync.
 */
let sharedBaseURL: string | null = null;

/** Normalize away trailing slashes so `${base}${'/path'}` never doubles `//`. */
function normalizeBaseURL(url: string): string {
  return typeof url === 'string' ? url.replace(/\/+$/, '') : url;
}

/**
 * Set the process-wide active API base URL. Called by APIService.updateBaseURL
 * (which App.tsx / ApiEndpointSwitcher drive from the resolved endpoint).
 */
export function setSharedBaseURL(url: string): void {
  sharedBaseURL = normalizeBaseURL(url);
}

/** The current shared base URL, or null if none has been set yet. */
export function getSharedBaseURL(): string | null {
  return sharedBaseURL;
}

/**
 * Normalized network error shape thrown/returned by the request layer.
 * The `isTimeout` / `isNetworkError` flags let the UI show a friendly
 * "request timed out" / "network unreachable" message instead of a raw
 * fetch `TypeError`.
 */
export interface NormalizedRequestError extends Error {
  isTimeout?: boolean;
  isNetworkError?: boolean;
  status?: number;
  cause?: unknown;
}

/**
 * Convert a low-level fetch/abort failure into a NormalizedRequestError with
 * stable, human-readable flags. Does not swallow the error — it enriches it.
 */
function normalizeRequestError(error: any): NormalizedRequestError {
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  // AbortController.abort() / AbortSignal.timeout() surface as AbortError.
  const isTimeout = error?.name === 'AbortError' || error?.name === 'TimeoutError';

  // fetch() rejects with a TypeError for DNS/connection/CORS failures.
  const isNetworkError = isOffline || error?.name === 'TypeError';

  let message: string;
  if (isTimeout) {
    message = 'Request timed out';
  } else if (isOffline) {
    message = 'Network unreachable (device is offline)';
  } else if (isNetworkError) {
    message = 'Network unreachable (server did not respond)';
  } else {
    message = error?.message || 'Network error';
  }

  const normalized = new Error(message) as NormalizedRequestError;
  normalized.name = isTimeout ? 'RequestTimeoutError' : 'NetworkError';
  normalized.isTimeout = isTimeout;
  normalized.isNetworkError = isNetworkError;
  normalized.status = 0;
  normalized.cause = error;
  return normalized;
}

/**
 * BaseAPI - Base class for all API modules
 */
export class BaseAPI {
  /**
   * Per-instance fallback used only until a shared base URL is set (i.e. the
   * construction-time guess). Once APIService.updateBaseURL runs, the shared
   * value wins for every module.
   */
  private seedBaseURL: string;
  /**
   * Per-instance temporary override. Normally null so the module follows the
   * process-wide shared base URL in lock-step. Settings' "test connection"
   * flow assigns `baseURL` to probe an arbitrary URL, then assigns the old
   * value back; the setter clears this override on restore so the module
   * resumes following the global (auto-failover-aware) endpoint.
   */
  private instanceOverride: string | null = null;
  protected prefix: string;
  protected headers: Record<string, string>;
  protected timeout: number;
  protected retryConfig: { count: number; delay: number };

  /**
   * Dynamically resolved base URL. Always prefers the process-wide shared
   * value so every module follows the ApiManager-resolved endpoint in
   * lock-step; falls back to this instance's construction-time seed only
   * before any endpoint has been selected.
   */
  protected get baseURL(): string {
    if (this.instanceOverride !== null) return this.instanceOverride;
    const shared = getSharedBaseURL();
    return shared !== null ? shared : this.seedBaseURL;
  }

  /**
   * Temporarily point only this module instance at `url`. Assigning the
   * currently-resolved value back (shared, or the construction-time seed)
   * clears the override so the instance rejoins the global lock-step
   * endpoint instead of pinning a now-stale URL.
   */
  protected set baseURL(url: string) {
    const shared = getSharedBaseURL();
    const resolved = shared !== null ? shared : this.seedBaseURL;
    this.instanceOverride = url === resolved ? null : normalizeBaseURL(url);
  }

  constructor(config: APIModuleConfig) {
    this.seedBaseURL = normalizeBaseURL(config.baseURL);
    this.prefix = config.prefix || '';
    this.headers = config.headers || {};
    // Fail-fast default: never wait longer than DEFAULT_REQUEST_TIMEOUT_MS
    // unless the module explicitly opts into a longer timeout.
    this.timeout = config.timeout || DEFAULT_REQUEST_TIMEOUT_MS;
    this.retryConfig = config.retry || { count: 3, delay: 1000 };
  }

  /**
   * GET request
   */
  async get<T>(url: string, params?: Record<string, any>, cache: boolean = false, cacheTTL: number = 300000, retry: boolean = true): Promise<APIResponse<T>> {
    const cacheKey = cache ? this.getCacheKey('GET', url, params) : null;

    // Check the cache
    if (cacheKey) {
      const cached = apiCache.get<T>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          error: null,
          status: 200,
          message: 'From cache'
        };
      }
    }

    const response = await this.request<T>({
      url,
      method: 'GET',
      params,
      cache,
      cacheTTL,
      retry
    });

    // Store in the cache
    if (cacheKey && response.success && response.data) {
      apiCache.set(cacheKey, response.data, cacheTTL);
    }

    return response;
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>({
      url,
      method: 'POST',
      data
    });
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>({
      url,
      method: 'PUT',
      data
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string): Promise<APIResponse<T>> {
    return this.request<T>({
      url,
      method: 'DELETE'
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>({
      url,
      method: 'PATCH',
      data
    });
  }

  /**
   * Core request method
   */
  protected async request<T>(config: APIRequestConfig, retryCount: number = 0): Promise<APIResponse<T>> {
    const fullURL = this.buildURL(config.url);
    const isFormData = config.data instanceof FormData;
    const startedAt = performance.now();

    // Explicit AbortController so we can guarantee a fail-fast timeout AND
    // deterministically clear the timer in finally (no leaked timers).
    const timeoutMs = config.timeout || this.timeout || DEFAULT_REQUEST_TIMEOUT_MS;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    const requestConfig: RequestInit = {
      method: config.method,
      headers: {
        ...this.headers,
        ...config.headers
      },
      signal: abortController.signal
    };

    // Only set Content-Type for non-FormData requests
    if (!isFormData) {
      requestConfig.headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...requestConfig.headers
      };
    } else {
      requestConfig.headers = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...requestConfig.headers
      };
    }

    // Add query parameters
    const url = config.params ? this.addQueryParams(fullURL, config.params) : fullURL;

    // Add body
    if (config.data) {
      requestConfig.body = isFormData ? config.data : JSON.stringify(config.data);
    }

    try {
      const response = await fetch(url, requestConfig);

      // Check content type
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      if (!isJson) {
        // Not JSON response - likely HTML error page
        const text = await response.text();

        // Trigger HTML error debug modal
        htmlErrorManager.triggerError(
          text,
          url,
          response.status
        );

        logRequestOutcome(config.method, url, response.status, performance.now() - startedAt, 'non-JSON response');
        return {
          success: false,
          data: null,
          error: `Invalid response format. Expected JSON but got: ${contentType || 'unknown'}. Response preview: ${text.slice(0, 200)}`,
          status: response.status
        };
      }

      const data = await response.json();

      if (response.ok) {
        logRequestOutcome(config.method, url, response.status, performance.now() - startedAt);
        return {
          success: true,
          data: data.data || data,
          error: null,
          status: response.status,
          message: data.message
        };
      } else {
        // Error response - trigger HTML error modal if debug info available
        if (data.exception || data.trace) {
          // Pass JSON directly as string - don't convert to HTML
          htmlErrorManager.triggerError(
            JSON.stringify(data, null, 2),
            url,
            response.status
          );
        }

        logRequestOutcome(
          config.method,
          url,
          response.status,
          performance.now() - startedAt,
          data.error || data.message || 'Request failed'
        );
        return {
          success: false,
          data: null,
          error: data.error || data.message || 'Request failed',
          status: response.status,
          debugInfo: data,
        };
      }
    } catch (error: any) {
      // Normalize timeout / offline / connection failures so callers get
      // stable isTimeout / isNetworkError flags and a friendly message
      // instead of a raw fetch TypeError.
      const normalized = normalizeRequestError(error);

      // Retry logic (retry on transient network/timeout failures only).
      // Callers can opt out (config.retry === false) so probe/info GETs
      // never fan out into a 3x retry storm against a slow/dead endpoint.
      const retryEnabled = config.retry !== false;
      if (retryEnabled && retryCount < this.retryConfig.count && this.shouldRetry(error)) {
        await this.delay(this.retryConfig.delay * (retryCount + 1));
        return this.request<T>(config, retryCount + 1);
      }

      // Preserve the existing return contract (resolve with an APIResponse),
      // but enrich it with the normalized error flags for the UI layer.
      // (Retried attempts return through the recursive call above, so this
      // logs once per FINAL failure, not once per attempt.)
      logRequestOutcome(config.method, fullURL, 0, performance.now() - startedAt, normalized.message);
      return {
        success: false,
        data: null,
        error: normalized.message,
        status: 0,
        isTimeout: normalized.isTimeout,
        isNetworkError: normalized.isNetworkError,
      } as APIResponse<T>;
    } finally {
      // Always clear the abort timer — prevents leaked timers on both the
      // success path and the error/retry path.
      clearTimeout(timeoutId);
    }
  }

  /**
   * Batch requests
   */
  async batch<T>(configs: APIRequestConfig[]): Promise<APIResponse<T>[]> {
    return Promise.all(configs.map(config => this.request<T>(config)));
  }

  /**
   * Build the full URL
   */
  protected buildURL(path: string): string {
    // If path is already a full URL (starts with http:// or https://), return it directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const cleanPrefix = this.prefix ? (this.prefix.endsWith('/') ? this.prefix.slice(0, -1) : this.prefix) : '';
    return `${this.baseURL}${cleanPrefix}/${cleanPath}`;
  }

  /**
   * Add query parameters
   */
  protected addQueryParams(url: string, params: Record<string, any>): string {
    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Generate the cache key
   */
  protected getCacheKey(method: string, url: string, params?: Record<string, any>): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${method}:${url}:${paramStr}`;
  }

  /**
   * Whether the request should be retried
   */
  protected shouldRetry(error: any): boolean {
    // Retry on network errors or timeouts
    return error.name === 'TypeError' || error.name === 'AbortError';
  }

  /**
   * Delay
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set a header
   */
  setHeader(key: string, value: string): void {
    this.headers[key] = value;
  }

  /**
   * Remove a header
   */
  removeHeader(key: string): void {
    delete this.headers[key];
  }

  /**
   * Clear all custom headers
   */
  clearHeaders(): void {
    this.headers = {};
  }
}
