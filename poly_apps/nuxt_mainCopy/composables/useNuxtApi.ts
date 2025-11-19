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

import { getApiInfo } from '@/services/api/nuxt-fetch';
import type { DataSource } from '@/types/api';

// 简化的 API 组合式函数 - 使用原生 useFetch
export const useApiFetch = <T = any>(
  dataSource: DataSource,
  url: string,
  options: any = {}
) => {
  const apiInfo = getApiInfo(dataSource);
  
  return useFetch<T>(url, {
    ...options,
    key: `${dataSource}-${url}`,
    baseURL: apiInfo.baseUrl,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Identifier': apiInfo.identifier,
      ...options.headers
    },
    onRequest({ request, options }) {
      console.log(`[${apiInfo.identifier}] Fetching: ${url}`);
    },
    onRequestError({ request, options, error }) {
      console.error(`[${apiInfo.identifier}] Request error:`, error);
    },
    onResponse({ request, response, options }) {
      console.log(`[${apiInfo.identifier}] Response:`, response._data);
    },
    onResponseError({ request, response, options }) {
      console.error(`[${apiInfo.identifier}] Response error:`, response._data);
    }
  });
};

// 简化的 API 组合式函数 - 使用原生 useAsyncData
export const useApiAsyncData = <T = any>(
  dataSource: DataSource,
  key: string,
  handler: () => Promise<T>,
  options: any = {}
) => {
  const apiInfo = getApiInfo(dataSource);
  
  return useAsyncData<T>(key, async () => {
    try {
      console.log(`[${apiInfo.identifier}] Executing: ${key}`);
      const result = await handler();
      console.log(`[${apiInfo.identifier}] Success: ${key}`, result);
      return result;
    } catch (error) {
      console.error(`[${apiInfo.identifier}] Error: ${key}`, error);
      throw error;
    }
  }, {
    server: true,
    lazy: false,
    immediate: true,
    deep: false,
    dedupe: 'cancel',
    ...options
  });
};

// 创建特定数据源的 useFetch 函数
export const createDataSourceFetch = (dataSource: DataSource) => {
  return <T = any>(url: string, options: any = {}) => {
    return useApiFetch<T>(dataSource, url, options);
  };
};

// 创建特定数据源的 useAsyncData 函数
export const createDataSourceAsyncData = (dataSource: DataSource) => {
  return <T = any>(key: string, handler: () => Promise<T>, options: any = {}) => {
    return useApiAsyncData<T>(dataSource, key, handler, options);
  };
};

// 预定义的 API 组合式函数
export const usePrimaryFetch = createDataSourceFetch('PRIMARY');
export const useSecondaryFetch = createDataSourceFetch('SECONDARY');
export const usePrimaryAsyncData = createDataSourceAsyncData('PRIMARY');
export const useSecondaryAsyncData = createDataSourceAsyncData('SECONDARY'); 