import { apiClient } from './client';
import { UsageStats } from '../../types/models';
import { DateRangeParams } from '../../types/api';

/**
 * User Usage Service
 * For regular users to view their own usage statistics
 */
export const userUsageService = {
  async getUsageStats(params?: DateRangeParams): Promise<UsageStats> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, value);
      });
    }
    const path = `/users/usage-stats${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<UsageStats>(path);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch usage stats');
  },
};

