# Nuxt Multi-App Architecture Analysis & Fixes Required

**Date:** 2025-10-21
**Project:** poly_apps/nuxt_main
**Status:** Analysis Complete with Action Items

---

## EXECUTIVE SUMMARY

The project implements a sophisticated **hierarchical multi-app architecture** where:
- **Base/Common Library** provides shared components, themes, stores, and utilities
- **Sub-Apps** (ittools, codemart, admin, dev, dashboard, example, main) extend the base
- **Each app has isolated** components, stores, services, routes, themes, and types
- **Shared entry point system** uses environment variable `APP_ENTRY` to select active app

**Critical Issues Found:** 9 major architectural inconsistencies requiring fixes

---

## PART 1: CURRENT ARCHITECTURE (AS-IS)

### 1. BASE/COMMON LIBRARY STRUCTURE

**Location:** `common/` directory

**Core Exports:**

```
common/
├── stores/
│   └── base-store.ts          -> createBaseStore() factory
├── theme/
│   └── base-theme.config.ts   -> BaseTheme class, interfaces
├── composables/
│   └── useAppTheme.ts         -> Hook for accessing theme
├── components/
│   ├── dashboard/             -> ProgressChart, StatCard, WelcomeCard
│   ├── layout/                -> MainHeader
│   └── ui/                    -> DataTable
├── layouts/
│   ├── auth.vue               -> Auth layout
│   └── default.vue            -> Default layout
├── plugins/
│   └── theme.client.ts        -> Route-based theme detection
├── constants/
│   └── base-constants.ts      -> Shared constants
└── styles/
    └── theme-base.css         -> CSS variables
```

**Base Store Factory Pattern:**
```typescript
// All app stores should extend this
export function createBaseStore(storeName: string, initialTheme?) {
  return defineStore(storeName, () => {
    const user = ref(null);
    const isAuthenticated = ref(false);
    const loading = ref(false);
    const error = ref(null);
    const theme = ref(initialTheme);

    // Template methods - must override in child
    async function login(credentials) { /* override */ }
    async function logout() { /* shared impl */ }
  });
}
```

### 2. SUB-APP STRUCTURE

**Standard Pattern (mostly followed):**

```
app_[name]/
├── app-config.json                  # Port, display name, commands
├── components_app_[name]/           # Vue components
├── composables_app_[name]/          # Vue composables
├── config_app_[name]/               # App config
├── constants_app_[name]/            # App constants
├── layouts_app_[name]/              # App layouts
├── locales_app_[name]/              # i18n translations (not used)
├── pages_app_[name]/                # Pages (index.vue + sub-pages)
├── router_app_[name]/               # Route definitions (NOT INTEGRATED)
├── services_app_[name]/             # API service classes
├── stores_app_[name]/               # Pinia stores
├── styles_app_[name]/               # CSS/styles
├── theme_app_[name]/                # Theme config
└── types_app_[name]/                # TypeScript types
```

### 3. ENTRY POINT SYSTEM

**How it Works:**

1. **Environment variable** `APP_ENTRY` set at build/runtime
2. **Pages directory** contains entry points:
   - `pages/index.vue` (auto-generated from APP_ENTRY)
   - `pages/index.ittools.vue` (manual)
   - `pages/index.codemart.vue` (manual)
   - `pages/index.admin.vue` (manual)
   - etc.

3. **App registry** in `app-entry.ts`:
```typescript
const appEntryRegistry: Record<AppEntryType, AppEntryConfig> = {
  ittools: {
    name: 'ittools',
    displayName: 'IT Tools',
    theme: { primary: '#3b82f6', secondary: '#8b5cf6' },
    api: { namespace: 'ittools', baseUrl: '/api/ittools' },
    // ...
  },
  // ... other apps
};
```

4. **Middleware detection** (`middleware/app-entry.global.ts`):
   - Detects app from route path
   - Applies theme colors
   - Sets body class `app-entry-{name}`

### 4. THEME INHERITANCE

