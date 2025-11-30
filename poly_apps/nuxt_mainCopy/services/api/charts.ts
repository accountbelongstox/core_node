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
import type { ChartData, ChartSeries } from '@/types/api';

export const chartsApi = {
  // 获取线图数据
  async getLineChartData(): Promise<ChartData> {
    const response = await apiRequest<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/line`);
    return response.data;
  },

  // 获取面积图数据
  async getAreaChartData(): Promise<ChartData> {
    const response = await apiRequest<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/area`);
    return response.data;
  },

  // 获取柱状图数据
  async getColumnChartData(): Promise<ChartData> {
    const response = await apiRequest<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/column`);
    return response.data;
  },

  // 获取饼图数据
  async getPieChartData(): Promise<ChartData> {
    const response = await apiRequest<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/pie`);
    return response.data;
  },

  // 获取雷达图数据
  async getRadarChartData(): Promise<ChartData> {
    const response = await apiRequest<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/radar`);
    return response.data;
  },

  // 获取混合图表数据
  async getMixedChartData(): Promise<ChartData> {
    const response = await apiRequest<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/mixed`);
    return response.data;
  },

  // 获取气泡图数据
  async getBubbleChartData(): Promise<ChartData> {
    const response = await apiRequest<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/bubble`);
    return response.data;
  },

  // 获取自定义图表数据
  async getCustomChartData(chartType: string): Promise<ChartData> {
    const response = await apiRequest<ChartData>('SECONDARY', `${API_ROUTES.SECONDARY.CHARTS}/${chartType}`);
    return response.data;
  }
}; 