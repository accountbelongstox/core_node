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

// Admin Subsite Configuration
export interface AdminSubsiteConfig {
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
  permissions: {
    required: string[];
    roles: string[];
  };
  features: {
    [key: string]: boolean;
  };
  api: {
    baseUrl: string;
    endpoints: Record<string, string>;
  };
}

export const adminSubsiteConfig: AdminSubsiteConfig = {
  name: 'Admin Management System',
  description: 'Administrative management subsite',
  version: '1.0.0',
  namespace: 'admin',
  routes: {
    prefix: '/admin',
    pages: [
      'dashboard-admin',
      'users-admin',
      'datasources-admin',
      'settings-admin',
      'logs-admin'
    ]
  },
  theme: {
    primary: '#e7515a',
    secondary: '#e2a03f',
    layout: 'admin-layout'
  },
  permissions: {
    required: ['admin.access'],
    roles: ['admin', 'super_admin']
  },
  features: {
    userManagement: true,
    systemLogs: true,
    dataSourceManagement: true,
    systemSettings: true,
    analytics: true
  },
  api: {
    baseUrl: '/api/admin',
    endpoints: {
      users: '/users',
      datasources: '/datasources',
      logs: '/logs',
      settings: '/settings',
      dashboard: '/dashboard'
    }
  }
};

export default adminSubsiteConfig;
