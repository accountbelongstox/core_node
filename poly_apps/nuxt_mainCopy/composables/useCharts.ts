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

import { chartsApi } from '@/services/api/charts';
import { useApiQuery, useSecondaryQuery } from './useVueQuery';
import { useApiFetch, useSecondaryFetch, useSecondaryAsyncData } from './useNuxtApi';
import { API_ROUTES } from '@/services/config/endpoints';
import type { ChartData } from '@/types/api';

// 使用 Vue Query 的图表组合式函数
export const useChartsQuery = () => {
  // 获取线图数据
  const lineChartData = useApiQuery<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/line`);
  
  // 获取面积图数据
  const areaChartData = useApiQuery<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/area`);
  
  // 获取柱状图数据
  const columnChartData = useApiQuery<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/column`);
  
  // 获取饼图数据
  const pieChartData = useApiQuery<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/pie`);
  
  // 获取雷达图数据
  const radarChartData = useApiQuery<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/radar`);
  
  // 获取混合图表数据
  const mixedChartData = useApiQuery<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/mixed`);
  
  // 获取气泡图数据
  const bubbleChartData = useApiQuery<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/bubble`);

  return {
    lineChartData,
    areaChartData,
    columnChartData,
    pieChartData,
    radarChartData,
    mixedChartData,
    bubbleChartData,
    
    // 计算加载状态
    isLoading: computed(() => 
      lineChartData.isLoading.value || 
      areaChartData.isLoading.value || 
      columnChartData.isLoading.value || 
      pieChartData.isLoading.value || 
      radarChartData.isLoading.value || 
      mixedChartData.isLoading.value || 
      bubbleChartData.isLoading.value
    ),
    
    // 计算错误状态
    hasError: computed(() => 
      lineChartData.error.value || 
      areaChartData.error.value || 
      columnChartData.error.value || 
      pieChartData.error.value || 
      radarChartData.error.value || 
      mixedChartData.error.value || 
      bubbleChartData.error.value
    ),
    
    // 刷新所有数据
    refresh: () => {
      lineChartData.refetch();
      areaChartData.refetch();
      columnChartData.refetch();
      pieChartData.refetch();
      radarChartData.refetch();
      mixedChartData.refetch();
      bubbleChartData.refetch();
    }
  };
};

// 使用 Nuxt 原生 useFetch 的图表组合式函数
export const useChartsFetch = () => {
  // 获取线图数据
  const { data: lineChartData, pending: linePending, error: lineError, refresh: refreshLine } = 
    useSecondaryFetch<ChartData>(`${API_ROUTES.SECONDARY.CHARTS}/line`);
  
  // 获取面积图数据
  const { data: areaChartData, pending: areaPending, error: areaError, refresh: refreshArea } = 
    useSecondaryFetch<ChartData>(`${API_ROUTES.SECONDARY.CHARTS}/area`);
  
  // 获取柱状图数据
  const { data: columnChartData, pending: columnPending, error: columnError, refresh: refreshColumn } = 
    useSecondaryFetch<ChartData>(`${API_ROUTES.SECONDARY.CHARTS}/column`);
  
  // 获取饼图数据
  const { data: pieChartData, pending: piePending, error: pieError, refresh: refreshPie } = 
    useSecondaryFetch<ChartData>(`${API_ROUTES.SECONDARY.CHARTS}/pie`);
  
  // 获取雷达图数据
  const { data: radarChartData, pending: radarPending, error: radarError, refresh: refreshRadar } = 
    useSecondaryFetch<ChartData>(`${API_ROUTES.SECONDARY.CHARTS}/radar`);
  
  // 获取混合图表数据
  const { data: mixedChartData, pending: mixedPending, error: mixedError, refresh: refreshMixed } = 
    useSecondaryFetch<ChartData>(`${API_ROUTES.SECONDARY.CHARTS}/mixed`);
  
  // 获取气泡图数据
  const { data: bubbleChartData, pending: bubblePending, error: bubbleError, refresh: refreshBubble } = 
    useSecondaryFetch<ChartData>(`${API_ROUTES.SECONDARY.CHARTS}/bubble`);

  return {
    lineChartData,
    areaChartData,
    columnChartData,
    pieChartData,
    radarChartData,
    mixedChartData,
    bubbleChartData,
    
    // 加载状态
    pending: computed(() => 
      linePending.value || 
      areaPending.value || 
      columnPending.value || 
      piePending.value || 
      radarPending.value || 
      mixedPending.value || 
      bubblePending.value
    ),
    
    // 错误状态
    errors: computed(() => ({
      line: lineError.value,
      area: areaError.value,
      column: columnError.value,
      pie: pieError.value,
      radar: radarError.value,
      mixed: mixedError.value,
      bubble: bubbleError.value
    })),
    
    // 刷新函数
    refresh: () => {
      refreshLine();
      refreshArea();
      refreshColumn();
      refreshPie();
      refreshRadar();
      refreshMixed();
      refreshBubble();
    }
  };
};

// 使用 Nuxt 原生 useAsyncData 的图表组合式函数
export const useChartsAsyncData = () => {
  // 获取线图数据
  const { data: lineChartData, pending: linePending, error: lineError, refresh: refreshLine } = 
    useSecondaryAsyncData('line-chart', () => chartsApi.getLineChartData());
  
  // 获取面积图数据
  const { data: areaChartData, pending: areaPending, error: areaError, refresh: refreshArea } = 
    useSecondaryAsyncData('area-chart', () => chartsApi.getAreaChartData());
  
  // 获取柱状图数据
  const { data: columnChartData, pending: columnPending, error: columnError, refresh: refreshColumn } = 
    useSecondaryAsyncData('column-chart', () => chartsApi.getColumnChartData());
  
  // 获取饼图数据
  const { data: pieChartData, pending: piePending, error: pieError, refresh: refreshPie } = 
    useSecondaryAsyncData('pie-chart', () => chartsApi.getPieChartData());
  
  // 获取雷达图数据
  const { data: radarChartData, pending: radarPending, error: radarError, refresh: refreshRadar } = 
    useSecondaryAsyncData('radar-chart', () => chartsApi.getRadarChartData());
  
  // 获取混合图表数据
  const { data: mixedChartData, pending: mixedPending, error: mixedError, refresh: refreshMixed } = 
    useSecondaryAsyncData('mixed-chart', () => chartsApi.getMixedChartData());
  
  // 获取气泡图数据
  const { data: bubbleChartData, pending: bubblePending, error: bubbleError, refresh: refreshBubble } = 
    useSecondaryAsyncData('bubble-chart', () => chartsApi.getBubbleChartData());

  return {
    lineChartData,
    areaChartData,
    columnChartData,
    pieChartData,
    radarChartData,
    mixedChartData,
    bubbleChartData,
    
    // 加载状态
    pending: computed(() => 
      linePending.value || 
      areaPending.value || 
      columnPending.value || 
      piePending.value || 
      radarPending.value || 
      mixedPending.value || 
      bubblePending.value
    ),
    
    // 错误状态
    errors: computed(() => ({
      line: lineError.value,
      area: areaError.value,
      column: columnError.value,
      pie: pieError.value,
      radar: radarError.value,
      mixed: mixedError.value,
      bubble: bubbleError.value
    })),
    
    // 刷新函数
    refresh: () => {
      refreshLine();
      refreshArea();
      refreshColumn();
      refreshPie();
      refreshRadar();
      refreshMixed();
      refreshBubble();
    }
  };
}; 