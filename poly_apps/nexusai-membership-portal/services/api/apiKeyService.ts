import { apiClient } from './client';
import { ApiKey, CreateApiKeyRequest, UpdateApiKeyRequest, ApiKeyUsage, ApiKeyListResponse } from '../../types/models';
import { QueryParams, PaginatedResponse } from '../../types/api';
import { ApiWrapper } from '../../utils/apiWrapper';

export const apiKeyService = {
  async getAll(params?: QueryParams): Promise<ApiKeyListResponse | null> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
    }
    const path = `/admin/api-keys${query.toString() ? `?${query.toString()}` : ''}`;
    return ApiWrapper.wrap(
      () => apiClient.get<ApiKeyListResponse>(path),
      'errorContextGetApiKeys',
      true
    );
  },

  async getById(id: string): Promise<ApiKey | null> {
    return ApiWrapper.wrap(
      () => apiClient.get<ApiKey>(`/admin/api-keys/${id}`),
      'errorContextGetApiKey',
      true
    );
  },

  async create(request: CreateApiKeyRequest): Promise<{ apiKey: ApiKey; fullKey: string } | null> {
    const data = await ApiWrapper.wrap(
      () => apiClient.post<ApiKey>('/admin/api-keys', request),
      'errorContextCreateApiKey',
      true
    );
    
    if (!data) return null;

    // top-router returns { id, apiKey, name, ... } on create, apiKey field contains full Key
    const fullKey = (data as any).apiKey || '';
    // Remove apiKey field, keep other fields as ApiKey object
    const { apiKey: _, ...apiKeyData } = data as any;
    return {
      apiKey: { ...apiKeyData, apiKeyPrefix: fullKey.substring(0, 10) } as ApiKey,
      fullKey: fullKey
    };
  },

  async update(id: string, request: UpdateApiKeyRequest): Promise<ApiKey | null> {
    return ApiWrapper.wrap(
      () => apiClient.put<ApiKey>(`/admin/api-keys/${id}`, request),
      'errorContextUpdateApiKey',
      true
    );
  },

  async delete(id: string): Promise<boolean> {
    const response = await ApiWrapper.wrapResponse(
      () => apiClient.delete(`/admin/api-keys/${id}`),
      'errorContextDeleteApiKey'
    );
    return response.success;
  },

  async getUsage(id: string, params?: { startDate?: string; endDate?: string }): Promise<ApiKeyUsage | null> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, value);
      });
    }
    const path = `/admin/api-keys/${id}/usage${query.toString() ? `?${query.toString()}` : ''}`;
    return ApiWrapper.wrap(
      () => apiClient.get<ApiKeyUsage>(path),
      'errorContextGetUsage',
      true
    );
  },

  async resetUsage(id: string): Promise<boolean> {
    const response = await ApiWrapper.wrapResponse(
      () => apiClient.post(`/admin/api-keys/${id}/reset-usage`),
      'errorContextResetUsage'
    );
    return response.success;
  }
};

