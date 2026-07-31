import type { APIModuleConfig } from '../types';
import { getDefaultBaseURL, DEFAULT_API_TIMEOUT } from '../../../config/constants';

export const LARAVEL_API_PREFIX = {
  root: '',
  common: '/api',
  appQyV1: '/api/app_qy_v1',
  appQyV1AiTools: '/api/app_qy_v1/ai_tools',
  appQyV1AiStatus: '/api/app_qy_v1/ai_tools/ai',
  appQyV1Media: '/api/app_qy_v1/media',
  mcpV1: '/api/mcp/v1',
  serverManagerV1: '/api/servermanager/v1',
  itToolsV1: '/api/ittools/v1',
  databaseManager: '/api/dashboard/db-manager',
  dashboardAuth: '/api/dashboard/auth',
  dashboard: '/api/dashboard',
  codeBrowser: '/api/code-browser',
  localAi: '/api/local/ai',
  localWordAudio: '/api/local/word-audio',
  devHistory: '/api/dev-history',
} as const;

export const LARAVEL_API_ROUTE = {
  auth: {
    login: '/login',
    register: '/register',
    logout: '/logout',
    currentUser: '/user',
    profile: '/user/profile',
    password: '/user/change-password',
    preferences: '/user/preferences',
  },
  inviteCodes: {
    list: '/admin/invite-codes',
    public: '/invite-codes/public',
    validate: '/invite-codes/validate',
    redeemSuperCode: '/user/redeem-super-code',
    deactivate: (id: number): string => `/admin/invite-codes/${encodeURIComponent(String(id))}/deactivate`,
  },
  articles: {
    list: '/articles',
    batchDelete: '/articles/batch-delete',
    byId: (id: string): string => `/articles/${encodeURIComponent(id)}`,
  },
} as const;

export function createLaravelModuleConfig(prefix: string): APIModuleConfig {
  return {
    baseURL: getDefaultBaseURL(),
    prefix,
    timeout: DEFAULT_API_TIMEOUT,
  };
}
