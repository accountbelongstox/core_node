import { apiClient } from './client';
import { ApiKey, CreateApiKeyRequest } from '../../types/models';
import { ApiWrapper } from '../../utils/apiWrapper';

/**
 * User API Key Service
 * For regular users to manage their own API Keys
 */
export const userApiKeyService = {
  async getAll(): Promise<ApiKey[]> {
    const response = await apiClient.get<{ success: boolean; apiKeys: ApiKey[]; total: number }>('/users/api-keys');
    if (response.success && response.data) {
      const result = response.data as any;
      // top-router returns { success: true, apiKeys: [...], total: number }
      return result.apiKeys || result || [];
    }
    throw new Error(response.message || 'Failed to fetch API keys');
  },

  async create(request: CreateApiKeyRequest): Promise<{ apiKey: ApiKey; fullKey: string } | null> {
    const response = await apiClient.post<{ success: boolean; apiKey: { id: string; name: string; key: string; [key: string]: any } }>('/users/api-keys', request);
    if (response.success && response.data) {
      const result = response.data as any;
      // top-router returns { success: true, apiKey: { id, name, key, ... } }
      const apiKeyData = result.apiKey || result;
      const fullKey = apiKeyData.key || apiKeyData.apiKey || '';
      // Remove key field, keep other fields as ApiKey object
      const { key: _, apiKey: __, ...apiKeyFields } = apiKeyData;
      return {
        apiKey: { ...apiKeyFields, apiKeyPrefix: fullKey.substring(0, 10) } as ApiKey,
        fullKey: fullKey
      };
    }
    throw new Error(response.message || 'Failed to create API key');
  },

  async delete(keyId: string): Promise<boolean> {
    const response = await ApiWrapper.wrapResponse(
      () => apiClient.delete(`/users/api-keys/${keyId}`),
      'errorContextDeleteApiKey'
    );
    return response.success;
  },
};

