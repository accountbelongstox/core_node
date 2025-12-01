import { codemartRoutes } from '@/app_codemart/router_app_codemart/routes';
import { adminRoutes } from '@/app_admin/router_app_admin/routes';
import { exampleRoutes } from '@/app_example/router_app_example/routes';

export const allAppRoutes = [
  {
    path: '/',
    name: 'home',
    redirect: '/codemart',
  },
  ...codemartRoutes,
  ...adminRoutes,
  ...exampleRoutes,
];

export default allAppRoutes;