**Base Theme** (`common/theme/base-theme.config.ts`):
- Defines all color categories
- Defines spacing, typography, shadows, border-radius
- Provides `extend()` method for sub-app themes
- `toCSSVariables()` for CSS generation
- `applyCSSVariables()` for DOM application

**App-Specific Themes** (e.g., `app_ittools/theme_app_ittools/colors.ts`):
```typescript
export const itToolsThemeColors = {
  primary: { 50, 500, 900 },
  categories: {
    crypto: { light, main, dark },
    converter: { light, main, dark },
    // ...
  }
};
```

**Application** via plugin (`plugins/theme.client.ts`):
```typescript
export default defineNuxtPlugin(() => {
  watch(() => route.path, () => {
    const currentApp = detectCurrentApp();
    const theme = themes[currentApp];
    theme.applyCSSVariables();
  }, { immediate: true });
});
```

### 5. STORE/STATE MANAGEMENT

**Global App Store** (`stores/index.ts`):
- User, roles, permissions
- UI state (dark mode, layout, language)
- 15 predefined roles
- localStorage persistence

**App-Specific Stores** - TWO LOCATIONS (DUPLICATION):
1. **Centralized:** `stores/apps/codemart-store.ts`
2. **App-local:** `apps/app_codemart/stores_app_codemart/codemart-store.ts`

Both are nearly identical - creates confusion about source of truth.

**Example - IT Tools Store** (`app_ittools/stores_app_ittools/ittools-store.ts`):
```typescript
export const useItToolsStore = defineStore('ittools', {
  state: () => ({
    allTools: ALL_TOOLS,
    selectedTool: null,
    searchQuery: '',
    favorites: [],
    history: [],
    // ...
  }),
  getters: {
    toolsByCategory, favoriteTools, recentTools, // ...
  },
  actions: {
    filterTools, selectTool, addToFavorites, // ...
  }
});
```

### 6. API/SERVICES

**Service Pattern:**
- **Class-based** API clients
- **Typed responses** with `ApiResponse<T>`
- **Instance singletons** exported for global usage

**Example - IT Tools API** (`app_ittools/services_app_ittools/ittools-main-api.ts`):
```typescript
export class ItToolsMainAPI {
  private baseUrl = '/api/ittools';

  async hashText(text, algorithm) { /* ... */ }
  async base64Encode(text) { /* ... */ }
  async jsonPrettify(json) { /* ... */ }
  // ... 88+ tool methods
}

export const itToolsAPI = new ItToolsMainAPI();
```

### 7. TYPES

**Scattered across locations:**
- `common/theme/base-theme.config.ts` - Theme types
- `common/stores/base-store.ts` - BaseUser type
- `app_ittools/types_app_ittools/index.ts` - ToolParam, Tool, HistoryEntry
- `app_codemart/types/` - CodeMart types (NOTE: Wrong directory name!)
- `app-entry.ts` - AppEntryConfig type
- `stores/index.ts` - Role, AppConfig interfaces

**No centralized type export point** - Each file defines and exports types independently.

---

## PART 2: ARCHITECTURAL INCONSISTENCIES (ISSUES FOUND)

### ISSUE 1: Directory Naming Inconsistency

**Problem:** Not all apps follow the `_app_[name]` naming convention consistently.

**Current State:**
- **Correct:** `components_app_ittools/`, `stores_app_ittools/`, `types_app_ittools/`
- **Incorrect - CodeMart:** `types/` instead of `types_app_codemart/`
- **Empty:** `router_app_ittools/` (directory exists but unused)

**Impact:**
- Auto-discovery scripts can't reliably find resources
- Inconsistent import patterns (e.g., `@/app_codemart/types/` vs `@/app_ittools/types_app_ittools/`)
- New developers confused about naming standards

**Fix Required:**
```bash
# Rename CodeMart types directory
mv apps/app_codemart/types/ apps/app_codemart/types_app_codemart/

# Update all imports in CodeMart app
# From: @/app_codemart/types/
# To:   @/app_codemart/types_app_codemart/
```

