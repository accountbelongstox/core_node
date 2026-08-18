/**
 * Transport-level types for the shared Laravel API library.
 * Single definition site — app-level type registries re-export from here.
 */
export interface APIResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  status: number;
  message?: string;
  isTimeout?: boolean;
  isNetworkError?: boolean;
  /** Raw error body when success is false (e.g. error_code for auth). */
  debugInfo?: { error_code?: string; [key: string]: any };
}

export interface APIRequestConfig {
  url: string;
  /** One-request target used only by explicit connection probes. */
  baseURL?: string;
  /** Skip the module prefix for Laravel web-root routes. */
  root?: boolean;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
  /**
   * When false, the request layer must NOT retry on transient
   * network/timeout failures. Used for probe/info GETs where a single
   * logical call must never fan out into a 3x retry storm against a slow
   * or dead endpoint. Defaults to true (existing retry behaviour).
   */
  retry?: boolean;
}

export interface APIModuleConfig {
  baseURL: string;
  endpointMode?: 'active' | 'fixed';
  prefix?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: {
    count: number;
    delay: number;
  };
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}
