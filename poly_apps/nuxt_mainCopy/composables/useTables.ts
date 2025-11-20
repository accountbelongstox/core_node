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

import { tablesApi } from '@/services/api/tables';
import { useApiQuery, useApiMutation, usePrimaryQuery, usePrimaryMutation } from './useVueQuery';
import { useApiFetch, usePrimaryFetch, usePrimaryAsyncData } from './useNuxtApi';
import { API_ROUTES } from '@/services/config/endpoints';
import type { TableData, PaginatedResponse } from '@/types/api';

// 使用 Vue Query 的表格组合式函数
export const useTablesQuery = (page: Ref<number> = ref(1), limit: Ref<number> = ref(10)) => {
  // 获取表格数据
  const tableData = useApiQuery<TableData[]>('PRIMARY', API_ROUTES.PRIMARY.TABLES);
  
  // 获取分页表格数据
  const paginatedData = useApiQuery<PaginatedResponse<TableData>>(
    'PRIMARY', 
    API_ROUTES.PRIMARY.TABLES, 
    { page: page.value, limit: limit.value }
  );

  // 创建表格记录
  const createMutation = useApiMutation<TableData, Omit<TableData, 'id'>>(
    'PRIMARY',
    API_ROUTES.PRIMARY.TABLES,
    'POST'
  );

  // 更新表格记录
  const updateMutation = useApiMutation<TableData, { id: number; data: Partial<TableData> }>(
    'PRIMARY',
    `${API_ROUTES.PRIMARY.TABLES}/:id`,
    'PUT'
  );

  // 删除表格记录
  const deleteMutation = useApiMutation<void, number>(
    'PRIMARY',
    `${API_ROUTES.PRIMARY.TABLES}/:id`,
    'DELETE'
  );

  return {
    tableData,
    paginatedData,
    createMutation,
    updateMutation,
    deleteMutation,
    
    // 计算加载状态
    isLoading: computed(() => 
      tableData.isLoading.value || 
      paginatedData.isLoading.value ||
      createMutation.isPending.value ||
      updateMutation.isPending.value ||
      deleteMutation.isPending.value
    ),
    
    // 计算错误状态
    hasError: computed(() => 
      tableData.error.value || 
      paginatedData.error.value ||
      createMutation.error.value ||
      updateMutation.error.value ||
      deleteMutation.error.value
    ),
    
    // 刷新数据
    refresh: () => {
      tableData.refetch();
      paginatedData.refetch();
    }
  };
};

// 使用 Nuxt 原生 useFetch 的表格组合式函数
export const useTablesFetch = (page: Ref<number> = ref(1), limit: Ref<number> = ref(10)) => {
  // 获取表格数据
  const { data: tableData, pending: tablePending, error: tableError, refresh: refreshTable } = 
    usePrimaryFetch<TableData[]>(API_ROUTES.PRIMARY.TABLES);
  
  // 获取分页表格数据
  const { data: paginatedData, pending: paginatedPending, error: paginatedError, refresh: refreshPaginated } = 
    usePrimaryFetch<PaginatedResponse<TableData>>(API_ROUTES.PRIMARY.TABLES, {
      query: { page: page.value, limit: limit.value }
    });

  return {
    tableData,
    paginatedData,
    
    // 加载状态
    pending: computed(() => 
      tablePending.value || 
      paginatedPending.value
    ),
    
    // 错误状态
    errors: computed(() => ({
      table: tableError.value,
      paginated: paginatedError.value
    })),
    
    // 刷新函数
    refresh: () => {
      refreshTable();
      refreshPaginated();
    }
  };
};

// 使用 Nuxt 原生 useAsyncData 的表格组合式函数
export const useTablesAsyncData = (page: Ref<number> = ref(1), limit: Ref<number> = ref(10)) => {
  // 获取表格数据
  const { data: tableData, pending: tablePending, error: tableError, refresh: refreshTable } = 
    usePrimaryAsyncData('table-data', () => tablesApi.getTableData());
  
  // 获取分页表格数据
  const { data: paginatedData, pending: paginatedPending, error: paginatedError, refresh: refreshPaginated } = 
    usePrimaryAsyncData('paginated-table-data', () => tablesApi.getPaginatedTableData(page.value, limit.value));

  return {
    tableData,
    paginatedData,
    
    // 加载状态
    pending: computed(() => 
      tablePending.value || 
      paginatedPending.value
    ),
    
    // 错误状态
    errors: computed(() => ({
      table: tableError.value,
      paginated: paginatedError.value
    })),
    
    // 刷新函数
    refresh: () => {
      refreshTable();
      refreshPaginated();
    }
  };
};

// 单个表格记录的组合式函数
export const useTableRecord = (id: Ref<number>) => {
  // 使用 Vue Query
  const tableRecord = useApiQuery<TableData>(
    'PRIMARY', 
    `${API_ROUTES.PRIMARY.TABLES}/${id.value}`
  );

  // 使用 Nuxt Fetch
  const { data: tableRecordFetch, pending: tableRecordPending, error: tableRecordError, refresh: refreshTableRecord } = 
    usePrimaryFetch<TableData>(`${API_ROUTES.PRIMARY.TABLES}/${id.value}`);

  // 使用 Nuxt AsyncData
  const { data: tableRecordAsync, pending: tableRecordAsyncPending, error: tableRecordAsyncError, refresh: refreshTableRecordAsync } = 
    usePrimaryAsyncData(`table-record-${id.value}`, () => tablesApi.getTableRecord(id.value));

  return {
    // Vue Query
    tableRecord,
    
    // Nuxt Fetch
    tableRecordFetch,
    tableRecordPending,
    tableRecordError,
    refreshTableRecord,
    
    // Nuxt AsyncData
    tableRecordAsync,
    tableRecordAsyncPending,
    tableRecordAsyncError,
    refreshTableRecordAsync
  };
}; 