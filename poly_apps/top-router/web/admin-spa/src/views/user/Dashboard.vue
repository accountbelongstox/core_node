<template>
  <div class="space-y-8">
    <!-- Header Section -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">控制台</h1>
        <p class="mt-2 text-slate-500">欢迎回来，{{ userStore.userName }}</p>
      </div>
    </div>

    <!-- Overview Content -->
    <div class="animate-fade-in space-y-8">
      <!-- Subscription Status Card -->
      <div
        class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-1 shadow-xl"
      >
        <div
          class="absolute inset-0 opacity-20"
          :style="{ backgroundImage: `url(${gridBackgroundUrl})` }"
        ></div>
        <div class="relative rounded-xl bg-white/10 p-6 backdrop-blur-sm sm:p-8">
          <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <h2 class="text-2xl font-bold text-white">
                  {{ subscription?.planName || '无有效订阅' }}
                </h2>
                <span
                  :class="[
                    'rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                    subscription?.status === 'active'
                      ? 'border border-emerald-500/20 bg-emerald-500/20 text-emerald-100'
                      : 'border border-slate-500/20 bg-slate-500/20 text-slate-200'
                  ]"
                >
                  {{ subscription?.status === 'active' ? '活跃' : '未激活' }}
                </span>
              </div>
              <p class="text-sm text-indigo-100/80">
                {{ subscription ? getRenewalText(subscription) : '订阅以解锁全部功能' }}
              </p>
            </div>

            <div class="flex items-center gap-8">
              <div v-if="subscription">
                <p class="mb-1 text-xs font-medium uppercase tracking-wider text-indigo-100">
                  剩余时间
                </p>
                <p class="text-3xl font-bold text-white">
                  {{ daysRemaining }} <span class="text-sm font-normal text-indigo-100">天</span>
                </p>
              </div>
              <div v-if="subscription" class="hidden h-12 w-px bg-white/20 md:block"></div>
              <div>
                <p class="mb-1 text-xs font-medium uppercase tracking-wider text-indigo-100">
                  月度费用
                </p>
                <p class="text-3xl font-bold text-white">¥{{ subscription?.amount || '0' }}</p>
              </div>
              <router-link
                class="ml-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-indigo-600 shadow-lg transition-colors hover:bg-indigo-50"
                to="/app/subscription"
              >
                管理
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Active Keys -->
        <div
          class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg"
        >
          <div
            class="absolute right-0 top-0 p-4 opacity-5 transition-opacity group-hover:opacity-10"
          >
            <i class="fas fa-key text-4xl text-emerald-600"></i>
          </div>
          <p class="text-sm font-medium text-slate-500">活跃 API 密钥</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">{{ apiKeysStats.active }}</p>
          <div class="mt-4 flex items-center gap-2 text-xs text-emerald-600">
            <span class="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            运行中
          </div>
        </div>

        <!-- Total Requests -->
        <div
          class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg"
        >
          <div
            class="absolute right-0 top-0 p-4 opacity-5 transition-opacity group-hover:opacity-10"
          >
            <i class="fas fa-exchange-alt text-4xl text-blue-600"></i>
          </div>
          <p class="text-sm font-medium text-slate-500">总请求数</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">
            {{ formatNumber(userProfile?.totalUsage?.requests || 0) }}
          </p>
          <div class="mt-4 text-xs text-slate-500">累计使用</div>
        </div>

        <!-- Token Usage -->
        <div
          class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg"
        >
          <div
            class="absolute right-0 top-0 p-4 opacity-5 transition-opacity group-hover:opacity-10"
          >
            <i class="fas fa-coins text-4xl text-purple-600"></i>
          </div>
          <p class="text-sm font-medium text-slate-500">Token 使用量</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">
            {{ formatNumber(userProfile?.totalUsage?.inputTokens || 0) }}
          </p>
          <div class="mt-4 text-xs text-slate-500">输入 Token 处理量</div>
        </div>

        <!-- Total Cost -->
        <div
          class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg"
        >
          <div
            class="absolute right-0 top-0 p-4 opacity-5 transition-opacity group-hover:opacity-10"
          >
            <i class="fas fa-dollar-sign text-4xl text-yellow-600"></i>
          </div>
          <p class="text-sm font-medium text-slate-500">总支出</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">
            ${{ (userProfile?.totalUsage?.totalCost || 0).toFixed(4) }}
          </p>
          <div class="mt-4 text-xs text-slate-500">累计消费</div>
        </div>
      </div>

      <!-- Quota Usage Section -->
      <div
        v-if="subscriptionStats"
        class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 class="mb-6 text-lg font-semibold text-slate-900">配额使用</h3>

        <div class="grid gap-8 md:grid-cols-3">
          <!-- Requests Progress -->
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-slate-500">请求数</span>
              <span :class="getUsageColorClass(subscriptionStats.usagePercentage.requests)">
                {{ subscriptionStats.usagePercentage.requests.toFixed(1) }}%
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="getProgressBarColorClass(subscriptionStats.usagePercentage.requests)"
                :style="{ width: `${Math.min(100, subscriptionStats.usagePercentage.requests)}%` }"
              ></div>
            </div>
            <div class="flex justify-between text-xs text-slate-500">
              <span>{{ formatNumber(subscriptionStats.subscription.usage.requests) }} 已用</span>
              <span>{{ formatNumber(subscriptionStats.plan.quotas.maxRequests) }} 限额</span>
            </div>
          </div>

          <!-- Tokens Progress -->
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-slate-500">Token 数</span>
              <span :class="getUsageColorClass(subscriptionStats.usagePercentage.tokens)">
                {{ subscriptionStats.usagePercentage.tokens.toFixed(1) }}%
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="getProgressBarColorClass(subscriptionStats.usagePercentage.tokens)"
                :style="{ width: `${Math.min(100, subscriptionStats.usagePercentage.tokens)}%` }"
              ></div>
            </div>
            <div class="flex justify-between text-xs text-slate-500">
              <span
                >{{
                  formatNumber(
                    subscriptionStats.subscription.usage.inputTokens +
                      subscriptionStats.subscription.usage.outputTokens
                  )
                }}
                已用</span
              >
              <span>{{ formatNumber(subscriptionStats.plan.quotas.maxTokens) }} 限额</span>
            </div>
          </div>

          <!-- Cost Progress -->
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-slate-500">月度预算</span>
              <span :class="getUsageColorClass(subscriptionStats.usagePercentage.cost)">
                {{ subscriptionStats.usagePercentage.cost.toFixed(1) }}%
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="getProgressBarColorClass(subscriptionStats.usagePercentage.cost)"
                :style="{ width: `${Math.min(100, subscriptionStats.usagePercentage.cost)}%` }"
              ></div>
            </div>
            <div class="flex justify-between text-xs text-slate-500">
              <span>¥{{ subscriptionStats.subscription.usage.totalCost.toFixed(2) }} 已用</span>
              <span>¥{{ subscriptionStats.plan.quotas.maxCostPerMonth }} 限额</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Temporary Quotas Section -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-slate-900">临时配额</h3>
          <router-link
            class="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            to="/app/plans"
          >
            购买配额 →
          </router-link>
        </div>

        <div v-if="temporaryQuotas.length > 0" class="grid gap-4 md:grid-cols-2">
          <div
            v-for="quota in temporaryQuotas"
            :key="quota.id"
            class="rounded-xl border border-slate-200 bg-slate-50 p-5"
          >
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-semibold text-slate-900">{{ quota.planName }}</h4>
                <p class="mt-1 text-sm text-slate-500">
                  {{ quota.type === 'daily' ? '日卡' : '加油包' }}
                  <span v-if="quota.isGift" class="ml-2 text-blue-600">🎁 免费赠送</span>
                </p>
              </div>
            </div>

            <!-- Usage Progress -->
            <div class="mt-4">
              <div v-if="quota.type === 'daily'" class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-slate-600">已用次数</span>
                  <span class="font-semibold text-slate-900">
                    {{ quota.usage.requests }} / {{ quota.limits.maxRequests }}
                  </span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    class="h-full rounded-full bg-blue-500 transition-all"
                    :style="{
                      width:
                        ((quota.usage.requests / quota.limits.maxRequests) * 100).toFixed(1) + '%'
                    }"
                  ></div>
                </div>
              </div>

              <div v-else class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-slate-600">已用额度</span>
                  <span class="font-semibold text-slate-900">
                    {{ formatTokens(quota.usage.inputTokens + quota.usage.outputTokens) }} / 20M
                  </span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    class="h-full rounded-full bg-purple-500 transition-all"
                    :style="{
                      width:
                        (
                          ((quota.usage.inputTokens + quota.usage.outputTokens) /
                            quota.limits.maxTokens) *
                          100
                        ).toFixed(1) + '%'
                    }"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Expiry Info -->
            <div class="mt-4 text-xs text-slate-500">
              有效期至: {{ new Date(quota.expiresAt).toLocaleString('zh-CN') }}
            </div>
          </div>
        </div>

        <div
          v-else
          class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"
        >
          <p class="text-slate-500">暂无临时配额</p>
          <router-link
            class="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            to="/app/plans"
          >
            购买日卡或加油包
          </router-link>
        </div>
      </div>

      <!-- Usage Stats Component -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <UserUsageStats />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { apiClient } from '@/config/api'
