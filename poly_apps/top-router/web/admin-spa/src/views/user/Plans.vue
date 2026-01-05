<template>
  <div class="min-h-screen p-4 sm:p-6 lg:p-8">
    <!-- 页面标题 -->
    <div class="mb-8 text-center">
      <h1 class="mb-3 text-3xl font-bold text-gray-900 dark:text-gray-100 sm:text-4xl">
        选择适合您的订阅计划
      </h1>
    </div>

    <!-- 计费周期切换 -->
    <div class="mb-10 flex justify-center">
      <div aria-label="Billing cycle" class="glass-strong inline-flex rounded-lg p-1" role="group">
        <button
          class="rounded-md px-6 py-2 text-sm font-semibold transition-all sm:px-8 sm:text-base"
          :class="
            billingCycle === 'monthly'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
          "
          @click="billingCycle = 'monthly'"
        >
          月付
        </button>
        <button
          class="relative rounded-md px-6 py-2 text-sm font-semibold transition-all sm:px-8 sm:text-base"
          :class="
            billingCycle === 'yearly'
              ? 'bg-blue-500 text-white shadow-lg'
              : 'text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
          "
          @click="billingCycle = 'yearly'"
        >
          年付
          <span class="ml-2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
            省17%
          </span>
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="loading-spinner h-12 w-12" />
    </div>

    <!-- 订阅计划卡片 -->
    <div v-else class="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="glass-strong relative flex flex-col rounded-2xl p-6 shadow-xl transition-transform hover:scale-105 sm:p-8"
        :class="{
          'ring-4 ring-blue-500': plan.id === 'pro',
          'ring-2 ring-blue-300 dark:ring-blue-700': plan.id !== 'pro'
        }"
      >
        <!-- 推荐标签 -->
        <div
          v-if="plan.id === 'pro'"
          class="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-1 text-xs font-bold text-white sm:text-sm"
        >
          最受欢迎
        </div>

        <!-- 计划名称 -->
        <div class="mb-4">
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">
            {{ plan.name }}
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ plan.description }}
          </p>
        </div>

        <!-- 价格 -->
        <div class="mb-6">
          <div class="flex items-baseline">
            <span class="text-4xl font-extrabold text-gray-900 dark:text-gray-100 sm:text-5xl">
              ¥{{ getPrice(plan) }}
            </span>
            <span class="ml-2 text-base text-gray-600 dark:text-gray-400">
              /{{ billingCycle === 'monthly' ? '月' : '年' }}
            </span>
          </div>
          <p
            v-if="billingCycle === 'yearly' && plan.pricing.yearlyDiscount > 0"
            class="mt-1 text-xs text-green-600 dark:text-green-400 sm:text-sm"
          >
            <i class="fas fa-tag mr-1" />节省 ¥{{
              Math.round(plan.pricing.monthly * 12 - plan.pricing.yearly)
            }}
          </p>
        </div>

        <!-- 配额信息 -->
        <div class="mb-6 flex-1 space-y-3 border-t border-gray-300 pt-6 dark:border-gray-600">
          <div class="flex items-start text-sm sm:text-base">
            <i class="fas fa-key mr-3 mt-1 text-blue-500" />
            <span class="text-gray-700 dark:text-gray-300">
              {{ formatQuota(plan.quotas.maxApiKeys) }} API Keys
            </span>
          </div>
          <div class="flex items-start text-sm sm:text-base">
            <i class="fas fa-sync mr-3 mt-1 text-green-500" />
            <span class="text-gray-700 dark:text-gray-300">
              {{ formatQuota(plan.quotas.maxRequests) }} 请求/月
            </span>
          </div>
          <div class="flex items-start text-sm sm:text-base">
            <i class="fas fa-file-alt mr-3 mt-1 text-purple-500" />
            <span class="text-gray-700 dark:text-gray-300">
              {{ formatTokens(plan.quotas.maxTokens) }} tokens/月
            </span>
          </div>
          <div class="flex items-start text-sm sm:text-base">
            <i class="fas fa-yen-sign mr-3 mt-1 text-yellow-500" />
            <span class="text-gray-700 dark:text-gray-300">
              {{ formatQuota(plan.quotas.maxCostPerMonth) }} 费用限额/月
            </span>
          </div>
        </div>

        <!-- 特性列表 -->
        <div class="mb-6 space-y-2 border-t border-gray-300 pt-6 dark:border-gray-600">
          <div
            v-for="(feature, index) in getFeaturesList(plan)"
            :key="index"
            class="flex items-start text-xs sm:text-sm"
          >
            <i
              class="mr-2 mt-0.5"
              :class="
                feature.enabled
                  ? 'fas fa-check-circle text-green-500'
                  : 'fas fa-times-circle text-gray-400'
              "
            />
            <span
              :class="
                feature.enabled
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 line-through dark:text-gray-600'
              "
            >
              {{ feature.label }}
            </span>
          </div>
        </div>

        <!-- 可用模型 -->
        <div class="mb-6 border-t border-gray-300 pt-6 dark:border-gray-600">
          <p class="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300 sm:text-sm">
            可用模型：
          </p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="model in getModelNames(plan)"
              :key="model"
              class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {{ model }}
            </span>
          </div>
        </div>

        <!-- 订阅按钮 -->
        <button
          class="btn btn-primary w-full px-4 py-3 text-base font-semibold sm:px-6 sm:text-lg"
          :disabled="subscribing === plan.id"
          @click="handleSubscribe(plan)"
        >
          <div v-if="subscribing === plan.id" class="loading-spinner mr-2" />
          <template v-else>
            <i class="fas fa-rocket mr-2" />
            立即订阅
          </template>
        </button>
      </div>
    </div>

    <!-- 底部说明 -->
    <div class="mx-auto mt-12 max-w-3xl text-center">
      <div
        class="glass-strong rounded-xl p-6 text-sm text-gray-600 dark:text-gray-400 sm:text-base"
      >
        <p class="mb-2">
          <i class="fas fa-info-circle mr-2 text-blue-500" />
          所有计划都支持随时升级或降级，费用按比例计算
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'

