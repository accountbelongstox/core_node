<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">数据源管理</h1>
        <p class="text-gray-600 dark:text-gray-400">管理和配置多个数据源连接</p>
      </div>
      <button
        @click="showAddModal = true"
        class="btn btn-primary"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        添加数据源
      </button>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 1.79 4 4 4h8c0-2.21-1.79-4-4-4H8c-2.21 0-4-1.79-4-4z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">总数据源</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ dataSources.length }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">健康数据源</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ healthyDataSources.length }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">活跃数据源</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ activeDataSources.length }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">平均响应时间</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ Math.round(stats.averageResponseTime) }}ms</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据源列表 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">数据源列表</h2>
          <div class="flex space-x-2">
            <button
              @click="performHealthCheck"
              :disabled="loading"
              class="btn btn-outline-primary"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
              </svg>
              健康检查
            </button>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                数据源
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                状态
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                认证类型
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                响应时间
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                最后检查
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="dataSource in dataSources" :key="dataSource.id">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 1.79 4 4 4h8c0-2.21-1.79-4-4-4H8c-2.21 0-4-1.79-4-4z"></path>
                      </svg>
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ dataSource.name }}
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      {{ dataSource.baseUrl }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusClass(dataSource.id)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ getStatusText(dataSource.id) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  {{ dataSource.auth.type.toUpperCase() }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                {{ getResponseTime(dataSource.id) }}ms
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {{ getLastCheckTime(dataSource.id) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button
                  @click="toggleDataSource(dataSource.id)"
                  :class="activeDataSources.some(ds => ds.id === dataSource.id) ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'"
                >
                  {{ activeDataSources.some(ds => ds.id === dataSource.id) ? '停用' : '启用' }}
                </button>
                <button
                  @click="editDataSource(dataSource)"
                  class="text-indigo-600 hover:text-indigo-900"
                >
                  编辑
                </button>
                <button
                  @click="deleteDataSource(dataSource.id)"
                  class="text-red-600 hover:text-red-900"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 添加/编辑数据源模态框 -->
    <div v-if="showAddModal || showEditModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {{ showEditModal ? '编辑数据源' : '添加数据源' }}
          </h3>
          
          <form @submit.prevent="saveDataSource" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">名称</label>
                <input
                  v-model="formData.name"
                  type="text"
                  required
                  class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">基础URL</label>
                <input
                  v-model="formData.baseUrl"
                  type="url"
                  required
                  class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">描述</label>
              <textarea
                v-model="formData.description"
                rows="2"
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              ></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">认证类型</label>
                <select
                  v-model="formData.auth.type"
                  class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="none">无认证</option>
                  <option value="jwt">JWT</option>
                  <option value="api_key">API Key</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">超时时间(ms)</label>
                <input
                  v-model.number="formData.timeout"
                  type="number"
                  min="1000"
                  max="60000"
                  class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">重试次数</label>
                <input
                  v-model.number="formData.retryCount"
                  type="number"
                  min="0"
                  max="5"
                  class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
              </div>
            </div>

            <!-- 认证配置 -->
            <div v-if="formData.auth.type !== 'none'" class="space-y-3">
              <h4 class="text-md font-medium text-gray-900 dark:text-white">认证配置</h4>
              
              <div v-if="formData.auth.type === 'jwt' || formData.auth.type === 'bearer'" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Token Key</label>
                  <input
                    v-model="formData.auth.tokenKey"
                    type="text"
                    class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Header Key</label>
                  <input
                    v-model="formData.auth.headerKey"
                    type="text"
                    class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">前缀</label>
                  <input
                    v-model="formData.auth.prefix"
                    type="text"
                    class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                </div>
              </div>

              <div v-if="formData.auth.type === 'api_key'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
                  <input
                    v-model="formData.auth.apiKey"
                    type="text"
                    class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Header Key</label>
                  <input
                    v-model="formData.auth.headerKey"
                    type="text"
                    class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                </div>
              </div>

              <div v-if="formData.auth.type === 'basic'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">用户名</label>
                  <input
                    v-model="formData.auth.username"
                    type="text"
                    class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">密码</label>
                  <input
                    v-model="formData.auth.password"
                    type="password"
                    class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                </div>
              </div>
            </div>

            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                @click="closeModal"
                class="btn btn-outline-secondary"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
              >
                {{ showEditModal ? '更新' : '添加' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataSource, useDataSourceStatus } from '@/composables/useDataSource';
import type { DataSourceConfig, DataSourceStatus } from '@/types/datasource';
import { AuthType } from '@/types/datasource';

// Page metadata
definePageMeta({
  title: 'Data Sources Management',
  layout: 'default',
  namespace: 'admin'
});

// 使用 composables
const {
  dataSources,
  activeDataSources,
  healthChecks,
  errors,
  loading,
  stats,
  getHealthyDataSources,
  addDataSource,
  updateDataSource,
  removeDataSource,
  activateDataSource,
  deactivateDataSource,
  healthCheck
} = useDataSource();

const { isHealthy, getResponseTime } = useDataSourceStatus();

// 响应式数据
const showAddModal = ref(false);
const showEditModal = ref(false);
const editingDataSource = ref<DataSourceConfig | null>(null);

// 表单数据
const formData = ref({
  id: '',
  name: '',
  description: '',
  baseUrl: '',
  timeout: 10000,
  retryCount: 3,
  auth: {
    type: 'none' as AuthType,
    tokenKey: '',
    headerKey: '',
    prefix: '',
    apiKey: '',
    username: '',
    password: ''
  },
  status: 'active' as DataSourceStatus,
  priority: 1,
  tags: [] as string[]
});

// 计算属性
const healthyDataSources = computed(() => getHealthyDataSources.value);

// 方法
const getStatusClass = (sourceId: string) => {
  if (isHealthy(sourceId)) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  }
  const health = healthChecks.value.get(sourceId);
  if (health?.status === 'unhealthy') {
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
};

const getStatusText = (sourceId: string) => {
  if (isHealthy(sourceId)) return '健康';
  const health = healthChecks.value.get(sourceId);
  if (health?.status === 'unhealthy') return '异常';
  return '未知';
};

const getLastCheckTime = (sourceId: string) => {
  const health = healthChecks.value.get(sourceId);
  if (!health?.lastCheck) return '从未检查';
  
  const now = new Date();
  const diff = now.getTime() - health.lastCheck.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
};

const performHealthCheck = async () => {
  try {
    await healthCheck();
  } catch (error) {
    console.error('Health check failed:', error);
  }
};

const toggleDataSource = (sourceId: string) => {
  const isActive = activeDataSources.value.some(ds => ds.id === sourceId);
  if (isActive) {
    deactivateDataSource(sourceId);
  } else {
    activateDataSource(sourceId);
  }
};

const editDataSource = (dataSource: DataSourceConfig) => {
  editingDataSource.value = dataSource;
  formData.value = {
    id: dataSource.id,
    name: dataSource.name,
    description: dataSource.description || '',
    baseUrl: dataSource.baseUrl,
    timeout: dataSource.timeout || 10000,
    retryCount: dataSource.retryCount || 3,
    auth: { ...dataSource.auth },
    status: dataSource.status,
    priority: dataSource.priority || 1,
    tags: dataSource.tags || []
  };
  showEditModal.value = true;
};

const deleteDataSource = (sourceId: string) => {
  if (confirm('确定要删除这个数据源吗？')) {
    removeDataSource(sourceId);
  }
};

const saveDataSource = () => {
  if (showEditModal.value && editingDataSource.value) {
    updateDataSource(editingDataSource.value.id, formData.value);
  } else {
    const newId = `datasource-${Date.now()}`;
    addDataSource({
      ...formData.value,
      id: newId,
      routes: {}
    });
  }
  closeModal();
};

const closeModal = () => {
  showAddModal.value = false;
  showEditModal.value = false;
  editingDataSource.value = null;
  resetForm();
};

const resetForm = () => {
  formData.value = {
    id: '',
    name: '',
    description: '',
    baseUrl: '',
    timeout: 10000,
    retryCount: 3,
    auth: {
      type: 'none' as AuthType,
      tokenKey: '',
      headerKey: '',
      prefix: '',
      apiKey: '',
      username: '',
      password: ''
    },
    status: 'active' as DataSourceStatus,
    priority: 1,
    tags: []
  };
};

// 页面加载时执行健康检查
onMounted(() => {
  performHealthCheck();
});
</script>

<style scoped>
.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: colors 200ms;
}

.btn-primary {
  background-color: rgb(37 99 235);
  color: white;
}

.btn-primary:hover {
  background-color: rgb(29 78 216);
}

.btn-outline-primary {
  border: 1px solid rgb(37 99 235);
  color: rgb(37 99 235);
  background-color: transparent;
}

.btn-outline-primary:hover {
  background-color: rgb(239 246 255);
}

.dark .btn-outline-primary:hover {
  background-color: rgb(30 58 138);
}

.btn-outline-secondary {
  border: 1px solid rgb(209 213 219);
  color: rgb(55 65 81);
  background-color: transparent;
}

.btn-outline-secondary:hover {
  background-color: rgb(249 250 251);
}

.dark .btn-outline-secondary {
  border-color: rgb(75 85 99);
  color: rgb(209 213 219);
}

.dark .btn-outline-secondary:hover {
  background-color: rgb(55 65 81);
}
</style>