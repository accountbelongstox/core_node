const AuthLayout = () => import('@/layouts/AuthLayout.vue')

export default [
  {
    path: '/auth',
    component: AuthLayout,
    meta: { audience: 'public' },
    children: [
      {
        path: 'admin-login',
        name: 'AdminLogin',
        component: () => import('@/views/auth/AdminLogin.vue'),
        meta: { audience: 'admin' }
      },
      {
        path: 'register',
        name: 'Register',
        component: () => import('@/views/auth/Register.vue'),
        meta: { audience: 'admin' }
      },
      {
        path: 'forgot-password',
        name: 'ForgotPassword',
        component: () => import('@/views/auth/ForgotPassword.vue'),
        meta: { audience: 'admin' }
      },
      {
        path: 'reset-password',
        name: 'ResetPassword',
        component: () => import('@/views/auth/ResetPassword.vue'),
        meta: { audience: 'admin' }
      },
      {
        path: 'user-login',
        name: 'UserLogin',
        component: () => import('@/views/auth/UserLogin.vue'),
        meta: { audience: 'user' }
      }
    ]
  }
]
