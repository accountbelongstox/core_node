# Nuxt Multi-App Namespace Architecture

**Version:** 7.0 (Updated: 2025-11-12)
**Status:** ✅ COMPLETE

---

## 🤖 AI Development Guide

### Priority: Extend Common Libraries First
When developing features, **always check and extend `common/` libraries first** before creating app-specific code:

**Common Libraries (Scan First):**
- `common/stores/` - Global state management (app-config-store, base-store)
- `common/composables/` - Reusable composables (useAppTheme, useGlobalConfig, useI18nConfig)
- `common/components/ui/` - Base UI components (BaseButton, BaseModal, DataTable, etc.)
- `common/components/dashboard/` - Dashboard components (StatCard, ProgressChart)
- `common/utils/` - Utility functions (localStorage)
- `common/plugins/` - Global plugins (app-config.client, theme.client)
- `common/theme/` - Theme configurations

**Extension Rule:**
- ✅ Extend common libraries when the functionality is **reusable across multiple apps**
- ✅ Keep common code **generic and configurable**
- ❌ Avoid adding app-specific business logic to common layer

### ⚠️ CRITICAL: Source Code vs Build Directory
**Rule:** ALWAYS modify source code in `poly_apps/nuxt_main/`, NEVER modify `_build_dir/` (auto-synced 1:1 mirror). Convert error paths: `_build_dir/nuxt_factory/linux/_app_{namespace}/` → `poly_apps/nuxt_main/`.

### Pages Directory Management Pattern
**Rule:** The `pages/` directory is **automatically managed** by the multi-app architecture. **DO NOT edit files in `pages/` directly.**

**Critical Rules:**
1. **Always edit files in `app_{namespace}_pages/` directories** - These are the source of truth (Source of Truth)
2. **Never edit files in `pages/` directly** - Changes will be lost when switching apps
3. **Use `app_main_pages/` as template** - Copy this directory when creating new apps
4. **Pages directory is recursively cleared and repopulated** when switching apps

**✅ Correct `pages/` Structure (Auto-managed):**
- `pages/index.vue` - Entry page (copied from `app_{namespace}_pages/index.vue`)
- `pages/blank.vue` - Blank layout page (optional, copied from `app_{namespace}_pages/blank.vue`)
- `pages/layouts/` - Layout directory (copied from `app_{namespace}_pages/layouts/`)
- `pages/INDEX.md` - Indicator file (shows current active app)

**❌ Incorrect `pages/` Structure (Must be cleaned):**
- ❌ `pages/types/`, `pages/composables/`, `pages/config/`, `pages/constants/`, `pages/i18n/`, `pages/services/`, `pages/stores/`, `pages/theme/`, `pages/components/` - Should NOT exist (all code stays in `app_{namespace}_pages/`)
- ❌ `pages/*.ts`, `pages/*.js`, `pages/*.json`, `pages/*.txt`, `pages/*.prompt`, `pages/*.md` (except `INDEX.md`) - Should NOT exist
- ❌ Any other files or directories beyond the 4 allowed items above

**Key Points:**
1. **Source of Truth:** `app_{namespace}_pages/` contains ALL source code (components, composables, config, stores, etc.). This is the ONLY place to edit code.
2. **Auto-managed Mirror:** `pages/` is a minimal mirror that only contains page files (`index.vue`, `blank.vue`) and layouts copied from source. All other code is accessed via Nuxt aliases pointing to `app_{namespace}_pages/`.
3. **Clean Separation:** When switching apps, `pages/` is cleared and repopulated. Never manually add files to `pages/` - they will be lost on next switch.

**Entry Page Pattern:**
Each `app_{namespace}_pages/index.vue` should **ONLY import a single component**, with all logic in the app component.

**Required Pattern:**
```vue
<!-- AI WARNING: Edit components under app_{namespace}_pages/components/{namespace}_index/ instead -->
<template>
  <{Namespace}App />
</template>

<script setup lang="ts">
import {Namespace}App from '@/app_{namespace}_pages/components/{namespace}_index/{Namespace}App.vue';
</script>
```

**Example:** `app_ittools_pages/index.vue` → `app_ittools_pages/components/ittools_index/ItToolsApp.vue`

---

## 🎯 Core Principles

