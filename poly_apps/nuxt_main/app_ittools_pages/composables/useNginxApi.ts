// Nginx Management API Composable
// Provides nginx management API methods for IT Tools app

import { ItToolsMainAPI } from '../services/ittools-main-api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

export function useNginxApi() {
  const api = new ItToolsMainAPI();

  /**
   * List all nginx sites
   */
  const listSites = async (): Promise<ApiResponse<any[]>> => {
    return await api.nginxListSites();
  };

  /**
   * Get site configuration
   */
  const getSiteConfig = async (siteName: string): Promise<ApiResponse<any>> => {
    return await api.nginxGetSiteConfig(siteName);
  };

  /**
   * Enable nginx site
   */
  const enableSite = async (siteName: string): Promise<ApiResponse<any>> => {
    return await api.nginxEnableSite(siteName);
  };

  /**
   * Disable nginx site
   */
  const disableSite = async (siteName: string): Promise<ApiResponse<any>> => {
    return await api.nginxDisableSite(siteName);
  };

  /**
   * Test nginx configuration
   */
  const testConfig = async (): Promise<ApiResponse<any>> => {
    return await api.nginxTestConfig();
  };

  /**
   * Reload nginx
   */
  const reloadNginx = async (): Promise<ApiResponse<any>> => {
    return await api.nginxReload();
  };

  return {
    listSites,
    getSiteConfig,
    enableSite,
    disableSite,
    testConfig,
    reloadNginx
  };
}

