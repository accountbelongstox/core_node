import { apiClient } from './client';
import { AccountBalance, QueryBalanceRequest } from '../../types/models';

export const accountBalanceService = {
  async getBalance(accountId: string): Promise<AccountBalance> {
    const response = await apiClient.get<AccountBalance>(`/admin/accounts/${accountId}/balance`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch account balance');
  },

  async refreshBalance(accountId: string): Promise<AccountBalance> {
    const response = await apiClient.post<AccountBalance>(`/admin/accounts/${accountId}/balance/refresh`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to refresh account balance');
  },

  async getByPlatform(platform: string): Promise<AccountBalance[]> {
    const response = await apiClient.get<AccountBalance[]>(`/admin/accounts/balance/platform/${platform}`);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.message || 'Failed to fetch platform balances');
  },

  async getSummary(): Promise<Record<string, any>> {
    const response = await apiClient.get<Record<string, any>>('/admin/accounts/balance/summary');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch balance summary');
  },

  async clearCache(accountId: string): Promise<void> {
    const response = await apiClient.delete(`/admin/accounts/${accountId}/balance/cache`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to clear balance cache');
    }
  },

  async queryBalance(request: QueryBalanceRequest): Promise<AccountBalance[]> {
    const response = await apiClient.post<AccountBalance[]>('/admin/account-balance/query', request);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.message || 'Failed to query balance');
  },
};

