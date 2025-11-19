<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">多数据源使用示例</h1>
      <p class="text-gray-600 dark:text-gray-400">演示如何使用多数据源管理系统</p>
    </div>

    <!-- 基础请求示例 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">基础请求示例</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <button
          @click="testPrimaryApi"
          :disabled="loading"
          class="btn btn-primary"
        >
          测试主API
        </button>
        <button
          @click="testSecondaryApi"
          :disabled="loading"
          class="btn btn-secondary"
        >
          测试辅助API
        </button>
        <button
          @click="testMultipleApis"
          :disabled="loading"
          class="btn btn-success"
        >
          测试多API并行
        </button>
      </div>

      <div v-if="basicResults.length > 0" class="space-y-2">
        <h3 class="font-medium text-gray-900 dark:text-white">请求结果:</h3>
        <div class="bg-gray-100 dark:bg-gray-700 rounded p-3 text-sm">
          <pre>{{ JSON.stringify(basicResults, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- 高级功能示例 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">高级功能示例</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <button
          @click="testFailover"
          :disabled="loading"
          class="btn btn-warning"
        >
          故障转移
        </button>
        <button
          @click="testLoadBalancing"
          :disabled="loading"
          class="btn btn-info"
        >
          负载均衡
        </button>
        <button
          @click="testAggregation"
          :disabled="loading"
          class="btn btn-purple"
        >
          数据聚合
        </button>
        <button
          @click="testCaching"
          :disabled="loading"
          class="btn btn-teal"
        >
          缓存测试
        </button>
      </div>

      <div v-if="advancedResults.length > 0" class="space-y-2">
        <h3 class="font-medium text-gray-900 dark:text-white">高级功能结果:</h3>
        <div class="bg-gray-100 dark:bg-gray-700 rounded p-3 text-sm max-h-64 overflow-y-auto">
          <pre>{{ JSON.stringify(advancedResults, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- 数据源状态监控 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">数据源状态监控</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="dataSource in activeDataSources"
          :key="dataSource.id"
          class="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium text-gray-900 dark:text-white">{{ dataSource.name }}</h3>
            <span
              :class="getHealthStatusClass(dataSource.id)"
              class="px-2 py-1 rounded-full text-xs font-medium"
            >
              {{ getHealthStatus(dataSource.id) }}
            </span>
          </div>
          
          <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <div>URL: {{ dataSource.baseUrl }}</div>
            <div>认证: {{ dataSource.auth.type.toUpperCase() }}</div>
            <div>响应时间: {{ getResponseTime(dataSource.id) }}ms</div>
            <div>最后检查: {{ getLastCheckTime(dataSource.id) }}</div>
          </div>
          
          <button
            @click="performHealthCheck(dataSource.id)"
            class="mt-2 text-xs btn btn-outline-primary"
          >
            检查健康状态
          </button>
        </div>
      </div>
    </div>

    <!-- 错误日志 -->
    <div v-if="errors.length > 0" class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">错误日志</h2>
        <button
          @click="clearAllErrors"
          class="text-sm btn btn-outline-danger"
        >
          清除所有错误
        </button>
      </div>
      
      <div class="space-y-2 max-h-48 overflow-y-auto">
        <div
          v-for="error in errors.slice(-10)"
          :key="error.timestamp"
          class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-red-800 dark:text-red-200">
              {{ error.source }}
            </span>
            <span class="text-xs text-red-600 dark:text-red-400">
              {{ new Date(error.timestamp).toLocaleString() }}
            </span>
          </div>
          <div class="text-sm text-red-700 dark:text-red-300 mt-1">
            [{{ error.code }}] {{ error.message }}
          </div>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">请求统计</h2>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {{ stats.totalRequests }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">总请求数</div>
        </div>
        
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {{ stats.successfulRequests }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">成功请求</div>
        </div>
        
        <div class="text-center">
          <div class="text-2xl font-bold text-red-600 dark:text-red-400">
            {{ stats.failedRequests }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">失败请求</div>
        </div>
        
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {{ Math.round(stats.averageResponseTime) }}ms
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">平均响应时间</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataSource, usePrimaryApi, useSecondaryApi, useDataSourceStatus } from '@/composables/useDataSource';

// 页面元数据
definePageMeta({
  title: '数据源示例',
  layout: 'default'
});

// 使用 composables
const {
  request,
  requestMultiple,
  requestWithFailover,
  requestWithLoadBalancing,
  requestAggregate,
  activeDataSources,
  errors,
  stats,
  clearErrors,
  healthCheck
} = useDataSource();

const { isHealthy, getResponseTime } = useDataSourceStatus();
const primaryApi = usePrimaryApi();
const secondaryApi = useSecondaryApi();

// 响应式数据
const loading = ref(false);
const basicResults = ref<any[]>([]);
const advancedResults = ref<any[]>([]);

// 基础API测试方法
const testPrimaryApi = async () => {
  loading.value = true;
  try {
    const response = await primaryApi.dashboard();
    basicResults.value = [
      {
        type: 'Primary API Dashboard',
        success: response.success,
        data: response.data,
        source: response.source,
        timestamp: response.timestamp
      }
    ];
  } catch (error: any) {
    basicResults.value = [
      {
        type: 'Primary API Error',
        error: error.message,
        code: error.code
      }
    ];
  } finally {
    loading.value = false;
  }
};

const testSecondaryApi = async () => {
  loading.value = true;
  try {
    const response = await secondaryApi.charts();
    basicResults.value = [
      {
        type: 'Secondary API Charts',
        success: response.success,
        data: response.data,
        source: response.source,
        timestamp: response.timestamp
      }
    ];
  } catch (error: any) {
    basicResults.value = [
      {
        type: 'Secondary API Error',
        error: error.message,
        code: error.code
      }
    ];
  } finally {
    loading.value = false;
  }
};

const testMultipleApis = async () => {
  loading.value = true;
  try {
    const responses = await requestMultiple([
      {
        sourceId: 'primary-api',
        endpoint: '/api/dashboard'
      },
      {
        sourceId: 'secondary-api',
        endpoint: '/api/charts'
      }
    ]);
    
    basicResults.value = responses.map((response, index) => ({
      type: `Multiple API Request ${index + 1}`,
      success: 'success' in response ? response.success : false,
      data: 'success' in response ? response.data : null,
      error: 'message' in response ? response.message : null
    }));
  } catch (error: any) {
    basicResults.value = [
      {
        type: 'Multiple API Error',
        error: error.message
      }
    ];
  } finally {
    loading.value = false;
  }
};

// 高级功能测试方法
const testFailover = async () => {
  loading.value = true;
  try {
    const response = await requestWithFailover(
      ['primary-api', 'secondary-api'],
      '/api/dashboard'
    );
    
    advancedResults.value = [
      {
        type: 'Failover Request',
        success: response.success,
        data: response.data,
        source: response.source
      }
    ];
  } catch (error: any) {
    advancedResults.value = [
      {
        type: 'Failover Error',
        error: error.message,
        code: error.code
      }
    ];
  } finally {
    loading.value = false;
  }
};

const testLoadBalancing = async () => {
  loading.value = true;
  try {
    const response = await requestWithLoadBalancing(
      ['primary-api', 'secondary-api'],
      '/api/dashboard'
    );
    
    advancedResults.value = [
      {
        type: 'Load Balanced Request',
        success: response.success,
        data: response.data,
        source: response.source
      }
    ];
  } catch (error: any) {
    advancedResults.value = [
      {
        type: 'Load Balancing Error',
        error: error.message,
        code: error.code
      }
    ];
  } finally {
    loading.value = false;
  }
};

const testAggregation = async () => {
  loading.value = true;
  try {
    const response = await requestAggregate([
      {
        sourceId: 'primary-api',
        endpoint: '/api/dashboard',
        key: 'dashboard'
      },
      {
        sourceId: 'secondary-api',
        endpoint: '/api/charts',
        key: 'charts'
      }
    ]);
    
    advancedResults.value = [
      {
        type: 'Aggregated Request',
        success: response.success,
        data: response.data,
        source: response.source
      }
    ];
  } catch (error: any) {
    advancedResults.value = [
      {
        type: 'Aggregation Error',
        error: error.message,
        code: error.code
      }
    ];
  } finally {
    loading.value = false;
  }
};

const testCaching = async () => {
  loading.value = true;
  try {
    // 第一次请求（会缓存）
    const start1 = Date.now();
    const response1 = await request('primary-api', '/api/dashboard', { cache: true });
    const time1 = Date.now() - start1;
    
    // 第二次请求（从缓存获取）
    const start2 = Date.now();
    const response2 = await request('primary-api', '/api/dashboard', { cache: true });
    const time2 = Date.now() - start2;
    
    advancedResults.value = [
      {
        type: 'Cache Test',
        firstRequest: {
          time: time1,
          cached: false,
          success: response1.success
        },
        secondRequest: {
          time: time2,
          cached: time2 < 10, // 如果响应时间很短，说明是从缓存获取的
          success: response2.success
        }
      }
    ];
  } catch (error: any) {
    advancedResults.value = [
      {
        type: 'Cache Test Error',
        error: error.message,
        code: error.code
      }
    ];
  } finally {
    loading.value = false;
  }
};

// 状态监控方法
const getHealthStatus = (sourceId: string) => {
  return isHealthy(sourceId) ? '健康' : '异常';
};

const getHealthStatusClass = (sourceId: string) => {
  return isHealthy(sourceId) 
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
};

const getLastCheckTime = (sourceId: string) => {
  // 这里可以从 healthChecks 获取最后检查时间
  return '刚刚';
};

const performHealthCheck = async (sourceId?: string) => {
  try {
    await healthCheck(sourceId);
  } catch (error) {
    console.error('Health check failed:', error);
  }
};

const clearAllErrors = () => {
  clearErrors();
};

// 页面加载时执行初始化
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: rgb(37 99 235);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: rgb(29 78 216);
}

.btn-secondary {
  background-color: rgb(75 85 99);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: rgb(55 65 81);
}

.btn-success {
  background-color: rgb(34 197 94);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: rgb(21 128 61);
}

.btn-warning {
  background-color: rgb(234 179 8);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background-color: rgb(161 98 7);
}

.btn-info {
  background-color: rgb(6 182 212);
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: rgb(8 145 178);
}

.btn-purple {
  background-color: rgb(147 51 234);
  color: white;
}

.btn-purple:hover:not(:disabled) {
  background-color: rgb(126 34 206);
}

.btn-teal {
  background-color: rgb(20 184 166);
  color: white;
}

.btn-teal:hover:not(:disabled) {
  background-color: rgb(15 118 110);
}

.btn-outline-primary {
  border: 1px solid rgb(37 99 235);
  color: rgb(37 99 235);
  background-color: transparent;
}

.btn-outline-primary:hover:not(:disabled) {
  background-color: rgb(239 246 255);
}

.dark .btn-outline-primary:hover:not(:disabled) {
  background-color: rgb(30 58 138);
}

.btn-outline-danger {
  border: 1px solid rgb(239 68 68);
  color: rgb(239 68 68);
  background-color: transparent;
}

.btn-outline-danger:hover:not(:disabled) {
  background-color: rgb(254 242 242);
}

.dark .btn-outline-danger:hover:not(:disabled) {
  background-color: rgb(127 29 29);
}
</style>