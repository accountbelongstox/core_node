import { apiClient } from './client';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  components: {
    redis?: {
      status: string;
      connected: boolean;
      ping?: number;
    };
    logger?: {
      status: string;
    };
    memory?: {
      status: string;
      used: number;
      total: number;
      percentage: number;
    };
  };
  config?: Record<string, any>;
}

export interface OEMSettings {
  siteName?: string;
  siteIcon?: string;
  adminButtonVisible?: boolean;
  publicStatsEnabled?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration: number;
  features: string[];
  isPopular?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Public Service
 * For unauthenticated/public endpoints
 */
export const publicService = {
  async getHealth(): Promise<HealthStatus> {
    const response = await apiClient.get<HealthStatus>('/health');
    if (response.success && response.data) {
      return response.data;
    }
    // health endpoint may not return success field
    return response.data as HealthStatus;
  },

  async getPublicStats(): Promise<any> {
    const response = await apiClient.get<any>('/admin/public-stats');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch public stats');
  },

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const response = await apiClient.get<{ plans: SubscriptionPlan[] } | SubscriptionPlan[]>('/subscriptions/plans');
    if (response.success && response.data) {
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return (response.data as any).plans || [];
    }
    throw new Error(response.message || 'Failed to fetch subscription plans');
  },

  async getRuntimeInfo(): Promise<any> {
    const response = await apiClient.get<any>('/web/runtime-info');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch runtime info');
  },

  async getOEMSettings(): Promise<OEMSettings> {
    const response = await apiClient.get<OEMSettings>('/admin/oem-settings');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch OEM settings');
  },
};

