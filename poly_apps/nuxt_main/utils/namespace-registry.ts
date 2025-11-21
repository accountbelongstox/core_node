// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import type { AppEntryType, AppEntryConfig } from '@/app-entry';
import { getAppEntryConfig, getAllAppEntries } from '@/app-entry';

export type RegisteredNamespace = 'example' | 'codemart' | 'dev' | 'admin' | 'dashboard' | 'pymatrix' | 'ittools' | 'main';

export interface NamespaceValidation {
  namespace: string;
  appEntry: boolean;
  routeNamespace: boolean;
  config: boolean;
  apiServices: boolean;
  pageEntry: boolean;
  complete: boolean;
  missing: string[];
}

export class NamespaceRegistry {
  private static instance: NamespaceRegistry;

  private constructor() {}

  static getInstance(): NamespaceRegistry {
    if (!NamespaceRegistry.instance) {
      NamespaceRegistry.instance = new NamespaceRegistry();
    }
    return NamespaceRegistry.instance;
  }

  validateNamespace(namespace: RegisteredNamespace): NamespaceValidation {
    const validation: NamespaceValidation = {
      namespace,
      appEntry: false,
      routeNamespace: false,
      config: false,
      apiServices: false,
      pageEntry: false,
      complete: false,
      missing: []
    };

    try {
      const appConfig = getAppEntryConfig(namespace as AppEntryType);
      validation.appEntry = !!appConfig;
      validation.config = !!appConfig.api;
    } catch (error) {
      validation.missing.push('app-entry');
    }

    validation.complete = validation.appEntry && validation.config;

    return validation;
  }

  validateAll(): Record<RegisteredNamespace, NamespaceValidation> {
    const namespaces: RegisteredNamespace[] = ['example', 'codemart', 'dev', 'admin', 'dashboard', 'pymatrix', 'ittools', 'main'];
    const results = {} as Record<RegisteredNamespace, NamespaceValidation>;

    for (const namespace of namespaces) {
      results[namespace] = this.validateNamespace(namespace);
    }

    return results;
  }

  getCompleteness(): { total: number; complete: number; percentage: number } {
    const validations = this.validateAll();
    const total = Object.keys(validations).length;
    const complete = Object.values(validations).filter(v => v.complete).length;

    return {
      total,
      complete,
      percentage: Math.round((complete / total) * 100)
    };
  }

  isNamespaceValid(namespace: string): namespace is RegisteredNamespace {
    const validNamespaces: RegisteredNamespace[] = ['example', 'codemart', 'dev', 'admin', 'dashboard', 'pymatrix', 'ittools', 'main'];
    return validNamespaces.includes(namespace as RegisteredNamespace);
  }

  getNamespacesList(): RegisteredNamespace[] {
    return ['example', 'codemart', 'dev', 'admin', 'dashboard', 'pymatrix', 'ittools', 'main'];
  }
}

export const namespaceRegistry = NamespaceRegistry.getInstance();

export function validateNamespaceType(namespace: string): asserts namespace is RegisteredNamespace {
  if (!namespaceRegistry.isNamespaceValid(namespace)) {
    throw new Error(`Invalid namespace: ${namespace}. Must be one of: example, codemart, dev, admin, dashboard, pymatrix, ittools, main`);
  }
}
