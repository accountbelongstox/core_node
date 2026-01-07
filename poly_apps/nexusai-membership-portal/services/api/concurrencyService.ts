import { apiClient } from './client';

export interface ConcurrencyStatus {
  apiKeyId: string;
  currentRequests: number;
  limit: number;
  queuedRequests: number;
}

export interface ConcurrencyQueueStats {
  entered: number;
  success: number;
  timeout: number;
  cancelled: number;
  socketChanged: number;
  rejectedOverload: number;
  waitTimeP50: number;
  waitTimeP90: number;
  waitTimeP99: number;
}

export const concurrencyService = {
  async getAll(): Promise<ConcurrencyStatus[]> {
    const response = await apiClient.get<ConcurrencyStatus[]>('/admin/concurrency');
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.message || 'Failed to fetch concurrency status');
  },

  async getByApiKey(apiKeyId: string): Promise<ConcurrencyStatus> {
    const response = await apiClient.get<ConcurrencyStatus>(`/admin/concurrency/${apiKeyId}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch concurrency status');
  },

  async getByAccount(accountId: string): Promise<ConcurrencyStatus> {
    const response = await apiClient.get<ConcurrencyStatus>(`/admin/concurrency/${accountId}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch account concurrency');
  },

  async clearByApiKey(apiKeyId: string): Promise<void> {
    const response = await apiClient.delete(`/admin/concurrency/${apiKeyId}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to clear concurrency');
    }
  },

  async clearAll(): Promise<void> {
    const response = await apiClient.delete('/admin/concurrency');
    if (!response.success) {
      throw new Error(response.message || 'Failed to clear all concurrency');
    }
  },

  async cleanup(): Promise<void> {
    const response = await apiClient.post('/admin/concurrency/cleanup');
    if (!response.success) {
      throw new Error(response.message || 'Failed to cleanup concurrency');
    }
  },

  async getQueueStats(): Promise<ConcurrencyQueueStats> {
    const response = await apiClient.get<ConcurrencyQueueStats>('/admin/concurrency-queue/stats');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch queue stats');
  },

  async clearQueueByApiKey(apiKeyId: string): Promise<void> {
    const response = await apiClient.delete(`/admin/concurrency-queue/${apiKeyId}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to clear queue');
    }
  },

  async clearQueue(): Promise<void> {
    const response = await apiClient.delete('/admin/concurrency-queue');
    if (!response.success) {
      throw new Error(response.message || 'Failed to clear all queues');
    }
  },
};

