const UserLayout = () => import('@/layouts/UserLayout.vue')

export default [
  {
    path: '/app',
    component: UserLayout,
    meta: { requiresUserAuth: true, audience: 'user' },
    children: [
      {
        path: 'dashboard',
        name: 'UserDashboard',
        component: () => import('@/views/user/Dashboard.vue')
      },
      {
        path: 'usage',
        name: 'UserUsage',
        component: () => import('@/views/user/UsageAnalytics.vue')
      },
      {
        path: 'plans',
        name: 'UserPlans',
        component: () => import('@/views/user/Plans.vue')
      },
      {
        path: 'subscription',
        name: 'UserSubscription',
        component: () => import('@/views/user/Subscription.vue')
      },
      {
        path: 'billing',
        name: 'UserBilling',
        component: () => import('@/views/user/Billing.vue')
      },
      {
        path: 'payment-methods',
        name: 'UserPayment',
        component: () => import('@/views/user/Payment.vue')
      },
      {
        path: 'api-keys',
        name: 'UserApiKeys',
        component: () => import('@/views/user/ApiKeys.vue')
      },
      {
        path: 'support',
        name: 'UserSupport',
        component: () => import('@/views/user/Support.vue')
      },
      {
        path: 'sms-settings',
        name: 'UserSmsSettings',
        component: () => import('@/views/user/SmsSettings.vue')
      },
      {
        path: 'tutorials',
        name: 'UserTutorials',
        component: () => import('@/views/user/Tutorials.vue')
      }
    ]
  }
]
