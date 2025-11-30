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

// 基础响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
}

// 分页响应类型
export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 仪表板数据类型
export interface DashboardData {
  revenue: RevenueData;
  salesByCategory: SalesByCategoryData;
  dailySales: DailySalesData;
  summary: SummaryData;
}

export interface RevenueData {
  income: number[];
  expenses: number[];
  months: string[];
  totalProfit: number;
}

export interface SalesByCategoryData {
  categories: string[];
  values: number[];
  total: number;
}

export interface DailySalesData {
  sales: number[];
  lastWeek: number[];
  days: string[];
}

export interface SummaryData {
  income: number;
  expenses: number;
  profit: number;
  growth: number;
}

// 表格数据类型
export interface TableData {
  id: number;
  name: string;
  email: string;
  date: string;
  sale: number;
  status: 'Complete' | 'Pending' | 'In Progress' | 'Canceled';
  register: string;
  progress: string;
  position: string;
  office: string;
}

// 图表数据类型
export interface ChartData {
  series: ChartSeries[];
  categories?: string[];
  options?: any;
}

export interface ChartSeries {
  name: string;
  data: number[];
}

// 用户数据类型
export interface UserData {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
}

// 财务数据类型
export interface FinanceData {
  balance: number;
  income: number;
  expenses: number;
  transactions: TransactionData[];
}

export interface TransactionData {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  category: string;
}

// 加密货币数据类型
export interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume: number;
  chartData: number[];
}

// API 错误类型
export interface ApiError {
  code: number;
  message: string;
  details?: any;
}

// 请求配置类型
export interface RequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
  params?: Record<string, any>;
}

// 数据源类型
export type DataSource = 'PRIMARY' | 'SECONDARY';

// 授权配置类型
export interface AuthConfig {
  tokenKey?: string;
  headerKey?: string;
  prefix?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  customHeaders?: Record<string, string>;
}

// API 配置类型
export interface ApiConfig {
  BASE_URL: string;
  TIMEOUT: number;
  HEADERS: Record<string, string>;
  AUTH_TYPE: string;
  API_IDENTIFIER: string;
  AUTH_CONFIG: AuthConfig;
} 