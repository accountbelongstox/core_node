<template>
  <div class="min-h-screen p-4 sm:p-6 lg:p-8">
    <!-- 页面标题 -->
    <div class="mb-8">
      <h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100 sm:text-4xl">我的订阅</h1>
      <p class="text-base text-gray-600 dark:text-gray-400">管理您的订阅计划与订单状态</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="loading-spinner h-12 w-12" />
    </div>

    <!-- 无订阅状态 -->
    <div v-else-if="!subscription" class="mx-auto max-w-2xl">
      <div class="glass-strong rounded-xl p-8 text-center sm:p-12">
        <i class="fas fa-inbox mb-4 text-5xl text-gray-400 dark:text-gray-600" />
        <h2 class="mb-3 text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">
          您还没有订阅
        </h2>
        <p class="mb-6 text-gray-600 dark:text-gray-400">
          选择适合您的订阅计划，开始使用我们的服务
        </p>
        <router-link class="btn btn-primary inline-flex items-center px-6 py-3" to="/app/plans">
          <i class="fas fa-shopping-cart mr-2" />
          查看订阅计划
        </router-link>
      </div>
    </div>

    <!-- 订阅详情 -->
    <div v-else class="mx-auto max-w-6xl space-y-6">
      <!-- 订阅概览卡片 -->
      <div class="glass-strong rounded-2xl p-6 shadow-xl sm:p-8">
        <div class="mb-6 flex flex-col items-start justify-between sm:flex-row sm:items-center">
          <div>
            <div class="mb-2 flex items-center gap-3">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                {{ subscription.planName }}
              </h2>
              <span
                class="rounded-full px-3 py-1 text-xs font-bold sm:text-sm"
                :class="getStatusClass(subscription.status)"
              >
                {{ getStatusText(subscription.status) }}
              </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
              {{ getBillingCycleText(subscription.billingCycle) }}
            </p>
          </div>
          <div class="mt-4 text-left sm:mt-0 sm:text-right">
            <div class="text-3xl font-extrabold text-gray-900 dark:text-gray-100 sm:text-4xl">
              ¥{{ subscription.amount }}
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
              /{{ subscription.billingCycle === 'monthly' ? '月' : '年' }}
            </p>
          </div>
        </div>

        <!-- 订阅时间信息 -->
        <div class="grid gap-4 border-t border-gray-300 pt-6 dark:border-gray-600 sm:grid-cols-3">
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 sm:text-sm">
              开始日期
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 sm:text-base">
              {{ formatDate(subscription.startDate) }}
            </p>
          </div>
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 sm:text-sm">
              结束日期
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 sm:text-base">
              {{ formatDate(subscription.endDate) }}
            </p>
          </div>
          <div>
            <p class="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 sm:text-sm">
              剩余天数
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 sm:text-base">
              <i class="fas fa-calendar-alt mr-1 text-blue-500" />
              {{ daysRemaining }} 天
            </p>
          </div>
        </div>

        <!-- 自动续费状态 - 已隐藏 -->
        <!-- <div
          v-if="subscription.status === 'active'"
          class="mt-6 flex items-center justify-between rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20"
        >
          <div class="flex items-center">
            <i
              class="mr-3 text-xl"
              :class="
                subscription.autoRenew
                  ? 'fas fa-sync-alt text-blue-500'
                  : 'fas fa-pause-circle text-gray-500'
              "
            />
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ subscription.autoRenew ? '自动续费已开启' : '自动续费已关闭' }}
              </p>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                {{ subscription.autoRenew ? '订阅到期时将自动续费' : '订阅到期后将不会自动续费' }}
              </p>
            </div>
          </div>
        </div> -->
      </div>

      <!-- 操作按钮 -->
      <div class="glass-strong rounded-2xl p-6 shadow-xl sm:p-8">
        <h3 class="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">
          订阅管理
        </h3>

        <!-- 待支付状态提示 -->
        <div
          v-if="subscription.status === 'pending'"
          class="mb-6 rounded-lg border-2 border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-900/20"
        >
          <div class="flex items-start">
            <i
              class="fas fa-exclamation-circle mr-3 mt-1 text-xl text-yellow-600 dark:text-yellow-400"
            />
            <div>
              <p class="font-semibold text-yellow-800 dark:text-yellow-200">订阅待支付</p>
              <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                您的订阅尚未支付，请尽快完成支付以激活服务。
              </p>
            </div>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <!-- 继续支付 - 待支付状态 -->
          <button
            v-if="subscription.status === 'pending'"
            class="btn border-2 border-orange-500 bg-orange-500 px-6 py-3 text-white hover:bg-orange-600 sm:col-span-2"
            @click="handleContinuePayment"
          >
            <i class="fas fa-credit-card mr-2" />
            继续支付
          </button>

          <router-link
            class="btn border-2 border-blue-500 bg-blue-50 px-6 py-3 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
            to="/app/plans"
          >
            <i class="fas fa-shopping-cart mr-2" />
            选择新计划
          </router-link>
          <router-link
            class="btn border-2 border-green-500 bg-green-50 px-6 py-3 text-green-700 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
            to="/app/billing"
          >
            <i class="fas fa-receipt mr-2" />
            查看账单
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'

