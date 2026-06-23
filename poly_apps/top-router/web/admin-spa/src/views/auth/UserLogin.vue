<template>
  <div class="w-full max-w-md">
    <!-- 主题切换按钮 - 绝对定位在卡片右上角 -->
    <div class="absolute right-0 top-0 -mt-12">
      <ThemeToggle mode="dropdown" />
    </div>

    <div
      class="glass-card w-full rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-xl dark:bg-slate-800/80 sm:p-10"
    >
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg"
        >
          <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">欢迎回来</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">登录您的账户以继续</p>
      </div>

      <form class="space-y-6" @submit.prevent="handleLogin">
        <div>
          <label
            class="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-200"
            for="username"
            >用户名</label
          >
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <i class="fas fa-user text-gray-400"></i>
            </div>
            <input
              id="username"
              v-model="form.username"
              autocomplete="username"
              class="form-input block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 pl-14 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              :disabled="loading"
              name="username"
              placeholder="请输入用户名"
              required
              type="text"
            />
          </div>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200" for="password"
              >密码</label
            >
            <router-link
              class="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              to="/auth/forgot-password"
              >忘记密码？</router-link
            >
          </div>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <i class="fas fa-lock text-gray-400"></i>
            </div>
            <input
              id="password"
              v-model="form.password"
              autocomplete="current-password"
              class="form-input block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 pl-14 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              :disabled="loading"
              name="password"
              placeholder="请输入密码"
              required
              type="password"
            />
          </div>
        </div>

        <div
          v-if="error"
          class="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300"
          role="alert"
        >
          <div class="flex items-center">
            <i class="fas fa-exclamation-circle mr-2"></i>
            <span class="font-medium">登录失败</span>
          </div>
          <div class="mt-1">{{ error }}</div>
        </div>

        <button
          class="w-full transform rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-center text-base font-medium text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-blue-800"
          :disabled="loading || !form.username || !form.password"
          type="submit"
        >
          <i v-if="loading" class="fas fa-circle-notch fa-spin mr-2"></i>
          {{ loading ? '登录中...' : '登录' }}
        </button>

        <div class="text-center text-sm text-gray-500 dark:text-gray-400">
          还没有账号？
          <router-link
            class="font-medium text-blue-600 hover:underline dark:text-blue-400"
            to="/auth/register"
          >
            立即注册
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const router = useRouter()
const userStore = useUserStore()
const themeStore = useThemeStore()

const loading = ref(false)
const error = ref('')

const form = reactive({
  username: '',
  password: ''
})

const handleLogin = async () => {
  if (!form.username || !form.password) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await userStore.login({
      username: form.username,
      password: form.password
    })

    // 登录成功，跳转到用户仪表板
    router.push('/app/dashboard')
  } catch (err) {
    console.error('登录失败:', err)
    error.value = err.response?.data?.error || err.message || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 初始化主题
  themeStore.initTheme()
})
</script>

<style scoped>
.glass-card {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
</style>
