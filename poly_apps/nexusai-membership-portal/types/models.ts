// User related
export interface User {
  id: string;
  username: string;
  email?: string;
  name?: string;
  displayName?: string;
  role: 'admin' | 'user';
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

// Login response (matches actual API)
export interface LoginResponse {
  token: string;
  expiresIn: number;
  admin?: {
    id: string;
    username: string;
    role: string;
  };
  user?: User;
}

// API Key related
export interface ApiKey {
  id: string;
  name: string;
  apiKey?: string; // Full key only returned on creation
  apiKeyPrefix: string; // Prefix returned on queries
  description?: string;
  permissions: string[];
  isActive: boolean; // top-router uses isActive, not status
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  // Rate limits (top-router uses separate fields, not object)
  concurrencyLimit: number;
  rateLimitWindow: number;
  rateLimitRequests: number;
  rateLimitCost: number;
  // Model and client restrictions
  enableModelRestriction?: boolean;
  restrictedModels: string[]; // top-router uses restrictedModels, not modelBlacklist
  enableClientRestriction?: boolean;
  allowedClients: string[];
  // Cost limits
  dailyCostLimit: number;
  totalCostLimit: number;
  weeklyOpusCostLimit?: number;
  // Other fields
  tags?: string[];
  expirationMode?: 'fixed' | 'activation';
  isActivated?: boolean;
  activatedAt?: string;
  activationDays?: number;
  activationUnit?: 'hours' | 'days';
  createdBy?: string;
  userId?: string;
  userUsername?: string;
  ownerDisplayName?: string;
  // Usage statistics (nested structure)
  usage?: {
    total: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cacheCreateTokens?: number;
      cacheReadTokens?: number;
      allTokens: number;
      cost?: number;
      formattedCost?: string;
    };
    daily: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cacheCreateTokens?: number;
      cacheReadTokens?: number;
      allTokens: number;
      cost?: number;
      formattedCost?: string;
    };
  };
  // Cost statistics (nested structure)
  cost?: {
    total: number;
    daily: number;
    weekly?: number;
    formattedCost?: string;
  };
  concurrentRequests?: number;
}

export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  permissions: string[];
  // Rate limits (using separate fields)
  concurrencyLimit?: number;
  rateLimitWindow?: number;
  rateLimitRequests?: number;
  rateLimitCost?: number;
  // Model and client restrictions
  enableModelRestriction?: boolean;
  restrictedModels?: string[];
  enableClientRestriction?: boolean;
  allowedClients?: string[];
  // Cost limits
  dailyCostLimit?: number;
  totalCostLimit?: number;
  weeklyOpusCostLimit?: number;
  // Concurrent request queue
  concurrentRequestQueueEnabled?: boolean;
  concurrentRequestQueueMaxSize?: number;
  concurrentRequestQueueTimeoutMs?: number;
  // Other
  tags?: string[];
  expirationMode?: 'fixed' | 'activation';
  expiresAt?: string;
  activationDays?: number;
  activationUnit?: 'hours' | 'days';
  userId?: string;
  icon?: string;
}

export interface UpdateApiKeyRequest extends Partial<CreateApiKeyRequest> {
  isActive?: boolean; // top-router uses isActive
}

// Keep RateLimits for compatibility (but actual API doesn't use it)
export interface RateLimits {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  tokensPerMinute?: number;
  tokensPerHour?: number;
  tokensPerDay?: number;
  costPerDay?: number;
}

// API Key list response (includes pagination)
export interface ApiKeyListResponse {
  keys: ApiKey[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalKeys: number;
    hasMore: boolean;
  };
  availableTags?: string[];
  costSortStatus?: any;
}

// API Key usage details (matches actual API response)
export interface ApiKeyUsage {
  keyId: string;
  keyName: string;
  usage: {
    total: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cacheCreateTokens: number;
      cacheReadTokens: number;
      allTokens: number;
    };
    daily: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cacheCreateTokens: number;
      cacheReadTokens: number;
      allTokens: number;
    };
    byModel: Array<{
      model: string;
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    }>;
    byDate: Array<{
      date: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
  };
  cost: {
    total: number;
    daily: number;
    weekly: number;
    monthly: number;
    breakdown: {
      input: number;
      output: number;
      cacheCreate: number;
      cacheRead: number;
    };
  };
  limits: {
    dailyCostLimit: number;
    dailyCostRemaining: number;
    totalCostLimit: number;
    totalCostRemaining: number;
    rateLimitWindow: number;
    rateLimitRequests: number;
    rateLimitCost: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

// Account related
export type AccountType = 
  | 'claude' 
  | 'claude-console' 
  | 'gemini' 
  | 'gemini-api' 
  | 'openai' 
  | 'openai-responses' 
  | 'bedrock' 
  | 'azure-openai' 
  | 'droid' 
  | 'ccr';

export type AccountStatus = 'active' | 'error' | 'overload' | 'disabled' | 'blocked' | 'unauthorized' | 'paused';

export interface Account {
  id: string;
  name: string;
  description?: string;
  type: AccountType;
  accountType?: string; // Platform-specific account type, e.g. 'claude-official', 'claude-console'
  status: AccountStatus;
  isActive: boolean;
  schedulable: boolean;
  priority?: number;
  lastUsedAt?: string;
  errorMessage?: string;
  email?: string;
  config?: Record<string, any>;
  proxy?: {
    type: 'socks5' | 'http';
    host: string;
    port: number;
    username?: string;
    password?: string;
    hasAuth?: boolean;
  };
  tokenExpiry?: string;
  createdAt: string;
  updatedAt?: string;
  usage?: {
    total: {
      requests: number;
      tokens: number;
      inputTokens?: number;
      outputTokens?: number;
      cacheCreateTokens?: number;
      cacheReadTokens?: number;
      allTokens?: number;
    };
    daily: {
      requests: number;
      tokens: number;
      inputTokens?: number;
      outputTokens?: number;
      cacheCreateTokens?: number;
      cacheReadTokens?: number;
      allTokens?: number;
    };
  };
  rateLimitStatus?: {
    isRateLimited: boolean;
    resetAt?: string;
  };
}

export interface ClaudeAccount extends Account {
  type: 'claude';
  accountType: 'claude-official' | 'claude-console';
  email?: string;
  claudeAiOauth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    scopes?: string[];
  };
}

