import { STORAGE_KEYS, API_BASE_URL } from '../base-constants';

export const ADMIN_API_ENDPOINTS = {
  USERS: `${API_BASE_URL}/api/admin/users`,
  ROLES: `${API_BASE_URL}/api/admin/roles`,
  PERMISSIONS: `${API_BASE_URL}/api/admin/permissions`,
  DATASOURCES: `${API_BASE_URL}/api/admin/datasources`,
  LOGS: `${API_BASE_URL}/api/admin/logs`,
  SETTINGS: `${API_BASE_URL}/api/admin/settings`,
} as const;

export const ADMIN_STORAGE_KEYS = {
  ...STORAGE_KEYS,
  ADMIN_PERMISSIONS: 'admin_permissions',
  SELECTED_DATASOURCE: 'admin_selected_datasource',
} as const;

export const ADMIN_PERMISSIONS = {
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_DATASOURCES: 'manage_datasources',
  VIEW_LOGS: 'view_logs',
  MANAGE_SETTINGS: 'manage_settings',
  SYSTEM_CONFIG: 'system_config',
} as const;

export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export const DATASOURCE_TYPES = {
  MYSQL: 'mysql',
  POSTGRESQL: 'postgresql',
  MONGODB: 'mongodb',
  REDIS: 'redis',
  ELASTICSEARCH: 'elasticsearch',
} as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[keyof typeof ADMIN_PERMISSIONS];
export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];
export type DatasourceType = typeof DATASOURCE_TYPES[keyof typeof DATASOURCE_TYPES];
