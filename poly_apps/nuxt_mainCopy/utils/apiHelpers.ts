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

import { getApiIdentifier, getAuthType } from '@/services/api/index';
import { getApiConfig } from '@/services/config/endpoints';
import type { DataSource } from '@/types/api';

// API 调试信息
export const getApiDebugInfo = (dataSource: DataSource) => {
  const config = getApiConfig();
  const apiConfig = dataSource === 'PRIMARY' ? config.PRIMARY : config.SECONDARY;
  
  return {
    identifier: apiConfig.API_IDENTIFIER,
    authType: apiConfig.AUTH_TYPE,
    baseUrl: apiConfig.BASE_URL,
    timeout: apiConfig.TIMEOUT,
    authConfig: apiConfig.AUTH_CONFIG
  };
};

// 格式化 API 请求日志
export const formatApiLog = (dataSource: DataSource, method: string, url: string, status?: number) => {
  const identifier = getApiIdentifier(dataSource);
  const authType = getAuthType(dataSource);
  
  return {
    timestamp: new Date().toISOString(),
    identifier,
    authType,
    dataSource,
    method,
    url,
    status,
    fullUrl: `${getApiConfig()[dataSource].BASE_URL}${url}`
  };
};

// 验证 API 配置
export const validateApiConfig = (dataSource: DataSource) => {
  const config = getApiConfig();
  const apiConfig = dataSource === 'PRIMARY' ? config.PRIMARY : config.SECONDARY;
  
  const errors: string[] = [];
  
  if (!apiConfig.BASE_URL) {
    errors.push(`${dataSource} API: Missing BASE_URL`);
  }
  
  if (!apiConfig.API_IDENTIFIER) {
    errors.push(`${dataSource} API: Missing API_IDENTIFIER`);
  }
  
  if (!apiConfig.AUTH_TYPE) {
    errors.push(`${dataSource} API: Missing AUTH_TYPE`);
  }
  
  // 根据授权类型验证配置
  switch (apiConfig.AUTH_TYPE) {
    case 'jwt':
      if (!('tokenKey' in apiConfig.AUTH_CONFIG) || !apiConfig.AUTH_CONFIG.tokenKey) {
        errors.push(`${dataSource} API: JWT auth requires tokenKey in AUTH_CONFIG`);
      }
      break;
    case 'api_key':
      if (!('apiKey' in apiConfig.AUTH_CONFIG) || !apiConfig.AUTH_CONFIG.apiKey) {
        errors.push(`${dataSource} API: API_KEY auth requires apiKey in AUTH_CONFIG`);
      }
      break;
    case 'basic':
      if (!('username' in apiConfig.AUTH_CONFIG) || !('password' in apiConfig.AUTH_CONFIG) || 
          !apiConfig.AUTH_CONFIG.username || !apiConfig.AUTH_CONFIG.password) {
        errors.push(`${dataSource} API: BASIC auth requires username and password in AUTH_CONFIG`);
      }
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 获取认证状态信息
export const getAuthStatusInfo = (dataSource: DataSource) => {
  const config = getApiConfig();
  const apiConfig = dataSource === 'PRIMARY' ? config.PRIMARY : config.SECONDARY;
  
  const authConfig = apiConfig.AUTH_CONFIG;
  let storedToken = null;
  let storedApiKey = null;
  
  switch (apiConfig.AUTH_TYPE) {
    case 'jwt':
    case 'bearer':
      storedToken = localStorage.getItem(('tokenKey' in authConfig ? authConfig.tokenKey : 'auth_token') || 'auth_token');
      break;
    case 'api_key':
      storedApiKey = localStorage.getItem(('apiKey' in authConfig ? authConfig.apiKey : 'api_key') || 'api_key');
      break;
  }
  
  return {
    authType: apiConfig.AUTH_TYPE,
    hasStoredCredentials: !!(storedToken || storedApiKey),
    storedToken: storedToken ? '***' + storedToken.slice(-4) : null,
    storedApiKey: storedApiKey ? '***' + storedApiKey.slice(-4) : null
  };
};

// 生成 API 文档信息
export const generateApiDocs = () => {
  const config = getApiConfig();
  
  return {
    primary: {
      identifier: config.PRIMARY.API_IDENTIFIER,
      authType: config.PRIMARY.AUTH_TYPE,
      baseUrl: config.PRIMARY.BASE_URL,
      authConfig: config.PRIMARY.AUTH_CONFIG
    },
    secondary: {
      identifier: config.SECONDARY.API_IDENTIFIER,
      authType: config.SECONDARY.AUTH_TYPE,
      baseUrl: config.SECONDARY.BASE_URL,
      authConfig: config.SECONDARY.AUTH_CONFIG
    }
  };
}; 