import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

export interface PathMapping {
  name: string;
  path: string;
  description?: string;
  accessible: boolean;
}

export interface SystemConfig {
  paths: {
    static_resources: PathMapping;
    code_browser: PathMapping;
    [key: string]: PathMapping;
  };
}

/**
 * System Configuration API
 * 获取系统路径配置和其他全局配置
 */
export class SystemConfigAPI extends BaseAPI {
  /**
   * Get API info - 获取API基本信息和健康状态
   * Note: This is a web route, not an API route
   */
  async getApiInfo(): Promise<APIResponse<any>> {
    return this.get('/api_info', undefined, false);
  }

  /**
   * Get full API info with all modules
   * Note: This is a web route, not an API route
   */
  async getFullApiInfo(app?: string): Promise<APIResponse<any>> {
    const params = app ? { app } : undefined;
    return this.get('/api_info', params, false);
  }

  /**
   * Get system path mappings
   * Note: This is an API route under /api prefix
   */
  async getPathMappings(): Promise<APIResponse<SystemConfig>> {
    return this.get('/api/config/paths');
  }

  /**
   * Get specific path mapping
   * Note: This is an API route under /api prefix
   */
  async getPathMapping(name: string): Promise<APIResponse<PathMapping>> {
    return this.get(`/api/config/paths/${name}`);
  }
}
