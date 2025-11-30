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

import { useDataSource, usePrimaryApi, useSecondaryApi } from '@/composables/useDataSource';
import type { 
  DashboardData, 
  RevenueData, 
  SalesByCategoryData, 
  DailySalesData,
  SummaryData,
  ChartData,
  FinanceData 
} from '@/types/api';

// 增强的仪表板API服务
export const enhancedDashboardApi = {
  // 从主数据源获取基础仪表板数据
  async getBasicDashboardData(): Promise<DashboardData> {
    const primaryApi = usePrimaryApi();
    const response = await primaryApi.dashboard();
    return response.data;
  },

  // 从辅助数据源获取图表数据
  async getChartData(): Promise<ChartData[]> {
    const secondaryApi = useSecondaryApi();
    const response = await secondaryApi.charts();
    return response.data;
  },

  // 从辅助数据源获取财务数据
  async getFinanceData(): Promise<FinanceData> {
    const secondaryApi = useSecondaryApi();
    const response = await secondaryApi.finance();
    return response.data;
  },

  // 聚合多个数据源的仪表板数据
  async getAggregatedDashboardData(): Promise<{
    basic: DashboardData;
    charts: ChartData[];
    finance: FinanceData;
  }> {
    const { requestAggregate } = useDataSource();
    
    const response = await requestAggregate([
      {
        sourceId: 'primary-api',
        endpoint: '/api/dashboard',
        key: 'basic'
      },
      {
        sourceId: 'secondary-api',
        endpoint: '/api/charts',
        key: 'charts'
      },
      {
        sourceId: 'secondary-api',
        endpoint: '/api/finance',
        key: 'finance'
      }
    ]);

    return response.data;
  },

  // 带故障转移的收入数据获取
  async getRevenueDataWithFailover(): Promise<RevenueData> {
    const { requestWithFailover } = useDataSource();
    
    const response = await requestWithFailover(
      ['primary-api', 'secondary-api'],
      '/api/dashboard/revenue'
    );

    return response.data;
  },

  // 负载均衡的销售数据获取
  async getSalesDataWithLoadBalancing(): Promise<SalesByCategoryData> {
    const { requestWithLoadBalancing } = useDataSource();
    
    const response = await requestWithLoadBalancing(
      ['primary-api', 'secondary-api'],
      '/api/dashboard/sales-category'
    );

    return response.data;
  },

  // 实时数据获取（禁用缓存）
  async getRealTimeData(): Promise<{
    summary: SummaryData;
    dailySales: DailySalesData;
  }> {
    const { requestMultiple } = useDataSource();
    
    const responses = await requestMultiple([
      {
        sourceId: 'primary-api',
        endpoint: '/api/dashboard/summary',
        options: { cache: false }
      },
      {
        sourceId: 'primary-api',
        endpoint: '/api/dashboard/daily-sales',
        options: { cache: false }
      }
    ]);

    const [summaryResponse, dailySalesResponse] = responses;
    
    if ('success' in summaryResponse && 'success' in dailySalesResponse) {
      return {
        summary: summaryResponse.data,
        dailySales: dailySalesResponse.data
      };
    }

    throw new Error('Failed to fetch real-time data');
  },

  // 缓存优化的数据获取
  async getCachedDashboardData(cacheTime: number = 300000): Promise<DashboardData> {
    const primaryApi = usePrimaryApi();
    
    const response = await primaryApi.dashboard({
      cache: true,
      transform: (data) => ({
        ...data,
        timestamp: Date.now()
      })
    });

    return response.data;
  },

  // 分页数据获取
  async getPaginatedData(
    endpoint: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const primaryApi = usePrimaryApi();
    
    const response = await primaryApi.get(endpoint, {
      query: { page, limit }
    });

    return response.data;
  },

  // 搜索和过滤数据
  async searchData(
    endpoint: string,
    searchParams: {
      query?: string;
      filters?: Record<string, any>;
      sort?: string;
      order?: 'asc' | 'desc';
    }
  ): Promise<any[]> {
    const primaryApi = usePrimaryApi();
    
    const response = await primaryApi.get(endpoint, {
      query: searchParams
    });

    return response.data;
  },

  // 批量操作
  async batchOperation(
    operations: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      endpoint: string;
      data?: any;
    }>
  ): Promise<any[]> {
    const { requestMultiple } = useDataSource();
    
    const requests = operations.map(op => ({
      sourceId: 'primary-api',
      endpoint: op.endpoint,
      options: {
        method: op.method,
        body: op.data
      }
    }));

    const responses = await requestMultiple(requests);
    
    return responses.map(response => 
      'success' in response ? response.data : null
    ).filter(Boolean);
  },

  // 数据导出
  async exportData(
    endpoint: string,
    format: 'json' | 'csv' | 'excel' = 'json',
    filters?: Record<string, any>
  ): Promise<Blob> {
    const primaryApi = usePrimaryApi();
    
    const response = await primaryApi.get(`${endpoint}/export`, {
      query: { format, ...filters },
      transform: (data) => data // 保持原始数据格式
    });

    // 根据格式创建 Blob
    let mimeType = 'application/json';
    if (format === 'csv') mimeType = 'text/csv';
    if (format === 'excel') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    return new Blob([JSON.stringify(response.data)], { type: mimeType });
  },

  // 数据统计和分析
  async getAnalytics(
    endpoint: string,
    timeRange: {
      start: string;
      end: string;
    },
    metrics: string[] = ['count', 'sum', 'avg']
  ): Promise<{
    metrics: Record<string, number>;
    trends: Array<{ date: string; value: number }>;
    summary: Record<string, any>;
  }> {
    const primaryApi = usePrimaryApi();
    
    const response = await primaryApi.get(`${endpoint}/analytics`, {
      query: {
        start: timeRange.start,
        end: timeRange.end,
        metrics: metrics.join(',')
      }
    });

    return response.data;
  }
};