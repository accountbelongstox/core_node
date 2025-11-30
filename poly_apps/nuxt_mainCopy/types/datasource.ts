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

// 数据源管理相关类型定义

// 认证类型枚举
export enum AuthType {
  NONE = 'none',           // 无需授权
  JWT = 'jwt',            // JWT Token
  API_KEY = 'api_key',    // API Key
  BEARER = 'bearer',      // Bearer Token
  BASIC = 'basic',        // Basic Auth
  OAUTH2 = 'oauth2',      // OAuth2
  CUSTOM = 'custom'       // 自定义授权
}

// 数据源状态枚举
export enum DataSourceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  TESTING = 'testing'
}

// 认证配置接口
export interface AuthConfig {
  type: AuthType;
  tokenKey?: string;        // JWT/Bearer token存储key
  headerKey?: string;       // 请求头key
  prefix?: string;          // token前缀 (Bearer, Token等)
  apiKey?: string;          // API Key
  username?: string;        // Basic Auth用户名
  password?: string;        // Basic Auth密码
  clientId?: string;        // OAuth2 客户端ID
  clientSecret?: string;    // OAuth2 客户端密钥
  tokenUrl?: string;        // OAuth2 token获取地址
  customHeaders?: Record<string, string>; // 自定义请求头
  refreshTokenKey?: string; // 刷新token的key
  expiresIn?: number;       // token过期时间(秒)
}

// 数据源配置接口
export interface DataSourceConfig {
  id: string;               // 数据源唯一标识
  name: string;             // 数据源名称
  description?: string;     // 数据源描述
  baseUrl: string;          // 基础URL
  timeout?: number;         // 请求超时时间
  retryCount?: number;      // 重试次数
  headers?: Record<string, string>; // 默认请求头
  auth: AuthConfig;         // 认证配置
  routes: Record<string, string>; // 路由配置
  status: DataSourceStatus; // 数据源状态
  priority?: number;        // 优先级
  tags?: string[];          // 标签
  metadata?: Record<string, any>; // 元数据
  createdAt?: Date;         // 创建时间
  updatedAt?: Date;         // 更新时间
}

// 数据源响应接口
export interface DataSourceResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
  source?: string;          // 数据来源标识
  timestamp?: number;       // 响应时间戳
}

// 数据源错误接口
export interface DataSourceError {
  code: number;
  message: string;
  source: string;
  details?: any;
  timestamp: number;
}

// 数据源健康检查接口
export interface HealthCheck {
  sourceId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastCheck: Date;
  error?: string;
}

// 请求选项接口
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  transform?: (data: any) => any;
}

// 路由映射接口
export interface RouteMapping {
  [key: string]: {
    path: string;
    method?: string;
    description?: string;
    params?: string[];
    queryParams?: string[];
  };
}