### Namespace Isolation
- Each app has unique namespace identifier
- No cross-app dependencies in code
- Shared resources via global `common/` layer
- API requests tagged with `X-App-Namespace` header

### Directory Structure

**⚠️ DEPRECATED DIRECTORY WARNING:**
- ❌ **`poly_apps/nuxt_main/apps/app_{namespace}/` is DEPRECATED**
- ❌ This directory structure is **OBSOLETE** and should be **migrated to the new structure**
- ✅ **NEW structure:** All app code should be in `app_{namespace}_pages/` directory
- 🔄 **Migration required:** Move code from `apps/app_{namespace}/` to `app_{namespace}_pages/` and refactor

**Current Directory Structure:**
```
poly_apps/nuxt_main/
├── ⚠️ apps/app_{namespace}/          # ❌ DEPRECATED - DO NOT USE
│   │                                  # This directory is OBSOLETE
│   │                                  # Must migrate to app_{namespace}_pages/
│   ├── components_app_{namespace}/    # ❌ OLD - Move to app_{namespace}_pages/components/
│   ├── composables_app_{namespace}/  # ❌ OLD - Move to app_{namespace}_pages/composables/
│   ├── stores_app_{namespace}/       # ❌ OLD - Move to app_{namespace}_pages/stores/
│   ├── layouts_app_{namespace}/      # ❌ OLD - Move to app_{namespace}_pages/layouts/
│   ├── i18n_app_{namespace}/         # ❌ OLD - Move to app_{namespace}_pages/i18n/
│   └── config_app_{namespace}/       # ❌ OLD - Move to app_{namespace}_pages/config/
├── ✅ app_{namespace}_pages/          # ✅ NEW - Source of Truth (Source Code)
│   ├── index.vue                      # Entry page (only imports main component)
│   ├── blank.vue                      # Blank layout page (optional)
│   ├── components/                    # All components
│   │   ├── {namespace}_index/        # Main app components
│   │   │   ├── {Namespace}App.vue   # Main app component
│   │   │   └── ...                   # Other main components
│   │   ├── {namespace}_index_components/ # Layout sub-components
│   │   │   ├── AppSidebar.vue        # Sidebar
│   │   │   ├── AppTopBar.vue         # Top bar
│   │   │   ├── AppContentArea.vue    # Content area
│   │   │   └── ...                   # Other layout components
│   │   ├── modules/                  # Feature modules
│   │   │   ├── api_testing/         # API testing module
│   │   │   ├── dev_tools/           # Dev tools module
│   │   │   ├── system_info/         # System info module
│   │   │   └── ...                  # Other modules
│   │   ├── tools/                    # Tool components (150+ tools)
│   │   │   ├── crypto/              # Crypto tools
│   │   │   ├── converter/           # Converter tools
│   │   │   ├── network/             # Network tools
│   │   │   └── ...                  # Other tool categories
│   │   └── auth/                     # Auth components (optional)
│   │       ├── LoginModal.vue
│   │       └── RegisterModal.vue
│   ├── composables/                  # Composables
│   │   ├── useApi.ts
│   │   ├── useAppState.ts
│   │   ├── useAppNavigation.ts
│   │   ├── useBackendStatus.ts
│   │   ├── useI18n.ts
│   │   ├── useStorage.ts
│   │   ├── useSystemInfo.ts
│   │   └── ...
│   ├── config/                       # Configuration files
│   │   ├── api-endpoints.ts         # API endpoints config (80+ endpoints)
│   │   ├── api-config.ts
│   │   ├── api-routes.ts
│   │   └── ...
│   ├── constants/                    # Constants
│   │   ├── complete-tools.ts
│   │   ├── tools.ts
│   │   └── ui-config.ts
│   ├── i18n/                        # Internationalization
│   │   ├── index.ts
│   │   └── locales/                 # 18 languages
│   │       ├── en.ts
│   │       ├── zh-CN.ts
│   │       ├── ja.json
│   │       ├── fa.json
│   │       └── ...
│   ├── layouts/                     # Layouts
│   │   └── blank.vue
│   ├── services/                    # Service layer
│   │   ├── api-client.ts
│   │   ├── http-client.ts
│   │   ├── {namespace}-api.ts
│   │   └── ...
│   ├── stores/                      # State management
│   │   ├── {namespace}-store.ts
│   │   └── auth-store.ts
│   ├── theme/                       # Theme
│   │   └── colors.ts
│   ├── types/                       # TypeScript types
│   │   ├── index.ts
│   │   ├── api-types.ts
│   │   └── navigation.ts
│   └── styles/                      # Styles (optional)
│       └── ...
├── app_main_pages/                    # Main app pages template
│   ├── index.vue                      # Main entry page
│   ├── index.{namespace}.vue          # App-specific entry pages
│   └── ...                            # Other pages
├── pages/                             # Active pages (auto-managed, DO NOT EDIT)
│   ├── index.vue                      # Entry page (copied from app_{namespace}_pages/index.vue)
│   ├── blank.vue                      # Blank layout page (optional, copied from app_{namespace}_pages/blank.vue)
│   ├── layouts/                       # Layout directory (copied from app_{namespace}_pages/layouts/)
│   └── INDEX.md                       # Indicator file (shows current active app)
├── common/                            # Shared foundation
│   ├── components/ui/
│   ├── composables/
│   ├── stores/
│   ├── utils/
│   └── plugins/
├── i18n/locales/                      # Global translations
├── configs/{namespace}.config.ts      # App configs
├── composables/useRouteNamespace.ts   # Namespace detection
└── scripts/
    └── switch-pages-directory.js      # Pages directory switcher
```

