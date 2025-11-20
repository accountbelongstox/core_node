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

import type { DataSourceConfig, DataSourceStatus } from '@/types/datasource';
import { getAppEntryConfig } from '@/app-entry';

// Admin App Data Source API Service
export class AdminDataSourceAPI {
  private baseUrl: string;
  private namespace: string;

  constructor() {
    const appConfig = getAppEntryConfig('admin');
    this.baseUrl = appConfig.api.baseUrl;
    this.namespace = appConfig.api.namespace;
  }

  // Get all data sources (admin has access to all namespaces)
  async getAllDataSources(): Promise<DataSourceConfig[]> {
    try {
      const response = await $fetch<DataSourceConfig[]>(`${this.baseUrl}/datasources/all`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch all data sources:', error);
      return [];
    }
  }

  // Get data sources by namespace
  async getDataSourcesByNamespace(targetNamespace: string): Promise<DataSourceConfig[]> {
    try {
      const response = await $fetch<DataSourceConfig[]>(`${this.baseUrl}/datasources/namespace/${targetNamespace}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return response;
    } catch (error) {
      console.error(`Failed to fetch data sources for namespace ${targetNamespace}:`, error);
      return [];
    }
  }

  // Get admin-specific data sources
  async getAdminDataSources(): Promise<DataSourceConfig[]> {
    try {
      const response = await $fetch<DataSourceConfig[]>(`${this.baseUrl}/datasources`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch admin data sources:', error);
      return [];
    }
  }

  // Create data source with admin privileges
  async createDataSource(config: Partial<DataSourceConfig>, targetNamespace?: string): Promise<DataSourceConfig | null> {
    try {
      const response = await $fetch<DataSourceConfig>(`${this.baseUrl}/datasources`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: {
          ...config,
          namespace: targetNamespace || this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to create data source:', error);
      return null;
    }
  }

  // Update data source with admin privileges
  async updateDataSource(id: string, config: Partial<DataSourceConfig>): Promise<DataSourceConfig | null> {
    try {
      const response = await $fetch<DataSourceConfig>(`${this.baseUrl}/datasources/${id}`, {
        method: 'PUT',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true',
          'Content-Type': 'application/json'
        },
        body: config
      });
      return response;
    } catch (error) {
      console.error(`Failed to update data source ${id}:`, error);
      return null;
    }
  }

  // Delete data source with admin privileges
  async deleteDataSource(id: string): Promise<boolean> {
    try {
      await $fetch(`${this.baseUrl}/datasources/${id}`, {
        method: 'DELETE',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return true;
    } catch (error) {
      console.error(`Failed to delete data source ${id}:`, error);
      return false;
    }
  }

  // Bulk operations for admin
  async bulkUpdateDataSources(updates: Array<{ id: string; config: Partial<DataSourceConfig> }>): Promise<boolean> {
    try {
      await $fetch(`${this.baseUrl}/datasources/bulk-update`, {
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
      console.error('Failed to bulk update data sources:', error);
      return false;
    }
  }

  // Get system-wide statistics
  async getSystemStatistics(): Promise<{
    totalByNamespace: Record<string, number>;
    statusByNamespace: Record<string, Record<DataSourceStatus, number>>;
    overallHealth: number;
  }> {
    try {
      const response = await $fetch<{
        totalByNamespace: Record<string, number>;
        statusByNamespace: Record<string, Record<DataSourceStatus, number>>;
        overallHealth: number;
      }>(`${this.baseUrl}/datasources/system-stats`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch system statistics:', error);
      return { totalByNamespace: {}, statusByNamespace: {}, overallHealth: 0 };
    }
  }

  // Test all connections
  async testAllConnections(): Promise<Record<string, { success: boolean; message: string }>> {
    try {
      const response = await $fetch<Record<string, { success: boolean; message: string }>>(`${this.baseUrl}/datasources/test-all`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to test all connections:', error);
      return {};
    }
  }

  // Get audit logs
  async getAuditLogs(limit: number = 100): Promise<Array<{
    id: string;
    action: string;
    dataSourceId: string;
    namespace: string;
    timestamp: string;
    user: string;
  }>> {
    try {
      const response = await $fetch<Array<{
        id: string;
        action: string;
        dataSourceId: string;
        namespace: string;
        timestamp: string;
        user: string;
      }>>(`${this.baseUrl}/datasources/audit-logs?limit=${limit}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace,
          'X-Admin-Access': 'true'
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }
  }
}

// Export singleton instance
export const adminDataSourceAPI = new AdminDataSourceAPI();
export default adminDataSourceAPI;
