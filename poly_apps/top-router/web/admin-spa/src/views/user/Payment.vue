<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-12 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
  >
    <div class="mx-auto max-w-2xl">
      <!-- Header -->
      <div class="mb-8 text-center">
        <router-link
          class="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          to="/app/subscription"
        >
          <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M15 19l-7-7 7-7"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          返回订阅管理
        </router-link>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">完成支付</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">选择支付方式完成订阅</p>
      </div>

      <!-- Payment Card -->
      <div class="glass-strong overflow-hidden rounded-2xl">
        <!-- Order Summary -->
        <div
          class="border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600 p-6 dark:border-gray-700"
        >
          <div class="text-white">
            <h2 class="text-xl font-semibold">订单摘要</h2>
            <div v-if="subscriptionPlan" class="mt-4 space-y-2">
              <div class="flex justify-between">
                <span class="opacity-90">订阅计划</span>
                <span class="font-semibold">{{ subscriptionPlan.name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="opacity-90">计费周期</span>
                <span class="font-semibold">{{ billingCycleText }}</span>
              </div>
              <div class="mt-4 flex items-end justify-between border-t border-white/20 pt-4">
                <span class="text-lg">应付金额</span>
                <div class="text-right">
                  <div class="text-3xl font-bold">¥{{ totalAmount }}</div>
                  <div v-if="billingCycle === 'yearly'" class="text-sm opacity-75">
                    节省 ¥{{ savedAmount }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Methods (Only show if not in payment process) -->
        <div v-if="!paymentCreated && !loading" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">选择支付方式</h3>
          <div class="space-y-3">
            <!-- Alipay - Temporarily disabled -->
            <!--
            <button
              :class="[
                'flex w-full items-center rounded-xl border-2 p-4 transition-all',
                selectedMethod === 'alipay'
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-600'
              ]"
              @click="selectedMethod = 'alipay'"
            >
              <div
                class="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500 text-white"
              >
                <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M3 3h18v11.5c-.5-.2-1.5-.5-3-.5-3 0-4.5 1.5-7 1.5s-4.5-1-7-1c-.5 0-1 .1-1 .1V3zm0 14.5s.5-.1 1-.1c2.5 0 4.5 1 7 1s4-1.5 7-1.5c1.5 0 2.5.3 3 .5V21H3v-3.5z"
                  />
                </svg>
              </div>
              <div class="ml-4 flex-1 text-left">
                <div class="font-semibold text-gray-900 dark:text-white">支付宝</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">推荐使用支付宝扫码支付</div>
              </div>
              <div v-if="selectedMethod === 'alipay'" class="ml-4">
                <svg
                  class="h-6 w-6 text-blue-500 dark:text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    clip-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    fill-rule="evenodd"
                  />
                </svg>
              </div>
            </button>
            -->

            <!-- WeChat Pay -->
            <button
              :class="[
                'flex w-full items-center rounded-xl border-2 p-4 transition-all',
                selectedMethod === 'wechat'
                  ? 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-900/20'
                  : 'border-gray-200 hover:border-green-300 dark:border-gray-700 dark:hover:border-green-600'
              ]"
              @click="selectedMethod = 'wechat'"
            >
              <div
                class="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500 text-white"
              >
                <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M8.5 11c-.8 0-1.5-.7-1.5-1.5S7.7 8 8.5 8s1.5.7 1.5 1.5S9.3 11 8.5 11zm7 0c-.8 0-1.5-.7-1.5-1.5S14.7 8 15.5 8 17 8.7 17 9.5 16.3 11 15.5 11zM12 2C6.5 2 2 6 2 11c0 3 1.7 5.8 4.5 7.4L6 22l4.5-2.5c.5.1 1 .1 1.5.1 5.5 0 10-4 10-9s-4.5-9-10-9z"
                  />
                </svg>
              </div>
              <div class="ml-4 flex-1 text-left">
                <div class="font-semibold text-gray-900 dark:text-white">微信支付</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">使用微信扫码支付</div>
              </div>
              <div v-if="selectedMethod === 'wechat'" class="ml-4">
                <svg
                  class="h-6 w-6 text-green-500 dark:text-green-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    clip-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    fill-rule="evenodd"
                  />
                </svg>
              </div>
            </button>
          </div>

          <!-- Create Payment Button -->
          <button
            class="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 font-semibold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-blue-500 disabled:hover:to-purple-600"
            :disabled="!selectedMethod"
            @click="createPayment"
          >
            立即支付
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="p-12">
          <div class="flex flex-col items-center justify-center">
            <div
              class="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"
            ></div>
            <p class="mt-4 text-gray-600 dark:text-gray-400">正在创建支付订单...</p>
          </div>
        </div>

        <!-- Payment QR Code (Desktop) -->
        <div v-if="paymentCreated && !isMobile && qrCodeUrl" class="p-6">
          <div class="text-center">
            <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              请使用{{ paymentMethodName }}扫码支付
            </h3>

            <!-- QR Code Display -->
            <div
              class="mx-auto mb-6 flex h-64 w-64 items-center justify-center rounded-2xl border-4 bg-white p-4 dark:bg-gray-800"
              :class="
                qrCodeDataUrl
                  ? 'border-gray-200 dark:border-gray-700'
                  : 'border-dashed border-gray-300 dark:border-gray-600'
              "
            >
              <!-- Show generated QR code if available -->
              <img
                v-if="qrCodeDataUrl"
                alt="Payment QR Code"
                class="h-full w-full object-contain"
                :src="qrCodeDataUrl"
              />
              <!-- Loading placeholder -->
              <div v-else class="text-center">
                <svg
                  class="mx-auto mb-2 h-16 w-16 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <p class="text-sm text-gray-500 dark:text-gray-400">二维码生成中...</p>
              </div>
            </div>

            <!-- Payment Status -->
            <div class="mb-4">
              <div class="flex items-center justify-center space-x-2">
                <div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                <span class="text-sm text-gray-600 dark:text-gray-400">等待支付...</span>
              </div>
            </div>

            <!-- Order Info -->
            <div class="rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">订单号</span>
                <span class="font-mono text-gray-900 dark:text-white">{{ orderId }}</span>
              </div>
              <div class="mt-2 flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">订单金额</span>
                <span class="font-semibold text-gray-900 dark:text-white">¥{{ totalAmount }}</span>
              </div>
              <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                订单将在 {{ expiryMinutes }} 分钟后过期
              </div>
            </div>

            <!-- Cancel Button -->
            <button
              class="mt-6 w-full rounded-xl border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              @click="cancelPayment"
            >
              取消支付
            </button>
          </div>
        </div>

        <!-- Payment Success -->
        <div v-if="paymentSuccess" class="p-6">
          <div class="text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
            >
              <svg
                class="h-10 w-10 text-green-500"
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
            <h3 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">支付成功！</h3>
            <p class="mb-6 text-gray-600 dark:text-gray-400">您的订阅已激活</p>

            <!-- API Key Display (新用户) -->
            <div v-if="apiKey" class="mb-6 rounded-xl bg-amber-50 p-6 dark:bg-amber-900/20">
              <div
                class="mb-4 flex items-center justify-center space-x-2 text-amber-600 dark:text-amber-400"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="font-semibold">您的 API Key</span>
              </div>

              <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">
                请妥善保存您的 API Key，此密钥仅显示一次！
              </p>

              <div class="mb-3 rounded-lg bg-white p-3 dark:bg-gray-800">
                <code class="block break-all font-mono text-sm text-gray-900 dark:text-white">{{
                  apiKey
                }}</code>
              </div>

              <button
                class="w-full rounded-lg border-2 border-amber-600 px-4 py-2 font-semibold text-amber-600 transition-colors hover:bg-amber-600 hover:text-white dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-400 dark:hover:text-gray-900"
                @click="copyApiKey"
              >
                <div class="flex items-center justify-center space-x-2">
                  <svg
                    v-if="!apiKeyCopied"
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  <span>{{ apiKeyCopied ? '已复制' : '复制 API Key' }}</span>
                </div>
              </button>
            </div>

            <!-- 续费提示（老用户） -->
            <div v-else class="mb-6 rounded-xl bg-blue-50 p-6 dark:bg-blue-900/20">
              <div
                class="mb-4 flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="font-semibold">订阅已续费</span>
              </div>

              <p class="mb-3 text-center text-sm text-gray-600 dark:text-gray-400">
                您的现有 API Key 已自动激活并延期
              </p>

              <div class="text-center">
                <router-link
                  class="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  to="/api-keys"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  <span>查看我的 API Keys</span>
                </router-link>
              </div>
            </div>

            <router-link
              class="inline-block rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 hover:shadow-xl"
              to="/app/subscription"
            >
              查看我的订阅
            </router-link>
          </div>
        </div>

        <!-- Payment Failed -->
        <div v-if="paymentFailed" class="p-6">
          <div class="text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
            >
              <svg
                class="h-10 w-10 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M6 18L18 6M6 6l12 12"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">支付失败</h3>
            <p class="mb-6 text-gray-600 dark:text-gray-400">
              {{ errorMessage || '支付过程中出现错误，请重试' }}
            </p>
            <button
              class="inline-block rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 hover:shadow-xl"
              @click="resetPayment"
            >
              重新支付
            </button>
          </div>
        </div>
      </div>

      <!-- Security Notice -->
      <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>支付过程采用SSL加密，确保您的支付安全</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiClient } from '@/config/api'
