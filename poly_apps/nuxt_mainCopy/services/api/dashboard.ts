// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { apiRequest } from './nuxt-fetch';
import { API_ROUTES } from '../config/endpoints';
import type { 
  DashboardData, 
  RevenueData, 
  SalesByCategoryData, 
  DailySalesData,
  SummaryData 
} from '@/types/api';

export const dashboardApi = {
  // 获取完整的仪表板数据
  async getDashboardData(): Promise<DashboardData> {
    const response = await apiRequest<DashboardData>('PRIMARY', API_ROUTES.PRIMARY.DASHBOARD);
    return response.data;
  },

  // 获取收入数据
  async getRevenueData(): Promise<RevenueData> {
    const response = await apiRequest<RevenueData>('PRIMARY', `${API_ROUTES.PRIMARY.DASHBOARD}/revenue`);
    return response.data;
  },

  // 获取按类别销售数据
  async getSalesByCategory(): Promise<SalesByCategoryData> {
    const response = await apiRequest<SalesByCategoryData>('PRIMARY', `${API_ROUTES.PRIMARY.DASHBOARD}/sales-category`);
    return response.data;
  },

  // 获取每日销售数据
  async getDailySales(): Promise<DailySalesData> {
    const response = await apiRequest<DailySalesData>('PRIMARY', `${API_ROUTES.PRIMARY.DASHBOARD}/daily-sales`);
    return response.data;
  },

  // 获取摘要数据
  async getSummaryData(): Promise<SummaryData> {
    const response = await apiRequest<SummaryData>('PRIMARY', `${API_ROUTES.PRIMARY.DASHBOARD}/summary`);
    return response.data;
  }
}; 