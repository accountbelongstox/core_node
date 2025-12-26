import { AppQyV1API } from './modules/AppQyV1';
import { McpV1API } from './modules/McpV1';
import { ServerManagerV1API } from './modules/ServerManagerV1';
import { ServerManagerAPI } from './modules/ServerManagerAPI';
import { ItToolsV1API } from './modules/ItToolsV1';
import { InviteCodeAPI } from './modules/InviteCodeAPI';
import { SystemConfigAPI } from './modules/SystemConfigAPI';

/**
 * API配置
 * NO ?? or || allowed - use explicit checks
 */
const getDefaultBaseURL = (): string => {
  const envBaseURL = import.meta.env.VITE_API_BASE_URL;
  if (envBaseURL) {
    return envBaseURL;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:9000`;
  }

  return 'http://localhost:9000';
};

const API_CONFIG = {
  baseURL: getDefaultBaseURL(),
  timeout: 30000
};

/**
 * 统一API服务 - 单例模式
 */
class APIService {
  private static instance: APIService;

  public appQyV1: AppQyV1API;
  public mcpV1: McpV1API;
  public serverManagerV1: ServerManagerV1API;
  public serverManager: ServerManagerAPI;
  public itToolsV1: ItToolsV1API;
  public inviteCode: InviteCodeAPI;
  public systemConfig: SystemConfigAPI;

  private constructor() {
    // 初始化所有API模块
    this.appQyV1 = new AppQyV1API({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api/app_qy_v1',
      timeout: API_CONFIG.timeout
    });

    this.mcpV1 = new McpV1API({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api/mcp/v1',
      timeout: API_CONFIG.timeout
    });

    this.serverManagerV1 = new ServerManagerV1API({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api/servermanager/v1',
      timeout: API_CONFIG.timeout
    });

    this.serverManager = new ServerManagerAPI({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api',
      timeout: API_CONFIG.timeout
    });

    this.itToolsV1 = new ItToolsV1API({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api/ittools/v1',
      timeout: API_CONFIG.timeout
    });

    this.inviteCode = new InviteCodeAPI({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api',
      timeout: API_CONFIG.timeout
    });

    this.systemConfig = new SystemConfigAPI({
      baseURL: API_CONFIG.baseURL,
      prefix: '', // No prefix - paths are handled in SystemConfigAPI methods
      timeout: API_CONFIG.timeout
    });
  }

  /**
   * 获取单例实例
   */
  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  /**
   * 设置全局Authorization header
   */
  setAuthToken(token: string): void {
    const bearerToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    this.appQyV1.setHeader('Authorization', bearerToken);
    this.mcpV1.setHeader('Authorization', bearerToken);
    this.serverManagerV1.setHeader('Authorization', bearerToken);
    this.serverManager.setHeader('Authorization', bearerToken);
    this.itToolsV1.setHeader('Authorization', bearerToken);
    this.inviteCode.setHeader('Authorization', bearerToken);
  }

  /**
   * 清除认证
   */
  clearAuth(): void {
    this.appQyV1.removeHeader('Authorization');
    this.mcpV1.removeHeader('Authorization');
    this.serverManagerV1.removeHeader('Authorization');
    this.serverManager.removeHeader('Authorization');
    this.itToolsV1.removeHeader('Authorization');
    this.inviteCode.removeHeader('Authorization');
  }

  /**
   * 设置全局header
   */
  setGlobalHeader(key: string, value: string): void {
    this.appQyV1.setHeader(key, value);
    this.mcpV1.setHeader(key, value);
    this.serverManagerV1.setHeader(key, value);
    this.serverManager.setHeader(key, value);
    this.itToolsV1.setHeader(key, value);
    this.inviteCode.setHeader(key, value);
  }

  /**
   * 更新所有模块的baseURL
   */
  updateBaseURL(baseURL: string): void {
    // 重新创建所有API模块实例
    this.appQyV1 = new AppQyV1API({
      baseURL,
      prefix: '/api/app_qy_v1',
      timeout: API_CONFIG.timeout
    });

    this.mcpV1 = new McpV1API({
      baseURL,
      prefix: '/api/mcp/v1',
      timeout: API_CONFIG.timeout
    });

    this.serverManagerV1 = new ServerManagerV1API({
      baseURL,
      prefix: '/api/servermanager/v1',
      timeout: API_CONFIG.timeout
    });

    this.itToolsV1 = new ItToolsV1API({
      baseURL,
      prefix: '/api/ittools/v1',
      timeout: API_CONFIG.timeout
    });

    this.inviteCode = new InviteCodeAPI({
      baseURL,
      prefix: '/api',
      timeout: API_CONFIG.timeout
    });
  }
}

// 导出单例
export const api = APIService.getInstance();

// 导出类型
export type { APIResponse } from '../types';
