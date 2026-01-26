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

export interface ServerConfig {
  app: {
    name: string;
    env: string;
    debug: boolean;
    url: string;
    timezone: string;
    locale: string;
  };
  database: {
    default: string;
    connections: Record<string, any>;
  };
  paths: {
    core_node: string;
    laravel_data: string;
    wwwroot: string;
    storage: string;
    public: string;
  };
  server: {
    php_version: string;
    laravel_version: string;
    server_software: string;
  };
  sanctum: {
    expiration: number;
    token_prefix: string;
  };
}

export interface EnvironmentInfo {
  php: {
    version: string;
    sapi: string;
    memory_limit: string;
    max_execution_time: string;
    upload_max_filesize: string;
    post_max_size: string;
  };
  laravel: {
    version: string;
    environment: string;
    debug: boolean;
  };
  server: {
    software: string;
    os: string;
    server_name: string;
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

  /**
   * Get server configuration
   * Requires admin authentication
   */
  async getServerConfig(): Promise<APIResponse<ServerConfig>> {
    return this.get('/api/config/server');
  }

  /**
   * Update server configuration
   * Requires super admin authentication
   */
  async updateServerConfig(data: Partial<ServerConfig>): Promise<APIResponse<any>> {
    return this.put('/api/config/server', data);
  }

  /**
   * Get environment information
   * Requires admin authentication
   */
  async getEnvironment(): Promise<APIResponse<EnvironmentInfo>> {
    return this.get('/api/config/environment');
  }
}