import QRCode from 'qrcode'

const route = useRoute()
const router = useRouter()

// State
const loading = ref(false)
const subscriptionPlan = ref(null)
const selectedMethod = ref('wechat') // Changed default to wechat since alipay is disabled
const paymentCreated = ref(false)
const paymentSuccess = ref(false)
const paymentFailed = ref(false)
const errorMessage = ref('')
const qrCodeUrl = ref('')
const qrCodeDataUrl = ref('') // For storing the generated QR code image
const orderId = ref('')
const orderSummary = ref(null)
const pollInterval = ref(null)
const apiKey = ref('') // API Key from server (暂不支持)
const apiKeyCopied = ref(false)

// Get params from route
const orderIdParam = route.query.orderId
const planId = ref(route.query.planId || '')
const billingCycle = ref(route.query.billingCycle || 'monthly')
const expiryMinutes = computed(() => {
  if (!orderSummary.value?.expiresAt) {
    return 30
  }
  const diffMs = new Date(orderSummary.value.expiresAt).getTime() - Date.now()
  if (!Number.isFinite(diffMs)) {
    return 30
  }
  return Math.max(1, Math.ceil(diffMs / (1000 * 60)))
})

// Detect mobile
const isMobile = computed(() => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
})

// Computed
const billingCycleText = computed(() => {
  return billingCycle.value === 'yearly' ? '年付' : '月付'
})

