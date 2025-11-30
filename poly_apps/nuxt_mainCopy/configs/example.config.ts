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

// Example App Configuration
export interface ExampleAppConfig {
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
  demo: {
    dataSourcesEnabled: boolean;
    analyticsEnabled: boolean;
    mockDataEnabled: boolean;
  };
}

export const exampleAppConfig: ExampleAppConfig = {
  name: 'Core Node Examples',
  description: 'Example application showcasing framework features',
  version: '1.0.0',
  namespace: 'example',
  routes: {
    prefix: '',
    pages: [
      'index',
      'mainsite-dashboard',
      'examples/datasource-demo',
      'examples/analytics-demo',
      'examples/components-demo'
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
    dataSourceDemo: true,
    componentsDemo: true,
    mockData: true
  },
  api: {
    baseUrl: '/api/example',
    endpoints: {
      dashboard: '/dashboard',
      datasources: '/datasources',
      analytics: '/analytics',
      demo: '/demo'
    }
  },
  demo: {
    dataSourcesEnabled: true,
    analyticsEnabled: true,
    mockDataEnabled: true
  }
};

export default exampleAppConfig;