**Files to update:**
- `apps/app_codemart/stores_app_codemart/codemart-store.ts`
- All CodeMart components importing types
- `services/api/codemart/codemart-projects-api.ts`

---

### ISSUE 2: Duplicated Store Definitions

**Problem:** Stores defined in TWO locations with identical code.

**Current State:**
```
stores/apps/codemart-store.ts              (Centralized)
apps/app_codemart/stores_app_codemart/codemart-store.ts  (App-local)
```

Both import from different paths:
```typescript
// Centralized version
import codemartTheme from '@/app_codemart/theme_app_codemart/codemart-theme';

// App-local version
import codemartTheme from '../theme_app_codemart/codemart-theme';
```

**Impact:**
- Maintenance nightmare - changes must be made in two places
- Confusion about which is the "real" store
- Runtime state might be out of sync if both are imported
- Breaks single-source-of-truth principle

**Fix Required:**
1. **Choose single location** - Recommendation: Use `stores/apps/` (centralized)
2. **Delete duplicates** from `apps/app_[name]/stores_app_[name]/`
3. **Update imports** to use centralized stores
4. **Keep backward compatibility** - Allow imports from both paths (re-export)

**Implementation:**
```typescript
// stores/apps/codemart-store.ts (KEEP - source of truth)
import codemartTheme from '@/app_codemart/theme_app_codemart/codemart-theme';
export const useCodemartStore = defineStore('codemart', { /* ... */ });

// apps/app_codemart/stores_app_codemart/index.ts (NEW - re-export)
export { useCodemartStore } from '@/stores/apps/codemart-store';
// Allow: import { useCodemartStore } from '@/app_codemart/stores_app_codemart'
```

---

### ISSUE 3: Router Integration Incomplete

**Problem:** App-specific routes defined but never registered in actual router.

**Current State:**
- Routes exist in `router_app_[name]/routes.ts`
- But there's no registration mechanism
- Routes are NOT added to Nuxt router at runtime

**Example:**
```typescript
// apps/app_codemart/router_app_codemart/routes.ts
export const codemartRoutes = [
  {
    path: '/codemart',
    name: 'codemart',
    component: () => import('@/app_codemart/pages_app_codemart/index.vue'),
  },
  // ... more routes
];

// These are defined but NEVER USED!
```

**Impact:**
- Nested routing within apps not possible
- No route metadata or permissions
- Route definitions are dead code
- Page navigation requires manual path setup

**Fix Required:**

1. **Create route aggregator** (`router/app-routes.ts`):
```typescript
import { codemartRoutes } from '@/app_codemart/router_app_codemart/routes';
import { itToolsRoutes } from '@/app_ittools/router_app_ittools/routes';
import { adminRoutes } from '@/app_admin/router_app_admin/routes';

export const appRoutes = [
  ...codemartRoutes,
  ...itToolsRoutes,
  ...adminRoutes,
  // ... include all app routes
];

export const createAppRouter = () => {
  return [
    {
      path: '/',
      component: () => import('@/layouts/default.vue'),
      children: appRoutes
    }
  ];
};
```

2. **Register routes in Nuxt config** (`nuxt.config.ts`):
```typescript
export default defineNuxtConfig({
  router: {
    options: {
      strict: true,
      sensitive: false,
    }
  },
  // Use route aggregator for dynamic routing
  hooks: {
    'pages:extend'(routes) {
      const { appRoutes } = await import('./router/app-routes');
      routes.push(...appRoutes);
    }
  }
});
```

3. **Enable app-specific routing** in each app:
```typescript
// apps/app_ittools/router_app_ittools/routes.ts
export const itToolsRoutes = [
  {
    path: '/ittools',
    component: () => import('@/app_ittools/pages_app_ittools/index.vue'),
    meta: { namespace: 'ittools', layout: 'default' },
    children: [
      {
        path: 'favorites',
        component: () => import('@/app_ittools/pages_app_ittools/favorites.vue'),
      },
      {
        path: 'history',
        component: () => import('@/app_ittools/pages_app_ittools/history.vue'),
      },
      // ... nested routes
    ]
  }
];
```

