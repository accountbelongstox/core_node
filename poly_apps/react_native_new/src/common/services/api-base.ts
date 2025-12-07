/**
 * Global Unified API Base Class
 * 
 * Features:
 * - Multiple API endpoint configuration
 * - Automatic availability detection
 * - API locking mechanism
 * - Response caching optimization
 * - Key-based endpoint mapping (no hardcoded URLs)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration Interface
export interface ApiConfig {
  id: string;
  baseUrl: string;
  healthCheckPath: string; // Path to check API availability (e.g., '/api/health')
  timeout?: number; // Request timeout in milliseconds
  priority?: number; // Lower number = higher priority
}

// API Response Standard Format
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

// Cache Entry
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Cache Configuration
interface CacheConfig {
  enabled: boolean;
  defaultTTL: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache entries
}

/**
 * Global Unified API Base Class
 */
export class ApiBase {
  private static instance: ApiBase;
  private configs: ApiConfig[] = [];
  private activeConfig: ApiConfig | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheConfig: CacheConfig = {
    enabled: true,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxSize: 100,
  };
  private endpointMap: Map<string, string> = new Map();

  // Storage keys
  private readonly STORAGE_KEY_ACTIVE_API = '@api_active_config';
  private readonly STORAGE_KEY_TOKENS = '@api_tokens';

