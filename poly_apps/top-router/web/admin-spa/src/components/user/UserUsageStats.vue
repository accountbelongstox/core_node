<template>
  <div class="space-y-6">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">使用统计</h1>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">查看您的 API 使用统计和费用</p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <select
          v-model="selectedPeriod"
          class="block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 sm:text-sm"
          @change="loadUsageStats"
        >
          <option value="day">过去 24 小时</option>
          <option value="week">过去 7 天</option>
          <option value="month">过去 30 天</option>
          <option value="quarter">过去 90 天</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="py-12 text-center">
      <svg
        class="mx-auto h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"
        fill="none"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          fill="currentColor"
        ></path>
      </svg>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">正在加载使用统计...</p>
    </div>

    <!-- Stats Cards -->
    <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg
                class="h-6 w-6 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  总请求数
                </dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {{ formatNumber(usageStats?.totalRequests || 0) }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg
                class="h-6 w-6 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  输入 Tokens
                </dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {{ formatNumber(usageStats?.totalInputTokens || 0) }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg
                class="h-6 w-6 text-purple-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  输出 Tokens
                </dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {{ formatNumber(usageStats?.totalOutputTokens || 0) }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg
                class="h-6 w-6 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  总费用
                </dt>
                <dd class="text-lg font-medium text-gray-900 dark:text-gray-100">
                  ${{ (usageStats?.totalCost || 0).toFixed(4) }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Usage Charts -->
    <div
      v-if="!loading && (usageStats || userApiKeys.length > 0)"
      :class="['grid grid-cols-1 gap-6', hasMultipleCharts ? 'lg:grid-cols-2' : 'lg:grid-cols-1']"
    >
      <!-- API Keys Usage Chart -->
      <div v-if="userApiKeys.length > 0" class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h3 class="mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
          按 API 密钥请求分布
        </h3>
        <div class="h-64">
          <canvas ref="apiKeysChartCanvas"></canvas>
        </div>
      </div>

      <!-- Models Usage Chart -->
      <div
        v-if="usageStats && usageStats.modelStats?.length > 0"
        class="rounded-lg bg-white p-6 shadow dark:bg-gray-800"
      >
        <h3 class="mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
          按模型请求分布
        </h3>
        <div class="h-64">
          <canvas ref="modelsChartCanvas"></canvas>
        </div>
      </div>
    </div>

    <!-- Model Usage Breakdown -->
    <div
      v-if="!loading && usageStats && usageStats.modelStats?.length > 0"
      class="rounded-lg bg-white shadow dark:bg-gray-800"
    >
      <div class="px-4 py-5 sm:p-6">
        <h3 class="mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
          按模型使用情况
        </h3>
        <div class="space-y-3">
          <div
            v-for="model in usageStats.modelStats"
            :key="model.name"
            class="flex items-center justify-between"
          >
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="h-2 w-2 rounded-full bg-blue-500"></div>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ model.name }}
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-900 dark:text-gray-100">
                {{ formatNumber(model.requests) }} 次请求
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${{ model.cost.toFixed(4) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detailed Usage Table -->
    <div
      v-if="!loading && userApiKeys.length > 0"
      class="rounded-lg bg-white shadow dark:bg-gray-800"
    >
      <div class="px-4 py-5 sm:p-6">
        <h3 class="mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
          按 API 密钥使用情况
        </h3>
        <div class="overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  scope="col"
                >
                  API 密钥
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  scope="col"
                >
                  请求次数
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  scope="col"
                >
                  输入 Tokens
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  scope="col"
                >
                  输出 Tokens
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  scope="col"
                >
                  费用
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  scope="col"
                >
                  状态
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              <tr v-for="apiKey in userApiKeys" :key="apiKey.id">
                <td class="whitespace-nowrap px-6 py-4">
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ apiKey.name }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ apiKey.keyPreview }}
                  </div>
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  {{ formatNumber(apiKey.usage?.requests || 0) }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  {{ formatNumber(apiKey.usage?.inputTokens || 0) }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  {{ formatNumber(apiKey.usage?.outputTokens || 0) }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  ${{ (apiKey.usage?.totalCost || 0).toFixed(4) }}
                </td>
                <td class="whitespace-nowrap px-6 py-4">
                  <span
                    :class="[
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      apiKey.isDeleted === 'true' || apiKey.deletedAt
                        ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        : apiKey.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    ]"
                  >
                    {{
                      apiKey.isDeleted === 'true' || apiKey.deletedAt
                        ? '已删除'
                        : apiKey.isActive
                          ? '激活'
                          : '已禁用'
                    }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- No Data State -->
    <div
      v-if="!loading && (!usageStats || usageStats.totalRequests === 0)"
      class="py-12 text-center"
    >
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">暂无使用数据</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        您还没有进行任何 API 请求。创建一个 API 密钥并开始使用服务以查看使用统计。
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { showToast } from '@/utils/toast'
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'

// 注册 Chart.js 组件
Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const userStore = useUserStore()
const themeStore = useThemeStore()

const loading = ref(true)
const selectedPeriod = ref('week')
const usageStats = ref(null)
const userApiKeys = ref([])

// Chart 实例
const apiKeysChartCanvas = ref(null)
const modelsChartCanvas = ref(null)
let apiKeysChart = null
let modelsChart = null

// 检查API Key是否有使用数据
const hasApiKeyUsage = computed(() => {
  if (userApiKeys.value.length === 0) return false
  // 检查是否至少有一个API Key有请求记录
  return userApiKeys.value.some((key) => (key.usage?.requests || 0) > 0)
})

// 计算是否有多个图表
const hasMultipleCharts = computed(() => {
  const hasApiKeysChart = hasApiKeyUsage.value
  const hasModelsChart = usageStats.value?.modelStats?.length > 0
  return hasApiKeysChart && hasModelsChart
})

const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// 获取当前主题的图表颜色
const getChartColors = () => {
  const isDark = themeStore.isDark
  return {
    textColor: isDark ? '#e5e7eb' : '#374151',
    gridColor: isDark ? '#374151' : '#e5e7eb',
    backgroundColor: [
      'rgba(59, 130, 246, 0.8)', // blue
      'rgba(16, 185, 129, 0.8)', // green
      'rgba(139, 92, 246, 0.8)', // purple
      'rgba(251, 146, 60, 0.8)', // orange
      'rgba(236, 72, 153, 0.8)', // pink
      'rgba(14, 165, 233, 0.8)', // sky
      'rgba(234, 179, 8, 0.8)', // yellow
      'rgba(239, 68, 68, 0.8)' // red
    ],
    borderColor: [
      'rgb(59, 130, 246)',
      'rgb(16, 185, 129)',
      'rgb(139, 92, 246)',
      'rgb(251, 146, 60)',
      'rgb(236, 72, 153)',
      'rgb(14, 165, 233)',
      'rgb(234, 179, 8)',
      'rgb(239, 68, 68)'
    ]
  }
}

// 创建 API Keys 使用图表
const createApiKeysChart = () => {
  if (!apiKeysChartCanvas.value || userApiKeys.value.length === 0) return

  // 销毁旧图表
  if (apiKeysChart) {
    apiKeysChart.destroy()
  }

  const colors = getChartColors()
  const labels = userApiKeys.value.map((key) => key.name)
  const data = userApiKeys.value.map((key) => key.usage?.requests || 0)

  const ctx = apiKeysChartCanvas.value.getContext('2d')
  apiKeysChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '请求次数',
          data: data,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `请求次数: ${formatNumber(context.parsed.y)}`
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: colors.textColor,
            callback: function (value) {
              return formatNumber(value)
            }
          },
          grid: {
            color: colors.gridColor
          }
        },
        x: {
          ticks: {
            color: colors.textColor,
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            display: false
          }
        }
      }
    }
  })
}

