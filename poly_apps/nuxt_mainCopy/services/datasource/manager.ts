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

import { useDataSourceStore } from '@/stores/datasource';
import type { 
  DataSourceConfig, 
  DataSourceResponse, 
  DataSourceError, 
  RequestOptions,
  AuthType 
} from '@/types/datasource';

// 数据源管理器类
export class DataSourceManager {
  private store = useDataSourceStore();
  
  constructor() {
    // 初始化时加载配置
    this.store.loadFromLocalStorage();
  }
  
  // 执行请求
  async request<T = any>(
    sourceId: string, 
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<DataSourceResponse<T>> {
    const dataSource = this.store.getDataSourceById(sourceId);
    if (!dataSource) {
      throw new Error(`Data source ${sourceId} not found`);
    }
    
    // 检查缓存
    const cacheKey = `${sourceId}:${endpoint}:${JSON.stringify(options)}`;
    if (options.cache !== false) {
      const cached = this.store.getCache(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const startTime = Date.now();
    let success = false;
    
    try {
      // 构建请求配置
      const requestConfig = this.buildRequestConfig(dataSource, endpoint, options);
      
      // 执行请求
      const response = await $fetch<T>(requestConfig.url, {
        method: requestConfig.method as any,
        query: requestConfig.query,
        body: requestConfig.body,
        headers: requestConfig.headers,
        timeout: requestConfig.timeout,
        retry: requestConfig.retries || 0
      });
      
      success = true;
      const responseTime = Date.now() - startTime;
      
      // 更新统计
      this.store.updateStats(true, responseTime);
      
      // 构建响应
      const result: DataSourceResponse<T> = {
        success: true,
        data: options.transform ? options.transform(response) : response,
        source: sourceId,
        timestamp: Date.now()
      };
      
      // 缓存响应
      if (options.cache !== false && requestConfig.method === 'GET') {
        this.store.setCache(cacheKey, result);
      }
      
      return result;
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.store.updateStats(false, responseTime);
      
      const apiError: DataSourceError = {
        code: error.response?.status || 500,
        message: error.response?._data?.message || error.message || 'Request failed',
        source: sourceId,
        details: error.response?._data || error,
        timestamp: Date.now()
      };
      
      this.store.addError(apiError);
      throw apiError;
    }
  }
  
  // 构建请求配置
  private buildRequestConfig(
    dataSource: DataSourceConfig, 
    endpoint: string, 
    options: RequestOptions
  ) {
    // 构建完整URL
    const baseUrl = dataSource.baseUrl.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${path}`;
    
    // 构建请求头
    const headers = {
      'Content-Type': 'application/json',
      'X-Source-ID': dataSource.id,
      ...dataSource.headers,
      ...this.store.buildAuthHeaders(dataSource.auth),
      ...options.headers
    };
    
    return {
      url,
      method: options.method || 'GET',
      query: options.query,
      body: options.body,
      headers,
      timeout: options.timeout || dataSource.timeout || 10000,
      retries: options.retries || dataSource.retryCount || 0
    };
  }
  
  // 根据路由名称请求
  async requestByRoute<T = any>(
    sourceId: string, 
    routeName: string, 
    options: RequestOptions = {}
  ): Promise<DataSourceResponse<T>> {
    const dataSource = this.store.getDataSourceById(sourceId);
    if (!dataSource) {
      throw new Error(`Data source ${sourceId} not found`);
    }
    
    const endpoint = dataSource.routes[routeName];
    if (!endpoint) {
      throw new Error(`Route ${routeName} not found in data source ${sourceId}`);
    }
    
    return this.request<T>(sourceId, endpoint, options);
  }
  
  // 多数据源请求（并行）
  async requestMultiple<T = any>(
    requests: Array<{
      sourceId: string;
      endpoint: string;
      options?: RequestOptions;
    }>
  ): Promise<Array<DataSourceResponse<T> | DataSourceError>> {
    const promises = requests.map(async (req) => {
      try {
        return await this.request<T>(req.sourceId, req.endpoint, req.options);
      } catch (error) {
        return error as DataSourceError;
      }
    });
    
    return Promise.all(promises);
  }
  
  // 故障转移请求
  async requestWithFailover<T = any>(
    sourceIds: string[], 
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<DataSourceResponse<T>> {
    let lastError: DataSourceError | null = null;
    
    for (const sourceId of sourceIds) {
      try {
        return await this.request<T>(sourceId, endpoint, options);
      } catch (error) {
        lastError = error as DataSourceError;
        console.warn(`Request failed for source ${sourceId}, trying next...`);
      }
    }
    
    throw lastError || new Error('All data sources failed');
  }
  
  // 负载均衡请求
  async requestWithLoadBalancing<T = any>(
    sourceIds: string[], 
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<DataSourceResponse<T>> {
    // 获取健康的数据源
    const healthySources = sourceIds.filter(id => {
      const health = this.store.healthChecks.get(id);
      return health?.status === 'healthy';
    });
    
    if (healthySources.length === 0) {
      throw new Error('No healthy data sources available');
    }
    
    // 简单的轮询负载均衡
    const selectedSource = healthySources[Math.floor(Math.random() * healthySources.length)];
    return this.request<T>(selectedSource, endpoint, options);
  }
  
  // 聚合请求（从多个数据源获取数据并合并）
  async requestAggregate<T = any>(
    requests: Array<{
      sourceId: string;
      endpoint: string;
      options?: RequestOptions;
      key?: string; // 用于标识响应数据的key
    }>,
    aggregator?: (responses: Array<{ key?: string; data: T }>) => T
  ): Promise<DataSourceResponse<T>> {
    const responses = await this.requestMultiple<T>(requests);
    
    const successfulResponses = responses
      .filter((resp): resp is DataSourceResponse<T> => 'success' in resp && resp.success)
      .map((resp, index) => ({
        key: requests[index].key,
        data: resp.data
      }));
    
    if (successfulResponses.length === 0) {
      throw new Error('No successful responses from aggregate request');
    }
    
    let aggregatedData: T;
    if (aggregator) {
      aggregatedData = aggregator(successfulResponses);
    } else {
      // 默认聚合策略：合并对象或数组
      if (Array.isArray(successfulResponses[0].data)) {
        aggregatedData = successfulResponses.flatMap(resp => resp.data) as T;
      } else {
        aggregatedData = successfulResponses.reduce((acc, resp) => ({
          ...acc,
          ...(resp.key ? { [resp.key]: resp.data } : resp.data)
        }), {} as T);
      }
    }
    
    return {
      success: true,
      data: aggregatedData,
      source: 'aggregate',
      timestamp: Date.now()
    };
  }
  
  // 健康检查
  async healthCheck(sourceId?: string): Promise<void> {
    if (sourceId) {
      await this.store.performHealthCheck(sourceId);
    } else {
      await this.store.performBatchHealthCheck();
    }
  }
  
  // 获取数据源信息
  getDataSource(sourceId: string): DataSourceConfig | undefined {
    return this.store.getDataSourceById(sourceId);
  }
  
  // 获取所有活跃数据源
  getActiveDataSources(): DataSourceConfig[] {
    return this.store.getActiveDataSources;
  }
  
  // 获取数据源统计
  getStats(sourceId?: string) {
    if (sourceId) {
      return this.store.getDataSourceStats(sourceId);
    }
    return this.store.stats;
  }
}

// 创建全局实例
export const dataSourceManager = new DataSourceManager();

// Nuxt 4 插件导出
export default dataSourceManager;