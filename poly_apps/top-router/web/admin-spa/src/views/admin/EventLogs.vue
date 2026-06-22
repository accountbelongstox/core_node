<template>
  <div class="space-y-6">
    <!-- Domain Events -->
    <section class="glass-card rounded-2xl p-4 shadow-lg sm:p-6">
      <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-500">
            数据事件 / 域日志
          </p>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Domain Events</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            实时查看订阅、订单等核心实体触发的领域事件，支持按实体/类型筛选与分页加载。
          </p>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span
            class="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200"
          >
            <i class="fas fa-database mr-1" />
            {{ domainEvents.length }} 条
          </span>
        </div>
      </header>

      <form class="mb-4 grid gap-3 md:grid-cols-5" @submit.prevent="applyDomainEventFilters">
        <div>
          <label class="form-label">Entity Type</label>
          <input
            v-model="domainEventFilters.entityType"
            class="form-input"
            placeholder="例如 subscription、order"
            type="text"
          />
        </div>
        <div>
          <label class="form-label">Entity ID</label>
          <input
            v-model="domainEventFilters.entityId"
            class="form-input"
            placeholder="ID 或 UUID"
            type="text"
          />
        </div>
        <div>
          <label class="form-label">Event Type</label>
          <input
            v-model="domainEventFilters.eventType"
            class="form-input"
            placeholder="created / usage_recorded 等"
            type="text"
          />
        </div>
        <div>
          <label class="form-label">每页条数</label>
          <select
            v-model.number="domainEventPagination.limit"
            class="form-input"
            @change="applyDomainEventFilters"
          >
            <option v-for="option in limitOptions" :key="`event-limit-${option}`" :value="option">
              {{ option }}
            </option>
          </select>
        </div>
        <div class="flex items-end gap-2">
          <button class="btn btn-primary flex-1" :disabled="domainEventLoading" type="submit">
            <i class="fas fa-search mr-2" />
            查询
          </button>
          <button class="btn btn-secondary flex-1" type="button" @click="resetDomainEventFilters">
            重置
          </button>
        </div>
      </form>

      <div
        v-if="domainEventError"
        class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200"
      >
        {{ domainEventError }}
      </div>

      <div
        v-if="domainEventLoading && domainEvents.length === 0"
        class="flex items-center justify-center py-10 text-sm text-gray-500"
      >
        <i class="fas fa-circle-notch mr-2 animate-spin" />
        正在加载事件...
      </div>

      <div
        v-if="!domainEventLoading && domainEvents.length === 0"
        class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        暂无事件记录，稍后再试或调整筛选条件。
      </div>

      <div v-if="domainEvents.length > 0" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800/70">
            <tr>
              <th
                class="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                ID
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                实体
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                事件
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Payload
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Metadata
              </th>
              <th
                class="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                时间
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900/60">
            <tr v-for="event in domainEvents" :key="`domain-event-${event.id}`">
              <td class="px-3 py-3 font-mono text-sm text-gray-500">#{{ event.id }}</td>
              <td class="px-3 py-3 text-sm">
                <div class="font-semibold text-gray-900 dark:text-gray-100">
                  {{ event.entityType }}
                </div>
                <div class="break-all font-mono text-xs text-gray-500">
                  {{ event.entityId }}
                </div>
              </td>
              <td class="px-3 py-3 text-sm">
                <span
                  class="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200"
                >
                  {{ event.eventType }}
                </span>
              </td>
              <td class="px-3 py-3 text-sm">
                <pre v-if="event.payload" class="json-preview">{{ formatJson(event.payload) }}</pre>
                <span v-else class="text-xs text-gray-400">-</span>
              </td>
              <td class="px-3 py-3 text-sm">
                <pre v-if="event.metadata" class="json-preview">{{
                  formatJson(event.metadata)
                }}</pre>
                <span v-else class="text-xs text-gray-400">-</span>
              </td>
              <td class="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                <div>{{ formatDate(event.createdAt) }}</div>
                <div class="text-xs text-gray-400">{{ formatRelativeTime(event.createdAt) }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasMoreDomainEvents" class="mt-4 flex justify-center">
        <button
          class="btn btn-outline"
          :disabled="domainEventLoading"
          @click="loadMoreDomainEvents"
        >
          <i v-if="domainEventLoading" class="fas fa-circle-notch mr-2 animate-spin" />
          加载更多
        </button>
      </div>
    </section>

    <!-- Audit Logs -->
    <section class="glass-card rounded-2xl p-4 shadow-lg sm:p-6">
      <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-amber-500">管理员审计</p>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Logs</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            跟踪后台操作、敏感变更与 IP 来源，支持按管理员 / 操作 / 目标类型查找。
          </p>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span
            class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
          >
            <i class="fas fa-user-shield mr-1" />
            {{ auditLogs.length }} 条
          </span>
        </div>
      </header>

      <form class="mb-4 grid gap-3 md:grid-cols-5" @submit.prevent="applyAuditLogFilters">
        <div>
          <label class="form-label">Admin ID / Username</label>
          <input
            v-model="auditLogFilters.adminId"
            class="form-input"
            placeholder="UUID 或用户名"
            type="text"
          />
        </div>
        <div>
          <label class="form-label">Action</label>
          <input
            v-model="auditLogFilters.action"
            class="form-input"
            placeholder="例如 create_api_key"
            type="text"
          />
        </div>
        <div>
          <label class="form-label">Target Type</label>
          <input
            v-model="auditLogFilters.targetType"
            class="form-input"
            placeholder="client / api_key 等"
            type="text"
          />
        </div>
        <div>
          <label class="form-label">每页条数</label>
          <select
            v-model.number="auditLogPagination.limit"
            class="form-input"
            @change="applyAuditLogFilters"
          >
            <option v-for="option in limitOptions" :key="`audit-limit-${option}`" :value="option">
              {{ option }}
            </option>
          </select>
        </div>
        <div class="flex items-end gap-2">
          <button class="btn btn-primary flex-1" :disabled="auditLogLoading" type="submit">
            <i class="fas fa-search mr-2" />
            查询
          </button>
          <button class="btn btn-secondary flex-1" type="button" @click="resetAuditLogFilters">
            重置
          </button>
        </div>
      </form>

      <div
        v-if="auditLogError"
        class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-200"
      >
        {{ auditLogError }}
      </div>

      <div
        v-if="auditLogLoading && auditLogs.length === 0"
        class="flex items-center justify-center py-10 text-sm text-gray-500"
      >
        <i class="fas fa-circle-notch mr-2 animate-spin" />
        正在加载审计日志...
      </div>

      <div
        v-if="!auditLogLoading && auditLogs.length === 0"
        class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        暂无审计记录，稍后再试或调整筛选条件。
      </div>

      <div v-if="auditLogs.length > 0" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800/70">
            <tr>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                操作
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Admin
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Target
              </th>
              <th
                class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Metadata
              </th>
              <th
                class="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                IP / 时间
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900/60">
            <tr v-for="log in auditLogs" :key="`audit-log-${log.id}`">
              <td class="px-3 py-3 text-sm">
                <div class="font-semibold text-gray-900 dark:text-gray-100">
                  {{ log.action }}
                </div>
                <div class="text-xs text-gray-500">#{{ log.id }}</div>
              </td>
              <td class="px-3 py-3 text-sm">
                <div class="font-semibold text-gray-900 dark:text-gray-100">
                  {{ log.adminUsername || '-' }}
                </div>
                <div class="break-all font-mono text-xs text-gray-500">
                  {{ log.adminId || '—' }}
                </div>
              </td>
              <td class="px-3 py-3 text-sm">
                <div class="text-sm text-gray-800 dark:text-gray-200">
                  {{ log.targetType || '-' }}
                </div>
                <div class="break-all font-mono text-xs text-gray-500">
                  {{ log.targetId || '—' }}
                </div>
              </td>
              <td class="px-3 py-3 text-sm">
                <pre v-if="log.metadata" class="json-preview">{{ formatJson(log.metadata) }}</pre>
                <span v-else class="text-xs text-gray-400">-</span>
              </td>
              <td class="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                <div class="text-xs text-gray-500">IP: {{ log.ipAddress || '-' }}</div>
                <div>{{ formatDate(log.createdAt) }}</div>
                <div class="text-xs text-gray-400">{{ formatRelativeTime(log.createdAt) }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasMoreAuditLogs" class="mt-4 flex justify-center">
        <button class="btn btn-outline" :disabled="auditLogLoading" @click="loadMoreAuditLogs">
          <i v-if="auditLogLoading" class="fas fa-circle-notch mr-2 animate-spin" />
          加载更多
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { apiClient } from '@/config/api'
import { formatDate, formatRelativeTime } from '@/utils/format'

const limitOptions = Object.freeze([25, 50, 100, 200])

// Domain events state
const domainEvents = ref([])
const domainEventFilters = reactive({
  entityType: '',
  entityId: '',
  eventType: ''
})
const domainEventPagination = reactive({
  limit: 50,
  cursor: null,
  nextCursor: null
})
const domainEventLoading = ref(false)
const domainEventError = ref(null)

// Audit logs state
const auditLogs = ref([])
const auditLogFilters = reactive({
  adminId: '',
  action: '',
  targetType: ''
})
const auditLogPagination = reactive({
  limit: 50,
  cursor: null,
  nextCursor: null
})
const auditLogLoading = ref(false)
const auditLogError = ref(null)

const hasMoreDomainEvents = computed(() => Boolean(domainEventPagination.nextCursor))
const hasMoreAuditLogs = computed(() => Boolean(auditLogPagination.nextCursor))

const buildParams = (filters, pagination, append) => {
  const params = {
    limit: pagination.limit || 50
  }

  if (append && pagination.nextCursor) {
    params.cursor = pagination.nextCursor
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) {
        params[key] = trimmed
      }
    }
  })

  return params
}

