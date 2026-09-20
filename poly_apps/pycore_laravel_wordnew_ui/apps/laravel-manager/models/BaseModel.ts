import { APIResponse } from '../types';

export interface ModelResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * BaseModel - Base class for all business models
 * Provides unified API call wrapping and error handling
 */
export class BaseModel {
  /**
   * Execute an API call and handle the response uniformly
   */
  protected async execute<T = any>(apiCall: Promise<APIResponse>): Promise<ModelResult<T>> {
    try {
      const response = await apiCall;
      if (response.success && response.data !== null && response.data !== undefined) {
        return { success: true, data: response.data as T };
      }
      return { success: false, error: response.error || response.message || 'Operation failed' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute API calls in batch
   */
  protected async executeBatch<T = any>(apiCalls: Promise<APIResponse>[]): Promise<ModelResult<T>[]> {
    const results = await Promise.allSettled(apiCalls);
    return results.map(result => {
      if (result.status === 'fulfilled') {
        const response = result.value;
        if (response.success && response.data !== null) {
          return { success: true, data: response.data as T };
        }
        return { success: false, error: response.error || 'Operation failed' };
      }
      return { success: false, error: result.reason };
    });
  }

  /**
   * Handle paginated responses
   */
  protected handlePaginatedResponse<T>(response: APIResponse): ModelResult<{ items: T[]; total: number; page: number }> {
    if (response.success && response.data) {
      const { items, total, page } = response.data;
      return {
        success: true,
        data: {
          items: items || [],
          total: total || 0,
          page: page || 1
        }
      };
    }
    return { success: false, error: response.error || 'Failed to fetch data' };
  }
}
