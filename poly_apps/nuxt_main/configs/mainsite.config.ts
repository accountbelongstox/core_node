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

// Main Site Configuration
export interface MainSiteConfig {
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

export const mainSiteConfig: MainSiteConfig = {
  name: 'Core Node Main Site',
  description: 'Main site for Core Node platform',
  version: '1.0.0',
  namespace: 'mainsite',
  routes: {
    prefix: '',
    pages: [
      'index',
      'dashboard',
      'profile',
      'settings'
    ]
  },
  theme: {
    primary: '#4361ee',
    secondary: '#805dca',
    layout: 'default'
  },
  features: {
    dashboard: true,
    analytics: true,
    notifications: true,
    userManagement: false
  },
  api: {
    baseUrl: '/api/mainsite',
    endpoints: {
      dashboard: '/dashboard',
      profile: '/profile',
      settings: '/settings'
    }
  }
};

export default mainSiteConfig;
