// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { getAppEntryConfig } from '@/app-entry';

// User interface
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
}

// Admin App Users API Service
export class AdminUsersAPI {
  private baseUrl: string;
  private namespace: string;

  constructor() {
    const appConfig = getAppEntryConfig('admin');
    this.baseUrl = `${appConfig.api.baseUrl}/users`;
    this.namespace = appConfig.api.namespace;
  }

  // Get all users
  async getAllUsers(page: number = 1, limit: number = 20): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const response = await $fetch<{
        users: User[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`${this.baseUrl}?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch users:', error);
      return { users: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
  }

  // Get user by ID
  async getUser(id: string): Promise<User | null> {
    try {
      const response = await $fetch<User>(`${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return response;
    } catch (error) {
      console.error(`Failed to fetch user ${id}:`, error);
      return null;
    }
  }

  // Create new user
  async createUser(userData: Partial<User>): Promise<User | null> {
    try {
      const response = await $fetch<User>(`${this.baseUrl}`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: userData
      });
      return response;
    } catch (error) {
      console.error('Failed to create user:', error);
      return null;
    }
  }

  // Update user
  async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
    try {
      const response = await $fetch<User>(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: userData
      });
      return response;
    } catch (error) {
      console.error(`Failed to update user ${id}:`, error);
      return null;
    }
  }

  // Delete user
  async deleteUser(id: string): Promise<boolean> {
    try {
      await $fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return true;
    } catch (error) {
      console.error(`Failed to delete user ${id}:`, error);
      return false;
    }
  }

  // Search users
  async searchUsers(query: string, filters?: {
    role?: string;
    status?: string;
  }): Promise<User[]> {
    try {
      const params = new URLSearchParams({ q: query });
      if (filters?.role) params.append('role', filters.role);
      if (filters?.status) params.append('status', filters.status);

      const response = await $fetch<User[]>(`${this.baseUrl}/search?${params.toString()}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to search users:', error);
      return [];
    }
  }

  // Get user statistics
  async getUserStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    byRole: Record<string, number>;
    recentRegistrations: number;
  }> {
    try {
      const response = await $fetch<{
        total: number;
        active: number;
        inactive: number;
        suspended: number;
        byRole: Record<string, number>;
        recentRegistrations: number;
      }>(`${this.baseUrl}/statistics`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch user statistics:', error);
      return { total: 0, active: 0, inactive: 0, suspended: 0, byRole: {}, recentRegistrations: 0 };
    }
  }

  // Bulk operations
  async bulkUpdateUsers(updates: Array<{ id: string; data: Partial<User> }>): Promise<boolean> {
    try {
      await $fetch(`${this.baseUrl}/bulk-update`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: { updates }
      });
      return true;
    } catch (error) {
      console.error('Failed to bulk update users:', error);
      return false;
    }
  }

  // Export users
  async exportUsers(format: 'csv' | 'json' = 'csv'): Promise<Blob | null> {
    try {
      const response = await $fetch(`${this.baseUrl}/export?format=${format}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        },
        responseType: 'blob'
      });
      return response as Blob;
    } catch (error) {
      console.error('Failed to export users:', error);
      return null;
    }
  }
}

// Export singleton instance
export const adminUsersAPI = new AdminUsersAPI();
export default adminUsersAPI;