// 创建模型使用图表
const createModelsChart = () => {
  if (!modelsChartCanvas.value || !usageStats.value?.modelStats?.length) return

  // 销毁旧图表
  if (modelsChart) {
    modelsChart.destroy()
  }

  const colors = getChartColors()
  const labels = usageStats.value.modelStats.map((model) => model.name)
  const data = usageStats.value.modelStats.map((model) => model.requests)

  const ctx = modelsChartCanvas.value.getContext('2d')
  modelsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '请求次数',
          data: data,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const modelStat = usageStats.value.modelStats[context.dataIndex]
              return [
                `请求次数: ${formatNumber(context.parsed.y)}`,
                `费用: $${modelStat.cost.toFixed(4)}`
              ]
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: colors.textColor,
            callback: function (value) {
              return formatNumber(value)
            }
          },
          grid: {
            color: colors.gridColor
          }
        },
        x: {
          ticks: {
            color: colors.textColor,
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            display: false
          }
        }
      }
    }
  })
}

const loadUsageStats = async () => {
  loading.value = true
  try {
    const [stats, apiKeys] = await Promise.all([
      userStore.getUserUsageStats({ period: selectedPeriod.value }),
      userStore.getUserApiKeys(true)
    ])

    usageStats.value = stats
    userApiKeys.value = apiKeys

    // 等待 DOM 更新后创建图表
    await nextTick()
    createApiKeysChart()
    createModelsChart()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load usage stats:', error)
    showToast('加载使用统计失败', 'error')
  } finally {
    loading.value = false
  }
}

// 监听主题变化，重新创建图表
watch(
  () => themeStore.isDark,
  async () => {
    await nextTick()
    createApiKeysChart()
    createModelsChart()
  }
)

// 监听 userApiKeys 数据变化，重新创建API Keys图表
watch(
  () => userApiKeys.value,
  async (newKeys) => {
    if (newKeys && newKeys.length > 0) {
      await nextTick()
      createApiKeysChart()
    }
  },
  { deep: true }
)

onMounted(() => {
  loadUsageStats()
})

onUnmounted(() => {
  // 清理图表实例
  if (apiKeysChart) {
    apiKeysChart.destroy()
  }
  if (modelsChart) {
    modelsChart.destroy()
  }
})
</script>

<style scoped>
/* 组件特定样式 */
</style>