### Location Example
- **Project Root:** `D:/programing/core_node/poly_apps/nuxt_main`
- **Sample File:** `app_pymatrix_pages/stores/scriptStore.ts`
  - Full path: `D:/programing/core_node/poly_apps/nuxt_main/app_pymatrix_pages/stores/scriptStore.ts`
  - Factory mirror path: `D:/programing/.build_dir/nuxt_factory/_app_pymatrix/app_pymatrix_pages/stores/scriptStore.ts`
  - Use the factory mirror mapping rules below whenever logs reference the mirrored path.

---

## 📐 Architecture Layers

### 1. Namespace Registry
**File:** `utils/namespace-registry.ts`
**Purpose:** Type-safe namespace management

```typescript
export type RegisteredNamespace =
  | 'example' | 'codemart' | 'dev' | 'admin'
  | 'dashboard' | 'pymatrix' | 'ittools' | 'main'
```

### 2. Route Detection
**File:** `composables/useRouteNamespace.ts`
**Purpose:** Auto-detect namespace from URL

**Rules:**
- `/pymatrix/*` → `pymatrix`
- `/admin/*` → `admin`
- `/dev/*` → `dev`
- `/` → `example` (default)

### 3. Configuration System
**Location:** `configs/{namespace}.config.ts`
**Required Fields:**
- `name` - Display name
- `namespace` - Unique identifier
- `routes.prefix` - URL prefix
- `theme` - Theme settings
- `api.baseUrl` - API endpoint

### 4. API Service Layer
**Location:** `services/api/{namespace}/` or `app_{namespace}_pages/services/`
**Convention:** `{namespace}-{resource}-api.ts`
**Header:** `X-App-Namespace: {namespace}`

### 5. Layout System
**Global:** `layouts/` - `base.vue`, `default-with-nav.vue`, `{namespace}.vue`
**App-Specific:** `app_{namespace}_pages/layouts/`
**Usage:** `definePageMeta({ layout: 'pymatrix' })`

### 6. Pages Directory & Build System

#### Pages Directory Switcher
**File:** `scripts/switch-pages-directory.js`
**How It Works:** Validates namespace → Backs up `pages/` → Clears → Copies only `index.vue`, `blank.vue` (optional), and `layouts/` from `app_{namespace}_pages/` → `pages/` → Creates `INDEX.md`
**Usage:** `node scripts/switch-pages-directory.js [appname]` or `APP_ENTRY=ittools node scripts/switch-pages-directory.js`
**Key Point:** Only page files (`index.vue`, `blank.vue`) and `layouts/` directory are copied to `pages/`. All other directories (components, composables, config, stores, services, types, constants, i18n, theme, styles) remain in `app_{namespace}_pages/` and are accessed via Nuxt path aliases. This ensures clean separation and prevents accidental edits in the auto-managed `pages/` directory.