const totalAmount = computed(() => {
  if (orderSummary.value?.amount) {
    return orderSummary.value.amount
  }
  if (!subscriptionPlan.value) return 0

  if (billingCycle.value === 'yearly') {
    return subscriptionPlan.value.pricing.yearly
  }
  return subscriptionPlan.value.pricing.monthly
})

const savedAmount = computed(() => {
  if (!subscriptionPlan.value || billingCycle.value !== 'yearly') return 0

  const monthlyTotal = subscriptionPlan.value.pricing.monthly * 12
  return (monthlyTotal - subscriptionPlan.value.pricing.yearly).toFixed(0)
})

const paymentMethodName = computed(() => {
  return selectedMethod.value === 'alipay' ? '支付宝' : '微信'
})

const normalizePlan = (plan) => {
  const amount = Number(plan.amount || 0)
  const cycle = String(plan.cycle || '').toLowerCase()
  const pricing = plan.pricing || {}
  const monthly =
    pricing.monthly ?? (cycle === 'yearly' && amount ? Math.round(amount / 12) : amount || 0)
  const yearly = pricing.yearly ?? (cycle === 'monthly' ? amount * 12 : amount || 0)

  return {
    ...plan,
    pricing: {
      monthly,
      yearly,
      yearlyDiscount: pricing.yearlyDiscount || 0
    }
  }
}

const resolvePaymentUrl = (payment) => {
  if (!payment) return ''
  return payment.paymentUrl || payment.h5Url || payment.codeUrl || ''
}

// Methods
const loadSubscriptionPlan = async () => {
  try {
    // Get plan details
    const response = await apiClient.get('/subscriptions/plans')
    const plans = (response.plans || []).map((plan) => normalizePlan(plan))
    subscriptionPlan.value = plans.find((p) => p.id === planId.value)

    if (!subscriptionPlan.value) {
      errorMessage.value = '订阅计划不存在'
      paymentFailed.value = true
    }
  } catch (error) {
    console.error('Failed to load subscription plan:', error)
    errorMessage.value = '加载订阅计划失败'
    paymentFailed.value = true
  }
}

const loadOrder = async () => {
  if (!orderId.value) return
  loading.value = true
  try {
    const response = await apiClient.get(`/subscriptions/orders/${orderId.value}`, {
      params: { refresh: true }
    })
    if (!response.success || !response.order) {
      throw new Error(response.error || '订单不存在')
    }
    orderSummary.value = response.order
    if (response.order.billingCycle) {
      billingCycle.value = response.order.billingCycle
    }
    if (!planId.value && response.order.planId) {
      planId.value = response.order.planId
    }
    if (planId.value && !subscriptionPlan.value) {
      await loadSubscriptionPlan()
    }

    const status = response.order.status
    if (status === 'paid') {
      paymentSuccess.value = true
      paymentCreated.value = false
      return
    }
    if (['cancelled', 'expired', 'failed', 'refunded'].includes(status)) {
      paymentFailed.value = true
      paymentCreated.value = false
      errorMessage.value = status === 'cancelled' ? '支付已取消' : '订单未完成'
      return
    }

    paymentCreated.value = true
    qrCodeUrl.value = resolvePaymentUrl(response.payment)
    if (isMobile.value) {
      const paymentUrl = resolvePaymentUrl(response.payment)
      if (paymentUrl) {
        window.location.href = paymentUrl
      }
    }
    startPollingPaymentStatus()
  } catch (error) {
    console.error('Failed to load order:', error)
    errorMessage.value = error.message || '加载订单失败'
    paymentFailed.value = true
  } finally {
    loading.value = false
  }
}

