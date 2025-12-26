/**
 * API Service
 * Unified management of all API calls, uses ApiManager to get dynamic base URL
 * 
 * Fallback Strategy:
 * - When no endpoints are available or API requests fail, automatically falls back to mock data
 * - Mock data is used when apiManager.isMockMode() returns true
 */
import { apiManager } from './ApiManager';
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
} from '../constants';
import { AppInstance, CustomerService, TechMember, AppGenerationRequest, AppRelease, Promoter, PromotionRecord, PromotionTrack, DailyStat, CSAppRevenue } from '../types';

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
  async post<T>(endpoint: string, data?: any, options?: RequestInit, mockDataFallback?: () => T | Promise<T>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }, mockDataFallback);
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any, options?: RequestInit, mockDataFallback?: () => T | Promise<T>): Promise<T> {
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
      return Promise.resolve(app || null);
    });
  }

  /**
   * Create app
   */
  async createApp(data: Partial<AppInstance>): Promise<AppInstance> {
    return this.post<AppInstance>('/api/apps', data, undefined, () => {
      const newApp: AppInstance = {
        id: `app${Date.now()}`,
        name: data.name || 'New App',
        status: data.status || 'Pending' as any,
        category: data.category || 'other' as any,
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
}

// Export singleton
export const apiService = new ApiService();