---

### ISSUE 4: Entry Point Generation Not Standardized

**Problem:** Entry point pages (`pages/index.*.vue`) have inconsistent generation/creation methods.

**Current State:**
- `pages/index.ittools.vue` - auto-generated (comment says "DO NOT EDIT")
- `pages/index.codemart.vue` - manually created
- `pages/index.vue` - generated from APP_ENTRY at runtime

No clear script that generates these files, making it hard to maintain consistency.

**Fix Required:**

1. **Create entry point generator** (`scripts/generate-app-entries.js`):
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { pascalCase } = require('change-case');

const APPS_DIR = path.join(__dirname, '../poly_apps/nuxt_main/apps');
const PAGES_DIR = path.join(__dirname, '../poly_apps/nuxt_main/pages');

const apps = fs.readdirSync(APPS_DIR)
  .filter(dir => dir.startsWith('app_'))
  .map(dir => dir.replace('app_', ''));

apps.forEach(app => {
  const filename = `${PAGES_DIR}/index.${app}.vue`;
  const componentPath = `@/app_${app}/pages_app_${app}/index.vue`;

  const content = `<!-- AUTO-GENERATED - DO NOT EDIT MANUALLY -->
<!-- Generated by scripts/generate-app-entries.js -->
<!-- To regenerate: npm run generate:app-entries -->

<script setup lang="ts">
import ${pascalCase(app)}Page from '${componentPath}';
</script>

<template>
  <${pascalCase(app)}Page />
</template>
`;

  fs.writeFileSync(filename, content);
  console.log(`[OK] Generated ${filename}`);
});
```

2. **Add npm script** (`package.json`):
```json
{
  "scripts": {
    "generate:app-entries": "node scripts/generate-app-entries.js",
    "postinstall": "npm run generate:app-entries",
    "prebuild": "npm run generate:app-entries"
  }
}
```

3. **Standardize entry point structure**:
```vue
<!-- All pages/index.*.vue should follow this pattern -->
<script setup lang="ts">
// Single import, single component
import AppPage from '@/app_[name]/pages_app_[name]/index.vue';
</script>

<template>
  <AppPage />
</template>
```

---

### ISSUE 5: Theme Plugin Detection Too Fragile

**Problem:** Theme selection relies on fragile string path matching.

**Current Code** (`plugins/theme.client.ts`):
```typescript
const detectCurrentApp = () => {
  const path = route.path.toLowerCase();
  if (path.includes('codemart')) return 'codemart';
  if (path.includes('admin')) return 'admin';
  if (path.includes('dev')) return 'dev';
  if (path.includes('dashboard')) return 'dashboard';
  // ... multiple fragile if statements
  return 'codemart'; // Fallback
};
```

**Problems:**
- Fragile - breaks if path contains partial matches
- No fallback to APP_ENTRY or app-config
- Theme registry hardcoded in plugin
- Not TypeScript-safe

**Fix Required:**

1. **Create theme registry** (`theme/theme-registry.ts`):
```typescript
import { BaseTheme } from '@/common/theme/base-theme.config';
import { itToolsThemeColors } from '@/app_ittools/theme_app_ittools/colors';
import { codemartTheme } from '@/app_codemart/theme_app_codemart/codemart-theme';
import { adminTheme } from '@/app_admin/theme_app_admin/admin-theme';

export interface ThemeRegistry {
  [appName: string]: BaseTheme;
}

export const themeRegistry: ThemeRegistry = {
  ittools: new BaseTheme(itToolsThemeColors),
  codemart: codemartTheme,
  admin: adminTheme,
  dev: devTheme,
  dashboard: dashboardTheme,
  example: exampleTheme,
  main: mainTheme,
};

export const getThemeForApp = (appName: string): BaseTheme | null => {
  return themeRegistry[appName] || null;
};
```

2. **Create app detector** (`utils/app-detector.ts`):
```typescript
import { getCurrentAppEntry } from '@/app-entry';

