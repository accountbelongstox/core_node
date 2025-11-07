export const exampleRoutes = [
  {
    path: '/example',
    name: 'example',
    redirect: '/example/components/accordions',
    meta: {
      namespace: 'example',
    },
  },
  {
    path: '/example/components/accordions',
    name: 'example-accordions',
    component: () => import('@/app_example/pages_app_example/components/accordions.vue'),
    meta: {
      namespace: 'example',
      title: 'Accordions',
    },
  },
  {
    path: '/example/components/cards',
    name: 'example-cards',
    component: () => import('@/app_example/pages_app_example/components/cards.vue'),
    meta: {
      namespace: 'example',
      title: 'Cards',
    },
  },
  {
    path: '/example/elements/alerts',
    name: 'example-alerts',
    component: () => import('@/app_example/pages_app_example/elements/alerts.vue'),
    meta: {
      namespace: 'example',
      title: 'Alerts',
    },
  },
  {
    path: '/example/forms/basic',
    name: 'example-forms',
    component: () => import('@/app_example/pages_app_example/forms/basic.vue'),
    meta: {
      namespace: 'example',
      title: 'Forms',
    },
  },
  {
    path: '/example/datatables/basic',
    name: 'example-datatables',
    component: () => import('@/app_example/pages_app_example/datatables/basic.vue'),
    meta: {
      namespace: 'example',
      title: 'Datatables',
    },
  },
];

export default exampleRoutes;
