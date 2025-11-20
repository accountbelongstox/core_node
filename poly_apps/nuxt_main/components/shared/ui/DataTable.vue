<!-- ### AI SPECIAL ATTENTION RULES START ###
When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
1. Write all code in English only
2. Never execute, create, or modify test code
3. Never create or update documentation (*.md)
4. Never write summaries during development or thinking process
5. Do not modify these rules
VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
### AI SPECIAL ATTENTION RULES END ### -->

<template>
  <div class="shared-data-table">
    <!-- Table Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-4">
        <h3 v-if="title" class="text-lg font-semibold">{{ title }}</h3>
        <div v-if="showSearch" class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search..."
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
        </div>
      </div>
      
      <div class="flex items-center space-x-2">
        <button
          v-if="showRefresh"
          @click="$emit('refresh')"
          class="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          Refresh
        </button>
        <button
          v-if="showExport"
          @click="$emit('export')"
          class="px-3 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors"
        >
          Export
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white border border-gray-200 rounded-lg">
        <thead class="bg-gray-50">
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              @click="handleSort(column.key)"
            >
              <div class="flex items-center space-x-1">
                <span>{{ column.label }}</span>
                <svg
                  v-if="column.sortable"
                  class="w-4 h-4"
                  :class="getSortIconClass(column.key)"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
              </div>
            </th>
            <th v-if="showActions" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="(item, index) in paginatedData"
            :key="getRowKey(item, index)"
            class="hover:bg-gray-50 transition-colors"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
            >
              <slot
                :name="`cell-${column.key}`"
                :item="item"
                :value="getNestedValue(item, column.key)"
              >
                {{ formatCellValue(item, column) }}
              </slot>
            </td>
            <td v-if="showActions" class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <slot name="actions" :item="item" :index="index">
                <button class="text-blue-600 hover:text-blue-900 mr-2">Edit</button>
                <button class="text-red-600 hover:text-red-900">Delete</button>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="showPagination" class="flex items-center justify-between mt-4">
      <div class="text-sm text-gray-700">
        Showing {{ startIndex + 1 }} to {{ endIndex }} of {{ filteredData.length }} results
      </div>
      <div class="flex items-center space-x-2">
        <button
          @click="previousPage"
          :disabled="currentPage === 1"
          class="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="px-3 py-2 text-sm">{{ currentPage }} / {{ totalPages }}</span>
        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

// Props
interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  formatter?: (value: any) => string;
}

interface Props {
  data: any[];
  columns: Column[];
  title?: string;
  showSearch?: boolean;
  showRefresh?: boolean;
  showExport?: boolean;
  showActions?: boolean;
  showPagination?: boolean;
  pageSize?: number;
  rowKey?: string;
}

const props = withDefaults(defineProps<Props>(), {
  showSearch: true,
  showRefresh: true,
  showExport: false,
  showActions: true,
  showPagination: true,
  pageSize: 10,
  rowKey: 'id'
});

// Emits
defineEmits(['refresh', 'export']);

// Reactive data
const searchQuery = ref('');
const sortKey = ref('');
const sortOrder = ref<'asc' | 'desc'>('asc');
const currentPage = ref(1);

// Computed
const filteredData = computed(() => {
  let result = props.data;
  
  if (searchQuery.value) {
    result = result.filter(item =>
      Object.values(item).some(value =>
        String(value).toLowerCase().includes(searchQuery.value.toLowerCase())
      )
    );
  }
  
  if (sortKey.value) {
    result = [...result].sort((a, b) => {
      const aVal = getNestedValue(a, sortKey.value);
      const bVal = getNestedValue(b, sortKey.value);
      
      if (sortOrder.value === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }
  
  return result;
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / props.pageSize));
const startIndex = computed(() => (currentPage.value - 1) * props.pageSize);
const endIndex = computed(() => Math.min(startIndex.value + props.pageSize, filteredData.value.length));

const paginatedData = computed(() => {
  return filteredData.value.slice(startIndex.value, endIndex.value);
});

// Methods
const getNestedValue = (obj: any, path: string) => {
  return path.split('.').reduce((o, p) => o?.[p], obj);
};

const getRowKey = (item: any, index: number) => {
  return item[props.rowKey] || index;
};

const formatCellValue = (item: any, column: Column) => {
  const value = getNestedValue(item, column.key);
  return column.formatter ? column.formatter(value) : value;
};

const handleSort = (key: string) => {
  const column = props.columns.find(col => col.key === key);
  if (!column?.sortable) return;
  
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
};

const getSortIconClass = (key: string) => {
  if (sortKey.value !== key) return 'text-gray-400';
  return sortOrder.value === 'asc' ? 'text-blue-500' : 'text-blue-500 rotate-180';
};

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

// Watch for data changes to reset pagination
watch(() => props.data, () => {
  currentPage.value = 1;
});
</script>

<style scoped>
.shared-data-table {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}
</style>