export const detectCurrentApp = (route: RouteLocationNormalizedLoaded): string => {
  // Priority 1: Check route metadata
  if (route.meta?.namespace) {
    return route.meta.namespace as string;
  }

  // Priority 2: Check URL path against app-config manifests
  const pathSegment = route.path.split('/')[1]; // e.g., '/codemart/...' -> 'codemart'
  if (pathSegment && isValidApp(pathSegment)) {
    return pathSegment;
  }

  // Priority 3: Use environment/config APP_ENTRY
  return getCurrentAppEntry();
};

const isValidApp = (name: string): boolean => {
  const validApps = ['ittools', 'codemart', 'admin', 'dev', 'dashboard', 'example', 'main'];
  return validApps.includes(name);
};
```

3. **Update theme plugin** (`plugins/theme.client.ts`):
```typescript
import { themeRegistry } from '@/theme/theme-registry';
import { detectCurrentApp } from '@/utils/app-detector';

export default defineNuxtPlugin(() => {
  const route = useRoute();

  const applyTheme = (app: string) => {
    const theme = themeRegistry[app];
    if (!theme) {
      console.warn(`Theme not found for app: ${app}`);
      return;
    }
    theme.applyCSSVariables();
    document.body.classList.add(`app-entry-${app}`);
  };

  watch(
    () => route.path,
    () => {
      const app = detectCurrentApp(route);
      applyTheme(app);
    },
    { immediate: true }
  );

  return {
    provide: {
      themes: themeRegistry,
      getTheme: (app: string) => themeRegistry[app],
    }
  };
});
```

---

### ISSUE 6: No Centralized Type Export

**Problem:** Types are defined in multiple locations without aggregation.

**Current State:**
- `common/theme/base-theme.config.ts` - BaseThemeConfig, ThemeColors
- `common/stores/base-store.ts` - BaseUser, BaseStoreState
- `app_ittools/types_app_ittools/index.ts` - Tool, ToolParam, HistoryEntry
- `app-entry.ts` - AppEntryConfig, AppEntryType
- `stores/index.ts` - Role, RoleType

All imports must know exact file paths - no centralized index.

**Fix Required:**

1. **Create type aggregation files**:

```typescript
// types/index.ts (ROOT TYPE EXPORTS)
export * from '@/common/theme/base-theme.config';
export * from '@/common/stores/base-store';
export * from '@/app-entry';
export * from '@/stores/index';

// types/api.ts
export * from '@/app_ittools/types_app_ittools';
export * from '@/app_codemart/types_app_codemart';
export * from '@/app_admin/types_app_admin';

// types/stores.ts
export { useCodemartStore } from '@/stores/apps/codemart-store';
export { useAdminStore } from '@/stores/apps/admin-store';
export { useItToolsStore } from '@/app_ittools/stores_app_ittools/ittools-store';
```

2. **Standardize type locations** per app:
```typescript
// apps/app_ittools/types_app_ittools/index.ts
export interface Tool { /* ... */ }
export interface ToolParam { /* ... */ }
export interface ToolResult { /* ... */ }
export interface ApiResponse<T> { /* ... */ }
export type ToolCategory = 'crypto' | 'converter' | /* ... */;
```

3. **Use centralized imports**:
```typescript
// Instead of scattered imports:
import type { Tool } from '@/app_ittools/types_app_ittools';
import type { BaseThemeConfig } from '@/common/theme/base-theme.config';

