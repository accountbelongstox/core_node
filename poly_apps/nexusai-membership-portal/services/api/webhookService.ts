import { apiClient } from './client';
import { WebhookConfig, CreateWebhookRequest } from '../../types/models';

export const webhookService = {
  async getAll(): Promise<WebhookConfig[]> {
    const response = await apiClient.get<WebhookConfig[]>('/admin/webhook/configs');
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.message || 'Failed to fetch webhook configs');
  },

  async getById(id: string): Promise<WebhookConfig> {
    const response = await apiClient.get<WebhookConfig>(`/admin/webhook/configs/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch webhook config');
  },

  async create(data: CreateWebhookRequest): Promise<WebhookConfig> {
    const response = await apiClient.post<WebhookConfig>('/admin/webhook/configs', data);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to create webhook config');
  },

  async update(id: string, data: Partial<CreateWebhookRequest>): Promise<WebhookConfig> {
    const response = await apiClient.put<WebhookConfig>(`/admin/webhook/configs/${id}`, data);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to update webhook config');
  },

  async delete(id: string): Promise<void> {
    const response = await apiClient.delete(`/admin/webhook/configs/${id}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete webhook config');
    }
  },

  async test(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(`/webhook/test`, { id });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to test webhook');
  },
};

