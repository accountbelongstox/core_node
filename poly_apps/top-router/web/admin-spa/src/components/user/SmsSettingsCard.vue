<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">短信通知设置</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">管理您的手机号码和短信通知偏好</p>
    </div>

    <!--Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
    </div>

    <!-- SMS service disabled -->
    <div v-else-if="!smsEnabled" class="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
      <div class="flex">
        <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            clip-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            fill-rule="evenodd"
          />
        </svg>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">短信服务未启用</h3>
          <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            管理员尚未启用短信通知服务。请联系系统管理员以获取更多信息。
          </p>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div v-else class="space-y-6">
      <!-- Phone number status card -->
      <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h3 class="mb-4 text-base font-medium text-gray-900 dark:text-white">手机号码</h3>

        <!-- Bound phone number -->
        <div v-if="config.phoneVerified && config.phoneNumber" class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <svg
                class="h-6 w-6 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ config.phoneNumber }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">已验证</p>
              </div>
            </div>
            <button
              class="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
              @click="handleUnbindPhone"
            >
              解绑
            </button>
          </div>
        </div>

        <!-- Bind phone number form -->
        <div v-else class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">绑定手机号后可接收短信通知</p>

          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              for="phoneNumber"
            >
              手机号码
            </label>
            <div class="mt-1 flex space-x-2">
              <input
                id="phoneNumber"
                v-model="phoneNumber"
                class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-800"
                :disabled="codeSent"
                maxlength="11"
                placeholder="请输入11位手机号"
                type="tel"
                @input="validatePhoneNumber"
              />
              <button
                class="whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
                :disabled="!isPhoneValid || codeSent || sendingCode"
                @click="handleSendCode"
              >
                {{ codeSent ? `${countdown}秒后重试` : sendingCode ? '发送中...' : '发送验证码' }}
              </button>
            </div>
            <p v-if="phoneError" class="mt-1 text-sm text-red-600 dark:text-red-400">
              {{ phoneError }}
            </p>
          </div>

          <div v-if="codeSent">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              for="verificationCode"
            >
              验证码
            </label>
            <input
              id="verificationCode"
              v-model="verificationCode"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              maxlength="6"
              placeholder="请输入6位验证码"
              type="text"
            />
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              验证码已发送至 {{ maskPhoneNumber(phoneNumber) }}，10分钟内有效
            </p>
          </div>

          <button
            v-if="codeSent"
            class="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600"
            :disabled="!verificationCode || verificationCode.length !== 6 || binding"
            @click="handleBindPhone"
          >
            {{ binding ? '验证中...' : '验证并绑定' }}
          </button>
        </div>
      </div>

      <!-- Notification preferences -->
      <div v-if="config.phoneVerified" class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h3 class="mb-4 text-base font-medium text-gray-900 dark:text-white">通知偏好设置</h3>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">选择您希望接收的短信通知类型</p>

        <div class="space-y-3">
          <label class="flex items-center space-x-3">
            <input
              v-model="preferences.quotaWarning"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              type="checkbox"
              @change="handlePreferenceChange"
            />
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">配额警告</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                当使用量达到配额的80%、90%、100%时通知
              </p>
            </div>
          </label>

          <label class="flex items-center space-x-3">
            <input
              v-model="preferences.subscriptionExpiring"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              type="checkbox"
              @change="handlePreferenceChange"
            />
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">订阅即将过期</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">订阅到期前7天和3天通知</p>
            </div>
          </label>

          <label class="flex items-center space-x-3">
            <input
              v-model="preferences.apiKeyExpiring"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              type="checkbox"
              @change="handlePreferenceChange"
            />
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">API Key即将过期</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">API Key到期前通知</p>
            </div>
          </label>

          <label class="flex items-center space-x-3">
            <input
              v-model="preferences.securityAlert"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              type="checkbox"
              @change="handlePreferenceChange"
            />
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">安全警告</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">异常登录或安全事件通知</p>
            </div>
          </label>

          <label class="flex items-center space-x-3">
            <input
              v-model="preferences.dailySummary"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              type="checkbox"
              @change="handlePreferenceChange"
            />
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">每日汇总</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                每天20:00发送使用量汇总（可选）
              </p>
            </div>
          </label>
        </div>
      </div>

      <!-- Rate limit status -->
      <div
        v-if="config.phoneVerified && rateLimit"
        class="rounded-lg bg-white p-6 shadow dark:bg-gray-800"
      >
        <h3 class="mb-4 text-base font-medium text-gray-900 dark:text-white">发送限制</h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <p class="text-xs text-gray-600 dark:text-gray-400">每分钟</p>
            <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {{ rateLimit.perMinute.current }}/{{ rateLimit.perMinute.limit }}
            </p>
          </div>
          <div class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <p class="text-xs text-gray-600 dark:text-gray-400">每小时</p>
            <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {{ rateLimit.perHour.current }}/{{ rateLimit.perHour.limit }}
            </p>
          </div>
          <div class="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
            <p class="text-xs text-gray-600 dark:text-gray-400">每天</p>
            <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {{ rateLimit.perDay.current }}/{{ rateLimit.perDay.limit }}
            </p>
          </div>
        </div>
      </div>

      <!-- SMS logs -->
      <div
        v-if="config.phoneVerified && logs.length > 0"
        class="rounded-lg bg-white p-6 shadow dark:bg-gray-800"
      >
        <h3 class="mb-4 text-base font-medium text-gray-900 dark:text-white">发送记录</h3>
        <div class="space-y-2">
          <div
            v-for="log in logs"
            :key="log.timestamp"
            class="flex items-center justify-between border-b border-gray-200 py-2 last:border-0 dark:border-gray-700"
          >
            <div class="flex-1">
              <p class="text-sm text-gray-900 dark:text-white">
                {{ getTemplateTypeName(log.templateType) }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatTimestamp(log.timestamp) }}
              </p>
            </div>
            <span
              :class="[
                'rounded-full px-2 py-1 text-xs font-medium',
                log.success
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
              ]"
            >
              {{ log.success ? '成功' : '失败' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { showToast } from '@/utils/toast'

const loading = ref(true)
const smsEnabled = ref(false)
const config = ref({
  phoneNumber: null,
  phoneVerified: false,
  notificationPreferences: {
    quotaWarning: true,
    subscriptionExpiring: true,
    apiKeyExpiring: true,
    securityAlert: true,
    dailySummary: false
  }
})

const preferences = ref({})
const rateLimit = ref(null)
const logs = ref([])

const phoneNumber = ref('')
const verificationCode = ref('')
const phoneError = ref('')
const isPhoneValid = ref(false)
const codeSent = ref(false)
const countdown = ref(60)
const sendingCode = ref(false)
const binding = ref(false)

let countdownTimer = null

onMounted(async () => {
  await loadSmsConfig()
  loading.value = false
})

const loadSmsConfig = async () => {
  try {
    const response = await axios.get('/users/sms/config')
    smsEnabled.value = response.data.smsEnabled

    if (smsEnabled.value) {
      config.value = response.data.config
      preferences.value = { ...config.value.notificationPreferences }

      if (config.value.phoneVerified) {
        await loadRateLimit()
        await loadLogs()
      }
    }
  } catch (error) {
    console.error('Failed to load SMS config:', error)
    showToast(error.response?.data?.message || '加载短信配置失败', 'error')
  }
}

const loadRateLimit = async () => {
  try {
    const response = await axios.get('/users/sms/rate-limit')
    rateLimit.value = response.data.rateLimit
  } catch (error) {
    console.error('Failed to load rate limit:', error)
  }
}

const loadLogs = async () => {
  try {
    const response = await axios.get('/users/sms/logs?limit=10')
    logs.value = response.data.logs
  } catch (error) {
    console.error('Failed to load SMS logs:', error)
  }
}

const validatePhoneNumber = () => {
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneNumber.value) {
    phoneError.value = ''
    isPhoneValid.value = false
  } else if (!phoneRegex.test(phoneNumber.value)) {
    phoneError.value = '请输入有效的11位手机号'
    isPhoneValid.value = false
  } else {
    phoneError.value = ''
    isPhoneValid.value = true
  }
}

const handleSendCode = async () => {
  sendingCode.value = true
  try {
    await axios.post('/users/sms/send-code', {
      phoneNumber: phoneNumber.value
    })

    codeSent.value = true
    countdown.value = 60
    startCountdown()

    showToast('验证码已发送', 'success')
  } catch (error) {
    const errorMessage = error.response?.data?.message || '发送验证码失败'
    showToast(errorMessage, 'error')
  } finally {
    sendingCode.value = false
  }
}

const startCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
      codeSent.value = false
      countdown.value = 60
    }
  }, 1000)
}

