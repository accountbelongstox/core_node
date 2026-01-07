import { apiClient } from './client';
import { UsageStats, UsageStatsByModel, UsageStatsByKey, UsageStatsByAccount, DailyUsageStats } from '../../types/models';
import { DateRangeParams } from '../../types/api';

export const usageStatsService = {
  async getOverview(params?: DateRangeParams): Promise<UsageStats> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, value);
      });
    }
    const path = `/admin/usage-stats/overview${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<UsageStats>(path);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch usage stats');
  },

  async getByModel(params?: DateRangeParams): Promise<UsageStatsByModel[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, value);
      });
    }
    const path = `/admin/usage-stats/models${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<UsageStatsByModel[]>(path);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch usage stats by model');
  },

  async getByKey(params?: DateRangeParams): Promise<UsageStatsByKey[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, value);
      });
    }
    const path = `/admin/usage-stats/keys${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<UsageStatsByKey[]>(path);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch usage stats by key');
  },

  async getByAccount(params?: DateRangeParams): Promise<UsageStatsByAccount[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, value);
      });
    }
    const path = `/admin/usage-stats/accounts${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<UsageStatsByAccount[]>(path);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch usage stats by account');
  },

  async getDaily(params?: DateRangeParams): Promise<DailyUsageStats[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, value);
      });
    }
    const path = `/admin/usage-stats/daily${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<DailyUsageStats[]>(path);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch daily usage stats');
  }
};