// Use centralized:
import type { Tool, BaseThemeConfig } from '@/types';
```

---

### ISSUE 7: Missing App Manifest System

**Problem:** App metadata scattered across files without validation or discovery.

**Current State:**
- `app-config.json` exists but rarely used
- App entry config in `app-entry.ts` (TypeScript)
- No central registry or schema
- Feature flags defined but not enforced

**Fix Required:**

1. **Create app manifest schema** (`schemas/app-manifest.schema.json`):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string", "pattern": "^[a-z]+$" },
    "displayName": { "type": "string" },
    "description": { "type": "string" },
    "namespace": { "type": "string", "pattern": "^[a-z]+$" },
    "port": { "type": "integer", "minimum": 3000, "maximum": 9999 },
    "devCommand": { "type": "string" },
    "buildCommand": { "type": "string" },
    "theme": {
      "type": "object",
      "properties": {
        "primary": { "type": "string", "pattern": "^#[0-9a-f]{6}$" },
        "secondary": { "type": "string", "pattern": "^#[0-9a-f]{6}$" }
      }
    },
    "api": {
      "type": "object",
      "properties": {
        "namespace": { "type": "string" },
        "baseUrl": { "type": "string" },
        "version": { "type": "string" }
      }
    },
    "features": {
      "type": "object",
      "additionalProperties": { "type": "boolean" }
    },
    "permissions": {
      "type": "object",
      "properties": {
        "required": { "type": "array", "items": { "type": "string" } },
        "roles": { "type": "array", "items": { "type": "string" } }
      }
    }
  },
  "required": ["name", "displayName", "namespace", "port"]
}
```

2. **Enhanced app-config.json** (per app):
```json
{
  "name": "ittools",
  "displayName": "IT Tools Suite",
  "description": "88+ online developer utilities",
  "namespace": "ittools",
  "port": 3005,
  "devCommand": "dev:ittools",
  "buildCommand": "build:ittools",
  "theme": {
    "primary": "#3b82f6",
    "secondary": "#8b5cf6"
  },
  "api": {
    "namespace": "ittools",
    "baseUrl": "/api/ittools",
    "version": "v1"
  },
  "features": {
    "search": true,
    "favorites": true,
    "history": true,
    "settings": true,
    "export": false,
    "collaborative": false
  },
  "permissions": {
    "required": ["ittools.access"],
    "roles": ["user", "developer", "admin"]
  },
  "components": {
    "layout": "default",
    "sidebar": true,
    "header": true
  }
}
```

3. **Create app manifest loader** (`utils/app-manifest-loader.ts`):
```typescript
import { AjvValidator } from 'ajv';

export interface AppManifest {
  name: string;
  displayName: string;
  namespace: string;
  port: number;
  devCommand: string;
  buildCommand: string;
  theme: { primary: string; secondary: string };
  api: { namespace: string; baseUrl: string; version: string };
  features: Record<string, boolean>;
  permissions: { required: string[]; roles: string[] };
}

const validator = new AjvValidator();

export const loadAppManifest = async (appName: string): Promise<AppManifest> => {
  const manifest = await import(`@/apps/app_${appName}/app-config.json`);

  const valid = validator.validate(manifest, appManifestSchema);
  if (!valid) {
    throw new Error(`Invalid manifest for ${appName}: ${validator.errorsText()}`);
  }

  return manifest as AppManifest;
};

export const discoverApps = async (): Promise<AppManifest[]> => {
  const appDirs = ['ittools', 'codemart', 'admin', 'dev', 'dashboard', 'example', 'main'];
  const manifests = await Promise.all(
    appDirs.map(app => loadAppManifest(app))
  );
  return manifests;
};
```

---

### ISSUE 8: No Service Discovery/Registration

**Problem:** Services manually instantiated, no centralized registry.

**Current Code:**
```typescript
// Each component must import and instantiate separately
import { ItToolsMainAPI } from '@/app_ittools/services_app_ittools/ittools-main-api';

const api = new ItToolsMainAPI();
const result = await api.hashText('data');
```

**Problems:**
- No dependency injection
- Services created multiple times (wasteful)
- No configuration management
- Hard to mock for testing

**Fix Required:**

