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

import { dashboardApi } from '@/services/api/dashboard';
import { useApiQuery, usePrimaryQuery } from './useVueQuery';
import { useApiFetch, usePrimaryFetch, usePrimaryAsyncData } from './useNuxtApi';
import { API_ROUTES } from '@/services/config/endpoints';
import type { DashboardData, RevenueData, SalesByCategoryData, DailySalesData, SummaryData } from '@/types/api';

// 使用 Vue Query 的仪表板组合式函数
export const useDashboardQuery = () => {
  // 获取完整仪表板数据
  const dashboardData = useApiQuery<DashboardData>('PRIMARY', API_ROUTES.PRIMARY.DASHBOARD);
  
  // 获取收入数据
  const revenueData = useApiQuery<RevenueData>('PRIMARY', `${API_ROUTES.PRIMARY.DASHBOARD}/revenue`);
  
  // 获取按类别销售数据
  const salesByCategory = useApiQuery<SalesByCategoryData>('PRIMARY', `${API_ROUTES.PRIMARY.DASHBOARD}/sales-category`);
  
  // 获取每日销售数据
  const dailySales = useApiQuery<DailySalesData>('PRIMARY', `${API_ROUTES.PRIMARY.DASHBOARD}/daily-sales`);
  
  // 获取摘要数据
  const summaryData = useApiQuery<SummaryData>('PRIMARY', `${API_ROUTES.PRIMARY.DASHBOARD}/summary`);

  return {
    dashboardData,
    revenueData,
    salesByCategory,
    dailySales,
    summaryData,
    
    // 计算加载状态
    isLoading: computed(() => 
      dashboardData.isLoading.value || 
      revenueData.isLoading.value || 
      salesByCategory.isLoading.value || 
      dailySales.isLoading.value || 
      summaryData.isLoading.value
    ),
    
    // 计算错误状态
    hasError: computed(() => 
      dashboardData.error.value || 
      revenueData.error.value || 
      salesByCategory.error.value || 
      dailySales.error.value || 
      summaryData.error.value
    ),
    
    // 刷新所有数据
    refresh: () => {
      dashboardData.refetch();
      revenueData.refetch();
      salesByCategory.refetch();
      dailySales.refetch();
      summaryData.refetch();
    }
  };
};

// 使用 Nuxt 原生 useFetch 的仪表板组合式函数
export const useDashboardFetch = () => {
  // 获取完整仪表板数据
  const { data: dashboardData, pending: dashboardPending, error: dashboardError, refresh: refreshDashboard } = 
    usePrimaryFetch<DashboardData>(API_ROUTES.PRIMARY.DASHBOARD);
  
  // 获取收入数据
  const { data: revenueData, pending: revenuePending, error: revenueError, refresh: refreshRevenue } = 
    usePrimaryFetch<RevenueData>(`${API_ROUTES.PRIMARY.DASHBOARD}/revenue`);
  
  // 获取按类别销售数据
  const { data: salesByCategory, pending: salesPending, error: salesError, refresh: refreshSales } = 
    usePrimaryFetch<SalesByCategoryData>(`${API_ROUTES.PRIMARY.DASHBOARD}/sales-category`);
  
  // 获取每日销售数据
  const { data: dailySales, pending: dailyPending, error: dailyError, refresh: refreshDaily } = 
    usePrimaryFetch<DailySalesData>(`${API_ROUTES.PRIMARY.DASHBOARD}/daily-sales`);
  
  // 获取摘要数据
  const { data: summaryData, pending: summaryPending, error: summaryError, refresh: refreshSummary } = 
    usePrimaryFetch<SummaryData>(`${API_ROUTES.PRIMARY.DASHBOARD}/summary`);

  return {
    dashboardData,
    revenueData,
    salesByCategory,
    dailySales,
    summaryData,
    
    // 加载状态
    pending: computed(() => 
      dashboardPending.value || 
      revenuePending.value || 
      salesPending.value || 
      dailyPending.value || 
      summaryPending.value
    ),
    
    // 错误状态
    errors: computed(() => ({
      dashboard: dashboardError.value,
      revenue: revenueError.value,
      sales: salesError.value,
      daily: dailyError.value,
      summary: summaryError.value
    })),
    
    // 刷新函数
    refresh: () => {
      refreshDashboard();
      refreshRevenue();
      refreshSales();
      refreshDaily();
      refreshSummary();
    }
  };
};

// 使用 Nuxt 原生 useAsyncData 的仪表板组合式函数
export const useDashboardAsyncData = () => {
  // 获取完整仪表板数据
  const { data: dashboardData, pending: dashboardPending, error: dashboardError, refresh: refreshDashboard } = 
    usePrimaryAsyncData('dashboard-data', () => dashboardApi.getDashboardData());
  
  // 获取收入数据
  const { data: revenueData, pending: revenuePending, error: revenueError, refresh: refreshRevenue } = 
    usePrimaryAsyncData('revenue-data', () => dashboardApi.getRevenueData());
  
  // 获取按类别销售数据
  const { data: salesByCategory, pending: salesPending, error: salesError, refresh: refreshSales } = 
    usePrimaryAsyncData('sales-category', () => dashboardApi.getSalesByCategory());
  
  // 获取每日销售数据
  const { data: dailySales, pending: dailyPending, error: dailyError, refresh: refreshDaily } = 
    usePrimaryAsyncData('daily-sales', () => dashboardApi.getDailySales());
  
  // 获取摘要数据
  const { data: summaryData, pending: summaryPending, error: summaryError, refresh: refreshSummary } = 
    usePrimaryAsyncData('summary-data', () => dashboardApi.getSummaryData());

  return {
    dashboardData,
    revenueData,
    salesByCategory,
    dailySales,
    summaryData,
    
    // 加载状态
    pending: computed(() => 
      dashboardPending.value || 
      revenuePending.value || 
      salesPending.value || 
      dailyPending.value || 
      summaryPending.value
    ),
    
    // 错误状态
    errors: computed(() => ({
      dashboard: dashboardError.value,
      revenue: revenueError.value,
      sales: salesError.value,
      daily: dailyError.value,
      summary: summaryError.value
    })),
    
    // 刷新函数
    refresh: () => {
      refreshDashboard();
      refreshRevenue();
      refreshSales();
      refreshDaily();
      refreshSummary();
    }
  };
}; 