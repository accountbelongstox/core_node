import { apiClient } from './client';
import { AccountGroup } from '../../types/models';

export const accountGroupsService = {
  async getAll(): Promise<AccountGroup[]> {
    const response = await apiClient.get<AccountGroup[]>('/admin/account-groups');
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.message || 'Failed to fetch account groups');
  },

  async getById(id: string): Promise<AccountGroup> {
    const response = await apiClient.get<AccountGroup>(`/admin/account-groups/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch account group');
  },

  async create(data: Partial<AccountGroup>): Promise<AccountGroup> {
    const response = await apiClient.post<AccountGroup>('/admin/account-groups', data);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to create account group');
  },

  async update(id: string, data: Partial<AccountGroup>): Promise<AccountGroup> {
    const response = await apiClient.put<AccountGroup>(`/admin/account-groups/${id}`, data);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to update account group');
  },

  async delete(id: string): Promise<void> {
    const response = await apiClient.delete(`/admin/account-groups/${id}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete account group');
    }
  },

  async getMembers(id: string): Promise<string[]> {
    const response = await apiClient.get<string[]>(`/admin/account-groups/${id}/members`);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.message || 'Failed to fetch group members');
  },
};

