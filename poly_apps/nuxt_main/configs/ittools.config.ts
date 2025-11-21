export interface ItToolsAppConfig {
  name: string;
  description: string;
  version: string;
  namespace: string;
  routes: {
    prefix: string;
    pages: string[];
  };
  theme: {
    primary: string;
    secondary: string;
    layout: string;
  };
  features: {
    [key: string]: boolean;
  };
  api: {
    baseUrl: string;
    endpoints: Record<string, string>;
  };
}

export const itToolsAppConfig: ItToolsAppConfig = {
  name: 'IT Tools',
  description: 'Collection of 88+ handy online tools for developers',
  version: '1.0.0',
  namespace: 'ittools',
  routes: {
    prefix: '/ittools',
    pages: [
      'index',
      'tools'
    ]
  },
  theme: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    layout: 'default'
  },
  features: {
    search: true,
    favorites: true,
    history: true,
    api: true,
    themes: true,
    localization: true
  },
  api: {
    baseUrl: '/api/ittools',
    endpoints: {
      tools: '/tools',
      favorites: '/favorites',
      history: '/history'
    }
  }
};

export default itToolsAppConfig;