export interface ClaudeConsoleAccount extends Account {
  type: 'claude-console';
  accountType: 'claude-console';
  apiKey?: string;
}

export interface GeminiAccount extends Account {
  type: 'gemini';
  accountType: 'gemini';
  email?: string;
  googleOauth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    scopes?: string[];
  };
}

export interface GeminiApiAccount extends Account {
  type: 'gemini-api';
  accountType: 'gemini-api';
  apiKey: string;
}

export interface OpenaiAccount extends Account {
  type: 'openai';
  accountType: 'openai';
  email?: string;
  oauth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
}

export interface OpenaiResponsesAccount extends Account {
  type: 'openai-responses';
  accountType: 'openai-responses';
  apiKey: string;
}

export interface BedrockAccount extends Account {
  type: 'bedrock';
  accountType: 'bedrock';
  accessKeyId: string;
  secretAccessKey?: string; // Only returned on creation
  region: string;
  credentialType?: 'default' | 'access_key' | 'bearer_token';
}

export interface AzureOpenaiAccount extends Account {
  type: 'azure-openai';
  accountType: 'azure-openai';
  apiKey: string;
  endpoint: string;
  deploymentName: string;
}

export interface DroidAccount extends Account {
  type: 'droid';
  accountType: 'droid';
  apiKey: string;
}

export interface CcrAccount extends Account {
  type: 'ccr';
  accountType: 'ccr';
  apiKey: string;
  apiUrl?: string;
}

export interface CreateAccountRequest {
  name: string;
  description?: string;
  type: AccountType;
  accountType?: string;
  config?: Record<string, any>;
  isActive?: boolean;
  schedulable?: boolean;
  priority?: number;
  proxy?: {
    type: 'socks5' | 'http';
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  // Platform-specific fields
  claudeAiOauth?: any;
  googleOauth?: any;
  apiKey?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  endpoint?: string;
  deploymentName?: string;
  apiUrl?: string;
}

// Usage statistics
export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  period: {
    start: string;
    end: string;
  };
}

export interface UsageStatsByModel extends UsageStats {
  model: string;
}

export interface UsageStatsByKey extends UsageStats {
  apiKeyId: string;
  apiKeyName: string;
}

export interface UsageStatsByAccount extends UsageStats {
  accountId: string;
  accountName: string;
}

export interface DailyUsageStats {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

// Dashboard (matches actual API response)
export interface DashboardData {
  overview: {
    totalApiKeys: number;
    activeApiKeys: number;
    totalAccounts: number;
    normalAccounts: number;
    abnormalAccounts: number;
    pausedAccounts: number;
    rateLimitedAccounts: number;
    accountsByPlatform: Record<string, {
      total: number;
      normal: number;
      abnormal: number;
      paused: number;
      rateLimited: number;
    }>;
    totalTokensUsed: number;
    totalRequestsUsed: number;
    totalInputTokensUsed: number;
    totalOutputTokensUsed: number;
    totalCacheCreateTokensUsed?: number;
    totalCacheReadTokensUsed?: number;
    totalAllTokensUsed: number;
  };
  recentActivity: {
    apiKeysCreatedToday: number;
    requestsToday: number;
    tokensToday: number;
    inputTokensToday: number;
    outputTokensToday: number;
    cacheCreateTokensToday?: number;
    cacheReadTokensToday?: number;
  };
  systemAverages: {
    rpm: number;
    tpm: number;
  };
  realtimeMetrics: {
    rpm: number;
    tpm: number;
    windowMinutes: number;
    isHistorical: boolean;
  };
  systemHealth: {
    redisConnected: boolean;
    claudeAccountsHealthy: boolean;
    geminiAccountsHealthy: boolean;
    droidAccountsHealthy?: boolean;
    uptime: number;
  };
  systemTimezone: number;
}

// System metrics (matches actual API response)
export interface SystemMetrics {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  usage: {
    totalRequests: number;
    totalTokens: number;
    rpm: number;
    tpm: number;
  };
  accounts: {
    total: number;
    active: number;
  };
  apiKeys: {
    total: number;
    active: number;
  };
  version: string;
  timestamp: string;
}

// Webhook
export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookRequest {
  url: string;
  events: string[];
  secret?: string;
}

// Account group
export interface AccountGroup {
  id: string;
  name: string;
  description?: string;
  accountIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Account balance
export interface AccountBalance {
  accountId: string;
  accountName: string;
  accountType: string;
  balance: number;
  currency: string;
  lastUpdated: string;
}

export interface QueryBalanceRequest {
  accountId?: string;
  accountType?: string;
}

