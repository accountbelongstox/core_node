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

// Main App Analytics API Service
export class MainAnalyticsAPI {
  private baseUrl: string;
  private namespace: string;

  constructor() {
    const appConfig = getAppEntryConfig('main');
    this.baseUrl = `${appConfig.api.baseUrl}/analytics`;
    this.namespace = appConfig.api.namespace;
  }

  // Get dashboard metrics
  async getDashboardMetrics(): Promise<{
    totalUsers: number;
    activeSessions: number;
    systemLoad: number;
    dataSources: number;
  }> {
    try {
      const response = await $fetch<{
        totalUsers: number;
        activeSessions: number;
        systemLoad: number;
        dataSources: number;
      }>(`${this.baseUrl}/dashboard-metrics`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch main dashboard metrics:', error);
      return { totalUsers: 0, activeSessions: 0, systemLoad: 0, dataSources: 0 };
    }
  }

  // Get user activity data
  async getUserActivity(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<Array<{
    timestamp: string;
    activeUsers: number;
    newUsers: number;
    sessions: number;
  }>> {
    try {
      const response = await $fetch<Array<{
        timestamp: string;
        activeUsers: number;
        newUsers: number;
        sessions: number;
      }>>(`${this.baseUrl}/user-activity?range=${timeRange}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch user activity:', error);
      return [];
    }
  }

  // Get system performance metrics
  async getSystemPerformance(): Promise<{
    cpu: number;
    memory: number;
    disk: number;
    network: {
      inbound: number;
      outbound: number;
    };
  }> {
    try {
      const response = await $fetch<{
        cpu: number;
        memory: number;
        disk: number;
        network: {
          inbound: number;
          outbound: number;
        };
      }>(`${this.baseUrl}/system-performance`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch system performance:', error);
      return { cpu: 0, memory: 0, disk: 0, network: { inbound: 0, outbound: 0 } };
    }
  }

  // Get recent activities
  async getRecentActivities(limit: number = 10): Promise<Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
    type: 'info' | 'warning' | 'error' | 'success';
  }>> {
    try {
      const response = await $fetch<Array<{
        id: string;
        title: string;
        description: string;
        timestamp: string;
        type: 'info' | 'warning' | 'error' | 'success';
      }>>(`${this.baseUrl}/recent-activities?limit=${limit}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      return [];
    }
  }

  // Get feature usage statistics
  async getFeatureUsage(): Promise<Record<string, {
    usage: number;
    trend: 'up' | 'down' | 'stable';
    percentage: number;
  }>> {
    try {
      const response = await $fetch<Record<string, {
        usage: number;
        trend: 'up' | 'down' | 'stable';
        percentage: number;
      }>>(`${this.baseUrl}/feature-usage`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch feature usage:', error);
      return {};
    }
  }
}

// Export singleton instance
export const mainAnalyticsAPI = new MainAnalyticsAPI();
export default mainAnalyticsAPI;
