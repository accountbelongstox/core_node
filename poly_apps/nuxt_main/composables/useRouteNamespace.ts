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
import exampleConfig from '@/configs/example.config';
import codemartConfig from '@/configs/codemart.config';
import devConfig from '@/configs/dev.config';
import adminSubsiteConfig from '@/configs/subsite-admin.config';
import dashboardConfig from '@/configs/dashboard.config';
import pymatrixConfig from '@/configs/pymatrix.config';
import mainsiteConfig from '@/configs/mainsite.config';

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
  example: {
    namespace: 'example',
    prefix: '',
    config: exampleConfig,
    pages: [
      'index',
      'mainsite-dashboard',
      'examples/datasource-demo'
    ],
    theme: exampleConfig.theme
  },
  codemart: {
    namespace: 'codemart',
    prefix: '/codemart',
    config: codemartConfig,
    pages: [
      'codemart-dashboard',
      'codemart-projects',
      'codemart-marketplace'
    ],
    theme: codemartConfig.theme
  },
  dev: {
    namespace: 'dev',
    prefix: '/dev',
    config: devConfig,
    pages: [
      'dev-dashboard',
      'dev-code-editor',
      'dev-tools'
    ],
    theme: devConfig.theme
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
  },
  dashboard: {
    namespace: 'dashboard',
    prefix: '/dashboard',
    config: dashboardConfig,
    pages: [
      'analytics',
      'charts',
      'reports'
    ],
    theme: dashboardConfig.theme
  },
  pymatrix: {
    namespace: 'pymatrix',
    prefix: '/pymatrix',
    config: pymatrixConfig,
    pages: [
      'pymatrix',
      'pymatrix-devices',
      'pymatrix-groups'
    ],
    theme: pymatrixConfig.theme
  },
  ittools: {
    namespace: 'ittools',
    prefix: '/ittools',
    config: { name: 'IT Tools', namespace: 'ittools', routes: { prefix: '/ittools', pages: [] }, theme: { primary: '#3b82f6', secondary: '#8b5cf6', layout: 'default' }, features: {}, api: { baseUrl: '/api/ittools', endpoints: {} } },
    pages: [
      'ittools',
      'ittools-tools'
    ],
    theme: { primary: '#3b82f6', secondary: '#8b5cf6', layout: 'default' }
  },
  main: {
    namespace: 'main',
    prefix: '/main',
    config: mainsiteConfig,
    pages: [
      'main'
    ],
    theme: mainsiteConfig.theme
  }
};

export const useRouteNamespace = () => {
  const route = useRoute();

  // Current namespace detection
  const currentNamespace = computed(() => {
    const path = route.path;

    // Check all registered namespaces with prefixes (priority order)
    const prefixedNamespaces = Object.entries(namespaceRegistry)
      .filter(([_, config]) => config.prefix)
      .sort((a, b) => b[1].prefix.length - a[1].prefix.length);

    for (const [namespace, config] of prefixedNamespaces) {
      if (path.startsWith(config.prefix)) {
        return namespace;
      }
    }

    // Default to example (root namespace)
    return 'example';
  });

  // Current configuration
  const currentConfig = computed(() => {
    return namespaceRegistry[currentNamespace.value];
  });

  // Navigation items for current namespace
  const navigationItems = computed(() => {
    const namespace = currentNamespace.value;

    switch (namespace) {
      case 'example':
        return [
          { path: '/', label: 'Home' },
          { path: '/mainsite-dashboard', label: 'Dashboard' },
          { path: '/examples/datasource-demo', label: 'Data Source Demo' }
        ];
      case 'codemart':
        return [
          { path: '/codemart', label: 'Dashboard' },
          { path: '/codemart/projects', label: 'Projects' },
          { path: '/codemart/marketplace', label: 'Marketplace' }
        ];
      case 'dev':
        return [
          { path: '/dev', label: 'Dashboard' },
          { path: '/dev/code-editor', label: 'Code Editor' },
          { path: '/dev/tools', label: 'Tools' }
        ];
      case 'admin':
        return [
          { path: '/admin', label: 'Dashboard' },
          { path: '/admin/users', label: 'Users' },
          { path: '/admin/datasources', label: 'Data Sources' },
          { path: '/admin/settings', label: 'Settings' }
        ];
      case 'dashboard':
        return [
          { path: '/dashboard', label: 'Overview' },
          { path: '/dashboard/analytics', label: 'Analytics' },
          { path: '/dashboard/charts', label: 'Charts' }
        ];
      case 'pymatrix':
        return [
          { path: '/pymatrix', label: 'Devices' },
          { path: '/pymatrix/groups', label: 'Groups' },
          { path: '/pymatrix/settings', label: 'Settings' }
        ];
      case 'ittools':
        return [
          { path: '/ittools', label: 'Home' },
          { path: '/ittools/tools', label: 'Tools' }
        ];
      case 'main':
        return [
          { path: '/main', label: 'Home' }
        ];
      default:
        return [];
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

    if (namespace === 'example') {
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

    // Root namespace check (example)
    const otherPrefixes = Object.values(namespaceRegistry)
      .map(c => c.prefix)
      .filter(p => p);

    return namespace === 'example' && !otherPrefixes.some(prefix => path.startsWith(prefix));
  };

  // Get namespace from path
  const getNamespaceFromPath = (path: string) => {
    for (const [namespace, config] of Object.entries(namespaceRegistry)) {
      if (isNamespaceRoute(namespace, path)) {
        return namespace;
      }
    }
    return 'example';
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

  // Validate namespace completeness
  const validateNamespace = (namespace: string): { valid: boolean; missing: string[] } => {
    const config = namespaceRegistry[namespace];
    const missing: string[] = [];

    if (!config) {
      return { valid: false, missing: ['namespace not registered'] };
    }

    if (!config.namespace) missing.push('namespace');
    if (!config.config) missing.push('config');
    if (!config.pages || config.pages.length === 0) missing.push('pages');
    if (!config.theme) missing.push('theme');

    return {
      valid: missing.length === 0,
      missing
    };
  };

  // Validate all namespaces
  const validateAllNamespaces = (): Record<string, { valid: boolean; missing: string[] }> => {
    const results: Record<string, { valid: boolean; missing: string[] }> = {};

    for (const namespace of Object.keys(namespaceRegistry)) {
      results[namespace] = validateNamespace(namespace);
    }

    return results;
  };

  // Check if namespace exists
  const hasNamespace = (namespace: string): boolean => {
    return namespace in namespaceRegistry;
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
    validateNamespace,
    validateAllNamespaces,
    hasNamespace,
    namespaceRegistry
  };
};
