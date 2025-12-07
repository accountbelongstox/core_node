/**
 * AWY App API Client
 * 
 * Extends the global API base with AWY-specific endpoints
 * All endpoints are accessed via keys, no hardcoded URLs
 */

import { apiBase, ApiResponse } from '@/common/services/api-base';
import { AWY_API_ENDPOINTS, AWY_ENDPOINT_PATHS } from './api-endpoints';
import { User, Friend, Product } from '@/apps/awy/awy_types';

// Register all AWY app endpoints on initialization
apiBase.registerEndpoints(AWY_ENDPOINT_PATHS);

/**
 * AWY API Client Class
 */
export class AwyApiClient {
  /**
   * Authentication APIs
   */
  static async sendVerificationCode(phone: string): Promise<ApiResponse<{ expiresIn: number }>> {
    return apiBase.request(AWY_API_ENDPOINTS.AUTH_SEND_CODE, {
      method: 'POST',
      body: { phone },
      skipAuth: true,
    });
  }

  static async login(phone: string, code: string): Promise<ApiResponse<{
    user: User;
    token: string;
    refreshToken: string;
    expiresIn: number;
  }>> {
    const response = await apiBase.request(AWY_API_ENDPOINTS.AUTH_LOGIN, {
      method: 'POST',
      body: { phone, code },
      skipAuth: true,
    });

    if (response.success && response.data) {
      apiBase.setTokens(response.data.token, response.data.refreshToken);
    }

    return response;
  }

  static async register(phone: string, code: string, name: string): Promise<ApiResponse<{
    user: User;
    token: string;
    refreshToken: string;
    expiresIn: number;
  }>> {
    const response = await apiBase.request(AWY_API_ENDPOINTS.AUTH_REGISTER, {
      method: 'POST',
      body: { phone, code, name },
      skipAuth: true,
    });

    if (response.success && response.data) {
      apiBase.setTokens(response.data.token, response.data.refreshToken);
    }

    return response;
  }

  static async socialLogin(
    provider: 'wechat' | 'qq' | 'alipay',
    code: string,
    accessToken?: string
  ): Promise<ApiResponse<{
    user: User;
    token: string;
    refreshToken: string;
    expiresIn: number;
  }>> {
    const response = await apiBase.request(AWY_API_ENDPOINTS.AUTH_SOCIAL_LOGIN, {
      method: 'POST',
      body: { provider, code, accessToken },
      skipAuth: true,
    });

    if (response.success && response.data) {
      apiBase.setTokens(response.data.token, response.data.refreshToken);
    }

    return response;
  }

  static async refreshToken(refreshToken: string): Promise<ApiResponse<{
    token: string;
    expiresIn: number;
  }>> {
    const response = await apiBase.request(AWY_API_ENDPOINTS.AUTH_REFRESH, {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
    });

    if (response.success && response.data) {
      apiBase.setTokens(response.data.token);
    }

    return response;
  }

  static async logout(): Promise<ApiResponse> {
    const response = await apiBase.request(AWY_API_ENDPOINTS.AUTH_LOGOUT, {
      method: 'POST',
    });

    if (response.success) {
      apiBase.clearTokens();
    }

    return response;
  }

