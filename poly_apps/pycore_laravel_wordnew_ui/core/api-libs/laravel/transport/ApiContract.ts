import type { APIModuleConfig } from './TransportTypes';
import { getDefaultBaseURL, DEFAULT_API_TIMEOUT } from '../../../../config/constants';

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
  codeBrowser: '/code-browser',
  localAi: '/api/local/ai',
  localWordAudio: '/api/local/word-audio',
  devHistory: '/api/dev-history',
} as const;

export const LARAVEL_API_ROUTE = {
  health: '/api/health',
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
    public: '/invite-codes/public',
    validate: '/invite-codes/validate',
    redeemSuperCode: '/user/redeem-super-code',
  },
  articles: {
    list: '/articles',
    batchDelete: '/articles/batch-delete',
    byId: (id: string): string => `/articles/${encodeURIComponent(id)}`,
  },
  vocabulary: {
    export: (format: string): string => `/vocabulary/export/${encodeURIComponent(format)}`,
  },
  serverFiles: {
    browse: '/files/browse',
    download: '/files/download',
    info: '/files/info',
    preview: '/files/preview',
    write: '/files/write',
    elevatedAuth: '/files/elevated-auth',
  },
  database: {
    exportTable: (table: string): string => `tables/${encodeURIComponent(table)}/export`,
    downloadBackup: (id: string): string => `backups/${encodeURIComponent(id)}/download`,
  },
  mcp: {
    screenshotAsset: (id: string, extension: string): string => `/screenshots/${encodeURIComponent(id)}.${encodeURIComponent(extension)}`,
    placeholderDownload: (id: string): string => `/placeholders/${encodeURIComponent(id)}/download`,
    staticResourceUpload: '/static-resources/upload',
  },
} as const;

export function createLaravelModuleConfig(prefix: string): APIModuleConfig {
  return {
    baseURL: getDefaultBaseURL(),
    prefix,
    timeout: DEFAULT_API_TIMEOUT,
  };
}
