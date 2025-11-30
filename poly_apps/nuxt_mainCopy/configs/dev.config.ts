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

// Dev Tools App Configuration
export interface DevAppConfig {
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
  development: {
    supportedLanguages: string[];
    environments: string[];
    tools: string[];
    maxExecutionTime: number;
    maxMemoryUsage: number;
  };
  permissions: {
    required: string[];
    roles: string[];
  };
}

export const devAppConfig: DevAppConfig = {
  name: 'Development Tools',
  description: 'Development tools and utilities platform',
  version: '1.0.0',
  namespace: 'dev',
  routes: {
    prefix: '/dev',
    pages: [
      'dev-dashboard',
      'dev-tools',
      'dev-environments',
      'dev-editor',
      'dev-debugger',
      'dev-testing'
    ]
  },
  theme: {
    primary: '#8b5cf6',
    secondary: '#06b6d4',
    layout: 'dev-layout'
  },
  features: {
    codeEditor: true,
    debugging: true,
    testing: true,
    deployment: true,
    monitoring: true,
    collaboration: true,
    versionControl: true,
    containerization: true,
    cloudIntegration: true
  },
  api: {
    baseUrl: '/api/dev',
    endpoints: {
      tools: '/tools',
      environments: '/environments',
      editor: '/editor',
      debugger: '/debugger',
      testing: '/testing',
      deployment: '/deployment'
    }
  },
  development: {
    supportedLanguages: [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 
      'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Dart', 'Scala', 'R'
    ],
    environments: [
      'Node.js', 'Python', 'Java JVM', 'Docker', 'Kubernetes', 
      'AWS Lambda', 'Google Cloud Functions', 'Azure Functions'
    ],
    tools: [
      'Code Editor', 'Debugger', 'Terminal', 'Git Client', 'Database Client',
      'API Tester', 'Performance Monitor', 'Log Viewer', 'Container Manager'
    ],
    maxExecutionTime: 30000, // 30 seconds
    maxMemoryUsage: 512 // 512MB
  },
  permissions: {
    required: ['dev.access'],
    roles: ['developer', 'tester', 'devops', 'admin']
  }
};

export default devAppConfig;
