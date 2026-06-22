/**
 * API Service
 * Unified management of all API calls, uses ApiManager to get dynamic base URL
 * 
 * Fallback Strategy:
 * - When no endpoints are available or API requests fail, automatically falls back to mock data
 * - Mock data is used when apiManager.isMockMode() returns true
 */
import { apiManager } from './ApiManager';
import { API_ENDPOINTS, buildApiUrl } from '../config/api-endpoints';
import { generateAvatarUrl } from '../utils/avatarUtils';
import { generateImageUrl, getImageUrlForCustomer, ImageType } from '../utils/imageUrlUtils';
import {
  MOCK_APPS,
  MOCK_CS,
  MOCK_TECH,
  MOCK_APP_REQUESTS,
  MOCK_APP_RELEASES,
  MOCK_PROMOTERS,
  MOCK_PROMOTION_RECORDS,
  MOCK_PROMOTION_TRACKS,
  MOCK_DAILY_STATS,
  MOCK_CS_APP_REVENUE,
  MOCK_AVATAR_PROVIDERS_LIST_RESPONSE,
  MOCK_AVATAR_CACHE_STATS,
} from '../constants';
import { AppInstance, CustomerService, TechMember, AppGenerationRequest, AppRelease, Promoter, PromotionRecord, PromotionTrack, DailyStat, CSAppRevenue, AvatarProvidersListResponse, AvatarCacheStatsResponse, AvatarCacheClearResponse, AppStatus, AppCategory } from '../types';

