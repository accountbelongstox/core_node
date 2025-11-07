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

// ============================================================================
// APPLICATION ENTRY POINT CONFIGURATION REGISTRY
// ============================================================================
//
// **PURPOSE**:
// Central registry for all application metadata including themes, API configs,
// features, and permissions. This file is imported by middleware and entry points
// to provide app-specific configuration.
//
// **ARCHITECTURE NOTE**:
// ⚠️ KNOWN LIMITATION: This file contains ALL app configurations in one place.
// While metadata objects are small (~1KB each), having them centralized means:
// 1. All app configs are loaded even if only one app is active
// 2. Increases coupling between apps
// 3. Requires modification of this file when adding new apps
//
// **FUTURE OPTIMIZATION**:
// Consider moving configs to individual app directories:
//   apps/app_ittools/app-config.json
//   apps/app_example/app-config.json
// Then dynamically import only the active app's config:
//   const config = await import(`./apps/app_${APP_ENTRY}/app-config.json`);
//
// **USAGE**:
// - Middleware: getCurrentAppEntry() to detect active app
// - Entry points: getAppEntryConfig('ittools') to load app settings
// - Routes: getAppEntryByNamespace('ittools') to find app by namespace
// ============================================================================

// Supported application types (must match directory names in apps/)
export type AppEntryType = 'example' | 'codemart' | 'dev' | 'admin' | 'dashboard' | 'ittools' | 'pymatrix';

export interface AppEntryConfig {
  name: string;
  displayName: string;
  description: string;
  namespace: string;
  defaultRoute: string;
  theme: {
    primary: string;
    secondary: string;
    layout: string;
  };
  api: {
    namespace: string;
    baseUrl: string;
    version: string;
  };
  features: {
    [key: string]: boolean;
  };
  permissions: {
    required: string[];
    roles: string[];
  };
}

