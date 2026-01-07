import { apiClient } from './client';
import { QueryParams } from '../../types/api';
import { ApiWrapper } from '../../utils/apiWrapper';

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
  openId?: string;
}

export interface OrderResponse {
  order: SubscriptionOrder;
  payment?: {
    url?: string;
    qrCode?: string;
    transactionId?: string;
    method: string;
  };
}

export interface RefundRequest {
  amount?: number;
  reason?: string;
}

/**
 * User Subscription Service
 * For regular users to manage subscriptions and orders
 */
export const userSubscriptionService = {
  async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await apiClient.get<{ plans: SubscriptionPlan[] } | SubscriptionPlan[]>('/subscriptions/plans');
    if (response.success && response.data) {
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return (response.data as any).plans || [];
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
    const response = await apiClient.get<{ orders: SubscriptionOrder[] } | SubscriptionOrder[]>(path);
    if (response.success && response.data) {
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return (response.data as any).orders || [];
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
};

