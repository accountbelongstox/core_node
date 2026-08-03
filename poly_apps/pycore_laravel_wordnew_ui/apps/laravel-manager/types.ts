/**
 * Transport-level API types are defined once in the shared core library and
 * re-exported here for laravel-manager consumers.
 */
export type {
  APIResponse,
  APIRequestConfig,
  APIModuleConfig,
  CacheEntry,
} from '../../core/api-libs/laravel/transport/TransportTypes';

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
export interface ToolDefinition {
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
  /**
   * When true, the tool's backend endpoint does not exist yet. The UI shows it
   * with a muted "coming soon" badge and a disabled Execute button so the API
   * is never called.
   */
  unavailable?: boolean;
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
 * UnifiedUser Model
 */
export interface UnifiedUser {
  id: string;
  username: string;
  email: string;
  nickname?: string;
  avatar?: string;
  avatar_url?: string;
  rolelevel?: number;
  rolename?: string;
  role?: string;
  role_level?: number;
  role_name?: string;
  name?: string;
  bio?: string;
  location?: string;
  is_active?: boolean | number;
  created_at?: string;
  updated_at?: string;
  preferences?: UserPreferences;
}

/**
 * UnifiedUser Preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  favorites: string[];
  recentTools: string[];
}