// App Entry Registry
const appEntryRegistry: Record<AppEntryType, AppEntryConfig> = {
  ittools: {
    name: 'ittools',
    displayName: 'IT Tools',
    description: 'Collection of 88+ handy online tools for developers',
    namespace: 'ittools',
    defaultRoute: '/ittools',
    theme: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      layout: 'default'
    },
    api: {
      namespace: 'ittools',
      baseUrl: '/api/ittools',
      version: 'v1'
    },
    features: {
      search: true,
      favorites: true,
      history: true,
      api: true,
      themes: true,
      localization: false
    },
    permissions: {
      required: ['ittools.access'],
      roles: ['user', 'developer', 'admin']
    }
  },
  example: {
    name: 'example',
    displayName: 'Core Node Examples',
    description: 'Example application with demo features',
    namespace: 'example',
    defaultRoute: '/',
    theme: {
      primary: '#4361ee',
      secondary: '#805dca',
      layout: 'default'
    },
    api: {
      namespace: 'example',
      baseUrl: '/api/example',
      version: 'v1'
    },
    features: {
      dashboard: true,
      analytics: true,
      notifications: true,
      userManagement: false,
      dataSourceDemo: true
    },
    permissions: {
      required: ['example.access'],
      roles: ['user', 'admin']
    }
  },
  codemart: {
    name: 'codemart',
    displayName: 'CodeMart Platform',
    description: 'Code marketplace and development platform',
    namespace: 'codemart',
    defaultRoute: '/codemart',
    theme: {
      primary: '#10b981',
      secondary: '#3b82f6',
      layout: 'codemart-layout'
    },
    api: {
      namespace: 'codemart',
      baseUrl: '/api/codemart',
      version: 'v1'
    },
    features: {
      marketplace: true,
      codeRepository: true,
      projectManagement: true,
      collaboration: true,
      versionControl: true
    },
    permissions: {
      required: ['codemart.access'],
      roles: ['developer', 'admin']
    }
  },
  dev: {
    name: 'dev',
    displayName: 'Development Tools',
    description: 'Development tools and utilities platform',
    namespace: 'dev',
    defaultRoute: '/dev',
    theme: {
      primary: '#8b5cf6',
      secondary: '#06b6d4',
      layout: 'dev-layout'
    },
    api: {
      namespace: 'dev',
      baseUrl: '/api/dev',
      version: 'v1'
    },
    features: {
      codeEditor: true,
      debugging: true,
      testing: true,
      deployment: true,
      monitoring: true
    },
    permissions: {
      required: ['dev.access'],
      roles: ['developer', 'admin']
    }
  },
  admin: {
    name: 'admin',
    displayName: 'Admin Management System',
    description: 'Administrative management interface',
    namespace: 'admin',
    defaultRoute: '/admin',
    theme: {
      primary: '#e7515a',
      secondary: '#e2a03f',
      layout: 'admin'
    },
    api: {
      namespace: 'admin',
      baseUrl: '/api/admin',
      version: 'v1'
    },
    features: {
      userManagement: true,
      systemLogs: true,
      dataSourceManagement: true,
      systemSettings: true,
      analytics: true
    },
    permissions: {
      required: ['admin.access'],
      roles: ['admin', 'super_admin']
    }
  },
  dashboard: {
    name: 'dashboard',
    displayName: 'Analytics Dashboard',
    description: 'Data analytics and visualization dashboard',
    namespace: 'dashboard',
    defaultRoute: '/dashboard',
    theme: {
      primary: '#00ab55',
      secondary: '#2196f3',
      layout: 'dashboard'
    },
    api: {
      namespace: 'dashboard',
      baseUrl: '/api/dashboard',
      version: 'v1'
    },
    features: {
      analytics: true,
      charts: true,
      reports: true,
      realtime: true
    },
    permissions: {
      required: ['dashboard.access'],
      roles: ['analyst', 'admin']
    }
  },
  pymatrix: {
    name: 'pymatrix',
    displayName: 'pyMatrix Device Control',
    description: 'Android device mirroring and group control system',
    namespace: 'pymatrix',
    defaultRoute: '/pymatrix',
    theme: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      layout: 'pymatrix'
    },
    api: {
      namespace: 'pymatrix',
      baseUrl: '/api/pymatrix',
      version: 'v1'
    },
    features: {
      videoStreaming: true,
      deviceControl: true,
      groupControl: true,
      touchInput: true,
      keyboardInput: true
    },
    permissions: {
      required: ['pymatrix.access'],
      roles: ['user', 'developer', 'admin']
    }
  }
};

// Get current app entry from environment
export const getCurrentAppEntry = (): AppEntryType => {
  const appEntry = process.env.APP_ENTRY as AppEntryType;
  return appEntry && appEntry in appEntryRegistry ? appEntry : 'example';
};

// Get app entry configuration
export const getAppEntryConfig = (entry?: AppEntryType): AppEntryConfig => {
  const currentEntry = entry || getCurrentAppEntry();
  return appEntryRegistry[currentEntry];
};

// Get all app entries
export const getAllAppEntries = (): Record<AppEntryType, AppEntryConfig> => {
  return appEntryRegistry;
};

// Register new app entry
export const registerAppEntry = (entry: AppEntryType, config: AppEntryConfig) => {
  appEntryRegistry[entry] = config;
};

// Check if app entry exists
export const hasAppEntry = (entry: string): entry is AppEntryType => {
  return entry in appEntryRegistry;
};

// Get app entry by namespace
export const getAppEntryByNamespace = (namespace: string): AppEntryConfig | null => {
  for (const config of Object.values(appEntryRegistry)) {
    if (config.namespace === namespace) {
      return config;
    }
  }
  return null;
};

export default {
  getCurrentAppEntry,
  getAppEntryConfig,
  getAllAppEntries,
  registerAppEntry,
  hasAppEntry,
  getAppEntryByNamespace
};
