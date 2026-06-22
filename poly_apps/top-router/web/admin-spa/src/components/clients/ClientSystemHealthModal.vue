<template>
  <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
    <div
      class="flex w-full max-w-4xl flex-col rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900"
      style="max-height: 90vh"
    >
      <div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
            系统健康 · {{ client.name }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Client ID: <span class="font-mono">{{ client.id }}</span>
          </p>
          <p v-if="lastUpdated" class="text-sm text-gray-400 dark:text-gray-500">
            更新时间：{{ lastUpdated }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800"
            :disabled="loading"
            @click="fetchSystemHealth"
          >
            <i
              :class="[
                'fas mr-1',
                loading ? 'fa-spinner fa-spin text-gray-400' : 'fa-sync-alt text-gray-500'
              ]"
            ></i>
            刷新
          </button>
          <button
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="$emit('close')"
          >
            关闭
          </button>
        </div>
      </div>

      <div v-if="loading" class="py-12 text-center">
        <div
          class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
        ></div>
        <p class="text-sm text-gray-500 dark:text-gray-400">正在获取系统健康状态...</p>
      </div>

      <div
        v-else-if="errorMessage"
        class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-200"
      >
        <div class="flex items-center justify-between">
          <p>{{ errorMessage }}</p>
          <button
            class="rounded border border-red-200 px-3 py-1 text-sm text-red-700 transition-colors hover:bg-red-100 dark:border-red-400/40 dark:text-red-200 dark:hover:bg-red-900/40"
            @click="fetchSystemHealth"
          >
            重试
          </button>
        </div>
      </div>

      <div
        v-else-if="!healthPayload"
        class="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        暂无系统健康数据
      </div>

      <div v-else class="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <section
            class="rounded-2xl border border-gray-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 dark:border-slate-800 dark:from-blue-950/40 dark:to-indigo-900/20"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-blue-500">
                  CPU 1 分钟负载
                </p>
                <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {{ formatPercentDisplay(cpuSummary.percent, 1) }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  平均值 {{ cpuSummary.loadAverage }}
                </p>
              </div>
              <div class="relative h-16 w-16">
                <div class="absolute inset-0 rounded-full bg-white/70 dark:bg-slate-900/80"></div>
                <div
                  class="absolute inset-0 rounded-full"
                  :style="buildGaugeStyle(cpuSummary.percent, 'rgba(59,130,246,0.95)')"
                ></div>
                <div
                  class="absolute inset-2 flex items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  {{ formatPercentDisplay(cpuSummary.percent, 0) }}
                </div>
              </div>
            </div>
            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
              核心：{{ cpuSummary.cores || '-' }} · {{ cpuSummary.model || '未知型号' }}
            </p>
          </section>

          <section
            class="rounded-2xl border border-gray-100 bg-gradient-to-br from-emerald-50 to-green-50 p-5 dark:border-slate-800 dark:from-emerald-950/40 dark:to-green-900/20"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-emerald-500">
                  内存使用率
                </p>
                <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {{ formatPercentDisplay(memorySummary.percent, 1) }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  已用 {{ memorySummary.used }} / {{ memorySummary.total }}
                </p>
              </div>
              <div class="flex h-16 w-16 items-center justify-center">
                <svg class="h-16 w-16" viewBox="0 0 36 36">
                  <path
                    class="text-gray-200 dark:text-gray-800"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="text-emerald-500"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    :stroke-dasharray="[memorySummary.percent || 0, 100].join(',')"
                    stroke-linecap="round"
                    stroke-width="4"
                  />
                </svg>
              </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">可用 {{ memorySummary.free }}</p>
          </section>

          <section
            v-if="diskSummary.present"
            class="rounded-2xl border border-gray-100 bg-gradient-to-br from-amber-50 to-orange-50 p-5 dark:border-slate-800 dark:from-orange-950/40 dark:to-amber-900/10"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-amber-500">磁盘占用</p>
                <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {{ formatPercentDisplay(diskSummary.percent, 1) }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">已用 {{ diskSummary.used }}</p>
              </div>
              <div class="w-20">
                <div class="h-2 rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <div
                    class="h-2 rounded-full bg-amber-500"
                    :style="buildBarStyle(diskSummary.percent)"
                  ></div>
                </div>
                <p class="mt-1 text-right text-[10px] text-gray-400 dark:text-gray-500">
                  可用 {{ diskSummary.available }}
                </p>
              </div>
            </div>
          </section>

          <section
            class="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-gray-100 p-5 dark:border-slate-800 dark:from-slate-900/60 dark:to-gray-900/30"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                  系统运行时间
                </p>
                <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {{ uptimeSummary.uptime }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ uptimeSummary.platform }} · {{ uptimeSummary.release }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-xs text-gray-500">客户端</p>
                <p class="font-semibold text-gray-800 dark:text-gray-100">{{ client.name }}</p>
              </div>
            </div>
          </section>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <section
            class="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60"
          >
            <h4 class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">系统信息</h4>
            <dl class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <div class="flex justify-between">
                <dt>平台</dt>
                <dd>{{ healthPayload.system?.platform }} ({{ healthPayload.system?.arch }})</dd>
              </div>
              <div class="flex justify-between">
                <dt>主机名</dt>
                <dd>{{ healthPayload.system?.hostname || '-' }}</dd>
              </div>
              <div class="flex justify-between">
                <dt>系统版本</dt>
                <dd>{{ healthPayload.system?.type }} {{ healthPayload.system?.release }}</dd>
              </div>
              <div class="flex justify-between">
                <dt>系统运行时间</dt>
                <dd>{{ healthPayload.system?.uptime?.formatted || '-' }}</dd>
              </div>
            </dl>
          </section>
          <section
            class="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60"
          >
            <h4 class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">进程</h4>
            <dl class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <div class="flex justify-between">
                <dt>PID</dt>
                <dd>{{ healthPayload.process?.pid || '-' }}</dd>
              </div>
              <div class="flex justify-between">
                <dt>运行时间</dt>
                <dd>{{ healthPayload.process?.uptime?.formatted || '-' }}</dd>
              </div>
              <div class="flex justify-between">
                <dt>Node 版本</dt>
                <dd>{{ healthPayload.process?.nodeVersion || '-' }}</dd>
              </div>
              <div class="flex justify-between">
                <dt>内存占用</dt>
                <dd>{{ healthPayload.process?.memory?.rss || '-' }}</dd>
              </div>
            </dl>
            <div v-if="processMemoryStats.length" class="mt-4 flex flex-wrap gap-2">
              <div
                v-for="stat in processMemoryStats"
                :key="stat.label"
                class="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
              >
                <span class="text-gray-400">{{ stat.label }}：</span>{{ stat.value }}
              </div>
            </div>
          </section>
        </div>

        <section
          v-if="Array.isArray(healthPayload.network) && healthPayload.network.length > 0"
          class="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60"
        >
          <h4 class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">网络接口</h4>
          <div class="space-y-3">
            <div
              v-for="iface in healthPayload.network"
              :key="iface.name"
              class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/60"
            >
              <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">
                接口：{{ iface.name }}
              </p>
              <ul class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                <li v-for="address in iface.addresses || []" :key="address.address">
                  <span class="font-mono">{{ address.family }}:</span> {{ address.address }}
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'

const props = defineProps({
  client: {
    type: Object,
    required: true
  }
})

// eslint-disable-next-line no-unused-vars
const emit = defineEmits(['close'])

const loading = ref(true)
const errorMessage = ref('')
const payload = ref(null)

const healthPayload = computed(() => payload.value?.data || payload.value || null)
const lastUpdated = computed(() => {
  if (!payload.value) return ''
  const ts = payload.value.timestamp || healthPayload.value?.timestamp
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('zh-CN')
  } catch {
    return ''
  }
})

const parsePercentValue = (value) => {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(\.\d+)?/)
    return match ? Number(match[0]) : null
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const clampPercentValue = (value) => {
  if (value === null || value === undefined) return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Math.max(0, Math.min(num, 100))
}

const computePercentFromLoad = (value, cores) => {
  const load = Number(value)
  if (!Number.isFinite(load)) return null
  const cpuCores = Number(cores) || 1
  return cpuCores <= 0 ? null : (load / cpuCores) * 100
}

const buildGaugeStyle = (percent, color) => {
  const safe = clampPercentValue(percent) ?? 0
  const degrees = (safe / 100) * 360
  return {
    background: `conic-gradient(${color} ${degrees}deg, rgba(148,163,184,0.3) ${degrees}deg)`
  }
}

const buildBarStyle = (percent) => {
  const safe = clampPercentValue(percent)
  return {
    width: `${safe ?? 0}%`
  }
}
const formatPercentDisplay = (value, digits = 2) => {
  const parsed = parsePercentValue(value)
  if (parsed === null || Number.isNaN(parsed)) {
    return '-'
  }
  return `${parsed.toFixed(digits)}%`
}

const cpuSummary = computed(() => {
  const cores = healthPayload.value?.cpu?.cores || 0
  const average = healthPayload.value?.cpu?.loadAverage?.['1min']
  const percent =
    parsePercentValue(healthPayload.value?.cpu?.loadPercent?.['1min']) ??
    computePercentFromLoad(average, cores)

  return {
    percent: clampPercentValue(percent),
    loadAverage: average || '-',
    cores: cores || null,
    model: healthPayload.value?.cpu?.model || ''
  }
})

const memorySummary = computed(() => {
  const percent = clampPercentValue(parsePercentValue(healthPayload.value?.memory?.usagePercent))
  return {
    percent,
    total: healthPayload.value?.memory?.total || '-',
    used: healthPayload.value?.memory?.used || '-',
    free: healthPayload.value?.memory?.free || '-'
  }
})

const diskSummary = computed(() => {
  const percent = clampPercentValue(parsePercentValue(healthPayload.value?.disk?.usePercent))
  return {
    present: Boolean(healthPayload.value?.disk),
    percent,
    total: healthPayload.value?.disk?.total || '-',
    used: healthPayload.value?.disk?.used || '-',
    available: healthPayload.value?.disk?.available || '-'
  }
})

const uptimeSummary = computed(() => ({
  uptime: healthPayload.value?.system?.uptime?.formatted || '-',
  uptimeSeconds: healthPayload.value?.system?.uptime?.seconds || null,
  platform: healthPayload.value?.system?.platform || '-',
  release: healthPayload.value?.system?.release || '-'
}))

const processMemoryStats = computed(() => {
  const procMem = healthPayload.value?.process?.memory
  if (!procMem) {
    return []
  }
  const stats = [
    { label: 'RSS', value: procMem.rss },
    { label: 'Heap 已用', value: procMem.heapUsed },
    { label: 'Heap 总计', value: procMem.heapTotal },
    { label: '外部', value: procMem.external }
  ]
  return stats.filter((stat) => stat.value)
})

const fetchSystemHealth = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await apiClient.get(`/admin/clients/${props.client.id}/system-health`)
    if (response.success) {
      payload.value = response.data
    } else {
      throw new Error(response.message || '获取系统健康状态失败')
    }
  } catch (error) {
    console.error('Failed to fetch system health:', error)
    const message = error.response?.data?.message || error.message || '获取系统健康状态失败'
    errorMessage.value = message
    showToast(message, 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchSystemHealth()
})
</script>