const handleError = (setter, error, fallbackMessage) => {
  console.error(fallbackMessage, error)
  setter.value = error?.message || fallbackMessage
}

const formatJson = (value) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  try {
    if (typeof value === 'string') {
      return JSON.stringify(JSON.parse(value), null, 2)
    }
    return JSON.stringify(value, null, 2)
  } catch (err) {
    return String(value)
  }
}

const fetchDomainEvents = async (append = false) => {
  if (append && !domainEventPagination.nextCursor) return
  domainEventLoading.value = true
  domainEventError.value = null
  try {
    const params = buildParams(domainEventFilters, domainEventPagination, append)
    const response = await apiClient.get('/admin/domain-events', { params })
    if (!response?.success) {
      throw new Error(response?.message || '获取领域事件失败')
    }
    const payload = response.data || {}
    const list = payload.events || []
    domainEvents.value = append ? [...domainEvents.value, ...list] : list
    domainEventPagination.cursor = payload.pagination?.cursor ?? null
    domainEventPagination.nextCursor = payload.pagination?.nextCursor ?? null
    domainEventPagination.limit = payload.pagination?.limit || domainEventPagination.limit
  } catch (error) {
    handleError(domainEventError, error, '获取领域事件失败')
  } finally {
    domainEventLoading.value = false
  }
}

