// IT Tools TypeScript Type Definitions

export type ToolCategory = 'crypto' | 'converter' | 'web' | 'text' | 'math' | 'network' | 'media';

export type ParamType = 'string' | 'number' | 'boolean' | 'integer' | 'email' | 'url' | 'textarea' | 'select';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ToolParam {
  type: ParamType;
  required: boolean;
  default?: string | number | boolean;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: (string | number)[];
  placeholder?: string;
  description?: string;
  label?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  endpoint: string;
  method: HttpMethod;
  params: Record<string, ToolParam>;
  keywords: string[];
  tags?: string[];
  examples?: ToolExample[];
  documentation?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ToolExample {
  name: string;
  input: Record<string, any>;
  output: any;
}

export interface ToolResult {
  toolId: string;
  input: Record<string, any>;
  output: any;
  timestamp: number;
  executionTime: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: number;
  path?: string;
}

export interface ToolsListResponse extends ApiResponse {
  data?: {
    tools: Tool[];
    total: number;
    categories: string[];
  };
}

export interface ToolExecuteRequest {
  toolId: string;
  params: Record<string, any>;
}

export interface ToolExecuteResponse extends ApiResponse {
  data?: ToolResult;
}

export interface SearchToolsRequest {
  query: string;
  category?: ToolCategory;
  limit?: number;
  offset?: number;
}

export interface SearchToolsResponse extends ApiResponse {
  data?: {
    tools: Tool[];
    total: number;
    query: string;
  };
}

export interface UserPreferences {
  apiBaseUrl: string;
  theme: 'light' | 'dark';
  language: string;
  favorites: string[];
  recentTools: string[];
}

export interface HistoryEntry {
  id?: string;
  toolId: string;
  toolName: string;
  input: Record<string, any>;
  output: any;
  timestamp: number;
  executionTime: number;
  starred?: boolean;
}

export interface ApiInfo {
  name: string;
  namespace: string;
  version: string;
  description?: string;
  baseUrl: string;
  supportedHeaders: Record<string, string>;
  apis: Record<string, ApiEndpointInfo>;
}

export interface ApiEndpointInfo {
  path: string;
  method: HttpMethod;
  description?: string;
  requiresAuth: boolean;
  params?: Record<string, any>;
  response?: Record<string, any>;
  examples?: any[];
  features?: string[];
}

export interface Category {
  id: ToolCategory;
  name: string;
  icon: string;
  count?: number;
}

export interface FilterOptions {
  category?: ToolCategory;
  searchQuery?: string;
  onlyFavorites?: boolean;
  tags?: string[];
}