const handleBindPhone = async () => {
  binding.value = true
  try {
    const response = await axios.post('/users/sms/bind-phone', {
      phoneNumber: phoneNumber.value,
      verificationCode: verificationCode.value
    })

    config.value = {
      ...response.data.config,
      phoneNumber: phoneNumber.value
    }
    preferences.value = { ...config.value.notificationPreferences }

    phoneNumber.value = ''
    verificationCode.value = ''
    codeSent.value = false
    if (countdownTimer) {
      clearInterval(countdownTimer)
    }

    showToast('手机号绑定成功', 'success')

    await loadRateLimit()
  } catch (error) {
    const errorMessage = error.response?.data?.message || '绑定失败'
    showToast(errorMessage, 'error')
  } finally {
    binding.value = false
  }
}

const handleUnbindPhone = async () => {
  if (!confirm('确定要解绑手机号吗？解绑后将无法接收短信通知。')) {
    return
  }

  try {
    await axios.post('/users/sms/unbind-phone')
    config.value.phoneNumber = null
    config.value.phoneVerified = false
    rateLimit.value = null
    logs.value = []

    showToast('手机号已解绑', 'success')
  } catch (error) {
    showToast(error.response?.data?.message || '解绑失败', 'error')
  }
}

const handlePreferenceChange = async () => {
  try {
    await axios.put('/users/sms/preferences', preferences.value)
    showToast('通知偏好已更新', 'success')
  } catch (error) {
    showToast(error.response?.data?.message || '更新失败', 'error')
    // Revert changes on error
    preferences.value = { ...config.value.notificationPreferences }
  }
}

const maskPhoneNumber = (phone) => {
  if (!phone || phone.length < 11) return phone
  return phone.substring(0, 3) + '****' + phone.substring(7)
}

const getTemplateTypeName = (type) => {
  const typeNames = {
    verificationCode: '验证码',
    quotaWarning: '配额警告',
    subscriptionExpiring: '订阅即将过期',
    apiKeyExpiring: 'API Key即将过期',
    securityAlert: '安全警告',
    dailySummary: '每日汇总'
  }
  return typeNames[type] || type
}

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>