const fetchAuditLogs = async (append = false) => {
  if (append && !auditLogPagination.nextCursor) return
  auditLogLoading.value = true
  auditLogError.value = null
  try {
    const params = buildParams(auditLogFilters, auditLogPagination, append)
    const response = await apiClient.get('/admin/audit-logs', { params })
    if (!response?.success) {
      throw new Error(response?.message || '获取审计日志失败')
    }
    const payload = response.data || {}
    const list = payload.logs || []
    auditLogs.value = append ? [...auditLogs.value, ...list] : list
    auditLogPagination.cursor = payload.pagination?.cursor ?? null
    auditLogPagination.nextCursor = payload.pagination?.nextCursor ?? null
    auditLogPagination.limit = payload.pagination?.limit || auditLogPagination.limit
  } catch (error) {
    handleError(auditLogError, error, '获取审计日志失败')
  } finally {
    auditLogLoading.value = false
  }
}

const applyDomainEventFilters = () => {
  domainEventPagination.cursor = null
  domainEventPagination.nextCursor = null
  fetchDomainEvents(false)
}

const resetDomainEventFilters = () => {
  domainEventFilters.entityType = ''
  domainEventFilters.entityId = ''
  domainEventFilters.eventType = ''
  applyDomainEventFilters()
}

const loadMoreDomainEvents = () => fetchDomainEvents(true)

const applyAuditLogFilters = () => {
  auditLogPagination.cursor = null
  auditLogPagination.nextCursor = null
  fetchAuditLogs(false)
}

const resetAuditLogFilters = () => {
  auditLogFilters.adminId = ''
  auditLogFilters.action = ''
  auditLogFilters.targetType = ''
  applyAuditLogFilters()
}

const loadMoreAuditLogs = () => fetchAuditLogs(true)

onMounted(() => {
  fetchDomainEvents()
  fetchAuditLogs()
})

defineExpose({
  refreshDomainEvents: applyDomainEventFilters,
  refreshAuditLogs: applyAuditLogFilters
})
</script>

<style scoped>
.json-preview {
  @apply max-h-36 overflow-auto rounded-md bg-gray-900/80 p-2 font-mono text-xs text-green-200;
}

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