#### Multi-App Factory System
**File:** `scripts/switch-app-entry-plus.js`
**How It Works:** Mirrors source to factory → Runs switcher → Watches files (2s debounce) → Launches `pnpm dev:{namespace}`
**Usage:** `node scripts/switch-app-entry-plus.js ittools` or `--apps ittools,pymatrix` or `--mode build`
**Factory Locations:** Windows: `D:/programing/.build_dir/nuxt_factory/_app_{namespace}/` | Linux: `{base}/_build_dir/nuxt_factory/linux/_app_{namespace}/`
**Path Mapping:** Factory paths are 1:1 mirrors. Convert: `_build_dir/nuxt_factory/_app_{namespace}/` → `poly_apps/nuxt_main/`

### 7. i18n Namespace System
**Global:** `i18n/locales/` - Common translations (save, cancel, settings, theme, etc.)
**App-Specific:** `app_{namespace}_pages/i18n/locales/` - App-specific translations only
**Composable:** `composables/useAppI18n.ts` - `const { t } = useAppI18n()` auto-merges global + app translations
**Standards:** snake_case naming, support 16 languages (en, zh, ja, fa, es, fr, de, ru, pt, it, pl, tr, sv, hu, da, el), test RTL (fa, ar)

---

## 📦 Common vs App-Specific Architecture

### Common Layer Standards

| Category | Location | Examples | Rules |
|----------|----------|----------|-------|
| **Stores** | `common/stores/` | app-config-store, base-store | Generic state, no app-specific logic |
| **Components** | `common/components/ui/` | BaseButton, BaseModal, DataTable | Reusable, props-driven, configurable |
| | `common/components/dashboard/` | StatCard, ProgressChart | No namespace-specific features |
| **Composables** | `common/composables/` | useAppTheme, useGlobalConfig, useI18nConfig | Pure logic, no app dependencies |
| **Utils** | `common/utils/` | localStorage | Pure functions, type-safe |
| **Plugins** | `common/plugins/` | app-config.client, theme.client | Global initialization, no namespace hardcoding |

### App-Specific Layer Standards

| Category | Location | Naming / Structure | Rules |
|----------|----------|-------------------|-------|
| **Components** | `app_{namespace}_pages/components/` | `{namespace}_index/{Namespace}App.vue` (main)<br>`{namespace}_index_components/` (sub-components)<br>`{feature}/` (feature modules) | App-specific UI, can import common, no cross-app imports |
| **Stores** | `app_{namespace}_pages/stores/` | `deviceStore.ts`, `groupStore.ts` | App-specific state, can compose common stores, no cross-app imports |
| **Services** | `app_{namespace}_pages/services/` | `{namespace}-{resource}-api.ts` | Must add `X-App-Namespace` header, no cross-namespace imports |
| **Composables** | `app_{namespace}_pages/composables/` | App-specific composables | Can use common composables, no cross-app imports |
| **Config** | `app_{namespace}_pages/config/` | Tool registries, constants | App-specific config only |

**Component Naming Examples:**
- Main: `components/ittools_index/ItToolsApp.vue`, `components/pymatrix_index/PyMatrixApp.vue`
- Sub: `components/ittools_index_components/AppSidebar.vue`, `components/ittools_index_components/AppTopBar.vue`
- Feature Modules: `components/modules/api_testing/ApiTestingDashboard.vue`, `components/modules/dev_tools/DevToolsPanel.vue`
- Tools: `components/tools/crypto/Base64Encoder.vue`, `components/tools/converter/Base64ConverterTool.vue`

---

## 📋 Namespace Rules

### ✅ DO
1. Use consistent namespace across all layers
2. Put common code in `common/`
3. Validate namespace with TypeScript types
4. Prefix app-specific directories with `app_{namespace}`
5. Include HTTP header for API requests
6. Support all global languages in app i18n
7. Use `useAppI18n()` for merged translations

