// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Query parameters (matches actual API)
export interface QueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  searchMode?: 'apiKey' | 'tag' | 'bindingAccount';
  tag?: string;
  isActive?: string | boolean;
  models?: string; // Comma-separated model list
  costTimeRange?: '7days' | '30days' | 'custom';
  costStartDate?: string;
  costEndDate?: string;
  timeRange?: string; // Compatibility with old parameter
  [key: string]: any;
}

// Date range query
export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

// Error response
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  details?: any;
}

