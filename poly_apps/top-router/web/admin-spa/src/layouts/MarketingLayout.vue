<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
  >
    <!-- Navigation -->
    <nav
      class="fixed left-0 right-0 top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-gray-700 dark:bg-gray-900/80"
    >
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <!-- Logo -->
          <div class="flex items-center">
            <router-link class="flex items-center space-x-2" to="/">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600"
              >
                <svg
                  class="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
              </div>
              <span class="text-xl font-bold text-gray-900 dark:text-white">Top Router</span>
            </router-link>
          </div>

          <!-- Desktop Navigation -->
          <div class="hidden items-center space-x-8 md:flex">
            <router-link
              class="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              to="/features"
              >功能</router-link
            >
            <router-link
              class="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              to="/tutorials"
              >教程</router-link
            >
            <router-link
              class="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              to="/about"
              >关于</router-link
            >
            <router-link
              class="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              to="/contact"
              >联系</router-link
            >
            <router-link
              class="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              to="/pricing"
              >定价</router-link
            >

            <!-- 未登录状态 -->
            <template v-if="!isLoggedIn">
              <router-link
                class="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                to="/auth/user-login"
                >登录</router-link
              >
              <router-link
                class="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2 font-semibold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 hover:shadow-xl"
                to="/auth/register"
              >
                注册
              </router-link>
            </template>

            <!-- 已登录状态 -->
            <template v-else>
              <span class="text-gray-600 dark:text-gray-400">欢迎，{{ userName }}</span>
              <router-link
                class="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2 font-semibold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 hover:shadow-xl"
                to="/app"
              >
                控制台
              </router-link>
            </template>
          </div>

          <!-- Mobile menu button -->
          <button class="md:hidden" @click="mobileMenuOpen = !mobileMenuOpen">
            <svg
              class="h-6 w-6 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </button>
        </div>

        <!-- Mobile Navigation -->
        <div
          v-if="mobileMenuOpen"
          class="border-t border-gray-200 py-4 dark:border-gray-700 md:hidden"
        >
          <div class="space-y-2">
            <router-link
              class="block py-2 text-gray-600 dark:text-gray-400"
              to="/features"
              @click="mobileMenuOpen = false"
              >功能</router-link
            >
            <router-link
              class="block py-2 text-gray-600 dark:text-gray-400"
              to="/tutorials"
              @click="mobileMenuOpen = false"
              >教程</router-link
            >
            <router-link
              class="block py-2 text-gray-600 dark:text-gray-400"
              to="/about"
              @click="mobileMenuOpen = false"
              >关于</router-link
            >
            <router-link
              class="block py-2 text-gray-600 dark:text-gray-400"
              to="/contact"
              @click="mobileMenuOpen = false"
              >联系</router-link
            >
            <router-link
              class="block py-2 text-gray-600 dark:text-gray-400"
              to="/pricing"
              @click="mobileMenuOpen = false"
              >定价</router-link
            >

            <!-- 未登录状态 -->
            <template v-if="!isLoggedIn">
              <router-link
                class="block py-2 text-gray-600 dark:text-gray-400"
                to="/auth/user-login"
                @click="mobileMenuOpen = false"
                >登录</router-link
              >
              <router-link
                class="block rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2 text-center font-semibold text-white"
                to="/auth/register"
                @click="mobileMenuOpen = false"
              >
                注册
              </router-link>
            </template>

            <!-- 已登录状态 -->
            <template v-else>
              <div class="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div class="mb-3 text-gray-600 dark:text-gray-400">欢迎，{{ userName }}</div>

                <router-link
                  class="block rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 text-center font-semibold text-white"
                  to="/app"
                  @click="mobileMenuOpen = false"
                >
                  控制台
                </router-link>

                <button
                  class="mt-2 block w-full py-2 text-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  @click="handleLogout"
                >
                  退出登录
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </nav>

    <main class="min-h-[calc(100vh-64px)] pt-16">
      <router-view />
    </main>

    <!-- Footer -->
    <footer
      class="border-t border-gray-200 bg-white px-4 py-12 dark:border-gray-700 dark:bg-gray-900 sm:px-6 lg:px-8"
    >
      <div class="mx-auto max-w-7xl">
        <div class="grid gap-8 md:grid-cols-4">
          <!-- Company Info -->
          <div class="md:col-span-2">
            <div class="mb-4 flex items-center space-x-2">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600"
              >
                <svg
                  class="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
              </div>
              <span class="text-xl font-bold text-gray-900 dark:text-white">Top Router</span>
            </div>
            <p class="text-gray-600 dark:text-gray-400">
              专业的 Top Router API 中转服务，为您的 AI 应用提供企业级支持
            </p>
          </div>

          <!-- Quick Links -->
          <div>
            <h3 class="mb-4 font-semibold text-gray-900 dark:text-white">快速链接</h3>
            <ul class="space-y-2">
              <li>
                <router-link
                  class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  to="/features"
                  >功能详情</router-link
                >
              </li>
              <li>
                <router-link
                  class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  to="/about"
                  >关于我们</router-link
                >
              </li>
              <li>
                <router-link
                  class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  to="/api-status"
                  >API 状态</router-link
                >
              </li>
            </ul>
          </div>

          <!-- Support -->
          <div>
            <h3 class="mb-4 font-semibold text-gray-900 dark:text-white">支持</h3>
            <ul class="space-y-2">
              <li>
                <router-link
                  class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  to="/contact"
                  >联系我们</router-link
                >
              </li>
              <li>
                <router-link
                  class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  to="/auth/user-login"
                  >登录</router-link
                >
              </li>
              <li>
                <router-link
                  class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  to="/auth/register"
                  >注册</router-link
                >
              </li>
            </ul>
          </div>
        </div>

        <div
          class="mt-8 border-t border-gray-200 pt-8 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400"
        >
          <p>&copy; {{ new Date().getFullYear() }} Top Router Service. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/toast'

const router = useRouter()
const userStore = useUserStore()

const mobileMenuOpen = ref(false)

// 计算属性：用户是否已登录
const isLoggedIn = computed(() => userStore.isAuthenticated && userStore.user)
const userName = computed(() => userStore.user?.displayName || userStore.user?.username || '用户')

// 检查用户认证状态
onMounted(async () => {
  if (!userStore.isAuthenticated) {
    await userStore.checkAuth()
  }
})

// 退出登录
const handleLogout = async () => {
  try {
    await userStore.logout()
    mobileMenuOpen.value = false
    showToast('已退出登录', 'success')
    // 刷新页面以更新导航状态
    router.go(0)
  } catch (error) {
    console.error('Logout failed:', error)
    showToast('退出登录失败', 'error')
  }
}
</script>

<style scoped>
/* 平滑滚动 */
html {
  scroll-behavior: smooth;
}
</style>
