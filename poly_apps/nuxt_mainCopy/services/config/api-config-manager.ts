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

import { getCurrentAppEntry, getAppEntryConfig, type AppEntryType } from '@/app-entry'

// API Configuration Interface
export interface APIConfig {
  namespace: string;
  baseUrl: string;
  version: string;
  timeout: number;
  retryCount: number;
  headers: Record<string, string>;
  endpoints: Record<string, string>;
}

// Multi-level API namespace configuration
export interface APINamespaceConfig {
  [appEntry: string]: {
    [service: string]: APIConfig;
  };
}

// API Configuration Registry
const apiConfigRegistry: APINamespaceConfig = {
  example: {
    datasource: {
      namespace: 'example.datasource',
      baseUrl: '/api/example/datasource',
      version: 'v1',
      timeout: 10000,
      retryCount: 3,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'example'
      },
      endpoints: {
        list: '/list',
        create: '/create',
        update: '/update',
        delete: '/delete',
        test: '/test',
        stats: '/stats',
        health: '/health'
      }
    },
    analytics: {
      namespace: 'example.analytics',
      baseUrl: '/api/example/analytics',
      version: 'v1',
      timeout: 15000,
      retryCount: 2,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'example'
      },
      endpoints: {
        dashboard: '/dashboard-metrics',
        userActivity: '/user-activity',
        performance: '/system-performance',
        activities: '/recent-activities',
        features: '/feature-usage'
      }
    }
  },
  codemart: {
    projects: {
      namespace: 'codemart.projects',
      baseUrl: '/api/codemart/projects',
      version: 'v1',
      timeout: 12000,
      retryCount: 3,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'codemart'
      },
      endpoints: {
        list: '/list',
        search: '/search',
        featured: '/featured',
        categories: '/categories',
        stats: '/stats',
        purchase: '/purchase'
      }
    },
    marketplace: {
      namespace: 'codemart.marketplace',
      baseUrl: '/api/codemart/marketplace',
      version: 'v1',
      timeout: 10000,
      retryCount: 3,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'codemart'
      },
      endpoints: {
        trending: '/trending',
        recommendations: '/recommendations',
        reviews: '/reviews',
        authors: '/authors'
      }
    }
  },
  dev: {
    tools: {
      namespace: 'dev.tools',
      baseUrl: '/api/dev/tools',
      version: 'v1',
      timeout: 15000,
      retryCount: 2,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'dev'
      },
      endpoints: {
        list: '/list',
        launch: '/launch',
        stop: '/stop',
        execute: '/execute',
        stats: '/stats'
      }
    },
    environments: {
      namespace: 'dev.environments',
      baseUrl: '/api/dev/environments',
      version: 'v1',
      timeout: 20000,
      retryCount: 2,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'dev'
      },
      endpoints: {
        list: '/list',
        create: '/create',
        start: '/start',
        stop: '/stop',
        status: '/status'
      }
    }
  },
  admin: {
    datasource: {
      namespace: 'admin.datasource',
      baseUrl: '/api/admin/datasource',
      version: 'v1',
      timeout: 12000,
      retryCount: 3,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'admin',
        'X-Admin-Access': 'true'
      },
      endpoints: {
        all: '/all',
        byNamespace: '/namespace',
        create: '/create',
        update: '/update',
        delete: '/delete',
        bulkUpdate: '/bulk-update',
        systemStats: '/system-stats',
        testAll: '/test-all',
        auditLogs: '/audit-logs'
      }
    },
    users: {
      namespace: 'admin.users',
      baseUrl: '/api/admin/users',
      version: 'v1',
      timeout: 10000,
      retryCount: 3,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'admin',
        'X-Admin-Access': 'true'
      },
      endpoints: {
        list: '/list',
        search: '/search',
        create: '/create',
        update: '/update',
        delete: '/delete',
        statistics: '/statistics',
        bulkUpdate: '/bulk-update',
        export: '/export'
      }
    },
    system: {
      namespace: 'admin.system',
      baseUrl: '/api/admin/system',
      version: 'v1',
      timeout: 20000,
      retryCount: 2,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'admin',
        'X-Admin-Access': 'true'
      },
      endpoints: {
        logs: '/logs',
        settings: '/settings',
        health: '/health',
        metrics: '/metrics',
        backup: '/backup',
        restore: '/restore'
      }
    }
  },
  dashboard: {
    analytics: {
      namespace: 'dashboard.analytics',
      baseUrl: '/api/dashboard/analytics',
      version: 'v1',
      timeout: 15000,
      retryCount: 2,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'dashboard'
      },
      endpoints: {
        charts: '/charts',
        reports: '/reports',
        realtime: '/realtime',
        export: '/export'
      }
    },
    widgets: {
      namespace: 'dashboard.widgets',
      baseUrl: '/api/dashboard/widgets',
      version: 'v1',
      timeout: 8000,
      retryCount: 3,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Namespace': 'dashboard'
      },
      endpoints: {
        list: '/list',
        config: '/config',
        data: '/data'
      }
    }
  }
};

