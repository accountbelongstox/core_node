<template>
  <section class="relative py-12 sm:py-16 lg:py-20">
    <!-- Background Decoration -->
    <div class="absolute inset-0 -z-10 overflow-hidden">
      <div
        class="absolute left-[20%] top-0 h-96 w-96 rounded-full bg-blue-500/10 blur-[100px]"
      ></div>
      <div
        class="absolute bottom-0 right-[20%] h-96 w-96 rounded-full bg-purple-500/10 blur-[100px]"
      ></div>
    </div>

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="text-center">
        <h2
          class="text-base font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400"
        >
          Pricing
        </h2>
        <h1
          class="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl md:text-5xl"
        >
          灵活透明的订阅计划
        </h1>
        <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          统一调度 Claude、Sonnet、Haiku 等模型，按调用量灵活扩展。
          <br class="hidden sm:block" />
          无隐藏费用，随时取消。
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="mt-16 flex justify-center py-12">
        <div
          class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"
        ></div>
      </div>

      <div v-else class="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-8">
        <article
          v-for="plan in plans"
          :key="plan.id"
          class="relative flex flex-col rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
          :class="[
            plan.featured
              ? 'z-10 border-indigo-500 bg-white shadow-xl ring-1 ring-indigo-500 dark:bg-slate-800'
              : 'border-slate-200 bg-white/60 shadow-lg backdrop-blur-lg dark:border-slate-700 dark:bg-slate-800/60'
          ]"
        >
          <div
            v-if="plan.featured"
            class="absolute -top-5 left-0 right-0 mx-auto w-32 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1 text-center text-sm font-medium text-white shadow-md"
          >
            最受欢迎
          </div>

          <div class="p-8 sm:p-10">
            <h3
              class="text-lg font-semibold leading-8 tracking-tight"
              :class="[
                plan.featured
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-900 dark:text-white'
              ]"
            >
              {{ plan.name }}
            </h3>
            <div
              class="mt-4 flex items-baseline text-5xl font-bold tracking-tight text-slate-900 dark:text-white"
            >
              <span v-if="typeof plan.price === 'number'">¥{{ plan.price }}</span>
              <span v-else>{{ plan.price }}</span>
              <span
                v-if="typeof plan.price === 'number'"
                class="text-lg font-medium text-slate-500 dark:text-slate-400"
                >/月</span
              >
            </div>
            <p class="mt-6 text-base leading-7 text-slate-600 dark:text-slate-300">
              {{ plan.description }}
            </p>
          </div>

          <div class="flex flex-1 flex-col justify-between p-8 pt-0 sm:p-10 sm:pt-0">
            <ul class="space-y-4">
              <li v-for="feature in plan.features" :key="feature" class="flex items-start">
                <div class="flex-shrink-0">
                  <svg
                    class="h-6 w-6 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                </div>
                <p class="ml-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {{ feature }}
                </p>
              </li>
            </ul>

            <div class="mt-8">
              <router-link
                class="inline-flex w-full items-center justify-center rounded-xl px-6 py-4 text-center text-base font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                :class="[
                  plan.featured
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl focus:ring-indigo-500'
                    : 'bg-slate-50 text-indigo-600 hover:bg-slate-100 dark:bg-slate-700 dark:text-indigo-400 dark:hover:bg-slate-600'
                ]"
                :to="{ path: '/auth/user-login', query: { redirect: '/app/plans', plan: plan.id } }"
              >
                {{ plan.price === '定制' ? '联系我们' : '立即开始' }}
              </router-link>
            </div>
          </div>
        </article>
      </div>

      <!-- Temporary Purchase Options -->
      <div class="mt-16">
        <div class="mb-8 text-center">
          <h3 class="text-2xl font-bold text-slate-900 dark:text-white">按需购买</h3>
          <p class="mt-2 text-slate-600 dark:text-slate-300">灵活补充，随时购买，无需长期承诺</p>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <!-- Day Pass Card -->
          <div
            class="glass-strong rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg"
                  >
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 class="text-xl font-bold text-slate-900 dark:text-white">日卡</h4>
                    <p class="text-sm text-slate-600 dark:text-slate-400">单日通行证</p>
                  </div>
                </div>
                <div class="mt-4 flex items-baseline gap-2">
                  <span class="text-4xl font-bold text-slate-900 dark:text-white">¥5</span>
                  <span class="text-slate-600 dark:text-slate-400">/天</span>
                </div>
                <ul class="mt-6 space-y-3">
                  <li class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        clip-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fill-rule="evenodd"
                      />
                    </svg>
                    <span>当日200次调用</span>
                  </li>
                  <li class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        clip-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fill-rule="evenodd"
                      />
                    </svg>
                    <span>所有模型</span>
                  </li>
                  <li class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        clip-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fill-rule="evenodd"
                      />
                    </svg>
                    <span class="font-semibold text-blue-600 dark:text-blue-400"
                      >新用户免费体验</span
                    >
                  </li>
                </ul>
                <button
                  class="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-center font-semibold text-white shadow-lg transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-xl"
                  @click="$router.push('/app/plans')"
                >
                  立即购买
                </button>
              </div>
            </div>
          </div>

          <!-- Token Package Card -->
          <div
            class="glass-strong rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg"
                  >
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 class="text-xl font-bold text-slate-900 dark:text-white">加油包</h4>
                    <p class="text-sm text-slate-600 dark:text-slate-400">额度补充包</p>
                  </div>
                </div>
                <div class="mt-4 flex items-baseline gap-2">
                  <span class="text-4xl font-bold text-slate-900 dark:text-white">¥29</span>
                </div>
                <ul class="mt-6 space-y-3">
                  <li class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        clip-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fill-rule="evenodd"
                      />
                    </svg>
                    <span class="font-semibold">20M tokens</span>
                  </li>
                  <li class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        clip-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fill-rule="evenodd"
                      />
                    </svg>
                    <span>30天有效期</span>
                  </li>
                  <li class="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        clip-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fill-rule="evenodd"
                      />
                    </svg>
                    <span>可叠加使用</span>
                  </li>
                </ul>
                <button
                  class="mt-6 w-full rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-3 text-center font-semibold text-white shadow-lg transition-all hover:from-purple-600 hover:to-purple-700 hover:shadow-xl"
                  @click="$router.push('/app/plans')"
                >
                  立即购买
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Enterprise CTA -->
      <div
        class="mt-16 rounded-3xl bg-slate-900 px-6 py-12 shadow-2xl dark:bg-indigo-900/20 sm:p-16"
      >
        <div class="mx-auto max-w-xl lg:max-w-none">
          <div class="text-center">
            <h2 class="text-2xl font-bold tracking-tight text-white">需要企业级私有化部署？</h2>
            <p class="mx-auto mt-4 max-w-xl text-lg text-slate-300">
              我们提供完整的私有化部署方案，支持 VPC、多区域高可用、SSO 单点登录以及定制化的 SLA
              保障。
            </p>
            <div class="mt-8 flex justify-center">
              <router-link
                class="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-bold text-slate-900 transition-all hover:bg-slate-50 hover:shadow-lg"
                to="/contact"
              >
                联系销售团队
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { apiClient } from '@/config/api'

