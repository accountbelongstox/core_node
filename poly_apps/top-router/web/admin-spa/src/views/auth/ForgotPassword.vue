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
            <i v-else class="fas fa-key text-2xl text-gray-700 sm:text-3xl" />
          </template>
          <div v-else class="h-10 w-10 animate-pulse rounded bg-gray-300/50 sm:h-12 sm:w-12" />
        </div>

        <template v-if="!oemLoading && authStore.oemSettings.siteName">
          <h1 class="header-title mb-2 text-2xl font-bold text-white sm:text-3xl">忘记密码</h1>
        </template>
        <div
          v-else-if="oemLoading"
          class="mx-auto mb-2 h-8 w-48 animate-pulse rounded bg-gray-300/50 sm:h-9 sm:w-64"
        />

        <p class="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
          输入您的邮箱地址，我们将发送密码重置链接
        </p>
      </div>

      <!-- 成功消息 -->
      <div
        v-if="successMessage"
        class="mb-4 rounded-lg border border-green-500/30 bg-green-500/20 p-3 text-center text-xs text-green-800 backdrop-blur-sm dark:text-green-400 sm:mb-6 sm:rounded-xl sm:p-4 sm:text-sm"
      >
        <i class="fas fa-check-circle mr-2" />{{ successMessage }}
      </div>

      <!-- 表单 -->
      <form v-if="!successMessage" class="space-y-4 sm:space-y-6" @submit.prevent="handleSubmit">
        <div>
          <label
            class="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-100 sm:mb-3"
            for="email"
          >
            邮箱地址
          </label>
          <input
            id="email"
            v-model="email"
            autocomplete="email"
            class="form-input w-full"
            name="email"
            placeholder="请输入您的邮箱地址"
            required
            type="email"
          />
        </div>

        <button
          class="btn btn-primary w-full px-4 py-3 text-base font-semibold sm:px-6 sm:py-4 sm:text-lg"
          :disabled="isLoading"
          type="submit"
        >
          <i v-if="!isLoading" class="fas fa-paper-plane mr-2" />
          <div v-if="isLoading" class="loading-spinner mr-2" />
          {{ isLoading ? '发送中...' : '发送重置链接' }}
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
      <div class="mt-4 text-center sm:mt-6">
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
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/config/api'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const authStore = useAuthStore()

// 状态
const email = ref('')
const isLoading = ref(false)
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
})

// 处理表单提交
const handleSubmit = async () => {
  if (!email.value.trim()) {
    errorMessage.value = '请输入邮箱地址'
    return
  }

  // 简单的邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    errorMessage.value = '请输入有效的邮箱地址'
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true

  try {
    const response = await apiClient.post('/users/forgot-password', {
      email: email.value.trim()
    })

    if (response.success) {
      successMessage.value = response.message || '密码重置邮件已发送，请查收邮箱'
      email.value = ''
    } else {
      errorMessage.value = response.message || '发送失败，请稍后重试'
    }
  } catch (error) {
    console.error('Forgot password error:', error)
    errorMessage.value = error.message || '发送失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* 继承全局样式，无需额外样式 */
</style>
