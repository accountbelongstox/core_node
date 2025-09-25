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
import type { FinanceData, TransactionData, CryptoData } from '@/types/api';

export const financeApi = {
  // 获取财务概览数据
  async getFinanceOverview(): Promise<FinanceData> {
    const response = await apiRequest<FinanceData>('SECONDARY', API_ROUTES.SECONDARY.FINANCE);
    return response.data;
  },

  // 获取交易记录
  async getTransactions(page: number = 1, limit: number = 20): Promise<TransactionData[]> {
    const response = await apiRequest<TransactionData[]>('SECONDARY', `${API_ROUTES.SECONDARY.FINANCE}/transactions`, {
      query: { page, limit }
    });
    return response.data;
  },

  // 获取加密货币数据
  async getCryptoData(): Promise<CryptoData[]> {
    const response = await apiRequest<CryptoData[]>('SECONDARY', API_ROUTES.SECONDARY.CRYPTO);
    return response.data;
  },

  // 获取特定加密货币数据
  async getCryptoDataBySymbol(symbol: string): Promise<CryptoData> {
    const response = await apiRequest<CryptoData>('SECONDARY', `${API_ROUTES.SECONDARY.CRYPTO}/${symbol}`);
    return response.data;
  },

  // 获取财务统计
  async getFinanceStats(): Promise<{
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    growthRate: number;
  }> {
    const response = await apiRequest('SECONDARY', `${API_ROUTES.SECONDARY.FINANCE}/stats`);
    return response.data;
  },

  // 添加交易记录
  async addTransaction(data: Omit<TransactionData, 'id'>): Promise<TransactionData> {
    const response = await apiRequest<TransactionData>('SECONDARY', `${API_ROUTES.SECONDARY.FINANCE}/transactions`, {
      method: 'POST',
      body: data
    });
    return response.data;
  },

  // 更新交易记录
  async updateTransaction(id: number, data: Partial<TransactionData>): Promise<TransactionData> {
    const response = await apiRequest<TransactionData>('SECONDARY', `${API_ROUTES.SECONDARY.FINANCE}/transactions/${id}`, {
      method: 'PUT',
      body: data
    });
    return response.data;
  },

  // 删除交易记录
  async deleteTransaction(id: number): Promise<void> {
    await apiRequest('SECONDARY', `${API_ROUTES.SECONDARY.FINANCE}/transactions/${id}`, {
      method: 'DELETE'
    });
  }
}; 