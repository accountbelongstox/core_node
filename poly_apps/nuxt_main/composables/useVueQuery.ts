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

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from '@/services/api/nuxt-fetch';
import { getApiInfo } from '@/services/api/nuxt-fetch';
import type { DataSource } from '@/types/api';

// Vue Query 配置
const queryClient = useQueryClient();

// 创建查询键
const createQueryKey = (dataSource: DataSource, endpoint: string, params?: any) => {
  return [dataSource, endpoint, params];
};

// 基于 Vue Query 的 API 查询组合式函数
export const useApiQuery = <T = any>(
  dataSource: DataSource,
  endpoint: string,
  params?: any,
  options: any = {}
) => {
  const apiInfo = getApiInfo(dataSource);
  const queryKey = createQueryKey(dataSource, endpoint, params);

  return useQuery({
    queryKey,
    queryFn: async () => {
      console.log(`[${apiInfo.identifier}] Querying: ${endpoint}`);
      const response = await apiRequest<T>(dataSource, endpoint, {
        query: params
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    ...options
  });
};

// 基于 Vue Query 的 API 变更组合式函数
export const useApiMutation = <T = any, V = any>(
  dataSource: DataSource,
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  options: any = {}
) => {
  const apiInfo = getApiInfo(dataSource);

  return useMutation({
    mutationFn: async (variables: V) => {
      console.log(`[${apiInfo.identifier}] Mutating: ${endpoint}`, variables);
      const response = await apiRequest<T>(dataSource, endpoint, {
        method,
        body: variables
      });
      return response.data;
    },
    onSuccess: (data, variables, context) => {
      console.log(`[${apiInfo.identifier}] Mutation success:`, data);
      // 使相关查询失效
      queryClient.invalidateQueries({ queryKey: [dataSource] });
    },
    onError: (error, variables, context) => {
      console.error(`[${apiInfo.identifier}] Mutation error:`, error);
    },
    ...options
  });
};

// 创建特定数据源的查询函数
export const createDataSourceQuery = (dataSource: DataSource) => {
  return <T = any>(endpoint: string, params?: any, options?: any) => {
    return useApiQuery<T>(dataSource, endpoint, params, options);
  };
};

// 创建特定数据源的变更函数
export const createDataSourceMutation = (dataSource: DataSource) => {
  return <T = any, V = any>(endpoint: string, method?: 'POST' | 'PUT' | 'DELETE', options?: any) => {
    return useApiMutation<T, V>(dataSource, endpoint, method, options);
  };
};

// 预定义的 API 查询组合式函数
export const usePrimaryQuery = createDataSourceQuery('PRIMARY');
export const useSecondaryQuery = createDataSourceQuery('SECONDARY');

// 预定义的 API 变更组合式函数
export const usePrimaryMutation = createDataSourceMutation('PRIMARY');
export const useSecondaryMutation = createDataSourceMutation('SECONDARY');

// 查询客户端工具函数
export const useQueryUtils = () => {
  return {
    // 使特定数据源的所有查询失效
    invalidateDataSource: (dataSource: DataSource) => {
      queryClient.invalidateQueries({ queryKey: [dataSource] });
    },
    
    // 使特定查询失效
    invalidateQuery: (dataSource: DataSource, endpoint: string, params?: any) => {
      const queryKey = createQueryKey(dataSource, endpoint, params);
      queryClient.invalidateQueries({ queryKey });
    },
    
    // 预取查询
    prefetchQuery: async <T = any>(
      dataSource: DataSource,
      endpoint: string,
      params?: any
    ) => {
      const queryKey = createQueryKey(dataSource, endpoint, params);
      const apiInfo = getApiInfo(dataSource);
      
      await queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const response = await apiRequest<T>(dataSource, endpoint, {
            query: params
          });
          return response.data;
        }
      });
    }
  };
}; 