<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/30">
    <!-- 背景装饰 -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        class="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-indigo-500/5 blur-[120px]"
      ></div>
      <div
        class="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-purple-500/5 blur-[120px]"
      ></div>
    </div>

    <div class="relative z-10 flex min-h-screen">
      <!-- 侧边栏 -->
      <aside
        class="sticky top-0 hidden h-screen w-72 flex-shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur-xl lg:flex"
      >
        <div class="p-6">
          <router-link class="group flex items-center gap-3" to="/">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105"
            >
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div>
              <h1 class="text-lg font-bold tracking-tight text-slate-900">Top Router</h1>
              <p class="text-xs text-slate-500">{{ userName }}</p>
            </div>
          </router-link>
        </div>

        <nav class="flex-1 space-y-1 overflow-y-auto px-4">
          <p class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            平台
          </p>
          <button
            v-for="item in navItems"
            :key="item.to"
            :class="[
              'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
              isItemActive(item.to)
                ? 'bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            ]"
            @click="navigate(item.to)"
          >
            <i
              :class="[
                item.icon,
                'transition-colors duration-200',
                isItemActive(item.to)
                  ? 'text-indigo-600'
                  : 'text-slate-400 group-hover:text-slate-600'
              ]"
            />
            {{ item.label }}
            <div
              v-if="isItemActive(item.to)"
              class="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600"
            ></div>
          </button>
        </nav>

        <div class="border-t border-slate-100 p-4">
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div class="flex items-center gap-3">
              <div class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
              <span class="text-xs font-medium text-slate-600">系统运行正常</span>
            </div>
            <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>延迟</span>
              <span class="font-medium text-emerald-600">24ms</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- 主内容区域 -->
      <div class="flex min-w-0 flex-1 flex-col">
        <!-- 顶部导航 -->
        <header
          class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-xl"
        >
          <div class="flex items-center gap-4 lg:hidden">
            <button
              class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              @click="mobileNavOpen = !mobileNavOpen"
            >
              <i class="fas fa-bars text-lg" />
            </button>
            <span class="font-bold text-slate-900">Top Router</span>
          </div>

          <div class="ml-auto flex items-center gap-4">
            <button
              class="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              @click="handleLogout"
            >
              <i class="fas fa-sign-out-alt text-slate-400"></i>
              退出登录
            </button>
          </div>
        </header>

        <!-- 内容滚动区域 -->
        <main class="flex-1 overflow-y-auto p-6 lg:p-8">
          <div class="animate-fade-in mx-auto max-w-7xl">
            <router-view />
          </div>
        </main>
      </div>
    </div>

    <!-- 移动端导航 -->
    <transition name="fade">
      <div
        v-if="mobileNavOpen"
        class="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm lg:hidden"
        @click="mobileNavOpen = false"
      >
        <div
          class="absolute left-0 top-0 h-full w-72 border-r border-slate-200 bg-white p-6 shadow-2xl"
          @click.stop
        >
          <div class="mb-8 flex items-center justify-between">
            <span class="text-lg font-bold text-slate-900">导航</span>
            <button class="text-slate-400 hover:text-slate-600" @click="mobileNavOpen = false">
              <i class="fas fa-times" />
            </button>
          </div>

          <nav class="flex flex-col gap-2">
            <button
              v-for="item in navItems"
              :key="`mobile-${item.to}`"
              :class="[
                'flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all',
                isItemActive(item.to)
                  ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              ]"
              @click="
                () => {
                  navigate(item.to)
                  mobileNavOpen = false
                }
              "
            >
              <i :class="item.icon" />
              {{ item.label }}
            </button>
          </nav>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const userName = computed(() => userStore.user?.displayName || userStore.user?.username || '用户')
const mobileNavOpen = ref(false)

const handleLogout = async () => {
  await userStore.logout()
  router.push('/')
}

const navItems = [
  { label: '概览', to: '/app/dashboard', icon: 'fas fa-chart-pie' },
  { label: '用量分析', to: '/app/usage', icon: 'fas fa-chart-line' },
  { label: '订阅计划', to: '/app/plans', icon: 'fas fa-layer-group' },
  { label: '我的订阅', to: '/app/subscription', icon: 'fas fa-receipt' },
  { label: '账单管理', to: '/app/billing', icon: 'fas fa-wallet' },
  { label: 'API 密钥', to: '/app/api-keys', icon: 'fas fa-key' },
  { label: '短信设置', to: '/app/sms-settings', icon: 'fas fa-comment-alt' },
  { label: '配置教程', to: '/app/tutorials', icon: 'fas fa-book' },
  { label: '在线支持', to: '/app/support', icon: 'fas fa-life-ring' }
]

const navigate = (path) => {
  if (path !== route.path) {
    router.push(path)
  }
}

const isItemActive = (targetPath) => {
  if (targetPath === '/app') {
    return route.path === '/app'
  }
  return route.path.startsWith(targetPath)
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

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

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}
</style>
