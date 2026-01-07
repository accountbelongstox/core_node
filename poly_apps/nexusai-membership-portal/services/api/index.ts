// Unified API service exports
export { apiManager } from './ApiManager';
export { apiClient } from './client';

// ============================================
// Public Group - No authentication required
// ============================================
export { publicService } from './publicService';

// ============================================
// User Group - Regular user endpoints
// ============================================
export { userAuthService } from './userAuthService';
export { userApiKeyService } from './userApiKeyService';
export { userUsageService } from './userUsageService';
export { userSubscriptionService } from './userSubscriptionService';

// ============================================
// Admin Group - Administrator endpoints
// ============================================
// Authentication (admin login)
export { authService } from './authService';

// API Keys management
export { apiKeyService } from './apiKeyService';

// Dashboard and statistics
export { dashboardService } from './dashboardService';
export { usageStatsService } from './usageStatsService';

// Account management services
export {
  BaseAccountService,
  claudeAccountsService,
  claudeConsoleAccountsService,
  geminiAccountsService,
  geminiApiAccountsService,
  openaiAccountsService,
  openaiResponsesAccountsService,
  bedrockAccountsService,
  azureOpenaiAccountsService,
  droidAccountsService,
  ccrAccountsService,
  accountServices,
} from './accountService';

// Other admin management services
export { accountGroupsService } from './accountGroupsService';
export { accountBalanceService } from './accountBalanceService';
export { webhookService } from './webhookService';
export { concurrencyService } from './concurrencyService';
export { adminSystemService } from './adminSystemService';
export { adminUserService } from './adminUserService';
export { adminSubscriptionService } from './adminSubscriptionService';

// ============================================
// Legacy exports (for backward compatibility)
// ============================================
// Note: These are deprecated, use grouped services instead
export { systemService } from './systemService';
export { userService } from './userService';
export { subscriptionService } from './subscriptionService';

