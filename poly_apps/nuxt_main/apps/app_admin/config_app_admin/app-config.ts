export const adminAppConfig = {
  name: 'Admin',
  namespace: 'admin',
  version: '1.0.0',
  description: 'Administration Application',

  routes: {
    prefix: '/admin',
    home: '/admin',
  },

  theme: {
    primary: '#dc2626',
    name: 'admin-theme',
  },

  api: {
    baseUrl: process.env.NUXT_PUBLIC_ADMIN_API_URL || '/api/admin',
  },

  features: {
    users: true,
    roles: true,
    permissions: true,
    datasources: true,
    logs: true,
    settings: true,
  },
};

export default adminAppConfig;
