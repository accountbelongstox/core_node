import { AppQyV1API } from './modules/AppQyV1';
import { McpV1API } from './modules/McpV1';
import { ServerManagerV1API } from './modules/ServerManagerV1';
import { ServerManagerAPI } from './modules/ServerManagerAPI';
import { ItToolsV1API } from './modules/ItToolsV1';
import { InviteCodeAPI } from './modules/InviteCodeAPI';
import { SystemConfigAPI } from './modules/SystemConfigAPI';
import { AuthAPI } from './modules/AuthAPI';
import { DatabaseManagerAPI, AuthDebugAPI } from './modules/DatabaseManagerAPI';
import { MediaQueryAPI } from './modules/MediaQueryAPI';
import { AiStatusAPI } from './modules/AiStatusAPI';
import { AiManagementAPI } from './modules/AiManagementAPI';
import { setSharedBaseURL } from './base/BaseAPI';
import { getDefaultBaseURL, DEFAULT_API_TIMEOUT } from '../../config/constants';

/**
 * API configuration
 * NO ?? or || allowed - use explicit checks
 */
const API_CONFIG = {
  baseURL: getDefaultBaseURL(),
  timeout: DEFAULT_API_TIMEOUT
};

/**
 * Unified API service - singleton pattern
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
  public auth: AuthAPI;
  public databaseManager: DatabaseManagerAPI;
  public authDebug: AuthDebugAPI;
  public mediaQuery: MediaQueryAPI;
  public aiStatus: AiStatusAPI;
  public aiManagement: AiManagementAPI;

  private constructor() {
    // Seed the single shared base URL so EVERY module (including
    // serverManager / systemConfig, which the old recreate-list forgot)
    // resolves the same endpoint from the very first request, even before
    // App.tsx's preselect runs.
    setSharedBaseURL(API_CONFIG.baseURL);

    // Initialize all API modules
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

    this.auth = new AuthAPI({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api',
      timeout: API_CONFIG.timeout
    });

    this.databaseManager = new DatabaseManagerAPI({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api/dashboard/db-manager',
      timeout: API_CONFIG.timeout
    });

    this.authDebug = new AuthDebugAPI({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api/dashboard/auth',
      timeout: API_CONFIG.timeout
    });

    this.mediaQuery = new MediaQueryAPI({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api/app_qy_v1/media',
      timeout: API_CONFIG.timeout
    });

    this.aiStatus = new AiStatusAPI({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api/app_qy_v1/ai_tools/ai',
      timeout: API_CONFIG.timeout
    });

    this.aiManagement = new AiManagementAPI({
      baseURL: API_CONFIG.baseURL,
      prefix: '/api/local/ai',
      timeout: API_CONFIG.timeout
    });
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  /**
   * Set the global Authorization header
   */
  setAuthToken(token: string): void {
    const bearerToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    this.appQyV1.setHeader('Authorization', bearerToken);
    this.mcpV1.setHeader('Authorization', bearerToken);
    this.serverManagerV1.setHeader('Authorization', bearerToken);
    this.serverManager.setHeader('Authorization', bearerToken);
    this.itToolsV1.setHeader('Authorization', bearerToken);
    this.inviteCode.setHeader('Authorization', bearerToken);
    this.auth.setHeader('Authorization', bearerToken);
    this.databaseManager.setHeader('Authorization', bearerToken);
    this.mediaQuery.setHeader('Authorization', bearerToken);
    this.aiStatus.setHeader('Authorization', bearerToken);
    this.aiManagement.setHeader('Authorization', bearerToken);
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.appQyV1.removeHeader('Authorization');
    this.mcpV1.removeHeader('Authorization');
    this.serverManagerV1.removeHeader('Authorization');
    this.serverManager.removeHeader('Authorization');
    this.itToolsV1.removeHeader('Authorization');
    this.inviteCode.removeHeader('Authorization');
    this.auth.removeHeader('Authorization');
    this.databaseManager.removeHeader('Authorization');
    this.mediaQuery.removeHeader('Authorization');
    this.aiStatus.removeHeader('Authorization');
    this.aiManagement.removeHeader('Authorization');
  }

  /**
   * Set a global header
   */
  setGlobalHeader(key: string, value: string): void {
    this.appQyV1.setHeader(key, value);
    this.mcpV1.setHeader(key, value);
    this.serverManagerV1.setHeader(key, value);
    this.serverManager.setHeader(key, value);
    this.itToolsV1.setHeader(key, value);
    this.inviteCode.setHeader(key, value);
    this.auth.setHeader(key, value);
    this.databaseManager.setHeader(key, value);
    this.mediaQuery.setHeader(key, value);
    this.aiStatus.setHeader(key, value);
    this.aiManagement.setHeader(key, value);
  }

  /**
   * Re-point EVERY API module at a new base URL.
   *
   * This now updates the single shared base URL instead of recreating each
   * module. One write re-points all modules in lock-step — including
   * serverManager and systemConfig, which the old enumerated recreate-list
   * silently omitted (the bug that made octane-tasks call the stale LAN IP
   * while the switcher showed localhost). Because modules are no longer
   * recreated, any Authorization / global headers set via setAuthToken /
   * setGlobalHeader also survive an endpoint failover.
   */
  updateBaseURL(baseURL: string): void {
    setSharedBaseURL(baseURL);
  }
}

// Export the singleton
export const api = APIService.getInstance();

// Export types
export type { APIResponse } from '../types';
