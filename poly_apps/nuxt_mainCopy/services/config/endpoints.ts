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

// 授权类型枚举
export enum AuthType {
  NONE = 'none',           // 无需授权
  JWT = 'jwt',            // JWT Token
  API_KEY = 'api_key',    // API Key
  BEARER = 'bearer',      // Bearer Token
  BASIC = 'basic',        // Basic Auth
  CUSTOM = 'custom'       // 自定义授权
}

// API 标识枚举
export enum ApiIdentifier {
  LARAVEL = 'laravel',
  STRAPI = 'strapi',
  EXPRESS = 'express',
  DJANGO = 'django',
  FLASK = 'flask',
  FASTAPI = 'fastapi',
  SPRING = 'spring',
  ASPNET = 'aspnet',
  CUSTOM = 'custom'
}

export const API_ENDPOINTS = {
  PRIMARY: {
    BASE_URL: 'http://47.107.84.210',
    TIMEOUT: 10000,
    HEADERS: {
      'Content-Type': 'application/json'
    },
    AUTH_TYPE: AuthType.JWT,
    API_IDENTIFIER: ApiIdentifier.LARAVEL,
    AUTH_CONFIG: {
      tokenKey: 'access_token',
      headerKey: 'Authorization',
      prefix: 'Bearer'
    }
  },
  SECONDARY: {
    BASE_URL: 'http://43.159.58.199', 
    TIMEOUT: 15000,
    HEADERS: {
      'Content-Type': 'application/json'
    },
    AUTH_TYPE: AuthType.API_KEY,
    API_IDENTIFIER: ApiIdentifier.STRAPI,
    AUTH_CONFIG: {
      apiKey: 'strapi_api_key',
      headerKey: 'X-API-Key'
    }
  }
};

// API 路由配置
export const API_ROUTES = {
  PRIMARY: {
    DASHBOARD: '/dashboard',
    TABLES: '/tables',
    USERS: '/users',
    ANALYTICS: '/analytics'
  },
  SECONDARY: {
    CHARTS: '/charts',
    WIDGETS: '/widgets',
    FINANCE: '/finance',
    CRYPTO: '/crypto'
  }
};

// 环境变量配置
export const getApiConfig = () => ({
  PRIMARY: {
    BASE_URL: process.env.NUXT_PRIMARY_API_URL || API_ENDPOINTS.PRIMARY.BASE_URL,
    TIMEOUT: parseInt(process.env.NUXT_PRIMARY_TIMEOUT || '10000'),
    HEADERS: API_ENDPOINTS.PRIMARY.HEADERS,
    AUTH_TYPE: API_ENDPOINTS.PRIMARY.AUTH_TYPE,
    API_IDENTIFIER: API_ENDPOINTS.PRIMARY.API_IDENTIFIER,
    AUTH_CONFIG: API_ENDPOINTS.PRIMARY.AUTH_CONFIG
  },
  SECONDARY: {
    BASE_URL: process.env.NUXT_SECONDARY_API_URL || API_ENDPOINTS.SECONDARY.BASE_URL,
    TIMEOUT: parseInt(process.env.NUXT_SECONDARY_TIMEOUT || '15000'),
    HEADERS: API_ENDPOINTS.SECONDARY.HEADERS,
    AUTH_TYPE: API_ENDPOINTS.SECONDARY.AUTH_TYPE,
    API_IDENTIFIER: API_ENDPOINTS.SECONDARY.API_IDENTIFIER,
    AUTH_CONFIG: API_ENDPOINTS.SECONDARY.AUTH_CONFIG
  }
}); 