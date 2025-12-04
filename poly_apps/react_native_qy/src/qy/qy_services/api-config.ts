/**
 * API Configuration
 */

import { ApiConfig } from '@/common/services/api-base';

const API_BASE_URL = 'http://192.168.50.2:9000';

export const getQyApiConfigs = (): ApiConfig[] => {
  return [
    {
      id: 'qy-api-primary',
      baseUrl: API_BASE_URL,
      healthCheckPath: '/api/health',
      timeout: 5000,
      priority: 1,
    },
  ];
};

