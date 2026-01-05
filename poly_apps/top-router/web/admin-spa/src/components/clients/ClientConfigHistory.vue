<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
    @click.self="handleClose"
  >
    <div
      class="relative w-full max-w-5xl rounded-lg bg-white shadow-2xl dark:bg-gray-900 md:max-h-[90vh] md:overflow-hidden"
    >
      <!-- Header -->
      <div
        class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600"
          >
            <i class="fas fa-history text-lg text-white" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">配置历史</h3>
            <p class="text-sm text-gray-500 dark:text-gray-300">{{ client.name }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input v-model="autoRefreshEnabled" class="rounded border-gray-300" type="checkbox" />
            自动刷新
          </label>
          <button
            class="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            @click="handleClose"
          >
            <i class="fas fa-times text-xl" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="max-h-[calc(90vh-140px)] overflow-y-auto p-6">
        <div class="space-y-4 lg:flex lg:gap-4 lg:space-y-0">
          <!-- Timeline -->
          <div class="lg:w-2/5">
            <div class="mb-4 flex items-center justify-between">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                历史版本 ({{ filteredHistory.length }})
              </h4>
              <button
                class="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                :disabled="loading"
                @click="loadHistory"
              >
                <i :class="['fas mr-1', loading ? 'fa-spinner fa-spin' : 'fa-sync-alt']" />
                刷新
              </button>
            </div>

            <div
              v-if="error"
              class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200"
            >
              <p class="mb-2 font-medium">加载失败</p>
              <p class="mb-3">{{ error }}</p>
              <button
                class="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-800/50 dark:text-red-100"
                @click="loadHistory"
              >
                重试
              </button>
            </div>

            <div
              v-else-if="filteredHistory.length === 0 && !loading"
              class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            >
              暂无配置历史
            </div>

            <ul v-else class="space-y-3">
              <li
                v-for="entry in filteredHistory"
                :key="entry.id"
                :class="[
                  'rounded-lg border px-4 py-3 text-sm transition hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-gray-800',
                  selectedEntry?.id === entry.id
                    ? 'border-blue-400 bg-blue-50 dark:border-blue-500/60 dark:bg-gray-800'
                    : 'border-gray-200 dark:border-gray-700'
                ]"
                @click="selectEntry(entry)"
              >
                <div
                  class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
                >
                  <span>版本 {{ entry.version }}</span>
                  <span>{{ formatDate(entry.appliedAt) }}</span>
                </div>
                <p class="mt-1 font-medium text-gray-900 dark:text-gray-100">
                  {{ entry.summary || '配置更新' }}
                </p>
                <div class="mt-1 flex flex-wrap gap-2 text-xs">
                  <span
                    class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {{ entry.operator || '系统' }}
                  </span>
                  <span
                    :class="[
                      'rounded-full px-2 py-0.5',
                      entry.requiresRestart
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300'
                    ]"
                  >
                    {{ entry.requiresRestart ? '需重启' : '无需重启' }}
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <!-- Detail -->
          <div class="lg:w-3/5">
            <div
              v-if="selectedEntry"
              class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="space-y-1">
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                    版本 {{ selectedEntry.version }} 详情
                  </h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    应用时间：{{ formatDate(selectedEntry.appliedAt, true) }}
                  </p>
                  <p class="text-sm text-gray-600 dark:text-gray-300">
                    <span class="font-medium">摘要：</span>
                    {{ selectedEntry.summary || '未提供' }}
                  </p>
                  <div class="flex flex-wrap gap-2 text-xs">
                    <span
                      class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300"
                    >
                      操作人：{{ selectedEntry.operator || '系统' }}
                    </span>
                    <span
                      :class="[
                        'rounded-full px-2 py-0.5',
                        selectedEntry.requiresRestart
                          ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-200'
                          : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-200'
                      ]"
                    >
                      {{ selectedEntry.requiresRestart ? '需重启' : '无需重启' }}
                    </span>
                  </div>
                </div>
                <div
                  class="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
                >
                  <label class="flex items-center gap-1">
                    <input v-model="showDiffOnly" type="checkbox" />
                    仅显示差异
                  </label>
                  <button
                    class="rounded-lg border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-900/20"
                    :disabled="rollbackLoading || !selectedEntry.appliedConfig"
                    @click="rollbackToVersion"
                  >
                    <i :class="['fas mr-1', rollbackLoading ? 'fa-spinner fa-spin' : 'fa-undo']" />
                    {{ rollbackLoading ? '回滚中…' : '回滚到此版本' }}
                  </button>
                </div>
              </div>

              <div
                v-if="rollbackAlert.message"
                :class="[
                  'mb-3 rounded-lg border px-3 py-2 text-xs',
                  rollbackAlert.type === 'error'
                    ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'
                    : 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200'
                ]"
              >
                {{ rollbackAlert.message }}
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div
                  class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <p class="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    应用配置
                  </p>
                  <pre
                    class="scrollbar-thin max-h-60 overflow-auto text-xs text-gray-800 dark:text-gray-200"
                  >
                  {{ formatConfig(selectedEntry.appliedConfig) }}</pre
                  >
                </div>
                <div
                  class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <p
                    class="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
                  >
                    变更 diff
                    <span
                      v-if="selectedEntry.changes?.length"
                      class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-200"
                    >
                      {{ selectedEntry.changes.length }}
                    </span>
                  </p>
                  <div
                    v-if="selectedEntry.changes?.length"
                    class="scrollbar-thin max-h-60 space-y-2 overflow-auto text-xs text-gray-800 dark:text-gray-200"
                  >
                    <div
                      v-for="change in filteredChanges"
                      :key="change.path"
                      class="rounded border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800"
                    >
                      <p class="mb-1 font-semibold text-gray-700 dark:text-gray-200">
                        {{ change.path }}
                      </p>
                      <div class="space-y-1">
                        <div>
                          <span class="mr-1 text-[11px] font-semibold text-red-500">旧值</span>
                          <pre
                            class="scrollbar-thin max-h-20 overflow-auto rounded bg-red-50 p-2 text-[11px] text-red-700 dark:bg-red-900/20 dark:text-red-200"
                          >
                          {{ stringify(change.oldValue) }}</pre
                          >
                        </div>
                        <div>
                          <span class="mr-1 text-[11px] font-semibold text-green-600">新值</span>
                          <pre
                            class="scrollbar-thin max-h-20 overflow-auto rounded bg-green-50 p-2 text-[11px] text-green-700 dark:bg-green-900/20 dark:text-green-200"
                          >
                          {{ stringify(change.newValue) }}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p v-else class="text-xs text-gray-500 dark:text-gray-400">无详细差异信息</p>
                </div>
              </div>
            </div>
            <div
              v-else
              class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              选择左侧的历史版本查看详情
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="sticky bottom-0 flex justify-end border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <button
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          :disabled="loading"
          @click="handleClose"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { apiClient } from '@/config/api'

