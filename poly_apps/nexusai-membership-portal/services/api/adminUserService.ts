import { apiClient } from './client';
import { User } from '../../types/models';
import { QueryParams } from '../../types/api';

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  totalApiKeys: number;
  totalUsage: number;
}

/**
 * Admin User Service
 * For administrators to manage users
 */
export const adminUserService = {
  async getAll(params?: QueryParams): Promise<User[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
    }
    const path = `/users${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<User[]>(path);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.message || 'Failed to fetch users');
  },

  async getById(userId: string): Promise<User> {
    const response = await apiClient.get<User>(`/users/${userId}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch user');
  },

  async updateStatus(userId: string, status: 'active' | 'disabled'): Promise<User> {
    const response = await apiClient.patch<User>(`/users/${userId}/status`, { status });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to update user status');
  },

  async updateRole(userId: string, role: 'admin' | 'user'): Promise<User> {
    const response = await apiClient.patch<User>(`/users/${userId}/role`, { role });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to update user role');
  },

  async disableUserKeys(userId: string): Promise<void> {
    const response = await apiClient.post(`/users/${userId}/disable-keys`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to disable user keys');
    }
  },

  async getUserStats(): Promise<UserStats> {
    const response = await apiClient.get<UserStats>('/users/stats/overview');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch user stats');
  },

  async getUserUsageStats(userId: string): Promise<any> {
    const response = await apiClient.get<any>(`/users/${userId}/usage-stats`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch user usage stats');
  },
};

