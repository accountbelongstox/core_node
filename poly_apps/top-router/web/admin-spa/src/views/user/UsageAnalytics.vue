<template>
  <section class="space-y-6">
    <header>
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-500">usage</p>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">调用分析</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">实时了解 tokens、请求数与成功率</p>
    </header>

    <div class="grid gap-4 md:grid-cols-3">
      <StatCard
        v-for="card in summaryCards"
        :key="card.label"
        :icon="card.icon"
        :icon-color="card.iconColor"
        :title="card.label"
        :value="card.value"
      >
        <template v-if="card.trend" #subtitle>
          <span class="text-xs text-emerald-500">{{ card.trend }}</span>
        </template>
      </StatCard>
    </div>

    <div
      class="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
    >
      <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">近期调用</h2>
        <select
          v-model="range"
          class="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="24h">最近 24 小时</option>
          <option value="7d">7 天</option>
          <option value="30d">30 天</option>
        </select>
      </header>

      <div v-if="loading" class="flex items-center justify-center py-16 text-slate-500">
        <div class="loading-spinner mr-3" />
        加载中...
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="usage in usageBreakdown"
          :key="usage.model"
          class="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-800/50"
        >
          <div class="flex items-center justify-between">
            <p class="font-semibold text-slate-800 dark:text-slate-200">{{ usage.model }}</p>
            <p class="text-slate-500">{{ usage.tokens.toLocaleString() }} tokens</p>
          </div>
          <div class="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              class="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
              :style="{ width: usage.percentage + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/toast'
import StatCard from '@/components/common/StatCard.vue'

const userStore = useUserStore()
const usageStats = ref(null)
const range = ref('7d')
const loading = ref(false)

const loadUsage = async () => {
  loading.value = true
  try {
    usageStats.value = await userStore.getUserUsageStats({ range: range.value })
  } catch (error) {
    showToast(error.message || '获取用量失败', 'error')
  } finally {
    loading.value = false
  }
}

watch(range, loadUsage)
onMounted(loadUsage)

const summaryCards = computed(() => {
  if (!usageStats.value) {
    return [
      { label: '请求总数', value: '--', icon: 'fas fa-chart-line', iconColor: 'info' },
      { label: 'Tokens', value: '--', icon: 'fas fa-coins', iconColor: 'warning' },
      { label: '成功率', value: '--', icon: 'fas fa-bullseye', iconColor: 'success' }
    ]
  }

  return [
    {
      label: '请求总数',
      value: usageStats.value.totalRequests?.toLocaleString() || '--',
      icon: 'fas fa-chart-line',
      iconColor: 'info'
    },
    {
      label: 'Tokens',
      value: usageStats.value.totalTokens
        ? `${(usageStats.value.totalTokens / 1_000_000).toFixed(2)}M`
        : '--',
      trend: usageStats.value.tokensChange ? `较昨日 ${usageStats.value.tokensChange}` : '',
      icon: 'fas fa-coins',
      iconColor: 'warning'
    },
    {
      label: '成功率',
      value: `${usageStats.value.successRate || '--'}%`,
      icon: 'fas fa-bullseye',
      iconColor: 'success'
    }
  ]
})

const usageBreakdown = computed(() => {
  if (!usageStats.value?.models) return []
  return usageStats.value.models.map((model) => ({
    model: model.name,
    tokens: model.tokens,
    percentage: model.percentage
  }))
})
</script>