// API Configuration Manager Class
export class APIConfigManager {
  private currentAppEntry: AppEntryType;
  
  constructor() {
    this.currentAppEntry = getCurrentAppEntry();
  }

  // Get API configuration for current app entry and service
  getAPIConfig(service: string): APIConfig | null {
    const appConfig = apiConfigRegistry[this.currentAppEntry];
    if (!appConfig || !appConfig[service]) {
      console.warn(`API config not found for ${this.currentAppEntry}.${service}`);
      return null;
    }
    return appConfig[service];
  }

  // Get API configuration for specific app entry and service
  getAPIConfigFor(appEntry: AppEntryType, service: string): APIConfig | null {
    const appConfig = apiConfigRegistry[appEntry];
    if (!appConfig || !appConfig[service]) {
      console.warn(`API config not found for ${appEntry}.${service}`);
      return null;
    }
    return appConfig[service];
  }

  // Get all services for current app entry
  getAvailableServices(): string[] {
    const appConfig = apiConfigRegistry[this.currentAppEntry];
    return appConfig ? Object.keys(appConfig) : [];
  }

  // Get all services for specific app entry
  getAvailableServicesFor(appEntry: AppEntryType): string[] {
    const appConfig = apiConfigRegistry[appEntry];
    return appConfig ? Object.keys(appConfig) : [];
  }

  // Build full API URL
  buildAPIUrl(service: string, endpoint: string, params?: Record<string, string>): string {
    const config = this.getAPIConfig(service);
    if (!config) {
      throw new Error(`API config not found for service: ${service}`);
    }

    const endpointPath = config.endpoints[endpoint];
    if (!endpointPath) {
      throw new Error(`Endpoint not found: ${endpoint} in service: ${service}`);
    }

    let url = `${config.baseUrl}${endpointPath}`;
    
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  // Get headers for API request
  getHeaders(service: string, additionalHeaders?: Record<string, string>): Record<string, string> {
    const config = this.getAPIConfig(service);
    if (!config) {
      throw new Error(`API config not found for service: ${service}`);
    }

    return {
      ...config.headers,
      ...additionalHeaders
    };
  }

  // Switch app entry context
  switchAppEntry(newEntry: AppEntryType) {
    this.currentAppEntry = newEntry;
  }

  // Register new API configuration
  registerAPIConfig(appEntry: AppEntryType, service: string, config: APIConfig) {
    if (!apiConfigRegistry[appEntry]) {
      apiConfigRegistry[appEntry] = {};
    }
    apiConfigRegistry[appEntry][service] = config;
  }

  // Get current app entry
  getCurrentAppEntry(): AppEntryType {
    return this.currentAppEntry;
  }

  // Get full registry (for debugging)
  getFullRegistry(): APINamespaceConfig {
    return apiConfigRegistry;
  }
}

// Export singleton instance
export const apiConfigManager = new APIConfigManager();
export default apiConfigManager;
