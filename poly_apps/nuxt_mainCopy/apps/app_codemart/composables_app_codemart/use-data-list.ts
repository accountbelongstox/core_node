/**
 * Generic Data List Management Composable
 * Handles list data, pagination, filtering, and sorting
 * Reduces boilerplate in all composables managing collections
 */

import { ref, computed, Ref, ComputedRef } from 'vue';

export interface DataListOptions<T> {
  initialData?: T[];
  initialPage?: number;
  initialPageSize?: number;
  initialSort?: string;
  initialOrder?: 'asc' | 'desc';
}

export interface DataListFilters {
  [key: string]: any;
}

export interface DataListSortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export interface UseDataListReturn<T> {
  items: Ref<T[]>;
  total: Ref<number>;
  currentPage: Ref<number>;
  pageSize: Ref<number>;
  sortConfig: Ref<DataListSortConfig | null>;
  filters: Ref<DataListFilters>;

  filteredItems: ComputedRef<T[]>;
  totalPages: ComputedRef<number>;
  hasNextPage: ComputedRef<boolean>;
  hasPreviousPage: ComputedRef<boolean>;

  addItem: (item: T) => void;
  removeItem: (predicate: (item: T) => boolean) => void;
  removeItemById: (id: string | number) => void;
  updateItem: (predicate: (item: T) => boolean, updates: Partial<T>) => void;
  updateItemById: (id: string | number, updates: Partial<T>) => void;
  replaceItem: (predicate: (item: T) => boolean, newItem: T) => void;
  replaceItemById: (id: string | number, newItem: T) => void;
  findItem: (predicate: (item: T) => boolean) => T | undefined;
  findItemById: (id: string | number) => T | undefined;

  setItems: (items: T[]) => void;
  setTotal: (total: number) => void;
  setFilters: (filters: DataListFilters) => void;
  addFilter: (key: string, value: any) => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;

  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;

  sort: (field: string, order?: 'asc' | 'desc') => void;
  clearSort: () => void;

  reset: () => void;
  clear: () => void;
}

export function useDataList<T extends { id?: string | number } = any>(
  options: DataListOptions<T> = {}
): UseDataListReturn<T> {
  const {
    initialData = [],
    initialPage = 1,
    initialPageSize = 20,
    initialSort,
    initialOrder = 'asc',
  } = options;

  const items = ref<T[]>(initialData);
  const total = ref(0);
  const currentPage = ref(initialPage);
  const pageSize = ref(initialPageSize);
  const sortConfig = ref<DataListSortConfig | null>(
    initialSort ? { field: initialSort, order: initialOrder } : null
  );
  const filters = ref<DataListFilters>({});

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1);

  const hasNextPage = computed(() => currentPage.value < totalPages.value);
  const hasPreviousPage = computed(() => currentPage.value > 1);

  const filteredItems = computed(() => {
    let result = [...items.value];

    if (sortConfig.value) {
      const { field, order } = sortConfig.value;
      result.sort((a, b) => {
        const aVal = (a as any)[field];
        const bVal = (b as any)[field];

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const comparison =
          typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal > bVal ? 1 : -1;

        return order === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  });

  const addItem = (item: T) => {
    items.value.push(item);
    total.value += 1;
  };

  const removeItem = (predicate: (item: T) => boolean) => {
    const index = items.value.findIndex(predicate);
    if (index !== -1) {
      items.value.splice(index, 1);
      total.value = Math.max(0, total.value - 1);
    }
  };

  const removeItemById = (id: string | number) => {
    removeItem(item => (item as any).id === id);
  };

  const updateItem = (
    predicate: (item: T) => boolean,
    updates: Partial<T>
  ) => {
    const index = items.value.findIndex(predicate);
    if (index !== -1) {
      items.value[index] = { ...items.value[index], ...updates };
    }
  };

  const updateItemById = (id: string | number, updates: Partial<T>) => {
    updateItem(item => (item as any).id === id, updates);
  };

  const replaceItem = (predicate: (item: T) => boolean, newItem: T) => {
    const index = items.value.findIndex(predicate);
    if (index !== -1) {
      items.value[index] = newItem;
    }
  };

  const replaceItemById = (id: string | number, newItem: T) => {
    replaceItem(item => (item as any).id === id, newItem);
  };

  const findItem = (predicate: (item: T) => boolean): T | undefined => {
    return items.value.find(predicate);
  };

  const findItemById = (id: string | number): T | undefined => {
    return findItem(item => (item as any).id === id);
  };

  const setItems = (newItems: T[]) => {
    items.value = newItems;
  };

  const setTotal = (newTotal: number) => {
    total.value = newTotal;
  };

  const setFilters = (newFilters: DataListFilters) => {
    filters.value = newFilters;
  };

  const addFilter = (key: string, value: any) => {
    filters.value[key] = value;
  };

  const removeFilter = (key: string) => {
    delete filters.value[key];
  };

  const clearFilters = () => {
    filters.value = {};
  };

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages.value));
    currentPage.value = validPage;
  };

  const nextPage = () => {
    if (hasNextPage.value) {
      currentPage.value += 1;
    }
  };

  const previousPage = () => {
    if (hasPreviousPage.value) {
      currentPage.value -= 1;
    }
  };

  const setPageSize = (size: number) => {
    pageSize.value = Math.max(1, size);
    currentPage.value = 1;
  };

  const sort = (field: string, order: 'asc' | 'desc' = 'asc') => {
    sortConfig.value = { field, order };
  };

  const clearSort = () => {
    sortConfig.value = null;
  };

  const reset = () => {
    items.value = initialData;
    total.value = 0;
    currentPage.value = initialPage;
    pageSize.value = initialPageSize;
    sortConfig.value = null;
    filters.value = {};
  };

  const clear = () => {
    items.value = [];
    total.value = 0;
    currentPage.value = 1;
    pageSize.value = 20;
    sortConfig.value = null;
    filters.value = {};
  };

  return {
    items,
    total,
    currentPage,
    pageSize,
    sortConfig,
    filters,
    filteredItems,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    addItem,
    removeItem,
    removeItemById,
    updateItem,
    updateItemById,
    replaceItem,
    replaceItemById,
    findItem,
    findItemById,
    setItems,
    setTotal,
    setFilters,
    addFilter,
    removeFilter,
    clearFilters,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    sort,
    clearSort,
    reset,
    clear,
  };
}

export default useDataList;
