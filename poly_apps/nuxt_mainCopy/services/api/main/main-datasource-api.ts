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

// Main App Data Source API Service
export class MainDataSourceAPI {
  private baseUrl: string;
  private namespace: string;

  constructor() {
    const appConfig = getAppEntryConfig('main');
    this.baseUrl = appConfig.api.baseUrl;
    this.namespace = appConfig.api.namespace;
  }

  // Get all data sources for main app
  async getDataSources(): Promise<DataSourceConfig[]> {
    try {
      const response = await $fetch<DataSourceConfig[]>(`${this.baseUrl}/datasources`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch main app data sources:', error);
      return [];
    }
  }

  // Get data source by ID
  async getDataSource(id: string): Promise<DataSourceConfig | null> {
    try {
      const response = await $fetch<DataSourceConfig>(`${this.baseUrl}/datasources/${id}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error(`Failed to fetch main app data source ${id}:`, error);
      return null;
    }
  }

  // Create new data source
  async createDataSource(config: Partial<DataSourceConfig>): Promise<DataSourceConfig | null> {
    try {
      const response = await $fetch<DataSourceConfig>(`${this.baseUrl}/datasources`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        },
        body: {
          ...config,
          namespace: this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to create main app data source:', error);
      return null;
    }
  }

  // Update data source
  async updateDataSource(id: string, config: Partial<DataSourceConfig>): Promise<DataSourceConfig | null> {
    try {
      const response = await $fetch<DataSourceConfig>(`${this.baseUrl}/datasources/${id}`, {
        method: 'PUT',
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        },
        body: config
      });
      return response;
    } catch (error) {
      console.error(`Failed to update main app data source ${id}:`, error);
      return null;
    }
  }

  // Delete data source
  async deleteDataSource(id: string): Promise<boolean> {
    try {
      await $fetch(`${this.baseUrl}/datasources/${id}`, {
        method: 'DELETE',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return true;
    } catch (error) {
      console.error(`Failed to delete main app data source ${id}:`, error);
      return false;
    }
  }

  // Test data source connection
  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await $fetch<{ success: boolean; message: string }>(`${this.baseUrl}/datasources/${id}/test`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error(`Failed to test main app data source ${id}:`, error);
      return { success: false, message: 'Connection test failed' };
    }
  }

  // Get data source statistics
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    error: number;
  }> {
    try {
      const response = await $fetch<{
        total: number;
        active: number;
        inactive: number;
        error: number;
      }>(`${this.baseUrl}/datasources/stats`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch main app data source statistics:', error);
      return { total: 0, active: 0, inactive: 0, error: 0 };
    }
  }

  // Get data source health status
  async getHealthStatus(): Promise<Record<string, DataSourceStatus>> {
    try {
      const response = await $fetch<Record<string, DataSourceStatus>>(`${this.baseUrl}/datasources/health`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch main app data source health status:', error);
      return {};
    }
  }
}

// Export singleton instance
export const mainDataSourceAPI = new MainDataSourceAPI();
export default mainDataSourceAPI;
