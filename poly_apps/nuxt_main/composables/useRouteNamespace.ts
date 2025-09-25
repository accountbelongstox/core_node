// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { computed } from 'vue';
import { useRoute } from 'vue-router';
import mainSiteConfig from '@/configs/mainsite.config';
import adminSubsiteConfig from '@/configs/subsite-admin.config';

// Route namespace configuration
export interface RouteNamespaceConfig {
  namespace: string;
  prefix: string;
  config: any;
  pages: string[];
  theme: {
    primary: string;
    secondary: string;
    layout: string;
  };
}

// Namespace registry
const namespaceRegistry: Record<string, RouteNamespaceConfig> = {
  mainsite: {
    namespace: 'mainsite',
    prefix: '',
    config: mainSiteConfig,
    pages: [
      'mainsite-dashboard',
      'mainsite-profile',
      'mainsite-settings'
    ],
    theme: mainSiteConfig.theme
  },
  admin: {
    namespace: 'admin',
    prefix: '/admin',
    config: adminSubsiteConfig,
    pages: [
      'datasources-admin',
      'users-admin',
      'settings-admin',
      'logs-admin'
    ],
    theme: adminSubsiteConfig.theme
  }
};

export const useRouteNamespace = () => {
  const route = useRoute();

  // Current namespace detection
  const currentNamespace = computed(() => {
    const path = route.path;
    
    // Check for admin routes
    if (path.startsWith('/admin')) {
      return 'admin';
    }
    
    // Check for other subsites
    for (const [namespace, config] of Object.entries(namespaceRegistry)) {
      if (config.prefix && path.startsWith(config.prefix)) {
        return namespace;
      }
    }
    
    // Default to mainsite
    return 'mainsite';
  });

  // Current configuration
  const currentConfig = computed(() => {
    return namespaceRegistry[currentNamespace.value];
  });

  // Navigation items for current namespace
  const navigationItems = computed(() => {
    const namespace = currentNamespace.value;
    
    switch (namespace) {
      case 'admin':
        return [
          { path: '/admin', label: 'Dashboard' },
          { path: '/admin/users', label: 'Users' },
          { path: '/admin/datasources', label: 'Data Sources' },
          { path: '/admin/settings', label: 'Settings' },
          { path: '/admin/logs', label: 'Logs' }
        ];
      case 'mainsite':
      default:
        return [
          { path: '/', label: 'Home' },
          { path: '/mainsite-dashboard', label: 'Dashboard' },
          { path: '/profile', label: 'Profile' },
          { path: '/settings', label: 'Settings' }
        ];
    }
  });

  // Theme configuration
  const themeConfig = computed(() => {
    return currentConfig.value.theme;
  });

  // Page title with namespace
  const getPageTitle = (title: string) => {
    const namespace = currentNamespace.value;
    const config = currentConfig.value;
    
    if (namespace === 'mainsite') {
      return title;
    }
    
    return `${config.config.name} - ${title}`;
  };

  // Check if route belongs to namespace
  const isNamespaceRoute = (namespace: string, path: string) => {
    const config = namespaceRegistry[namespace];
    if (!config) return false;
    
    if (config.prefix) {
      return path.startsWith(config.prefix);
    }
    
    return namespace === 'mainsite' && !path.startsWith('/admin');
  };

  // Get namespace from path
  const getNamespaceFromPath = (path: string) => {
    for (const [namespace, config] of Object.entries(namespaceRegistry)) {
      if (isNamespaceRoute(namespace, path)) {
        return namespace;
      }
    }
    return 'mainsite';
  };

  // Register new namespace
  const registerNamespace = (namespace: string, config: RouteNamespaceConfig) => {
    namespaceRegistry[namespace] = config;
  };

  // Get all registered namespaces
  const getAllNamespaces = () => {
    return Object.keys(namespaceRegistry);
  };

  // Get namespace configuration
  const getNamespaceConfig = (namespace: string) => {
    return namespaceRegistry[namespace];
  };

  return {
    currentNamespace,
    currentConfig,
    navigationItems,
    themeConfig,
    getPageTitle,
    isNamespaceRoute,
    getNamespaceFromPath,
    registerNamespace,
    getAllNamespaces,
    getNamespaceConfig,
    namespaceRegistry
  };
};
