// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { getAppEntryConfig } from '@/app-entry';

export interface AnalyticsData {
  id: string;
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  timestamp: string;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }>;
}

export class DashboardAnalyticsAPI {
  private baseUrl: string;
  private namespace: string;

  constructor() {
    const appConfig = getAppEntryConfig('dashboard');
    this.baseUrl = appConfig.api.baseUrl;
    this.namespace = appConfig.api.namespace;
  }

  async getAnalytics(): Promise<AnalyticsData[]> {
    try {
      const response = await $fetch<AnalyticsData[]>(`${this.baseUrl}/analytics`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch dashboard analytics:', error);
      return [];
    }
  }

  async getChartData(chartType: string): Promise<ChartData | null> {
    try {
      const response = await $fetch<ChartData>(`${this.baseUrl}/charts/${chartType}`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error(`Failed to fetch chart data for ${chartType}:`, error);
      return null;
    }
  }

  async getRealtimeData(): Promise<any> {
    try {
      const response = await $fetch(`${this.baseUrl}/realtime`, {
        method: 'GET',
        headers: {
          'X-App-Namespace': this.namespace
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to fetch realtime data:', error);
      return null;
    }
  }

  async exportReport(format: 'pdf' | 'csv' | 'excel'): Promise<Blob | null> {
    try {
      const response = await $fetch<Blob>(`${this.baseUrl}/export`, {
        method: 'POST',
        headers: {
          'X-App-Namespace': this.namespace,
          'Content-Type': 'application/json'
        },
        body: { format },
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      console.error('Failed to export report:', error);
      return null;
    }
  }
}

export const dashboardAnalyticsAPI = new DashboardAnalyticsAPI();
