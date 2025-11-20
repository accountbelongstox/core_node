export const codemartRoutes = [
  {
    path: '/codemart',
    name: 'codemart',
    component: () => import('@/app_codemart/pages_app_codemart/index.vue'),
    meta: {
      layout: 'codemart-layout',
      namespace: 'codemart',
      title: 'CodeMart Dashboard',
    },
  },
  {
    path: '/codemart/projects',
    name: 'codemart-projects',
    component: () => import('@/app_codemart/pages_app_codemart/apps/projects.vue'),
    meta: {
      layout: 'codemart-layout',
      namespace: 'codemart',
      title: 'Projects',
    },
  },
];

export default codemartRoutes;
