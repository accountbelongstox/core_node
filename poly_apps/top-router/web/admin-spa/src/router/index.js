import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { useRuntimeStore } from '@/stores/runtime'
import { APP_CONFIG } from '@/config/app'
import { showToast } from '@/utils/toast'
import marketing from '@/router/modules/marketing'
import user from '@/router/modules/user'
import auth from '@/router/modules/auth'

// 路由懒加载
const LoginView = () => import('@/views/LoginView.vue')
const UserDashboardView = () => import('@/views/UserDashboardView.vue')
const UserManagementView = () => import('@/views/UserManagementView.vue')
const MainLayout = () => import('@/components/layout/MainLayout.vue')
const DashboardView = () => import('@/views/DashboardView.vue')
const ApiKeysView = () => import('@/views/ApiKeysView.vue')
const ApiKeyUsageRecordsView = () => import('@/views/ApiKeyUsageRecordsView.vue')
const AccountsView = () => import('@/views/AccountsView.vue')
const AccountUsageRecordsView = () => import('@/views/AccountUsageRecordsView.vue')
const SettingsView = () => import('@/views/SettingsView.vue')
const ApiStatsView = () => import('@/views/ApiStatsView.vue')
const VpnTunnelsView = () => import('@/views/VpnTunnelsView.vue')
const WsClientsView = () => import('@/views/admin/Clients.vue')
const SubscriptionsView = () => import('@/views/admin/Subscriptions.vue')
const EventLogsView = () => import('@/views/admin/EventLogs.vue')

const routes = [
  ...marketing,
  ...user,
  ...auth,
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/admin-login',
    redirect: '/login'
  },
  {
    path: '/user-dashboard',
    name: 'UserDashboard',
    component: UserDashboardView,
    meta: { requiresUserAuth: true }
  },
  {
    path: '/api-stats',
    name: 'ApiStats',
    component: ApiStatsView,
    meta: { requiresAuth: false }
  },
  {
    path: '/admin',
    meta: { requiresAuth: true },
    component: MainLayout,
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: DashboardView
      },
      {
        path: 'api-keys',
        name: 'ApiKeys',
        component: ApiKeysView
      },
      {
        path: 'api-keys/:keyId/usage-records',
        name: 'ApiKeyUsageRecords',
        component: ApiKeyUsageRecordsView
      },
      {
        path: 'accounts',
        name: 'Accounts',
        component: AccountsView
      },
      {
        path: 'accounts/:accountId/usage-records',
        name: 'AccountUsageRecords',
        component: AccountUsageRecordsView
      },
      {
        path: 'vpn',
        name: 'VpnTunnels',
        component: VpnTunnelsView
      },
      {
        path: 'clients',
        name: 'WsClients',
        component: WsClientsView
      },
      {
        path: 'subscriptions',
        name: 'Subscriptions',
        component: SubscriptionsView
      },
      {
        path: 'logs',
        name: 'EventLogs',
        component: EventLogsView
      },
      {
        path: 'settings',
        name: 'Settings',
        component: SettingsView
      },
      {
        path: 'user-management',
        name: 'UserManagement',
        component: UserManagementView
      }
    ]
  },
  // 捕获所有未匹配的路由
  {
    path: '/:pathMatch(.*)*',
    redirect: '/api-stats'
  }
]

const router = createRouter({
  history: createWebHistory(APP_CONFIG.basePath),
  routes
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const userStore = useUserStore()
  const runtimeStore = useRuntimeStore()

  try {
    await runtimeStore.fetchRuntimeInfo()
  } catch (error) {
    // 运行时模式获取失败时，继续使用默认行为
  }

  if (runtimeStore.isWsClientOnly) {
    const isUserAuthRoute = to.path === '/auth/user-login' || to.path === '/auth/register'
    const isAdminAudience = to.matched.some((record) => record.meta.audience === 'admin')
    const isPublicAudience = to.matched.some((record) => record.meta.audience === 'public')

    if (to.path === '/') {
      return next('/api-stats')
    }
    if (to.path.startsWith('/admin/subscriptions')) {
      return next('/admin/dashboard')
    }
    if (isUserAuthRoute) {
      return next('/')
    }
    if (isPublicAudience && !isAdminAudience && to.path !== '/api-stats') {
      return next('/api-stats')
    }
    if (to.path.startsWith('/admin/user-management') || to.path.startsWith('/admin/users')) {
      return next('/admin/dashboard')
    }
  }

  // 防止重定向循环：如果已经在目标路径，直接放行
  if (to.path === from.path && to.fullPath === from.fullPath) {
    return next()
  }

  // 检查用户认证状态
  if (to.meta.requiresUserAuth) {
    if (!userStore.isAuthenticated) {
      // 尝试检查本地存储的认证信息
      try {
        const isUserLoggedIn = await userStore.checkAuth()
        if (!isUserLoggedIn) {
          return next('/auth/user-login')
        }
      } catch (error) {
        // If the error is about disabled account, redirect to login with error
        if (error.message && error.message.includes('disabled')) {
          showToast(error.message, 'error')
        }
        return next('/auth/user-login')
      }
    }
    return next()
  }

  // API Stats 页面不需要认证，直接放行
  if (to.path === '/api-stats' || to.path.startsWith('/api-stats')) {
    next()
  } else if (to.path === '/auth/user-login') {
    // 如果已经是用户登录状态，重定向到用户仪表板
    if (userStore.isAuthenticated) {
      next('/user-dashboard')
    } else {
      next()
    }
  } else if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/admin/dashboard')
  } else {
    next()
  }
})

export default router