  /**
   * User APIs
   */
  static async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiBase.request(AWY_API_ENDPOINTS.USER_ME, {
      method: 'GET',
      useCache: true,
      cacheTTL: 2 * 60 * 1000, // 2 minutes
    });
  }

  static async updateUser(updates: Partial<User>): Promise<ApiResponse<User>> {
    const response = await apiBase.request(AWY_API_ENDPOINTS.USER_UPDATE, {
      method: 'PUT',
      body: updates,
    });

    // Clear user cache on update
    apiBase.clearCache();

    return response;
  }

  static async uploadAvatar(avatarFile: FormData): Promise<ApiResponse<{ avatar: string }>> {
    return apiBase.request(AWY_API_ENDPOINTS.USER_AVATAR, {
      method: 'POST',
      body: avatarFile,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  /**
   * Friends APIs
   */
  static async getFriendsList(params?: {
    status?: 'all' | 'online' | 'monitored' | 'alerts';
    search?: string;
  }): Promise<ApiResponse<Friend[]>> {
    return apiBase.request(AWY_API_ENDPOINTS.FRIENDS_LIST, {
      method: 'GET',
      query: params,
      useCache: true,
      cacheTTL: 1 * 60 * 1000, // 1 minute
    });
  }

  static async getFriendDetail(friendId: string): Promise<ApiResponse<Friend>> {
    return apiBase.request(AWY_API_ENDPOINTS.FRIENDS_DETAIL, {
      method: 'GET',
      params: { friendId },
      useCache: true,
      cacheTTL: 1 * 60 * 1000, // 1 minute
    });
  }

  static async searchUsers(phone?: string, query?: string): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    phone: string;
    avatar: string;
    isFriend: boolean;
    hasPendingRequest: boolean;
  }>>> {
    const queryParams: Record<string, string | number> = {};
    if (phone) queryParams.phone = phone;
    if (query) queryParams.q = query;

    return apiBase.request(AWY_API_ENDPOINTS.FRIENDS_SEARCH, {
      method: 'GET',
      query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
  }

  static async sendFriendRequest(data: {
    userId: string;
    message?: string;
    alias?: string;
    relation: 'Family' | 'Partner' | 'Friend';
  }): Promise<ApiResponse<{
    requestId: string;
    status: string;
  }>> {
    return apiBase.request(AWY_API_ENDPOINTS.FRIENDS_SEND_REQUEST, {
      method: 'POST',
      body: data,
    });
  }

  static async getFriendRequests(type?: 'sent' | 'received'): Promise<ApiResponse<any[]>> {
    return apiBase.request(AWY_API_ENDPOINTS.FRIENDS_GET_REQUESTS, {
      method: 'GET',
      query: type ? { type } : undefined,
    });
  }

  static async updateFriendRequest(
    requestId: string,
    action: 'accept' | 'reject'
  ): Promise<ApiResponse> {
    return apiBase.request(AWY_API_ENDPOINTS.FRIENDS_UPDATE_REQUEST, {
      method: 'PUT',
      params: { requestId },
      body: { action },
    });
  }

  static async toggleMonitor(friendId: string, isMonitored: boolean): Promise<ApiResponse> {
    return apiBase.request(AWY_API_ENDPOINTS.FRIENDS_TOGGLE_MONITOR, {
      method: 'PUT',
      params: { friendId },
      body: { isMonitored },
    });
  }

  static async removeFriend(friendId: string): Promise<ApiResponse> {
    return apiBase.request(AWY_API_ENDPOINTS.FRIENDS_REMOVE, {
      method: 'DELETE',
      params: { friendId },
    });
  }

  /**
   * Location APIs
   */
  static async getFriendLocation(friendId: string): Promise<ApiResponse<{
    lat: number;
    lng: number;
    address: string;
    updatedAt: string;
  }>> {
    return apiBase.request(AWY_API_ENDPOINTS.LOCATION_GET, {
      method: 'GET',
      params: { friendId },
      useCache: true,
      cacheTTL: 30 * 1000, // 30 seconds
    });
  }

  static async getLocationHistory(
    friendId: string,
    params?: { startDate?: string; endDate?: string; limit?: number }
  ): Promise<ApiResponse<any[]>> {
    return apiBase.request(AWY_API_ENDPOINTS.LOCATION_HISTORY, {
      method: 'GET',
      params: { friendId },
      query: params,
      useCache: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
    });
  }

  static async uploadLocation(data: {
    lat: number;
    lng: number;
    accuracy?: number;
    address?: string;
  }): Promise<ApiResponse> {
    return apiBase.request(AWY_API_ENDPOINTS.LOCATION_UPLOAD, {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Health Data APIs
   */
  static async getFriendHealth(friendId: string): Promise<ApiResponse<{
    steps: number;
    heartRate: number;
    temp: number;
    updatedAt: string;
  }>> {
    return apiBase.request(AWY_API_ENDPOINTS.HEALTH_GET, {
      method: 'GET',
      params: { friendId },
      useCache: true,
      cacheTTL: 1 * 60 * 1000, // 1 minute
    });
  }

  static async getHealthHistory(
    friendId: string,
    params?: { startDate?: string; endDate?: string }
  ): Promise<ApiResponse<any[]>> {
    return apiBase.request(AWY_API_ENDPOINTS.HEALTH_HISTORY, {
      method: 'GET',
      params: { friendId },
      query: params,
      useCache: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Device APIs
   */
  static async getFriendDevice(friendId: string): Promise<ApiResponse<{
    network: 'WiFi' | '4G' | '5G';
    unlocks: number;
    usageTime: string;
    battery: number;
    updatedAt: string;
  }>> {
    return apiBase.request(AWY_API_ENDPOINTS.DEVICE_GET, {
      method: 'GET',
      params: { friendId },
      useCache: true,
      cacheTTL: 1 * 60 * 1000, // 1 minute
    });
  }

  /**
   * Chat APIs
   */
  static async getChatMessages(
    friendId: string,
    params?: { before?: string; limit?: number }
  ): Promise<ApiResponse<any[]>> {
    return apiBase.request(AWY_API_ENDPOINTS.CHAT_MESSAGES, {
      method: 'GET',
      params: { friendId },
      query: params,
      useCache: true,
      cacheTTL: 30 * 1000, // 30 seconds
    });
  }

  static async sendMessage(
    friendId: string,
    message: string
  ): Promise<ApiResponse<{
    id: string;
    message: string;
    createdAt: string;
  }>> {
    return apiBase.request(AWY_API_ENDPOINTS.CHAT_SEND, {
      method: 'POST',
      params: { friendId },
      body: { message },
    });
  }

  static async markMessagesAsRead(friendId: string): Promise<ApiResponse> {
    return apiBase.request(AWY_API_ENDPOINTS.CHAT_MARK_READ, {
      method: 'PUT',
      params: { friendId },
    });
  }

  static async getUnreadCount(): Promise<ApiResponse<Record<string, number>>> {
    return apiBase.request(AWY_API_ENDPOINTS.CHAT_UNREAD_COUNT, {
      method: 'GET',
      useCache: true,
      cacheTTL: 30 * 1000, // 30 seconds
    });
  }

  /**
   * Products APIs
   */
  static async getProductsList(params?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Product[]>> {
    return apiBase.request(AWY_API_ENDPOINTS.PRODUCTS_LIST, {
      method: 'GET',
      query: params,
      useCache: true,
      cacheTTL: 10 * 60 * 1000, // 10 minutes
    });
  }

  static async getProductDetail(productId: string): Promise<ApiResponse<Product>> {
    return apiBase.request(AWY_API_ENDPOINTS.PRODUCTS_DETAIL, {
      method: 'GET',
      params: { productId },
      useCache: true,
      cacheTTL: 10 * 60 * 1000, // 10 minutes
    });
  }

  /**
   * AI Assistant APIs
   */
  static async sendAIMessage(message: string): Promise<ApiResponse<{
    response: string;
    createdAt: string;
  }>> {
    return apiBase.request(AWY_API_ENDPOINTS.AI_CHAT, {
      method: 'POST',
      body: { message },
    });
  }

  static async getAIChatHistory(params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<any[]>> {
    return apiBase.request(AWY_API_ENDPOINTS.AI_CHAT_HISTORY, {
      method: 'GET',
      query: params,
      useCache: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Places APIs
   */
  static async getFriendPlaces(
    friendId: string,
    params?: { startDate?: string; endDate?: string }
  ): Promise<ApiResponse<any[]>> {
    return apiBase.request(AWY_API_ENDPOINTS.PLACES_GET, {
      method: 'GET',
      params: { friendId },
      query: params,
      useCache: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
    });
  }
}

