<template>
  <div class="flex min-h-screen items-center justify-center p-4 sm:p-6">
    <!-- 主题切换按钮 - 固定在右上角 -->
    <div class="fixed right-4 top-4 z-50">
      <ThemeToggle mode="dropdown" />
    </div>

    <div
      class="glass-strong w-full max-w-md rounded-xl p-6 shadow-2xl sm:rounded-2xl sm:p-8 md:rounded-3xl md:p-10"
    >
      <div class="mb-6 text-center sm:mb-8">
        <div
          class="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-gray-300/30 bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm sm:mb-6 sm:h-20 sm:w-20 sm:rounded-2xl"
        >
          <template v-if="!oemLoading">
            <img
              v-if="authStore.oemSettings.siteIconData || authStore.oemSettings.siteIcon"
              alt="Logo"
              class="h-10 w-10 object-contain sm:h-12 sm:w-12"
              :src="authStore.oemSettings.siteIconData || authStore.oemSettings.siteIcon"
              @error="(e) => (e.target.style.display = 'none')"
            />
            <i v-else class="fas fa-lock text-2xl text-gray-700 sm:text-3xl" />
          </template>
          <div v-else class="h-10 w-10 animate-pulse rounded bg-gray-300/50 sm:h-12 sm:w-12" />
        </div>

        <template v-if="!oemLoading && authStore.oemSettings.siteName">
          <h1 class="header-title mb-2 text-2xl font-bold text-white sm:text-3xl">重置密码</h1>
        </template>
        <div
          v-else-if="oemLoading"
          class="mx-auto mb-2 h-8 w-48 animate-pulse rounded bg-gray-300/50 sm:h-9 sm:w-64"
        />

        <p
          v-if="tokenValid && userEmail"
          class="text-sm text-gray-600 dark:text-gray-400 sm:text-base"
        >
          为账户 <span class="font-semibold">{{ userEmail }}</span> 设置新密码
        </p>
        <p v-else class="text-sm text-gray-600 dark:text-gray-400 sm:text-base">请输入您的新密码</p>
      </div>

      <!-- 验证中 -->
      <div
        v-if="isValidating"
        class="mb-4 flex flex-col items-center justify-center space-y-3 rounded-lg border border-gray-300/30 bg-gray-100/50 p-6 backdrop-blur-sm dark:bg-gray-800/50 sm:mb-6 sm:rounded-xl sm:p-8"
      >
        <div class="loading-spinner h-8 w-8"></div>
        <p class="text-sm text-gray-600 dark:text-gray-400">正在验证重置链接...</p>
      </div>

      <!-- Token 无效 -->
      <div
        v-else-if="!tokenValid"
        class="mb-4 rounded-lg border border-red-500/30 bg-red-500/20 p-3 text-center text-xs text-red-800 backdrop-blur-sm dark:text-red-400 sm:mb-6 sm:rounded-xl sm:p-4 sm:text-sm"
      >
        <i class="fas fa-exclamation-triangle mr-2" />{{ tokenError || '重置链接无效或已过期' }}
      </div>

      <!-- 成功消息 -->
      <div
        v-else-if="successMessage"
        class="mb-4 space-y-4 rounded-lg border border-green-500/30 bg-green-500/20 p-4 backdrop-blur-sm sm:mb-6 sm:rounded-xl sm:p-6"
      >
        <div class="text-center">
          <i class="fas fa-check-circle mb-3 text-4xl text-green-600 dark:text-green-400" />
          <p class="text-sm text-green-800 dark:text-green-400 sm:text-base">
            {{ successMessage }}
          </p>
        </div>
        <router-link
          class="btn btn-primary inline-flex w-full items-center justify-center"
          to="/auth/admin-login"
        >
          <i class="fas fa-sign-in-alt mr-2" />前往登录
        </router-link>
      </div>

      <!-- 重置表单 -->
      <form
        v-else-if="tokenValid && !successMessage"
        class="space-y-4 sm:space-y-6"
        @submit.prevent="handleSubmit"
      >
        <div>
          <label
            class="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-100 sm:mb-3"
            for="password"
          >
            新密码
          </label>
          <input
            id="password"
            v-model="password"
            autocomplete="new-password"
            class="form-input w-full"
            minlength="8"
            name="password"
            placeholder="请输入新密码（至少8个字符）"
            required
            type="password"
          />
        </div>

        <div>
          <label
            class="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-100 sm:mb-3"
            for="confirmPassword"
          >
            确认新密码
          </label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            autocomplete="new-password"
            class="form-input w-full"
            minlength="8"
            name="confirmPassword"
            placeholder="请再次输入新密码"
            required
            type="password"
          />
        </div>

        <!-- 密码强度提示 -->
        <div
          class="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-400 sm:rounded-xl sm:p-4 sm:text-sm"
        >
          <i class="fas fa-info-circle mr-2" />密码必须至少包含8个字符
        </div>

        <button
          class="btn btn-primary w-full px-4 py-3 text-base font-semibold sm:px-6 sm:py-4 sm:text-lg"
          :disabled="isLoading"
          type="submit"
        >
          <i v-if="!isLoading" class="fas fa-save mr-2" />
          <div v-if="isLoading" class="loading-spinner mr-2" />
          {{ isLoading ? '重置中...' : '重置密码' }}
        </button>
      </form>

      <!-- 错误消息 -->
      <div
        v-if="errorMessage"
        class="mt-4 rounded-lg border border-red-500/30 bg-red-500/20 p-3 text-center text-xs text-red-800 backdrop-blur-sm dark:text-red-400 sm:mt-6 sm:rounded-xl sm:p-4 sm:text-sm"
      >
        <i class="fas fa-exclamation-triangle mr-2" />{{ errorMessage }}
      </div>

      <!-- 返回登录 -->
      <div v-if="!isValidating && !successMessage" class="mt-4 text-center sm:mt-6">
        <router-link
          class="text-sm text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300 sm:text-base"
          to="/auth/admin-login"
        >
          <i class="fas fa-arrow-left mr-2" />返回登录
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/config/api'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const route = useRoute()
const authStore = useAuthStore()

