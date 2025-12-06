/**
 * API Initialization Helper
 */

import { ApiBase, ApiConfig } from './api-base';

export interface EndpointPaths {
  [key: string]: string;
}

/**
 * Initialize API with configurations and endpoints
 */
export const initializeApi = async (
  configs: ApiConfig[],
  endpoints: EndpointPaths
): Promise<void> => {
  const apiBase = ApiBase.getInstance();
  apiBase.configure(configs);
  apiBase.registerEndpoints(endpoints);
  
  // Try to detect available API
  await apiBase.detectAvailableApi();
};