const router = useRouter()

const loading = ref(true)
const subscribing = ref(null)
const billingCycle = ref('monthly') // 'monthly' or 'yearly'
const plans = ref([])

const normalizePlan = (plan) => {
  const amount = Number(plan.amount || 0)
  const cycle = String(plan.cycle || '').toLowerCase()
  const pricing = plan.pricing || {}
  const monthly =
    pricing.monthly ?? (cycle === 'yearly' && amount ? Math.round(amount / 12) : amount || 0)
  const yearly = pricing.yearly ?? (cycle === 'monthly' ? amount * 12 : amount || 0)

  return {
    description: plan.description || '',
    ...plan,
    pricing: {
      monthly,
      yearly,
      yearlyDiscount: pricing.yearlyDiscount || 0
    },
    quotas: plan.quotas || {
      maxApiKeys: '—',
      maxRequests: '—',
      maxTokens: '—',
      maxCostPerMonth: '—'
    },
    features: {
      apiAccess: true,
      prioritySupport: false,
      sla: false,
      availableModels: [],
      ...(plan.features || {})
    }
  }
}

// 获取订阅计划
const fetchPlans = async () => {
  loading.value = true

  try {
    const result = await apiClient.get('/subscriptions/plans')

    if (result.success) {
      plans.value = (result.plans || []).map((plan) => normalizePlan(plan))
    } else {
      showToast('获取订阅计划失败', 'error')
    }
  } catch (error) {
    console.error('Error fetching plans:', error)
    showToast(error.message || '获取订阅计划失败', 'error')
  } finally {
    loading.value = false
  }
}

// 获取价格
const getPrice = (plan) => {
  if (billingCycle.value === 'yearly') {
    return plan.pricing?.yearly ?? plan.amount ?? 0
  }
  return plan.pricing?.monthly ?? plan.amount ?? 0
}

// 格式化配额
const formatQuota = (value) => {
  if (value === -1) return '无限制'
  if (typeof value === 'string') return value
  return value.toLocaleString()
}

// 格式化tokens
const formatTokens = (value) => {
  if (value === -1) return '无限制'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return value.toLocaleString()
}

// 获取特性列表
const getFeaturesList = (plan) => {
  const featureLabels = {
    apiAccess: 'API 访问',
    prioritySupport: '优先支持',
    sla: 'SLA 保障'
  }

  const features = plan.features || {}
  return Object.entries(features)
    .filter(([key]) => key !== 'availableModels')
    .map(([key, enabled]) => ({
      label: featureLabels[key] || key,
      enabled
    }))
}

// 获取模型名称（简化）
const getModelNames = (plan) => {
  const modelMap = {
    'claude-3-5-haiku-20241022': 'Haiku 3.5',
    'claude-3-haiku-20240307': 'Haiku 3',
    'claude-3-5-sonnet-20241022': 'Sonnet 3.5',
    'claude-3-5-sonnet-20240620': 'Sonnet 3.5',
    'claude-3-opus-20240229': 'Opus 3'
  }

  // 去重
  const uniqueModels = new Set()
  const models = Array.isArray(plan.features?.availableModels) ? plan.features.availableModels : []
  models.forEach((model) => {
    const name = modelMap[model] || model
    uniqueModels.add(name)
  })

  return Array.from(uniqueModels)
}

// 处理订阅
const handleSubscribe = async (plan) => {
  subscribing.value = plan.id

  try {
    // 所有计划都是付费版，跳转到支付页面（支付成功后会创建订阅）
    showToast('即将跳转到支付页面...', 'info')
    router.push({
      path: '/app/payment-methods',
      query: {
        planId: plan.id,
        billingCycle: billingCycle.value
      }
    })
  } catch (error) {
    console.error('Error subscribing:', error)
    showToast(error.message || '订阅失败', 'error')
  } finally {
    subscribing.value = null
  }
}

onMounted(() => {
  fetchPlans()
})
</script>

<style scoped>
/* 组件特定样式已经在全局样式中定义 */
</style>