import UserUsageStats from '@/components/user/UserUsageStats.vue'
import gridBackgroundUrl from '@/assets/grid.svg'

const userStore = useUserStore()

const userProfile = ref(null)
const apiKeysStats = ref({ active: 0, deleted: 0 })
const subscription = ref(null)
const subscriptionStats = ref(null)
const temporaryQuotas = ref([])

// Helper functions for styling
const getUsageColorClass = (percentage) => {
  if (percentage >= 100) return 'text-red-400'
  if (percentage >= 80) return 'text-yellow-400'
  return 'text-emerald-400'
}

const getProgressBarColorClass = (percentage) => {
  if (percentage >= 100) return 'bg-red-500'
  if (percentage >= 80) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

const daysRemaining = computed(() => {
  if (!subscription.value || !subscription.value.endDate) return 0
  const now = new Date()
  const end = new Date(subscription.value.endDate)
  const diff = end - now
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
})

const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

const loadUserProfile = async () => {
  try {
    userProfile.value = await userStore.getUserProfile()
  } catch (error) {
    console.error('Failed to load user profile:', error)
  }
}

const loadSubscription = async () => {
  try {
    const result = await apiClient.get('/subscriptions/orders')
    if (result.success) {
      const orders = result.orders || []
      const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      const preferred =
        sorted.find((order) => order.status === 'paid') ||
        sorted.find((order) => order.status === 'pending') ||
        sorted[0]
      subscription.value = preferred ? mapOrderToSubscription(preferred) : null
    } else {
      subscription.value = null
    }
  } catch (error) {
    console.error('Failed to load subscription:', error)
  }
}

const loadApiKeysStats = async () => {
  try {
    const allApiKeys = await userStore.getUserApiKeys(true)
    const activeKeys = allApiKeys.filter(
      (key) => !(key.isDeleted === 'true' || key.deletedAt) && key.isActive
    )
    const deletedKeys = allApiKeys.filter((key) => key.isDeleted === 'true' || key.deletedAt)
    apiKeysStats.value = { active: activeKeys.length, deleted: deletedKeys.length }
  } catch (error) {
    console.error('Failed to load API keys stats:', error)
    apiKeysStats.value = { active: 0, deleted: 0 }
  }
}

const getRenewalText = (plan) => {
  if (!plan.endDate) return '续费日期 -'
  return `续费日期 ${new Date(plan.endDate).toLocaleDateString()}`
}

const mapOrderToSubscription = (order) => {
  const statusMap = {
    paid: 'active',
    pending: 'pending',
    cancelled: 'cancelled',
    expired: 'expired',
    failed: 'expired',
    refunded: 'cancelled'
  }
  const billingCycle = order.billingCycle || 'monthly'
  const startDate = order.updatedAt || order.createdAt
  let endDate = order.expiresAt || null
  if (order.status === 'paid' && startDate) {
    const baseTime = new Date(startDate).getTime()
    const cycleDays = billingCycle === 'yearly' ? 365 : 30
    endDate = new Date(baseTime + cycleDays * 24 * 60 * 60 * 1000).toISOString()
  }
  return {
    planName: order.planName || order.planId || '订阅',
    amount: order.amount || 0,
    billingCycle,
    status: statusMap[order.status] || order.status,
    endDate
  }
}

const formatTokens = (tokens) => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`
  return tokens
}

onMounted(() => {
  loadUserProfile()
  loadApiKeysStats()
  loadSubscription()
})
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
