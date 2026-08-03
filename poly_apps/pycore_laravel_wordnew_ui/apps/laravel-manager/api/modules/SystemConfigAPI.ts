import { BaseAPI } from '../../../../core/api-libs/laravel/transport/BaseAPI';
import { APIResponse } from '../../types';

export interface PathMapping {
  name: string;
  path: string;
  description?: string;
  accessible: boolean;
}

export interface SystemConfig {
  paths: {
    static_resources: PathMapping;
    code_browser: PathMapping;
    [key: string]: PathMapping;
  };
}

export interface ServerConfig {
  app: {
    name: string;
    env: string;
    debug: boolean;
    url: string;
    timezone: string;
    locale: string;
  };
  database: {
    default: string;
    connections: Record<string, any>;
  };
  paths: {
    core_node: string;
    laravel_data: string;
    wwwroot: string;
    storage: string;
    public: string;
  };
  server: {
    php_version: string;
    laravel_version: string;
    server_software: string;
  };
  sanctum: {
    expiration: number;
    token_prefix: string;
  };
}

export interface EnvironmentInfo {
  php: {
    version: string;
    sapi: string;
    memory_limit: string;
    max_execution_time: string;
    upload_max_filesize: string;
    post_max_size: string;
  };
  laravel: {
    version: string;
    environment: string;
    debug: boolean;
  };
  server: {
    software: string;
    os: string;
    server_name: string;
  };
}

/**
 * Client-side TTL for the /api_info catalog (ms).
 *
 * /api_info is a large, fairly static catalog that Settings.tsx and
 * ApiTester.tsx both fetch on every mount. Without a cache each mount (and
 * StrictMode's double-mount) re-hits the network. 60s comfortably dedupes
 * normal navigation between those views while still picking up backend
 * restarts quickly. The backend also sends Cache-Control/ETag, but we honor
 * an explicit client-side TTL regardless so behaviour is deterministic.
 */
const API_INFO_TTL_MS = 60000;

interface ApiInfoCacheEntry {
  data: APIResponse<any>;
  timestamp: number;
}

/**
 * System Configuration API
 * Retrieves system path configuration and other global config
 */
export class SystemConfigAPI extends BaseAPI {
  // Shared across instances and keyed by the fully-resolved request URL
  // (base URL + path + params), including one-request connection probes.
  private static apiInfoCache = new Map<string, ApiInfoCacheEntry>();
  // Single-flight: concurrent callers for the same resolved URL share one
  // in-flight request instead of each issuing their own.
  private static apiInfoInflight = new Map<string, Promise<APIResponse<any>>>();

  /**
   * Fetch /api_info with a TTL cache + single-flight, keyed by the resolved
   * URL so Settings.tsx (test base URL) and ApiTester.tsx (default base URL)
   * each get correct, de-duplicated results.
   */
  private async fetchApiInfo(
    params?: Record<string, any>,
    baseURL?: string,
    headers?: Record<string, string>,
  ): Promise<APIResponse<any>> {
    const key = this.buildURL('/api_info', baseURL) + (params ? `?${JSON.stringify(params)}` : '');

    const cached = SystemConfigAPI.apiInfoCache.get(key);
    if (cached && Date.now() - cached.timestamp < API_INFO_TTL_MS) {
      return cached.data;
    }

    const inflight = SystemConfigAPI.apiInfoInflight.get(key);
    if (inflight) {
      return inflight;
    }

    // retry=false: a single api_info call must never become a 3x retry storm
    // against a slow/dead endpoint.
    const promise = this.request<any>({
      url: '/api_info',
      baseURL,
      method: 'GET',
      params,
      headers,
      retry: false,
    })
      .then((response) => {
        // Only cache successful responses; failures should retry next call.
        if (response.success) {
          SystemConfigAPI.apiInfoCache.set(key, {
            data: response,
            timestamp: Date.now()
          });
        }
        return response;
      })
      .finally(() => {
        SystemConfigAPI.apiInfoInflight.delete(key);
      });

    SystemConfigAPI.apiInfoInflight.set(key, promise);
    return promise;
  }

  /**
   * Get API info - basic API information and health status
   * Note: This is a web route, not an API route
   */
  async getApiInfo(): Promise<APIResponse<any>> {
    return this.fetchApiInfo();
  }

  /** Probe an arbitrary candidate without changing the selected endpoint. */
  async testApiInfo(baseURL: string, apiKey?: string): Promise<APIResponse<any>> {
    const headers = apiKey ? { 'X-API-Key': apiKey } : undefined;
    return this.fetchApiInfo(undefined, baseURL, headers);
  }

  /**
   * Get full API info with all modules
   * Note: This is a web route, not an API route
   */
  async getFullApiInfo(app?: string): Promise<APIResponse<any>> {
    const params = app ? { app } : undefined;
    return this.fetchApiInfo(params);
  }

  /**
   * Get system path mappings
   * Note: This is an API route under /api prefix
   */
  async getPathMappings(): Promise<APIResponse<SystemConfig>> {
    return this.get('/api/config/paths');
  }

  /**
   * Get specific path mapping
   * Note: This is an API route under /api prefix
   */
  async getPathMapping(name: string): Promise<APIResponse<PathMapping>> {
    return this.get(`/api/config/paths/${name}`);
  }

  /**
   * Get server configuration
   * Requires admin authentication
   */
  async getServerConfig(): Promise<APIResponse<ServerConfig>> {
    return this.get('/api/config/server');
  }

  /**
   * Update server configuration
   * Requires super admin authentication
   */
  async updateServerConfig(data: Partial<ServerConfig>): Promise<APIResponse<any>> {
    return this.put('/api/config/server', data);
  }

  /**
   * Get environment information
   * Requires admin authentication
   */
  async getEnvironment(): Promise<APIResponse<EnvironmentInfo>> {
    return this.get('/api/config/environment');
  }
}
