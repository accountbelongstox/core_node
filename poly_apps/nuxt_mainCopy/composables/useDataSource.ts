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

import { dataSourceManager } from '@/services/datasource/manager';
import { useDataSourceStore } from '@/stores/datasource';
import type { 
  DataSourceResponse, 
  RequestOptions, 
  DataSourceConfig,
  HealthCheck 
} from '@/types/datasource';

// 数据源 Composable
export const useDataSource = () => {
  const store = useDataSourceStore();
  
  // 基础请求方法
  const request = async <T = any>(
    sourceId: string, 
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<DataSourceResponse<T>> => {
    return dataSourceManager.request<T>(sourceId, endpoint, options);
  };
  
  // 根据路由名称请求
  const requestByRoute = async <T = any>(
    sourceId: string, 
    routeName: string, 
    options: RequestOptions = {}
  ): Promise<DataSourceResponse<T>> => {
    return dataSourceManager.requestByRoute<T>(sourceId, routeName, options);
  };
  
  // 多数据源请求
  const requestMultiple = async <T = any>(
    requests: Array<{
      sourceId: string;
      endpoint: string;
      options?: RequestOptions;
    }>
  ) => {
    return dataSourceManager.requestMultiple<T>(requests);
  };
  
  // 故障转移请求
  const requestWithFailover = async <T = any>(
    sourceIds: string[], 
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<DataSourceResponse<T>> => {
    return dataSourceManager.requestWithFailover<T>(sourceIds, endpoint, options);
  };
  
  // 负载均衡请求
  const requestWithLoadBalancing = async <T = any>(
    sourceIds: string[], 
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<DataSourceResponse<T>> => {
    return dataSourceManager.requestWithLoadBalancing<T>(sourceIds, endpoint, options);
  };
  
  // 聚合请求
  const requestAggregate = async <T = any>(
    requests: Array<{
      sourceId: string;
      endpoint: string;
      options?: RequestOptions;
      key?: string;
    }>,
    aggregator?: (responses: Array<{ key?: string; data: T }>) => T
  ): Promise<DataSourceResponse<T>> => {
    return dataSourceManager.requestAggregate<T>(requests, aggregator);
  };
  
  // 健康检查
  const healthCheck = async (sourceId?: string): Promise<void> => {
    await dataSourceManager.healthCheck(sourceId);
  };
  
  // 数据源管理方法
  const addDataSource = (config: Omit<DataSourceConfig, 'createdAt' | 'updatedAt'>) => {
    store.addDataSource(config);
  };
  
  const updateDataSource = (id: string, updates: Partial<DataSourceConfig>) => {
    store.updateDataSource(id, updates);
  };
  
  const removeDataSource = (id: string) => {
    store.removeDataSource(id);
  };
  
  const activateDataSource = (id: string) => {
    store.activateDataSource(id);
  };
  
  const deactivateDataSource = (id: string) => {
    store.deactivateDataSource(id);
  };
  
  // 缓存管理
  const clearCache = (pattern?: string) => {
    store.clearCache(pattern);
  };
  
  const getCache = (key: string) => {
    return store.getCache(key);
  };
  
  // 错误管理
  const clearErrors = (sourceId?: string) => {
    store.clearErrors(sourceId);
  };
  
  return {
    // 请求方法
    request,
    requestByRoute,
    requestMultiple,
    requestWithFailover,
    requestWithLoadBalancing,
    requestAggregate,
    
    // 健康检查
    healthCheck,
    
    // 数据源管理
    addDataSource,
    updateDataSource,
    removeDataSource,
    activateDataSource,
    deactivateDataSource,
    
    // 缓存管理
    clearCache,
    getCache,
    
    // 错误管理
    clearErrors,
    
    // 响应式状态
    dataSources: computed(() => store.dataSources),
    activeDataSources: computed(() => store.getActiveDataSources),
    healthChecks: computed(() => store.healthChecks),
    errors: computed(() => store.errors),
    loading: computed(() => store.loading),
    stats: computed(() => store.stats),
    
    // Getters
    getDataSourceById: store.getDataSourceById,
    getDataSourcesByTag: store.getDataSourcesByTag,
    getHealthyDataSources: computed(() => store.getHealthyDataSources),
    getDataSourceStats: store.getDataSourceStats
  };
};

// 特定数据源的 Composable
export const usePrimaryApi = () => {
  const { request, requestByRoute } = useDataSource();
  
  return {
    get: <T = any>(endpoint: string, options?: RequestOptions) => 
      request<T>('primary-api', endpoint, { ...options, method: 'GET' }),
    
    post: <T = any>(endpoint: string, body: any, options?: RequestOptions) => 
      request<T>('primary-api', endpoint, { ...options, method: 'POST', body }),
    
    put: <T = any>(endpoint: string, body: any, options?: RequestOptions) => 
      request<T>('primary-api', endpoint, { ...options, method: 'PUT', body }),
    
    delete: <T = any>(endpoint: string, options?: RequestOptions) => 
      request<T>('primary-api', endpoint, { ...options, method: 'DELETE' }),
    
    // 路由方法
    dashboard: <T = any>(options?: RequestOptions) => 
      requestByRoute<T>('primary-api', 'dashboard', options),
    
    users: <T = any>(options?: RequestOptions) => 
      requestByRoute<T>('primary-api', 'users', options),
    
    analytics: <T = any>(options?: RequestOptions) => 
      requestByRoute<T>('primary-api', 'analytics', options)
  };
};

export const useSecondaryApi = () => {
  const { request, requestByRoute } = useDataSource();
  
  return {
    get: <T = any>(endpoint: string, options?: RequestOptions) => 
      request<T>('secondary-api', endpoint, { ...options, method: 'GET' }),
    
    post: <T = any>(endpoint: string, body: any, options?: RequestOptions) => 
      request<T>('secondary-api', endpoint, { ...options, method: 'POST', body }),
    
    // 路由方法
    charts: <T = any>(options?: RequestOptions) => 
      requestByRoute<T>('secondary-api', 'charts', options),
    
    widgets: <T = any>(options?: RequestOptions) => 
      requestByRoute<T>('secondary-api', 'widgets', options),
    
    finance: <T = any>(options?: RequestOptions) => 
      requestByRoute<T>('secondary-api', 'finance', options),
    
    crypto: <T = any>(options?: RequestOptions) => 
      requestByRoute<T>('secondary-api', 'crypto', options)
  };
};

// 响应式数据源状态 Composable
export const useDataSourceStatus = () => {
  const store = useDataSourceStore();
  
  const isHealthy = (sourceId: string) => {
    const health = store.healthChecks.get(sourceId);
    return health?.status === 'healthy';
  };
  
  const getResponseTime = (sourceId: string) => {
    const health = store.healthChecks.get(sourceId);
    return health?.responseTime || 0;
  };
  
  const getLastError = (sourceId: string) => {
    const errors = store.errors.filter(e => e.source === sourceId);
    return errors[errors.length - 1];
  };
  
  return {
    isHealthy,
    getResponseTime,
    getLastError,
    healthChecks: computed(() => store.healthChecks),
    errors: computed(() => store.errors),
    stats: computed(() => store.stats)
  };
};