const createPayment = async () => {
  loading.value = true

  try {
    if (!planId.value) {
      throw new Error('缺少订阅计划')
    }

    const response = await apiClient.post('/subscriptions/orders', {
      planId: planId.value,
      provider: selectedMethod.value,
      method: isMobile.value ? 'h5' : 'web'
    })

    if (response.success) {
      orderSummary.value = response.order
      orderId.value = response.order.id
      if (response.order.billingCycle) {
        billingCycle.value = response.order.billingCycle
      }
      paymentCreated.value = true

      // Handle different payment methods and device types
      if (isMobile.value) {
        // Redirect to payment URL for mobile
        const paymentUrl = resolvePaymentUrl(response.payment)
        if (paymentUrl) {
          window.location.href = paymentUrl
        }
      } else {
        // Show QR code for desktop
        qrCodeUrl.value = resolvePaymentUrl(response.payment)

        // Start polling for payment status
        startPollingPaymentStatus()
      }
    } else {
      throw new Error(response.error || '创建支付订单失败')
    }
  } catch (error) {
    console.error('Failed to create payment:', error)
    errorMessage.value = error.message || '创建支付订单失败'
    paymentFailed.value = true
  } finally {
    loading.value = false
  }
}

const startPollingPaymentStatus = () => {
  stopPolling()
  // Poll every 3 seconds
  pollInterval.value = setInterval(async () => {
    try {
      const response = await apiClient.get(`/subscriptions/orders/${orderId.value}`, {
        params: { refresh: true }
      })

      if (response.success && response.order) {
        orderSummary.value = response.order
        if (!qrCodeUrl.value && response.payment) {
          qrCodeUrl.value = resolvePaymentUrl(response.payment)
        }
        const status = response.order.status

        if (status === 'paid') {
          // Payment successful
          stopPolling()

          paymentSuccess.value = true
          paymentCreated.value = false
        } else if (['cancelled', 'expired', 'failed', 'refunded'].includes(status)) {
          // Payment failed/cancelled
          stopPolling()
          paymentFailed.value = true
          paymentCreated.value = false
          errorMessage.value = status === 'cancelled' ? '支付已取消' : '订单未完成'
        }
      }
    } catch (error) {
      console.error('Failed to poll payment status:', error)
      // Don't stop polling on network errors, just log
    }
  }, 3000)
}

const stopPolling = () => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
}

const cancelPayment = async () => {
  stopPolling()
  router.push('/app/subscription')
}

const resetPayment = () => {
  paymentCreated.value = false
  paymentSuccess.value = false
  paymentFailed.value = false
  errorMessage.value = ''
  qrCodeUrl.value = ''
  qrCodeDataUrl.value = ''
  orderId.value = ''
  apiKey.value = ''
  apiKeyCopied.value = false
  stopPolling()
}

const copyApiKey = async () => {
  try {
    await navigator.clipboard.writeText(apiKey.value)
    apiKeyCopied.value = true
    // Reset copied state after 2 seconds
    setTimeout(() => {
      apiKeyCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy API key:', error)
    // Fallback: try to use document.execCommand
    try {
      const textArea = document.createElement('textarea')
      textArea.value = apiKey.value
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      apiKeyCopied.value = true
      setTimeout(() => {
        apiKeyCopied.value = false
      }, 2000)
    } catch (fallbackError) {
      console.error('Fallback copy also failed:', fallbackError)
    }
  }
}

// Generate QR code when qrCodeUrl changes
const generateQRCode = async () => {
  if (!qrCodeUrl.value) {
    qrCodeDataUrl.value = ''
    return
  }

  try {
    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(qrCodeUrl.value, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
    qrCodeDataUrl.value = dataUrl
  } catch (error) {
    console.error('Failed to generate QR code:', error)
  }
}

// Watch for qrCodeUrl changes and generate QR code
watch(qrCodeUrl, () => {
  generateQRCode()
})

// Lifecycle
onMounted(() => {
  if (orderIdParam) {
    orderId.value = orderIdParam
    loadOrder()
    return
  }
  if (!planId.value) {
    // No order or plan specified, redirect
    router.push('/app/plans')
    return
  }
  loadSubscriptionPlan()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
/* Add any additional styles if needed */
</style>
