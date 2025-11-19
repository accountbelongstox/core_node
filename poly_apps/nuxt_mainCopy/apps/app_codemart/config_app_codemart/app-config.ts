export const codemartAppConfig = {
  name: 'CodeMart',
  namespace: 'codemart',
  version: '1.0.0',
  description: 'CodeMart Business Application',

  routes: {
    prefix: '/codemart',
    home: '/codemart',
  },

  theme: {
    primary: '#667eea',
    name: 'codemart-theme',
  },

  api: {
    baseUrl: process.env.NUXT_PUBLIC_CODEMART_API_URL || '/api/codemart',
  },

  features: {
    projects: true,
    templates: true,
    reviews: true,
    payments: true,
  },
};

export default codemartAppConfig;