1. **Create service registry** (`services/service-registry.ts`):
```typescript
import { ItToolsMainAPI } from '@/app_ittools/services_app_ittools/ittools-main-api';
import { CodemartAPI } from '@/app_codemart/services_app_codemart/codemart-api';
import { AdminAPI } from '@/app_admin/services_app_admin/admin-api';

export class ServiceRegistry {
  private static services: Map<string, any> = new Map();

  static register(name: string, service: any) {
    this.services.set(name, service);
  }

  static get(name: string) {
    if (!this.services.has(name)) {
      throw new Error(`Service not registered: ${name}`);
    }
    return this.services.get(name);
  }

  static has(name: string) {
    return this.services.has(name);
  }
}

// Pre-register services
ServiceRegistry.register('ittools', new ItToolsMainAPI());
ServiceRegistry.register('codemart', new CodemartAPI());
ServiceRegistry.register('admin', new AdminAPI());

export const getService = (name: string) => ServiceRegistry.get(name);
```

2. **Create service composables** (`composables/useService.ts`):
```typescript
export const useItToolsAPI = () => {
  return getService('ittools');
};

export const useCodemartAPI = () => {
  return getService('codemart');
};

export const useAdminAPI = () => {
  return getService('admin');
};
```

3. **Usage in components**:
```vue
<script setup lang="ts">
import { useItToolsAPI } from '@/composables/useService';

const api = useItToolsAPI();
const { data } = await api.hashText('input');
</script>
```

---

### ISSUE 9: Incomplete Middleware System

**Problem:** Only one global middleware, no app-specific or route-level protection.

**Current State:**
- Only `middleware/app-entry.global.ts` exists
- Handles theme detection and app switching
- No authentication checks
- No permission validation
- No error handling

**Fix Required:**

1. **Create authentication middleware** (`middleware/auth.ts`):
```typescript
export default defineRouteMiddleware(async (to, from) => {
  const appStore = useAppStore();

  if (!appStore.isAuthenticated && to.meta.requiresAuth) {
    return navigateTo('/auth/login');
  }
});
```

2. **Create permission middleware** (`middleware/permissions.ts`):
```typescript
export default defineRouteMiddleware(async (to, from) => {
  const appStore = useAppStore();
  const requiredPermission = to.meta.requiredPermission;

  if (requiredPermission && !appStore.hasPermission(requiredPermission)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access Forbidden',
    });
  }
});
```

3. **Update route metadata**:
```typescript
// apps/app_codemart/router_app_codemart/routes.ts
export const codemartRoutes = [
  {
    path: '/codemart/admin',
    component: () => import('@/app_codemart/pages_app_codemart/admin.vue'),
    meta: {
      requiresAuth: true,
      requiredPermission: 'codemart.admin',
      layout: 'codemart-layout',
      roles: ['admin', 'moderator'],
    }
  }
];
```

---

## PART 3: RECOMMENDED FIXES & IMPLEMENTATION ORDER

### Priority 1: Critical (Implement First)

1. **Fix CodeMart types directory name**
   - Rename: `types/` → `types_app_codemart/`
   - Update all imports
   - Estimated: 1 hour

2. **Consolidate duplicate stores**
   - Keep: `stores/apps/codemart-store.ts`
   - Delete: `apps/app_codemart/stores_app_codemart/codemart-store.ts`
   - Create re-exports for backward compatibility
   - Estimated: 2 hours

3. **Generate entry points consistently**
   - Create `scripts/generate-app-entries.js`
   - Add npm script
   - Auto-generate all `pages/index.*.vue` files
   - Estimated: 1 hour

### Priority 2: Important (Implement Second)

4. **Create theme registry system**
   - Create `theme/theme-registry.ts`
   - Create `utils/app-detector.ts`
   - Update `plugins/theme.client.ts`
   - Estimated: 2 hours

5. **Centralize type exports**
   - Create `types/index.ts`
   - Create `types/api.ts`
   - Create `types/stores.ts`
   - Estimated: 1 hour

6. **Create app manifest system**
   - Enhance `app-config.json` files
   - Create manifest loader and validator
   - Add manifest discovery
   - Estimated: 3 hours

### Priority 3: Enhancement (Implement Third)

7. **Integrate app routing**
   - Create `router/app-routes.ts`
   - Register routes in Nuxt config
   - Add route metadata
   - Estimated: 3 hours

8. **Create service registry**
   - Create `services/service-registry.ts`
   - Create service composables
   - Update all service usage
   - Estimated: 2 hours