const router = useRouter()

const loading = ref(true)
const subscription = ref(null)
const orders = ref([])

const statusMap = {
  paid: 'active',
  pending: 'pending',
  cancelled: 'cancelled',
  expired: 'expired',
  failed: 'expired',
  refunded: 'cancelled'
}

// 获取订阅信息
const fetchSubscription = async () => {
  loading.value = true

  try {
    const result = await apiClient.get('/subscriptions/orders')
    if (result.success) {
      orders.value = result.orders || []
      const sorted = [...orders.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      const preferred =
        sorted.find((order) => order.status === 'paid') ||
        sorted.find((order) => order.status === 'pending') ||
        sorted[0]
      subscription.value = preferred ? mapOrderToSubscription(preferred) : null
    }
  } catch (error) {
    console.error('Error fetching subscription:', error)
    showToast(error.message || '获取订阅信息失败', 'error')
  } finally {
    loading.value = false
  }
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    active: '活跃',
    cancelled: '已取消',
    expired: '已过期',
    pending: '待支付'
  }
  return statusMap[status] || status
}

// 获取状态样式
const getStatusClass = (status) => {
  const classMap = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    cancelled: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
  }
  return classMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
}

// 获取计费周期文本
const getBillingCycleText = (cycle) => {
  return cycle === 'monthly' ? '月度订阅' : '年度订阅'
}

// 继续支付 - 跳转到支付页面（未支付订阅）
const handleContinuePayment = () => {
  router.push({
    path: '/app/payment-methods',
    query: {
      orderId: subscription.value.orderId
    }
  })
}

const daysRemaining = computed(() => {
  if (!subscription.value || !subscription.value.endDate) return 0
  const end = new Date(subscription.value.endDate)
  const diff = end.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
})

const mapOrderToSubscription = (order) => {
  const billingCycle = order.billingCycle || 'monthly'
  const startDate = order.updatedAt || order.createdAt
  let endDate = order.expiresAt || null
  if (order.status === 'paid' && startDate) {
    const baseTime = new Date(startDate).getTime()
    const cycleDays = billingCycle === 'yearly' ? 365 : 30
    endDate = new Date(baseTime + cycleDays * 24 * 60 * 60 * 1000).toISOString()
  }
  return {
    orderId: order.id,
    planId: order.planId,
    planName: order.planName || order.planId,
    amount: order.amount || 0,
    billingCycle,
    status: statusMap[order.status] || order.status,
    startDate,
    endDate
  }
}

onMounted(() => {
  fetchSubscription()
})
</script>

<style scoped>
/* 组件特定样式已经在全局样式中定义 */
</style>