class ApiService {
  /**
   * Get complete API URL
   * Returns null if in mock mode or no base URL available
   */
  private getApiUrl(endpoint: string): string | null {
    if (apiManager.isMockMode()) {
      return null; // Mock mode, no API URL needed
    }
    const baseUrl = apiManager.getCurrentBaseUrl();
    if (!baseUrl) {
      return null; // No base URL, use mock data
    }
    // Ensure endpoint starts with /
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${path}`;
  }

  /**
   * Generic request method
   * Automatically falls back to mock data if API is unavailable
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    mockDataFallback?: () => T | Promise<T>
  ): Promise<T> {
    // Check if we should use mock data
    if (apiManager.isMockMode() || !apiManager.getCurrentBaseUrl()) {
      if (mockDataFallback) {
        console.log(`API Service: Using mock data for ${endpoint}`);
        return await mockDataFallback();
      }
      throw new Error(`No API endpoint available and no mock data fallback for ${endpoint}`);
    }

    const url = this.getApiUrl(endpoint);
    if (!url) {
      // Fallback to mock data
      if (mockDataFallback) {
        console.log(`API Service: No URL available, using mock data for ${endpoint}`);
        return await mockDataFallback();
      }
      throw new Error(`No API URL available and no mock data fallback for ${endpoint}`);
    }
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        // API request failed, try mock data fallback
        if (mockDataFallback) {
          console.warn(`API Service: Request failed for ${endpoint}, falling back to mock data`);
          return await mockDataFallback();
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // catch block is necessary: must be kept
      // Reason: Network requests may fail (network error, timeout, server error, etc.)
      // Need to catch errors and provide mock data fallback to avoid application crash
      console.error(`API Service: Request error for ${endpoint}:`, error);
      // Try mock data fallback on error
      if (mockDataFallback) {
        console.warn(`API Service: Using mock data fallback for ${endpoint}`);
        return await mockDataFallback();
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestInit, mockDataFallback?: () => T | Promise<T>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      ...options,
    }, mockDataFallback);
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown, options?: RequestInit, mockDataFallback?: () => T | Promise<T>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }, mockDataFallback);
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown, options?: RequestInit, mockDataFallback?: () => T | Promise<T>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }, mockDataFallback);
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestInit, mockDataFallback?: () => T | Promise<T>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      ...options,
    }, mockDataFallback);
  }

  // ===== Business API Methods =====
  // All methods automatically fall back to mock data when API is unavailable

  /**
   * Get apps list
   */
  async getApps(): Promise<AppInstance[]> {
    return this.get<AppInstance[]>('/api/apps', undefined, () => Promise.resolve([...MOCK_APPS]));
  }

  /**
   * Get app by ID
   */
  async getAppById(appId: string): Promise<AppInstance | null> {
    return this.get<AppInstance | null>(`/api/apps/${appId}`, undefined, () => {
      const app = MOCK_APPS.find(a => a.id === appId);
      return Promise.resolve(app ?? null);
    });
  }

  /**
   * Create app
   */
  async createApp(data: Partial<AppInstance>): Promise<AppInstance> {
    return this.post<AppInstance>('/api/apps', data, undefined, () => {
      const newApp: AppInstance = {
        id: `app${Date.now()}`,
        name: data.name ?? 'New App',
        status: (data.status ?? 'Pending') as AppStatus,
        category: (data.category ?? 'other') as AppCategory,
        visits: 0,
        revenue: 0,
        monthlyRevenue: 0,
        dailyActiveUsers: 0,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        ...data,
      } as AppInstance;
      return Promise.resolve(newApp);
    });
  }

  /**
   * Update app
   */
  async updateApp(appId: string, data: Partial<AppInstance>): Promise<AppInstance> {
    return this.put<AppInstance>(`/api/apps/${appId}`, data, undefined, () => {
      const app = MOCK_APPS.find(a => a.id === appId);
      if (!app) {
        throw new Error(`App ${appId} not found`);
      }
      const updatedApp = { ...app, ...data, updatedAt: new Date().toISOString().split('T')[0] };
      return Promise.resolve(updatedApp as AppInstance);
    });
  }

  /**
   * Delete app
   */
  async deleteApp(appId: string): Promise<boolean> {
    return this.delete<boolean>(`/api/apps/${appId}`, undefined, () => {
      return Promise.resolve(true);
    });
  }

  /**
   * Get customer service team list
   */
  async getCSTeam(): Promise<CustomerService[]> {
    return this.get<CustomerService[]>('/api/cs-team', undefined, () => Promise.resolve([...MOCK_CS]));
  }

  /**
   * Get tech team list
   */
  async getTechTeam(): Promise<TechMember[]> {
    return this.get<TechMember[]>('/api/tech-team', undefined, () => Promise.resolve([...MOCK_TECH]));
  }

  /**
   * Get app generation requests
   */
  async getAppRequests(): Promise<AppGenerationRequest[]> {
    return this.get<AppGenerationRequest[]>('/api/app-requests', undefined, () => Promise.resolve([...MOCK_APP_REQUESTS]));
  }

  /**
   * Get app releases
   */
  async getAppReleases(): Promise<AppRelease[]> {
    return this.get<AppRelease[]>('/api/app-releases', undefined, () => Promise.resolve([...MOCK_APP_RELEASES]));
  }

  /**
   * Get promoters list
   */
  async getPromoters(): Promise<Promoter[]> {
    return this.get<Promoter[]>('/api/promoters', undefined, () => Promise.resolve([...MOCK_PROMOTERS]));
  }

  /**
   * Get promotion records list
   */
  async getPromotionRecords(): Promise<PromotionRecord[]> {
    return this.get<PromotionRecord[]>('/api/promotion-records', undefined, () => Promise.resolve([...MOCK_PROMOTION_RECORDS]));
  }

  /**
   * Get promotion tracks
   */
  async getPromotionTracks(): Promise<PromotionTrack[]> {
    return this.get<PromotionTrack[]>('/api/promotion-tracks', undefined, () => Promise.resolve([...MOCK_PROMOTION_TRACKS]));
  }

  /**
   * Get daily statistics
   */
  async getDailyStats(): Promise<DailyStat[]> {
    return this.get<DailyStat[]>('/api/daily-stats', undefined, () => Promise.resolve([...MOCK_DAILY_STATS]));
  }

  /**
   * Get CS app revenue
   */
  async getCSAppRevenue(): Promise<CSAppRevenue[]> {
    return this.get<CSAppRevenue[]>('/api/cs-app-revenue', undefined, () => Promise.resolve([...MOCK_CS_APP_REVENUE]));
  }

  // ===== Avatar API Methods =====

  /**
   * Get avatar URL using multi-API system
   * Note: This returns a URL string, not an image blob
   * The actual image is served directly by the backend (laravel_main)
   * 
   * Uses current API endpoint from ApiManager:
   * - Priority 1: localhost:9000 (local development)
   * - Priority 2: 192.168.50.3:9000 (LAN server)
   * - Priority 3: https://api.si.12gm.com (cloud production)
   * 
   * If no endpoint is available, falls back to first endpoint in config
   * This ensures avatar URLs always work even during initialization
   */
  getAvatarUrl(name: string, size: number = 512, provider: string | number = 'pravatar'): string {
    // Use unified avatar URL utility library
    const providerStr = typeof provider === 'number' ? provider.toString() : provider;
    return generateAvatarUrl(name, size, providerStr);
  }

  /**
   * List all avatar providers
   */
  async getAvatarProviders(): Promise<AvatarProvidersListResponse> {
    return this.get<AvatarProvidersListResponse>(
      '/api/public/avatar-providers/list',
      undefined,
      () => Promise.resolve({ ...MOCK_AVATAR_PROVIDERS_LIST_RESPONSE })
    );
  }

  // ===== Image URL Methods =====

  /**
   * Get image URL using multi-API system
   * References old .js code image processing logic, uses multi-API system to generate absolute URL
   * 
   * @param relativePath - Relative path or identifier (e.g. 'customer1' or 'avatars/appqyv1/avatar_1.png')
   * @param imageType - Image type, defaults to 'avatar'
   * @param options - Additional options (size, provider, etc.)
   * @returns Absolute URL
   */
  getImageUrl(
    relativePath: string | null | undefined,
    imageType: ImageType = 'avatar',
    options: {
      size?: number;
      provider?: string;
      [key: string]: any;
    } = {}
  ): string {
    return generateImageUrl(relativePath, imageType, options);
  }

  /**
   * Get image URL for customer (customer1, etc.)
   * Specifically for image URL generation for user identifiers like customer1
   * 
   * @param customerId - Customer ID, e.g. 'customer1'
   * @param size - Image size, defaults to 150
   * @param provider - Avatar provider, defaults to 'pravatar'
   * @returns Absolute URL
   */
  getCustomerImageUrl(
    customerId: string | null | undefined,
    size: number = 150,
    provider: string = 'pravatar'
  ): string {
    return getImageUrlForCustomer(customerId, size, provider);
  }

  /**
   * Get avatar cache statistics
   */
  async getAvatarCacheStats(): Promise<AvatarCacheStatsResponse> {
    return this.get<AvatarCacheStatsResponse>(
      '/api/public/avatar-cache/stats',
      undefined,
      () => Promise.resolve({ ...MOCK_AVATAR_CACHE_STATS })
    );
  }

  /**
   * Clear avatar cache for a specific user
   */
  async clearAvatarCache(name: string, provider?: string): Promise<AvatarCacheClearResponse> {
    const endpoint = provider
      ? `/api/public/avatar-cache/${encodeURIComponent(name)}?provider=${encodeURIComponent(provider)}`
      : `/api/public/avatar-cache/${encodeURIComponent(name)}`;
    
    return this.delete<AvatarCacheClearResponse>(
      endpoint,
      undefined,
      () => Promise.resolve({ success: true, message: 'Cache cleared' })
    );
  }

  /**
   * Clear all avatar cache
   */
  async clearAllAvatarCache(): Promise<AvatarCacheClearResponse> {
    return this.delete<AvatarCacheClearResponse>(
      '/api/public/avatar-cache',
      undefined,
      () => Promise.resolve({ success: true, deleted_count: MOCK_AVATAR_CACHE_STATS.total_files })
    );
  }
}

// Export singleton
export const apiService = new ApiService();
