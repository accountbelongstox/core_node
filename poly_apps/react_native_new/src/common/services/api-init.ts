/**
 * API Initialization
 * 
 * Initialize the global API base with configurations
 * This should be called during app startup
 */

import { apiBase, ApiConfig } from './api-base';

/**
 * Initialize API base with configurations
 * 
 * @param configs Array of API configurations to try
 * @param endpointPaths Optional endpoint paths to register (app-specific)
 * @param healthCheckPath Path to check API health (default: '/api/health')
 */
export async function initializeApi(
  configs: Array<{
    id: string;
    baseUrl: string;
    healthCheckPath?: string;
    timeout?: number;
    priority?: number;
  }>,
  endpointPaths?: Record<string, string>,
  healthCheckPath: string = '/api/health'
): Promise<void> {
  // Register endpoint paths if provided (app-specific)
  if (endpointPaths) {
    apiBase.registerEndpoints(endpointPaths);
  }

  // Convert configs to ApiConfig format
  const apiConfigs: ApiConfig[] = configs.map((config) => ({
    id: config.id,
    baseUrl: config.baseUrl,
    healthCheckPath: config.healthCheckPath || healthCheckPath,
    timeout: config.timeout || 5000,
    priority: config.priority || 999,
  }));

  // Configure API base
  apiBase.configure(apiConfigs);

  // Detect and lock to available API
  const availableApi = await apiBase.detectAvailableApi();
  if (!availableApi) {
    console.warn('No available API endpoint found. App will use the first configured API.');
    if (apiConfigs.length > 0) {
      await apiBase.lockApi(apiConfigs[0]);
    }
  }

  console.log('API initialized:', {
    activeApi: apiBase.getActiveApi()?.id,
    baseUrl: apiBase.getActiveApi()?.baseUrl,
  });
}

/**
 * Get default API configurations
 * 
 * @deprecated Use app-specific config loaders instead (e.g., getAwyApiConfigs)
 * This function is kept for backward compatibility but returns empty array
 * Each app should provide its own config loader
 */
export function getDefaultApiConfigs(): Array<{
  id: string;
  baseUrl: string;
  priority: number;
}> {
  // Return empty array - apps should use their own config loaders
  // This prevents hardcoding URLs and forces apps to define their configs
  return [];
}

