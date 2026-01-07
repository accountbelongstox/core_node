import { apiClient } from './client';
import { DashboardData, SystemMetrics } from '../../types/models';
import { DateRangeParams } from '../../types/api';

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const response = await apiClient.get<DashboardData>('/admin/dashboard');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch dashboard data');
  },

  async getMetrics(): Promise<SystemMetrics> {
    const response = await apiClient.get<SystemMetrics>('/metrics');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch metrics');
  }
};