  private constructor() {
    this.loadPersistedState();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ApiBase {
    if (!ApiBase.instance) {
      ApiBase.instance = new ApiBase();
    }
    return ApiBase.instance;
  }

  /**
   * Configure multiple API endpoints
   */
  configure(configs: ApiConfig[]): void {
    this.configs = configs.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }

  /**
   * Register endpoint key mapping
   */
  registerEndpoint(key: string, path: string): void {
    this.endpointMap.set(key, path);
  }

  /**
   * Register multiple endpoints at once
   */
  registerEndpoints(endpoints: Record<string, string>): void {
    Object.entries(endpoints).forEach(([key, path]) => {
      this.endpointMap.set(key, path);
    });
  }

  /**
   * Get endpoint path by key
   */
  getEndpoint(key: string, params?: Record<string, string | number>): string {
    let path = this.endpointMap.get(key);
    if (!path) {
      throw new Error(`Endpoint key "${key}" not found. Please register it first.`);
    }

    // Replace path parameters
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        path = path!.replace(`:${paramKey}`, String(value));
      });
    }

    return path;
  }

  /**
   * Detect API availability
   */
  async detectAvailableApi(): Promise<ApiConfig | null> {
    if (this.configs.length === 0) {
      throw new Error('No API configurations provided. Call configure() first.');
    }

    // Check cached active API first
    if (this.activeConfig) {
      const isStillAvailable = await this.checkHealth(this.activeConfig);
      if (isStillAvailable) {
        return this.activeConfig;
      }
    }

    // Try each API in priority order
    for (const config of this.configs) {
      const isAvailable = await this.checkHealth(config);
      if (isAvailable) {
        await this.lockApi(config);
        return config;
      }
    }

    return null;
  }

  /**
   * Check API health
   */
  private async checkHealth(config: ApiConfig): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout || 5000);

      const response = await fetch(`${config.baseUrl}${config.healthCheckPath}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeout);

      return response.ok && response.status >= 200 && response.status < 300;
    } catch (error) {
      console.warn(`API health check failed for ${config.id}:`, error);
      return false;
    }
  }

  /**
   * Lock to a specific API
   */
  async lockApi(config: ApiConfig): Promise<void> {
    this.activeConfig = config;
    await AsyncStorage.setItem(this.STORAGE_KEY_ACTIVE_API, JSON.stringify(config));
  }

  /**
   * Get active API configuration
   */
  getActiveApi(): ApiConfig | null {
    return this.activeConfig;
  }

  /**
   * Set authentication tokens
   */
  setTokens(accessToken: string, refreshToken?: string): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
    this.persistTokens();
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    AsyncStorage.removeItem(this.STORAGE_KEY_TOKENS);
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Configure cache settings
   */
  configureCache(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get from cache
   */
  private getCached<T>(key: string): T | null {
    if (!this.cacheConfig.enabled) {
      return null;
    }

    this.cleanExpiredCache();

    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }

    if (entry) {
      this.cache.delete(key);
    }

    return null;
  }

  /**
   * Set cache
   */
  private setCache<T>(key: string, data: T, ttl?: number): void {
    if (!this.cacheConfig.enabled) {
      return;
    }

    // Enforce max size
    if (this.cache.size >= this.cacheConfig.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const now = Date.now();
    const expiresAt = now + (ttl || this.cacheConfig.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });
  }

  /**
   * Make API request
   */
  async request<T = any>(
    endpointKey: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: any;
      params?: Record<string, string | number>;
      query?: Record<string, string | number>;
      headers?: Record<string, string>;
      useCache?: boolean;
      cacheTTL?: number;
      skipAuth?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      params,
      query,
      headers = {},
      useCache = method === 'GET',
      cacheTTL,
      skipAuth = false,
    } = options;

    // Ensure active API is set
    if (!this.activeConfig) {
      const availableApi = await this.detectAvailableApi();
      if (!availableApi) {
        throw new Error('No available API endpoint found');
      }
    }

    // Get endpoint path
    let path = this.getEndpoint(endpointKey, params);

    // Add query parameters
    if (query && Object.keys(query).length > 0) {
      const queryString = Object.entries(query)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
      path += `?${queryString}`;
    }

    // Check cache for GET requests
    if (useCache && method === 'GET') {
      const cacheKey = `${method}:${path}`;
      const cached = this.getCached<ApiResponse<T>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Build request URL
    const url = `${this.activeConfig!.baseUrl}${path}`;

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (!skipAuth && this.accessToken) {
      requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Build request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      if (body instanceof FormData) {
        delete requestHeaders['Content-Type']; // Let browser set it for FormData
        requestOptions.body = body;
      } else {
        requestOptions.body = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(url, requestOptions);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let responseData: ApiResponse<T>;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        // For non-JSON responses, wrap in standard format
        const text = await response.text();
        responseData = {
          success: response.ok,
          data: text as any,
        };
      }

      // Cache successful GET responses
      if (useCache && method === 'GET' && response.ok) {
        const cacheKey = `${method}:${path}`;
        this.setCache(cacheKey, responseData, cacheTTL);
      }

      // Handle token refresh if needed
      if (!response.ok && response.status === 401 && !skipAuth && this.refreshToken) {
        // TODO: Implement token refresh logic
        console.warn('Token expired, refresh needed');
      }

      return responseData;
    } catch (error) {
      console.error(`API request failed [${endpointKey}]:`, error);
      throw error;
    }
  }

  /**
   * Load persisted state from storage
   */
  private async loadPersistedState(): Promise<void> {
    try {
      // Load active API config
      const activeConfigStr = await AsyncStorage.getItem(this.STORAGE_KEY_ACTIVE_API);
      if (activeConfigStr) {
        this.activeConfig = JSON.parse(activeConfigStr);
      }

      // Load tokens
      const tokensStr = await AsyncStorage.getItem(this.STORAGE_KEY_TOKENS);
      if (tokensStr) {
        const tokens = JSON.parse(tokensStr);
        this.accessToken = tokens.accessToken || null;
        this.refreshToken = tokens.refreshToken || null;
      }
    } catch (error) {
      console.error('Failed to load persisted API state:', error);
    }
  }

  /**
   * Persist tokens to storage
   */
  private async persistTokens(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEY_TOKENS,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
        })
      );
    } catch (error) {
      console.error('Failed to persist tokens:', error);
    }
  }
}

// Export singleton instance
export const apiBase = ApiBase.getInstance();

