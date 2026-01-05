const MarketingLayout = () => import('@/layouts/MarketingLayout.vue')

export default [
  {
    path: '/',
    component: MarketingLayout,
    meta: { audience: 'public' },
    children: [
      {
        path: '',
        name: 'Landing',
        component: () => import('@/views/marketing/Landing.vue'),
        meta: { title: 'Top Router · 统一接入层' }
      },
      {
        path: 'solutions',
        name: 'Solutions',
        component: () => import('@/views/marketing/Solutions.vue'),
        meta: { title: '解决方案' }
      },
      {
        path: 'pricing',
        name: 'Pricing',
        component: () => import('@/views/marketing/Pricing.vue'),
        meta: { title: '订阅计划' }
      },
      {
        path: 'case-studies',
        name: 'CaseStudies',
        component: () => import('@/views/marketing/CaseStudies.vue'),
        meta: { title: '客户案例' }
      },

      {
        path: 'features',
        name: 'Features',
        component: () => import('@/views/marketing/Features.vue'),
        meta: { title: '产品特性' }
      },
      {
        path: 'about',
        name: 'About',
        component: () => import('@/views/marketing/About.vue'),
        meta: { title: '关于我们' }
      },
      {
        path: 'contact',
        name: 'Contact',
        component: () => import('@/views/marketing/Contact.vue'),
        meta: { title: '联系我们' }
      },
      {
        path: 'api-status',
        name: 'ApiStatus',
        component: () => import('@/views/marketing/ApiStatus.vue'),
        meta: { title: 'API 状态' }
      },
      {
        path: 'tutorials/:slug?',
        name: 'Tutorials',
        component: () => import('@/views/marketing/Tutorial.vue'),
        meta: { title: '使用教程' }
      }
    ]
  }
]