// 状态
const token = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const isValidating = ref(true)
const tokenValid = ref(false)
const tokenError = ref('')
const userEmail = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const oemLoading = ref(true)

// 加载OEM设置
onMounted(async () => {
  try {
    await authStore.loadOemSettings()
  } catch (error) {
    console.error('Failed to load OEM settings:', error)
  } finally {
    oemLoading.value = false
  }

  // 从URL获取token
  token.value = route.query.token || ''

  if (!token.value) {
    tokenValid.value = false
    tokenError.value = '缺少重置令牌'
    isValidating.value = false
    return
  }

  // 验证token
  await validateToken()
})

// 验证token
const validateToken = async () => {
  isValidating.value = true

  try {
    const response = await apiClient.get(`/users/validate-reset-token/${token.value}`)

    if (response.success && response.valid) {
      tokenValid.value = true
      userEmail.value = response.email || ''
    } else {
      tokenValid.value = false
      tokenError.value = response.message || '重置链接无效或已过期'
    }
  } catch (error) {
    console.error('Token validation error:', error)
    tokenValid.value = false
    tokenError.value = error.message || '验证失败，请稍后重试'
  } finally {
    isValidating.value = false
  }
}

// 处理表单提交
const handleSubmit = async () => {
  // 验证密码
  if (password.value.length < 8) {
    errorMessage.value = '密码必须至少包含8个字符'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true

  try {
    const response = await apiClient.post('/users/reset-password', {
      token: token.value,
      password: password.value
    })

    if (response.success) {
      successMessage.value = response.message || '密码重置成功！您现在可以使用新密码登录了'
      password.value = ''
      confirmPassword.value = ''
    } else {
      errorMessage.value = response.message || '重置失败，请稍后重试'
    }
  } catch (error) {
    console.error('Reset password error:', error)
    errorMessage.value = error.message || '重置失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* 继承全局样式，无需额外样式 */
</style>
