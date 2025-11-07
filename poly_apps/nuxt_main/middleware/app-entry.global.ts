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

import { getCurrentAppEntry, getAppEntryConfig } from '@/app-entry'

export default defineNuxtRouteMiddleware((to) => {
  // Skip for root route (handled by redirect middleware)
  if (to.path === '/') {
    return;
  }

  // Determine current app entry from route path or query parameter
  let currentEntry: string;

  // Extract app from route path (e.g., /index-example -> example)
  if (to.path.startsWith('/index-')) {
    currentEntry = to.path.replace('/index-', '');
  } else {
    // Fallback to query parameter or environment
    const queryApp = to.query.app as string;
    if (queryApp && ['example', 'codemart', 'dev', 'admin', 'dashboard', 'ittools', 'pymatrix'].includes(queryApp)) {
      currentEntry = queryApp;
    } else {
      currentEntry = getCurrentAppEntry();
    }
  }

  const appConfig = getAppEntryConfig(currentEntry as any)
  
  // Set app entry context in route meta
  to.meta.appEntry = currentEntry
  to.meta.appConfig = appConfig
  
  // Set theme based on app entry
  if (process.client) {
    // Update CSS variables for theme
    const root = document.documentElement
    root.style.setProperty('--color-primary', appConfig.theme.primary)
    root.style.setProperty('--color-secondary', appConfig.theme.secondary)
    
    // Update page title
    const baseTitle = to.meta.title as string || 'Core Node'
    const fullTitle = currentEntry === 'example' ? baseTitle : `${appConfig.displayName} - ${baseTitle}`
    
    if (typeof document !== 'undefined') {
      document.title = fullTitle
    }
    
    // Add app entry class to body
    document.body.className = document.body.className.replace(/app-entry-\w+/g, '')
    document.body.classList.add(`app-entry-${currentEntry}`)
  }
  
  // Log app entry context (development only)
  if (process.dev) {
    console.log(`[App Entry] Current: ${currentEntry}, Route: ${to.path}, Namespace: ${appConfig.namespace}`)
  }
})