9. **Enhance middleware system**
   - Create `middleware/auth.ts`
   - Create `middleware/permissions.ts`
   - Add route protection
   - Estimated: 2 hours

---

## PART 4: IMPLEMENTATION CHECKLIST

### Naming Consistency
- [ ] Rename `apps/app_codemart/types/` to `types_app_codemart/`
- [ ] Update CodeMart imports
- [ ] Verify empty directories have proper structure
- [ ] Document naming standards in README

### Store Consolidation
- [ ] Create centralized stores mapping
- [ ] Delete app-local duplicates
- [ ] Create re-export modules
- [ ] Test store functionality
- [ ] Update documentation

### Entry Point Generation
- [ ] Write `scripts/generate-app-entries.js`
- [ ] Add npm scripts in `package.json`
- [ ] Run generation and verify all pages created
- [ ] Add comment headers to generated files
- [ ] Test each app loads via direct route

### Theme System
- [ ] Create `theme/theme-registry.ts`
- [ ] Create `utils/app-detector.ts`
- [ ] Update `plugins/theme.client.ts`
- [ ] Test theme switching per route
- [ ] Verify CSS variables applied

### Type Organization
- [ ] Create `types/index.ts`
- [ ] Audit all type locations
- [ ] Create centralized exports
- [ ] Update all imports to use central file
- [ ] Verify TypeScript compilation

### App Manifest
- [ ] Create manifest schema
- [ ] Enhance all `app-config.json` files
- [ ] Create manifest loader
- [ ] Implement validator
- [ ] Add manifest discovery function

### Routing Integration
- [ ] Create `router/app-routes.ts`
- [ ] Extract routes from each app
- [ ] Register routes in Nuxt config
- [ ] Add route metadata
- [ ] Test nested routing

### Service Registry
- [ ] Create `services/service-registry.ts`
- [ ] Create service composables
- [ ] Update all components using services
- [ ] Test service access
- [ ] Add error handling

### Middleware Enhancement
- [ ] Create `middleware/auth.ts`
- [ ] Create `middleware/permissions.ts`
- [ ] Update route definitions with metadata
- [ ] Test auth flow
- [ ] Test permission checks

---

## SUMMARY TABLE: Current vs Target State

| Area | Current State | Target State | Status |
|------|---------------|--------------|--------|
| **Directory Naming** | Inconsistent (CodeMart uses `types/`) | All apps use `_app_[name]` pattern | TO DO |
| **Store Location** | Duplicated (2 locations) | Single centralized location | TO DO |
| **Entry Points** | Mixed (auto-generated + manual) | Standardized generation script | TO DO |
| **Theme Detection** | Fragile path matching | Type-safe registry + detector | TO DO |
| **Type Exports** | Scattered across files | Centralized `types/index.ts` | TO DO |
| **App Manifest** | Minimal metadata | Full validation + registry | TO DO |
| **App Routing** | Defined but not integrated | Full routing with metadata | TO DO |
| **Service Access** | Manual instantiation | Registry + composables | TO DO |
| **Middleware** | Single global only | Complete middleware chain | TO DO |

---

## CONCLUSION

The Nuxt multi-app architecture is **well-designed conceptually** but has **9 critical inconsistencies** that accumulate into maintainability issues:

**Main Problems:**
1. Inconsistent naming makes auto-discovery impossible
2. Duplicated stores violate DRY principle
3. Fragile theme detection breaks easily
4. Router integration incomplete (dead code)
5. No centralized metadata or service discovery

**Recommended Action:**
Implement fixes in **3 phases over 2-3 weeks**:
- Phase 1 (4-5 hours): Fix naming, consolidate stores, generate entries
- Phase 2 (6-8 hours): Centralize types, themes, manifest system
- Phase 3 (7-9 hours): Integrate routing, services, middleware

**Result:** A robust, maintainable, scalable multi-app system ready for 10+ apps.

---

**Generated:** 2025-10-21
**Document Type:** Architecture Analysis + Implementation Guide
**Revision:** 1.0
