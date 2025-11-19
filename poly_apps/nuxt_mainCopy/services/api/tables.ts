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
import type { TableData, PaginatedResponse } from '@/types/api';

export const tablesApi = {
  // 获取表格数据
  async getTableData(): Promise<TableData[]> {
    const response = await apiRequest<TableData[]>('PRIMARY', API_ROUTES.PRIMARY.TABLES);
    return response.data;
  },

  // 获取分页表格数据
  async getPaginatedTableData(page: number = 1, limit: number = 10): Promise<PaginatedResponse<TableData>> {
    const response = await apiRequest<PaginatedResponse<TableData>>('PRIMARY', API_ROUTES.PRIMARY.TABLES, {
      query: { page, limit }
    });
    return response.data;
  },

  // 获取单个表格记录
  async getTableRecord(id: number): Promise<TableData> {
    const response = await apiRequest<TableData>('PRIMARY', `${API_ROUTES.PRIMARY.TABLES}/${id}`);
    return response.data;
  },

  // 创建表格记录
  async createTableRecord(data: Omit<TableData, 'id'>): Promise<TableData> {
    const response = await apiRequest<TableData>('PRIMARY', API_ROUTES.PRIMARY.TABLES, {
      method: 'POST',
      body: data
    });
    return response.data;
  },

  // 更新表格记录
  async updateTableRecord(id: number, data: Partial<TableData>): Promise<TableData> {
    const response = await apiRequest<TableData>('PRIMARY', `${API_ROUTES.PRIMARY.TABLES}/${id}`, {
      method: 'PUT',
      body: data
    });
    return response.data;
  },

  // 删除表格记录
  async deleteTableRecord(id: number): Promise<void> {
    await apiRequest('PRIMARY', `${API_ROUTES.PRIMARY.TABLES}/${id}`, {
      method: 'DELETE'
    });
  },

  // 搜索表格数据
  async searchTableData(query: string): Promise<TableData[]> {
    const response = await apiRequest<TableData[]>('PRIMARY', `${API_ROUTES.PRIMARY.TABLES}/search`, {
      query: { q: query }
    });
    return response.data;
  }
}; 