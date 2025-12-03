/**
 * AWY App API Configuration
 * 
 * API configuration constants for AWY app
 * No process.env usage - all config defined here
 * 
 * To add more API endpoints, add them to the API_CONFIGS array below.
 */

interface ApiConfigItem {
  id: string;
  baseUrl: string;
  healthCheckPath?: string;
  timeout?: number;
  priority: number;
}

/**
 * API configurations for AWY app
 * Define all API endpoints here
 */
const API_CONFIGS: ApiConfigItem[] = [
  {
    id: 'primary',
    baseUrl: 'https://api.example.com',
    healthCheckPath: '/api/health',
    timeout: 5000,
    priority: 1,
  },
  // Add more API endpoints as needed:
  // {
  //   id: 'secondary',
  //   baseUrl: 'https://api-backup.example.com',
  //   healthCheckPath: '/api/health',
  //   timeout: 5000,
  //   priority: 2,
  // },
];

/**
 * Get API configurations for AWY app
 */
export function getAwyApiConfigs(): ApiConfigItem[] {
  return API_CONFIGS;
}

