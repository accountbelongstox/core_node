/**
 * API Response Type
 */
export interface APIResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  status: number;
  message?: string;
  /** Raw error body when success is false (e.g. error_code for auth). */
  debugInfo?: { error_code?: string; [key: string]: any };
}

/**
 * API Request Configuration
 */
export interface APIRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
}

/**
 * API Module Configuration
 */
export interface APIModuleConfig {
  baseURL: string;
  prefix?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: {
    count: number;
    delay: number;
  };
}

/**
 * Cache Entry
 */
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Tool Configuration
 */
export interface ToolConfig {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  apiModule: string;
  apiMethod: string;
  inputSchema: any;
  outputSchema: any;
  history?: boolean;
  favorites?: boolean;
  cache?: boolean;
}

/**
 * Tool History Item
 */
export interface ToolHistoryItem {
  id: string;
  toolId: string;
  input: any;
  output: any;
  timestamp: number;
  success: boolean;
}

/**
 * User Model
 */
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  rolelevel?: number;
  rolename?: string;
  preferences?: UserPreferences;
}

/**
 * User Preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  favorites: string[];
  recentTools: string[];
}
