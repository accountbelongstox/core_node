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

// CodeMart App Configuration
export interface CodeMartAppConfig {
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
  marketplace: {
    commission: number;
    paymentMethods: string[];
    supportedLanguages: string[];
    categories: string[];
  };
  permissions: {
    required: string[];
    roles: string[];
  };
}

export const codeMartAppConfig: CodeMartAppConfig = {
  name: 'CodeMart Platform',
  description: 'Code marketplace and development platform',
  version: '1.0.0',
  namespace: 'codemart',
  routes: {
    prefix: '/codemart',
    pages: [
      'codemart-dashboard',
      'codemart-marketplace',
      'codemart-projects',
      'codemart-authors',
      'codemart-categories'
    ]
  },
  theme: {
    primary: '#10b981',
    secondary: '#3b82f6',
    layout: 'codemart-layout'
  },
  features: {
    marketplace: true,
    codeRepository: true,
    projectManagement: true,
    collaboration: true,
    versionControl: true,
    paymentProcessing: true,
    authorProfiles: true,
    reviews: true,
    recommendations: true
  },
  api: {
    baseUrl: '/api/codemart',
    endpoints: {
      projects: '/projects',
      marketplace: '/marketplace',
      authors: '/authors',
      categories: '/categories',
      payments: '/payments',
      reviews: '/reviews'
    }
  },
  marketplace: {
    commission: 0.15, // 15% commission
    paymentMethods: ['credit_card', 'paypal', 'stripe', 'crypto'],
    supportedLanguages: [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'PHP', 
      'Go', 'Rust', 'Swift', 'Kotlin', 'Vue', 'React', 'Angular'
    ],
    categories: [
      'Web Development', 'Mobile Apps', 'Desktop Apps', 'APIs',
      'Libraries', 'Frameworks', 'Tools', 'Templates', 'Plugins',
      'Games', 'AI/ML', 'Blockchain', 'IoT', 'DevOps'
    ]
  },
  permissions: {
    required: ['codemart.access'],
    roles: ['developer', 'author', 'buyer', 'admin']
  }
};

export default codeMartAppConfig;
