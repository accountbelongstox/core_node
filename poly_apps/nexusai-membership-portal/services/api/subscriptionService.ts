import { apiClient } from './client';
import { QueryParams } from '../../types/api';
import { ApiWrapper } from '../../utils/apiWrapper';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration: number; // days
  features: string[];
  isPopular?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePlanRequest {
  name: string;
  description: string;
  price: number;
  currency: string;
  duration: number;
  features: string[];
  isPopular?: boolean;
  isActive?: boolean;
}

export interface SubscriptionOrder {
  id: string;
  userId: string;
  planId: string;
  planName?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'refunded' | 'cancelled' | 'expired';
  provider: 'alipay' | 'wechat';
  method?: 'web' | 'h5' | 'app';
  transactionId?: string;
  createdAt: string;
  paidAt?: string;
  expiresAt?: string;
  refundedAt?: string;
}

export interface CreateOrderRequest {
  planId: string;
  provider?: 'alipay' | 'wechat';
  method?: 'web' | 'h5' | 'app';
  openId?: string; // For WeChat payment
}

export interface OrderResponse {
  order: SubscriptionOrder;
  payment?: {
    url?: string; // Payment URL for web/mobile
    qrCode?: string; // QR code for mobile payment
    transactionId?: string;
    method: string;
  };
}

export interface RefundRequest {
  amount?: number;
  reason?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  userName?: string;
  planId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'expired';
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SubscriptionListResponse {
  subscriptions: Subscription[];
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    total: number;
  };
}

export const subscriptionService = {
  // User endpoints
  async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await apiClient.get<{ plans: SubscriptionPlan[] }>('/subscriptions/plans');
    if (response.success && response.data) {
      return (response.data as any).plans || response.data as SubscriptionPlan[];
    }
    throw new Error(response.message || 'Failed to fetch subscription plans');
  },

  async getOrder(orderId: string, refresh?: boolean): Promise<OrderResponse> {
    const query = refresh ? '?refresh=true' : '';
    const response = await apiClient.get<OrderResponse>(`/subscriptions/orders/${orderId}${query}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch order');
  },

  async getOrders(params?: QueryParams): Promise<SubscriptionOrder[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
    }
    const path = `/subscriptions/orders${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<{ orders: SubscriptionOrder[] }>(path);
    if (response.success && response.data) {
      return (response.data as any).orders || response.data as SubscriptionOrder[];
    }
    throw new Error(response.message || 'Failed to fetch orders');
  },

  async createOrder(request: CreateOrderRequest): Promise<OrderResponse> {
    return ApiWrapper.wrap(
      () => apiClient.post<OrderResponse>('/subscriptions/orders', request),
      'errorContextCreateOrder',
      true
    ) as Promise<OrderResponse>;
  },

  async refundOrder(orderId: string, request?: RefundRequest): Promise<void> {
    const response = await apiClient.post(`/subscriptions/orders/${orderId}/refund`, request || {});
    if (!response.success) {
      throw new Error(response.message || 'Failed to refund order');
    }
  },

  // Admin endpoints
  async getAdminPlans(): Promise<SubscriptionPlan[]> {
    const response = await apiClient.get<{ plans: SubscriptionPlan[] }>('/admin/subscriptions/plans');
    if (response.success && response.data) {
      return (response.data as any).plans || response.data as SubscriptionPlan[];
    }
    throw new Error(response.message || 'Failed to fetch subscription plans');
  },

  async createPlan(request: CreatePlanRequest): Promise<SubscriptionPlan> {
    return ApiWrapper.wrap(
      () => apiClient.post<SubscriptionPlan>('/admin/subscriptions/plans', request),
      'errorContextCreatePlan',
      true
    ) as Promise<SubscriptionPlan>;
  },

  async updatePlan(planId: string, request: Partial<CreatePlanRequest>): Promise<SubscriptionPlan> {
    return ApiWrapper.wrap(
      () => apiClient.put<SubscriptionPlan>(`/admin/subscriptions/plans/${planId}`, request),
      'errorContextUpdatePlan',
      true
    ) as Promise<SubscriptionPlan>;
  },

  async deletePlan(planId: string): Promise<void> {
    const response = await apiClient.delete(`/admin/subscriptions/plans/${planId}`);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete plan');
    }
  },

  async getAdminOrders(params?: QueryParams & { userId?: string; status?: string }): Promise<SubscriptionOrder[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
    }
    const path = `/admin/subscriptions/orders${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<{ orders: SubscriptionOrder[] }>(path);
    if (response.success && response.data) {
      return (response.data as any).orders || response.data as SubscriptionOrder[];
    }
    throw new Error(response.message || 'Failed to fetch orders');
  },

  async getAdminOrder(orderId: string): Promise<OrderResponse> {
    const response = await apiClient.get<OrderResponse>(`/admin/subscriptions/orders/${orderId}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch order');
  },

  async refundAdminOrder(orderId: string, request?: RefundRequest): Promise<void> {
    const response = await apiClient.post(`/admin/subscriptions/orders/${orderId}/refund`, request || {});
    if (!response.success) {
      throw new Error(response.message || 'Failed to refund order');
    }
  },

  async getSubscriptions(params?: QueryParams): Promise<SubscriptionListResponse> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
    }
    const path = `/admin/subscriptions${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<SubscriptionListResponse>(path);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch subscriptions');
  },

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const response = await apiClient.get<Subscription>(`/admin/subscriptions/${subscriptionId}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch subscription');
  },

  async updateSubscription(subscriptionId: string, request: Partial<Subscription>): Promise<Subscription> {
    return ApiWrapper.wrap(
      () => apiClient.put<Subscription>(`/admin/subscriptions/${subscriptionId}`, request),
      'errorContextUpdateSubscription',
      true
    ) as Promise<Subscription>;
  },
};

