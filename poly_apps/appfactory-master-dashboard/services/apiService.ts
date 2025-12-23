/**
 * API服务
 * 统一管理所有API调用，使用ApiManager获取动态base URL
 * 
 * 注意：当前系统主要使用mock数据，此服务为将来实际API调用准备
 */
import { apiManager } from './ApiManager';

class ApiService {
  /**
   * 获取完整的API URL
   */
  private getApiUrl(endpoint: string): string {
    const baseUrl = apiManager.getCurrentBaseUrl();
    if (!baseUrl) {
      throw new Error('API Manager not initialized');
    }
    // 确保endpoint以/开头
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${path}`;
  }

  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.getApiUrl(endpoint);
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  /**
   * GET请求
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * POST请求
   */
  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * PUT请求
   */
  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * DELETE请求
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      ...options,
    });
  }

  // ===== 具体业务API方法 =====
  // 以下方法为示例，实际使用时根据后端API文档实现

  /**
   * 获取APP列表
   */
  async getApps() {
    // 当前使用mock数据，实际使用时调用此方法
    // return this.get('/api/apps');
    return null;
  }

  /**
   * 获取APP详情
   */
  async getAppById(appId: string) {
    // return this.get(`/api/apps/${appId}`);
    return null;
  }

  /**
   * 创建APP
   */
  async createApp(data: any) {
    // return this.post('/api/apps', data);
    return null;
  }

  /**
   * 更新APP
   */
  async updateApp(appId: string, data: any) {
    // return this.put(`/api/apps/${appId}`, data);
    return null;
  }

  /**
   * 删除APP
   */
  async deleteApp(appId: string) {
    // return this.delete(`/api/apps/${appId}`);
    return null;
  }

  /**
   * 获取客服团队列表
   */
  async getCSTeam() {
    // return this.get('/api/cs-team');
    return null;
  }

  /**
   * 获取推广记录列表
   */
  async getPromotionRecords() {
    // return this.get('/api/promotion-records');
    return null;
  }

  /**
   * 获取推广人员列表
   */
  async getPromoters() {
    // return this.get('/api/promoters');
    return null;
  }
}

// 导出单例
export const apiService = new ApiService();

