export const mainAppConfig = {
  name: 'Main',
  namespace: 'main',
  version: '1.0.0',
  description: 'Main Aggregator Application',

  apps: [
    {
      name: 'CodeMart',
      namespace: 'codemart',
      route: '/codemart',
      description: 'Business marketplace application',
    },
    {
      name: 'Admin',
      namespace: 'admin',
      route: '/admin',
      description: 'Administration panel',
    },
    {
      name: 'Example',
      namespace: 'example',
      route: '/example',
      description: 'Example and demo pages',
    },
    {
      name: 'Dev',
      namespace: 'dev',
      route: '/dev',
      description: 'Developer tools',
    },
    {
      name: 'Dashboard',
      namespace: 'dashboard',
      route: '/dashboard',
      description: 'Analytics dashboard',
    },
  ],

  routes: {
    prefix: '/',
    home: '/',
  },
};

export default mainAppConfig;