### ❌ DON'T
1. **Use deprecated `apps/app_{namespace}/` structure** - This directory is OBSOLETE and must be migrated to `app_{namespace}_pages/`
2. **Edit files in `pages/` directory** - All edits must be in `app_{namespace}_pages/` (Source of Truth)
3. **Add directories or files to `pages/`** - Only `index.vue`, `blank.vue`, `layouts/`, and `INDEX.md` are allowed
4. Hardcode namespace strings
5. Mix namespaces in single file
6. Skip namespace validation
7. Create routes without prefixes
8. Duplicate common code in app directories
9. Reference other app's code
10. Put app-specific translations in global i18n
11. Skip languages in app i18n files
12. Use old suffix naming like `components_app_{namespace}/` - Use clean names like `components/` in `app_{namespace}_pages/`

---

## 🚀 Adding New App

| Step | Action | Files/Locations |
|------|--------|----------------|
| 1. Create Pages Dir | Copy template | `cp -r app_main_pages app_myapp_pages`<br>Edit `app_myapp_pages/index.vue` to import `MyappApp.vue` |
| 2. Create Dirs | App structure | `app_myapp_pages/{components,composables,stores,services,types,config,constants,styles,i18n/locales,theme}` |
| 3. Register | Namespace | `utils/namespace-registry.ts`: `... \| 'myapp'`<br>`composables/useRouteNamespace.ts`: `myapp: { prefix: '/myapp' }` |
| 4. Create Files | Entry & config | `app_myapp_pages/index.vue` (imports `MyappApp.vue`)<br>`app_myapp_pages/components/myapp_index/MyappApp.vue`<br>`configs/myapp.config.ts`<br>`layouts/myapp.vue`<br>`app_myapp_pages/services/myapp-main-api.ts` (with `X-App-Namespace` header)<br>`app_myapp_pages/i18n/locales/{en,zh,ja,fa}.json` |
| 5. Switch Pages | Activate app | `node scripts/switch-pages-directory.js myapp` |

**Migration from Deprecated Structure:**
If you have existing code in `apps/app_{namespace}/`, migrate: `components_app_{namespace}/` → `app_{namespace}_pages/components/`, `stores_app_{namespace}/` → `app_{namespace}_pages/stores/`, `composables_app_{namespace}/` → `app_{namespace}_pages/composables/`, `i18n_app_{namespace}/` → `app_{namespace}_pages/i18n/`, `config_app_{namespace}/` → `app_{namespace}_pages/config/`. Update all import paths and delete old directory.

---

## 🔍 Key Files

| Purpose | File |
|---------|------|
| Namespace Types | `utils/namespace-registry.ts` |
| Route Detection | `composables/useRouteNamespace.ts` |
| App Configs | `configs/{namespace}.config.ts` |
| API Services | `services/api/{namespace}/` or `app_{namespace}_pages/services/` |
| App i18n | `app_{namespace}_pages/i18n/locales/` |
| Global i18n | `i18n/locales/` |
| i18n Composable | `composables/useAppI18n.ts` |
| Pages Switcher | `scripts/switch-pages-directory.js` |
| App Pages (Source) | `app_{namespace}_pages/` |
| Active Pages (Managed) | `pages/` (DO NOT EDIT DIRECTLY) |
| Pages Template | `app_main_pages/` |

---

## ✅ Validation Checklist

**For Each App:** Register namespace (`utils/namespace-registry.ts`, `useRouteNamespace.ts`), create `app_{namespace}_pages/` (copy from `app_main_pages/`), follow Entry Point Pattern, ship `app_{namespace}_pages/i18n/locales/` with all languages, use component naming: `{namespace}_index/{Namespace}App.vue`.

**Global Standards:** Keep shared logic under `common/`, enforce i18n language set in `i18n/locales/`, structure API clients by namespace with `X-App-Namespace` header.

---

## 🔧 Common Patterns

| Pattern | Code |
|---------|------|
| Namespace Detection | `const { currentNamespace } = useRouteNamespace()` |
| App Translation | `const { t } = useAppI18n()` |
| API with Namespace | `$fetch('/api/endpoint', { headers: { 'X-App-Namespace': namespace }})` |
| Custom Layout | `definePageMeta({ layout: 'myapp' })` |

---

## 📊 Current Apps

**Example Apps:** example, codemart, dev, admin, dashboard, pymatrix, ittools, main
**Discovery:** `ls . | grep "^app_.*_pages$"` | `cat utils/namespace-registry.ts | grep "RegisteredNamespace"`

---

**Last Updated:** 2025-11-12
**Maintained By:** Core Node Team