const loading = ref(true)
const plansData = ref([])

// Fetch plans from API
const fetchPlans = async () => {
  loading.value = true
  try {
    const result = await apiClient.get('/subscriptions/plans')
    if (result.success) {
      plansData.value = result.plans || []
    }
  } catch (error) {
    console.error('Error fetching plans:', error)
  } finally {
    loading.value = false
  }
}

// Transform API data to display format
const plans = computed(() => {
  return plansData.value.map((plan) => {
    // Format features array
    const features = []
    const quotas = plan.quotas || {}
    const planFeatures = plan.features || {}

    // Add quotas as features
    if (quotas.maxTokens !== undefined) {
      const tokens = quotas.maxTokens === -1 ? '无限' : formatTokens(quotas.maxTokens)
      features.push(`${tokens} tokens/月`)
    }

    if (quotas.maxRequests !== undefined) {
      const requests = quotas.maxRequests === -1 ? '无限' : formatNumber(quotas.maxRequests)
      features.push(`${requests} 请求/月`)
    }

    if (quotas.maxApiKeys !== undefined) {
      const keys = quotas.maxApiKeys === -1 ? '无限' : quotas.maxApiKeys
      features.push(`${keys} API Keys`)
    }

    // Add other features
    if (planFeatures.prioritySupport) {
      features.push('优先支持')
    }

    if (planFeatures.sla) {
      features.push('SLA 保障')
    }

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description || '',
      price: plan.pricing?.monthly ?? plan.amount ?? 0,
      featured: plan.id === 'pro',
      features
    }
  })
})

// Format tokens for display
const formatTokens = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return value.toLocaleString()
}

// Format numbers for display
const formatNumber = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return value.toLocaleString()
}

onMounted(() => {
  fetchPlans()
})
</script>
