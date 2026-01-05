<template>
  <div class="space-y-6">
    <section class="glass-card rounded-2xl p-4 shadow-lg sm:p-6">
      <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-sky-500">订阅与套餐</p>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Subscriptions</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            直接从 MySQL
            读取订阅记录，可按用户/套餐/状态筛选并滚动加载，便于校验迁移结果或排查账单。
          </p>
        </div>
        <span
          class="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-100"
        >
          <i class="fas fa-database mr-2" /> {{ subscriptions.length }} 条
        </span>
      </header>

      <form class="mb-4 grid gap-3 md:grid-cols-5" @submit.prevent="applyFilters">
        <div>
          <label class="form-label">用户 ID</label>
          <input
            v-model="filters.userId"
            class="form-input"
            placeholder="UUID / userId"
            type="text"
          />
        </div>
        <div>
          <label class="form-label">套餐 ID</label>
          <input
            v-model="filters.planId"
            class="form-input"
            placeholder="basic / pro / premium"
            type="text"
          />
        </div>
        <div>
          <label class="form-label">状态</label>
          <select v-model="filters.status" class="form-input">
            <option value="">全部</option>
            <option v-for="status in statusOptions" :key="`status-${status}`" :value="status">
              {{ status }}
            </option>
          </select>
        </div>
        <div>
          <label class="form-label">每页条数</label>
          <select v-model.number="pagination.limit" class="form-input" @change="applyFilters">
            <option v-for="option in limitOptions" :key="`limit-${option}`" :value="option">
              {{ option }}
            </option>
          </select>
        </div>
        <div class="flex items-end gap-2">
          <button class="btn btn-primary flex-1" :disabled="loading" type="submit">
            <i class="fas fa-search mr-2" />
            查询
          </button>
          <button class="btn btn-secondary flex-1" type="button" @click="resetFilters">重置</button>
        </div>
      </form>

      <div
        v-if="error"
        class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200"
      >
        {{ error }}
      </div>

      <div
        v-if="loading && subscriptions.length === 0"
        class="flex items-center justify-center py-10 text-sm text-gray-500"
      >
        <i class="fas fa-circle-notch mr-2 animate-spin" />
        正在加载订阅...
      </div>

      <div
        v-if="!loading && subscriptions.length === 0"
        class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        暂无订阅数据，尝试修改筛选条件或稍后再试。
      </div>

      <div v-if="subscriptions.length > 0" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800/70">
            <tr>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                订阅
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                用户 / 套餐
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                计费
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                周期
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                更新
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900/60">
            <tr v-for="subscription in subscriptions" :key="`subscription-${subscription.id}`">
              <td class="px-3 py-3 text-sm">
                <div class="font-semibold text-gray-900 dark:text-gray-100">
                  #{{ subscription.id }}
                </div>
                <div class="text-xs text-gray-500">{{ formatStatus(subscription.status) }}</div>
              </td>
              <td class="px-3 py-3 text-sm">
                <div class="text-gray-900 dark:text-gray-100">
                  {{ subscription.planName || subscription.planId }}
                </div>
                <div class="text-xs text-gray-500">
                  用户: <span class="font-mono">{{ subscription.userId }}</span>
                </div>
                <div class="text-xs text-gray-500">
                  套餐ID: <span class="font-mono">{{ subscription.planId }}</span>
                </div>
              </td>
              <td class="px-3 py-3 text-sm">
                <div class="font-semibold text-gray-900 dark:text-gray-100">
                  {{ formatCurrency(subscription.amount, subscription.currency) }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ subscription.billingCycle === 'yearly' ? '年付' : '月付' }}
                </div>
              </td>
              <td class="px-3 py-3 text-sm">
                <div>起: {{ formatDate(subscription.startDate) }}</div>
                <div>止: {{ formatDate(subscription.endDate) }}</div>
              </td>
              <td class="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                <div>创建: {{ formatDate(subscription.createdAt) }}</div>
                <div>更新: {{ formatDate(subscription.updatedAt) }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasMore" class="mt-4 flex justify-center">
        <button class="btn btn-outline" :disabled="loading" @click="loadMore">
          <i v-if="loading" class="fas fa-circle-notch mr-2 animate-spin" />
          加载更多
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { apiClient } from '@/config/api'
import { formatDate } from '@/utils/format'

const limitOptions = Object.freeze([25, 50, 100, 200])
const statusOptions = Object.freeze(['active', 'pending', 'cancelled', 'expired'])

const subscriptions = ref([])
const filters = reactive({
  userId: '',
  planId: '',
  status: ''
})
const pagination = reactive({
  limit: 50,
  cursor: null,
  nextCursor: null
})
const loading = ref(false)
const error = ref(null)

const hasMore = computed(() => Boolean(pagination.nextCursor))

const buildParams = (append = false) => {
  const params = {
    limit: pagination.limit || 50
  }
  if (append && pagination.nextCursor) {
    params.cursor = pagination.nextCursor
  }
  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      params[key] = value.trim()
    }
  })
  return params
}

const fetchSubscriptions = async (append = false) => {
  if (append && !pagination.nextCursor) return
  loading.value = true
  error.value = null
  try {
    const params = buildParams(append)
    const response = await apiClient.get('/admin/subscriptions', { params })
    if (!response?.success) {
      throw new Error(response?.message || '获取订阅数据失败')
    }
    const payload = response.data || {}
    const list = payload.subscriptions || []
    subscriptions.value = append ? [...subscriptions.value, ...list] : list
    pagination.cursor = payload.pagination?.cursor ?? null
    pagination.nextCursor = payload.pagination?.nextCursor ?? null
    pagination.limit = payload.pagination?.limit || pagination.limit
  } catch (err) {
    console.error('获取订阅失败:', err)
    error.value = err?.message || '获取订阅数据失败'
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  pagination.cursor = null
  pagination.nextCursor = null
  fetchSubscriptions(false)
}

const resetFilters = () => {
  filters.userId = ''
  filters.planId = ''
  filters.status = ''
  applyFilters()
}

const loadMore = () => fetchSubscriptions(true)

const formatStatus = (status) => {
  if (!status) return 'unknown'
  const normalized = status.toLowerCase()
  if (normalized === 'active') return 'active ✅'
  if (normalized === 'pending') return 'pending ⏳'
  if (normalized === 'cancelled') return 'cancelled ✖'
  if (normalized === 'expired') return 'expired ⛔'
  return normalized
}

const formatCurrency = (value, currency = 'CNY') => {
  const amount = Number(value) || 0
  return `${currency.toUpperCase()} ${amount.toFixed(2)}`
}

onMounted(() => {
  fetchSubscriptions()
})
</script>

<style scoped>
.btn {
  @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition;
}

.btn-primary {
  @apply bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60;
}

.btn-secondary {
  @apply bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600;
}

.btn-outline {
  @apply border border-indigo-400 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-200 dark:hover:bg-indigo-900/40;
}

.form-label {
  @apply mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400;
}

.form-input {
  @apply w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100 dark:placeholder-gray-500;
}
</style>
