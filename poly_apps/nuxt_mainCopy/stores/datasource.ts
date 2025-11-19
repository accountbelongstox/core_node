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

import { defineStore } from 'pinia';
import { 
  AuthType, 
  DataSourceStatus 
} from '../types/datasource';
import type { 
  DataSourceConfig, 
  HealthCheck,
  DataSourceError 
} from '../types/datasource';

// 默认数据源配置
const DEFAULT_DATASOURCES: DataSourceConfig[] = [
  {
    id: 'primary-api',
    name: 'Primary API Server',
    description: '主要API服务器 - Laravel后端',
    baseUrl: 'http://47.107.84.210',
    timeout: 10000,
    retryCount: 3,
    auth: {
      type: AuthType.JWT,
      tokenKey: 'access_token',
      headerKey: 'Authorization',
      prefix: 'Bearer',
      refreshTokenKey: 'refresh_token',
      expiresIn: 3600
    },
    routes: {
      dashboard: '/api/dashboard',
      users: '/api/users',
      analytics: '/api/analytics',
      tables: '/api/tables',
      auth: '/api/auth'
    },
    status: DataSourceStatus.ACTIVE,
    priority: 1,
    tags: ['primary', 'laravel', 'main'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'secondary-api',
    name: 'Secondary API Server',
    description: '辅助API服务器 - Strapi CMS',
    baseUrl: 'http://43.159.58.199',
    timeout: 15000,
    retryCount: 2,
    auth: {
      type: AuthType.API_KEY,
      apiKey: 'strapi_api_key',
      headerKey: 'X-API-Key'
    },
    routes: {
      charts: '/api/charts',
      widgets: '/api/widgets',
      finance: '/api/finance',
      crypto: '/api/crypto',
      content: '/api/content'
    },
    status: DataSourceStatus.ACTIVE,
    priority: 2,
    tags: ['secondary', 'strapi', 'cms'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'external-api',
    name: 'External Data Provider',
    description: '外部数据提供商 - 需要Bearer认证',
    baseUrl: 'https://api.external-provider.com',
    timeout: 20000,
    retryCount: 1,
    auth: {
      type: AuthType.BEARER,
      tokenKey: 'external_bearer_token',
      headerKey: 'Authorization',
      prefix: 'Bearer'
    },
    routes: {
      market: '/v1/market-data',
      news: '/v1/news',
      reports: '/v1/reports'
    },
    status: DataSourceStatus.INACTIVE,
    priority: 3,
    tags: ['external', 'market-data'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const useDataSourceStore = defineStore('datasource', {
  state: () => ({
    // 数据源配置列表
    dataSources: [...DEFAULT_DATASOURCES] as DataSourceConfig[],
    
    // 当前活跃的数据源
    activeDataSources: [] as string[],
    
    // 健康检查状态
    healthChecks: new Map<string, HealthCheck>(),
    
    // 错误日志
    errors: [] as DataSourceError[],
    
    // 加载状态
    loading: false,
    
    // 缓存数据
    cache: new Map<string, { data: any; timestamp: number; ttl: number }>(),
    
    // 统计信息
    stats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    }
  }),

  getters: {
    // 获取活跃的数据源
    getActiveDataSources: (state) => {
      return state.dataSources.filter(ds => 
        ds.status === DataSourceStatus.ACTIVE && 
        state.activeDataSources.includes(ds.id)
      );
    },
    
    // 根据ID获取数据源
    getDataSourceById: (state) => (id: string) => {
      return state.dataSources.find(ds => ds.id === id);
    },
    
    // 根据标签获取数据源
    getDataSourcesByTag: (state) => (tag: string) => {
      return state.dataSources.filter(ds => ds.tags?.includes(tag));
    },
    
    // 获取健康的数据源
    getHealthyDataSources: (state) => {
      return state.dataSources.filter(ds => {
        const health = state.healthChecks.get(ds.id);
        return health?.status === 'healthy';
      });
    },
    
    // 获取数据源统计
    getDataSourceStats: (state) => (sourceId: string) => {
      const errors = state.errors.filter(e => e.source === sourceId);
      const health = state.healthChecks.get(sourceId);
      
      return {
        errorCount: errors.length,
        lastError: errors[errors.length - 1],
        health: health,
        isHealthy: health?.status === 'healthy'
      };
    }
  },

  actions: {
    // 添加数据源
    addDataSource(config: Omit<DataSourceConfig, 'createdAt' | 'updatedAt'>) {
      const newConfig: DataSourceConfig = {
        ...config,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.dataSources.push(newConfig);
      this.saveToLocalStorage();
    },
    
    // 更新数据源
    updateDataSource(id: string, updates: Partial<Omit<DataSourceConfig, 'id' | 'createdAt'>>) {
      const index = this.dataSources.findIndex(ds => ds.id === id);
      if (index !== -1) {
        this.dataSources[index] = {
          ...this.dataSources[index],
          ...updates,
          updatedAt: new Date()
        } as DataSourceConfig;
        this.saveToLocalStorage();
      }
    },
    
    // 删除数据源
    removeDataSource(id: string) {
      const index = this.dataSources.findIndex(ds => ds.id === id);
      if (index !== -1) {
        this.dataSources.splice(index, 1);
        this.activeDataSources = this.activeDataSources.filter(dsId => dsId !== id);
        this.healthChecks.delete(id);
        this.saveToLocalStorage();
      }
    },
    
    // 激活数据源
    activateDataSource(id: string) {
      if (!this.activeDataSources.includes(id)) {
        this.activeDataSources.push(id);
        this.saveToLocalStorage();
      }
    },
    
    // 停用数据源
    deactivateDataSource(id: string) {
      this.activeDataSources = this.activeDataSources.filter(dsId => dsId !== id);
      this.saveToLocalStorage();
    },
    
    // 更新数据源状态
    updateDataSourceStatus(id: string, status: DataSourceStatus) {
      this.updateDataSource(id, { status });
    },
    
    // 健康检查
    async performHealthCheck(sourceId: string): Promise<HealthCheck> {
      const dataSource = this.getDataSourceById(sourceId);
      if (!dataSource) {
        throw new Error(`Data source ${sourceId} not found`);
      }
      
      const startTime = Date.now();
      let healthCheck: HealthCheck;
      
      try {
        // 执行健康检查请求
        const response = await $fetch(`${dataSource.baseUrl}/health`, {
          timeout: dataSource.timeout || 5000,
          headers: this.buildAuthHeaders(dataSource.auth)
        });
        
        const responseTime = Date.now() - startTime;
        
        healthCheck = {
          sourceId,
          status: 'healthy',
          responseTime,
          lastCheck: new Date()
        };
        
        this.updateDataSourceStatus(sourceId, DataSourceStatus.ACTIVE);
      } catch (error: any) {
        healthCheck = {
          sourceId,
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error.message
        };
        
        this.updateDataSourceStatus(sourceId, DataSourceStatus.ERROR);
        this.addError({
          code: error.status || 500,
          message: error.message,
          source: sourceId,
          details: error,
          timestamp: Date.now()
        });
      }
      
      this.healthChecks.set(sourceId, healthCheck);
      return healthCheck;
    },
    
    // 批量健康检查
    async performBatchHealthCheck(): Promise<HealthCheck[]> {
      const activeDataSources = this.getActiveDataSources;
      const promises = activeDataSources.map(ds => this.performHealthCheck(ds.id));
      
      try {
        return await Promise.all(promises);
      } catch (error) {
        console.error('Batch health check failed:', error);
        return [];
      }
    },
    
    // 构建认证头
    buildAuthHeaders(auth: any): Record<string, string> {
      const headers: Record<string, string> = {};
      
      switch (auth.type) {
        case AuthType.JWT:
        case AuthType.BEARER:
          const token = localStorage.getItem(auth.tokenKey || 'auth_token');
          if (token) {
            headers[auth.headerKey || 'Authorization'] = `${auth.prefix || 'Bearer'} ${token}`;
          }
          break;
          
        case AuthType.API_KEY:
          const apiKey = localStorage.getItem(auth.apiKey || 'api_key');
          if (apiKey) {
            headers[auth.headerKey || 'X-API-Key'] = apiKey;
          }
          break;
          
        case AuthType.BASIC:
          if (auth.username && auth.password) {
            const credentials = btoa(`${auth.username}:${auth.password}`);
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
          
        case AuthType.CUSTOM:
          if (auth.customHeaders) {
            Object.assign(headers, auth.customHeaders);
          }
          break;
      }
      
      return headers;
    },
    
    // 添加错误日志
    addError(error: DataSourceError) {
      this.errors.push(error);
      
      // 保持错误日志数量在合理范围内
      if (this.errors.length > 100) {
        this.errors = this.errors.slice(-50);
      }
    },
    
    // 清除错误日志
    clearErrors(sourceId?: string) {
      if (sourceId) {
        this.errors = this.errors.filter(e => e.source !== sourceId);
      } else {
        this.errors = [];
      }
    },
    
    // 缓存管理
    setCache(key: string, data: any, ttl: number = 300000) { // 默认5分钟
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl
      });
    },
    
    getCache(key: string) {
      const cached = this.cache.get(key);
      if (!cached) return null;
      
      if (Date.now() - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
        return null;
      }
      
      return cached.data;
    },
    
    clearCache(pattern?: string) {
      if (pattern) {
        for (const [key] of this.cache) {
          if (key.includes(pattern)) {
            this.cache.delete(key);
          }
        }
      } else {
        this.cache.clear();
      }
    },
    
    // 更新统计信息
    updateStats(success: boolean, responseTime: number) {
      this.stats.totalRequests++;
      
      if (success) {
        this.stats.successfulRequests++;
      } else {
        this.stats.failedRequests++;
      }
      
      // 计算平均响应时间
      this.stats.averageResponseTime = 
        (this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime) / 
        this.stats.totalRequests;
    },
    
    // 保存到本地存储
    saveToLocalStorage() {
      try {
        localStorage.setItem('datasources_config', JSON.stringify({
          dataSources: this.dataSources,
          activeDataSources: this.activeDataSources
        }));
      } catch (error) {
        console.error('Failed to save datasources to localStorage:', error);
      }
    },
    
    // 从本地存储加载
    loadFromLocalStorage() {
      try {
        const saved = localStorage.getItem('datasources_config');
        if (saved) {
          const config = JSON.parse(saved);
          this.dataSources = config.dataSources || DEFAULT_DATASOURCES;
          this.activeDataSources = config.activeDataSources || [];
        } else {
          // 首次加载，激活默认数据源
          this.activeDataSources = this.dataSources
            .filter(ds => ds.status === DataSourceStatus.ACTIVE)
            .map(ds => ds.id);
        }
      } catch (error) {
        console.error('Failed to load datasources from localStorage:', error);
        this.dataSources = [...DEFAULT_DATASOURCES];
        this.activeDataSources = this.dataSources
          .filter(ds => ds.status === DataSourceStatus.ACTIVE)
          .map(ds => ds.id);
      }
    },
    
    // 重置为默认配置
    resetToDefaults() {
      this.dataSources = [...DEFAULT_DATASOURCES];
      this.activeDataSources = this.dataSources
        .filter(ds => ds.status === DataSourceStatus.ACTIVE)
        .map(ds => ds.id);
      this.healthChecks.clear();
      this.errors = [];
      this.cache.clear();
      this.saveToLocalStorage();
    }
  }
});