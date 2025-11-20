import type { FetchOptions } from 'ofetch';
import { $fetch } from 'ofetch';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export abstract class CodeMartApiBase {
  protected baseUrl: string;
  protected namespace: string = 'codemart';

  constructor(baseUrl: string = '/api/codemart') {
    this.baseUrl = baseUrl;
  }

  protected getHeaders(includeContentType: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
      'X-App-Namespace': this.namespace,
    };

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  protected async request<T = any>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await $fetch<ApiResponse<T>>(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {}),
        },
      });

      if (!response || response.code !== 0) {
        throw new Error(response?.message || 'Unknown error');
      }

      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`API Error: ${error.message}`);
      }
      throw error;
    }
  }

  protected async get<T = any>(
    endpoint: string,
    query?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const queryString = params.toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    return this.request<T>(url, {
      method: 'GET',
    });
  }

  protected async post<T = any>(
    endpoint: string,
    data?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data,
    });
  }

  protected async put<T = any>(
    endpoint: string,
    data?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data,
    });
  }

  protected async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  protected async patch<T = any>(
    endpoint: string,
    data?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data,
    });
  }

  protected async postFormData<T = any>(
    endpoint: string,
    formData: FormData
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: this.getHeaders(false),
    });
  }

  protected buildQuery(
    filters: Record<string, any> = {},
    pagination: PaginationParams = {}
  ): Record<string, any> {
    const query: Record<string, any> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        query[key] = value;
      }
    });

    if (pagination.page) query.page = pagination.page;
    if (pagination.pageSize) query.pageSize = pagination.pageSize;
    if (pagination.sort) query.sort = pagination.sort;
    if (pagination.order) query.order = pagination.order;

    return query;
  }
}

export default CodeMartApiBase;
