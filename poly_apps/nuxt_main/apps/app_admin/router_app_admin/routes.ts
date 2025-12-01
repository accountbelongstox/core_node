export const adminRoutes = [
  {
    path: '/admin',
    name: 'admin',
    redirect: '/admin/datasources',
    meta: {
      namespace: 'admin',
    },
  },
  {
    path: '/admin/datasources',
    name: 'admin-datasources',
    component: () => import('@/app_admin/pages_app_admin/datasources.vue'),
    meta: {
      namespace: 'admin',
      title: 'Datasources',
    },
  },
];

export default adminRoutes;