const props = defineProps({
  client: {
    type: Object,
    required: true
  },
  autoRefreshInterval: {
    type: Number,
    default: 60000
  }
})

const emit = defineEmits(['close', 'rolled-back'])

const loading = ref(false)
const error = ref(null)
const historyEntries = ref([])
const selectedEntry = ref(null)
const showDiffOnly = ref(false)
const autoRefreshEnabled = ref(true)
let autoRefreshTimer = null
const rollbackLoading = ref(false)
const rollbackAlert = ref({ type: null, message: null })
let rollbackAlertTimer = null

const filteredHistory = computed(() => historyEntries.value)
const filteredChanges = computed(() => {
  if (!selectedEntry.value?.changes) {
    return []
  }
  if (!showDiffOnly.value) {
    return selectedEntry.value.changes
  }
  return selectedEntry.value.changes.filter((change) => change.oldValue !== change.newValue)
})

const formatDate = (ts, showTime = false) => {
  if (!ts) return '未知时间'
  const date = new Date(ts)
  return showTime ? date.toLocaleString() : date.toLocaleDateString()
}

const stringify = (value) => {
  if (value === null || value === undefined) {
    return '无'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

const formatConfig = (config) => {
  if (!config) return '{}'
  return JSON.stringify(config, null, 2)
}

const selectEntry = (entry) => {
  selectedEntry.value = entry
}

const loadHistory = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await apiClient.get(`/admin/clients/${props.client.id}/config/history`)
    if (response.success) {
      historyEntries.value = response.data.entries || []
      if (!selectedEntry.value && historyEntries.value.length > 0) {
        selectedEntry.value = historyEntries.value[0]
      } else if (selectedEntry.value) {
        const updated = historyEntries.value.find((entry) => entry.id === selectedEntry.value.id)
        selectedEntry.value = updated || historyEntries.value[0] || null
      }
    } else {
      throw new Error(response.error || '加载失败')
    }
  } catch (err) {
    console.error('Failed to load config history:', err)
    error.value = err.message || '无法加载配置历史'
  } finally {
    loading.value = false
  }
}

const showRollbackAlert = (type, message) => {
  rollbackAlert.value = { type, message }
  clearRollbackAlertTimer()
  if (message) {
    rollbackAlertTimer = setTimeout(() => {
      rollbackAlert.value = { type: null, message: null }
      rollbackAlertTimer = null
    }, 5000)
  }
}

const rollbackToVersion = async () => {
  if (!selectedEntry.value?.appliedConfig) {
    showRollbackAlert('error', '该版本未保存配置内容，无法回滚')
    return
  }
  const confirmed = window.confirm?.(
    `确定回滚到版本 ${selectedEntry.value.version} 吗？此操作将立即下发配置。`
  )
  if (!confirmed) {
    return
  }
  rollbackLoading.value = true
  showRollbackAlert(null, null)
  try {
    const response = await apiClient.post(`/admin/clients/${props.client.id}/config`, {
      config: selectedEntry.value.appliedConfig,
      applyImmediately: true,
      summary: `回滚到版本 ${selectedEntry.value.version}`
    })
    if (!response.success) {
      throw new Error(response.error || '回滚失败')
    }
    showRollbackAlert('success', `已回滚至版本 ${selectedEntry.value.version}`)
    emit('rolled-back', {
      clientId: props.client.id,
      version: selectedEntry.value.version,
      data: response.data
    })
    await loadHistory()
  } catch (err) {
    showRollbackAlert('error', err.message || '回滚失败')
  } finally {
    rollbackLoading.value = false
  }
}

const startAutoRefresh = () => {
  clearAutoRefresh()
  if (!autoRefreshEnabled.value || props.autoRefreshInterval <= 0) {
    return
  }
  autoRefreshTimer = setInterval(loadHistory, props.autoRefreshInterval)
}

const clearAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

const clearRollbackAlertTimer = () => {
  if (rollbackAlertTimer) {
    clearTimeout(rollbackAlertTimer)
    rollbackAlertTimer = null
  }
}

const handleClose = () => {
  if (!loading.value) {
    emit('close')
  }
}

onMounted(() => {
  loadHistory()
  startAutoRefresh()
})

onBeforeUnmount(() => {
  clearAutoRefresh()
  clearRollbackAlertTimer()
})

watch(autoRefreshEnabled, () => {
  startAutoRefresh()
})

watch(
  () => props.client.id,
  () => {
    loadHistory()
  }
)
</script>
