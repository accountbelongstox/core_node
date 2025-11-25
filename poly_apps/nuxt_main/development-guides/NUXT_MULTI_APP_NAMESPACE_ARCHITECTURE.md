# Nuxt Multi-App Namespace Architecture

**Version:** 7.0 (Updated: 2025-11-25)
**Status:** ✅ COMPLETE - **NEW SIMPLIFIED STRUCTURE**

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

### Entry Point Pattern
**Rule:** `app_{namespace}_pages/index.vue` should **ONLY import a single component**, with all logic in the app component.

**Required Pattern:**
```vue
<!-- AI WARNING: Edit app_{namespace}_pages/index.vue and components under app_{namespace}_pages/components/ -->
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

### Directory Structure (NEW SIMPLIFIED)
```
poly_apps/nuxt_main/
├── app_{namespace}_pages/          # ✨ ALL app code in ONE directory (NO suffix!)
│   ├── components/                 # App components (clean naming)
│   │   ├── {namespace}_index/      # Main app component
│   │   │   └── {Namespace}App.vue
│   │   └── ...                     # Other components
│   ├── composables/                # App composables
│   ├── stores/                     # App stores
│   ├── services/                   # App services
│   ├── types/                      # App types
│   ├── config/                     # App config
│   ├── constants/                  # App constants
│   ├── styles/                     # App styles
│   ├── i18n/locales/               # App translations
│   │   ├── en.json
│   │   ├── zh.json
│   │   ├── ja.json
│   │   └── fa.json
│   ├── theme/                      # App theme
│   └── index.vue                   # ✨ Entry point (imports single component)
├── app_main_pages/                 # Main app (reference structure)
├── common/                         # Shared foundation
│   ├── components/ui/
│   ├── composables/
│   ├── stores/
│   ├── utils/
│   └── plugins/
├── i18n/locales/                   # Global translations
├── configs/{namespace}.config.ts   # App configs
└── composables/useRouteNamespace.ts# Namespace detection
```

**🚨 DEPRECATED (DO NOT USE):**
```
❌ apps/app_{namespace}/components_app_{namespace}/  # OLD - Don't use
❌ apps/app_{namespace}/stores_app_{namespace}/      # OLD - Don't use
❌ pages/index.{namespace}.vue                       # OLD - Don't use
```

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
**Location:** `services/api/{namespace}/`
**Convention:** `{namespace}-{resource}-api.ts`
**Header:** `X-App-Namespace: {namespace}`

### 5. Layout System
**Global:** `layouts/` - `base.vue`, `default-with-nav.vue`, `{namespace}.vue`
**App-Specific:** `apps/app_{namespace}/layouts_app_{namespace}/`
**Usage:** `definePageMeta({ layout: 'pymatrix' })`

### 6. Entry Point & Build System

#### Entry Pages
**Location:** `pages/index.{namespace}.vue`
**Pattern:** Import single app component from `components_app_{namespace}/{namespace}_index/{Namespace}App.vue`

#### Launcher Scripts
**Development:** `.\scripts\start.ps1 [namespace]` or `node scripts/switch-app-entry-plus.js [namespace]`
**Build:** `.\scripts\start.ps1 [namespace] build`

#### Multi-App Factory System (switch-app-entry-plus.js)
**How It Works:**
1. **Mirrors** source workspace to factory build directory per app (`factory_root/_app_{namespace}/`)
2. **Runs** `switch-app-entry.js` in mirrored tree to activate specific app entry
3. **Watches** source files with 2s debounce, auto-syncs changes to all active factory runtimes
4. **Launches** `pnpm dev:{namespace}` or `pnpm build:{namespace}` from factory directory
5. **Supports** concurrent multi-app development (`--apps app1,app2`)

**Usage:**
```bash
# Single app
node scripts/switch-app-entry-plus.js ittools

# Multiple apps concurrently
node scripts/switch-app-entry-plus.js --apps ittools,pymatrix

# Build mode
node scripts/switch-app-entry-plus.js ittools --mode build
```

**Factory Locations:**
- Windows: `D:/programing/.build_dir/nuxt_factory/_app_{namespace}/`
- Linux: `{base}/_build_dir/nuxt_factory/linux/_app_{namespace}/`

### 7. i18n Namespace System

#### Global Layer
**Location:** `i18n/locales/`
**Content:** Common translations (save, cancel, settings, theme, etc.)
**Languages:** en, zh, ja, fa, es, fr, de, ru, pt, it, pl, tr, sv, hu, da, el

#### App-Specific Layer
**Location:** `apps/app_{namespace}/i18n_app_{namespace}/locales/`
**Naming:** `i18n_app_pymatrix`, `i18n_app_admin`, etc.
**Content:** App-specific translations only

#### Merging Strategy
1. Load global translations
2. Load app-specific translations
3. Merge (app overrides global)

#### Composable
**File:** `composables/useAppI18n.ts`
**Usage:** `const { t } = useAppI18n()` - Auto-merges global + app translations

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

### App-Specific Layer Standards (NEW SIMPLIFIED)

| Category | Location | Naming / Structure | Rules |
|----------|----------|-------------------|-------|
| **Components** | `app_{namespace}_pages/components/` | `{namespace}_index/{Namespace}App.vue` (main)<br>`{namespace}_index_components/` (sub-components)<br>`{feature}/` (feature modules) | App-specific UI, can import common, no cross-app imports |
| **Stores** | `app_{namespace}_pages/stores/` | `deviceStore.ts`, `groupStore.ts` | App-specific state, can compose common stores, no cross-app imports |
| **Services** | `app_{namespace}_pages/services/` | `{namespace}-{resource}-api.ts`, `api-client.ts` | Must add `X-App-Namespace` header, no cross-namespace imports |
| **Composables** | `app_{namespace}_pages/composables/` | App-specific composables | Can use common composables, no cross-app imports |
| **Config** | `app_{namespace}_pages/config/` | Tool registries, constants | App-specific config only |
| **Types** | `app_{namespace}_pages/types/` | `index.ts` | App-specific TypeScript types |
| **Constants** | `app_{namespace}_pages/constants/` | Constants and configs | App-specific constants |
| **Styles** | `app_{namespace}_pages/styles/` | CSS/SCSS files | App-specific styles |
| **i18n** | `app_{namespace}_pages/i18n/locales/` | Translation files | App-specific translations |

**Component Naming Examples:**
- Main: `components/ittools_index/ItToolsApp.vue`, `components/pymatrix_index/PyMatrixApp.vue`
- Sub: `components/ittools_index_components/CategoryTreePanel.vue`
- Feature: `components/tools/converter/Base64ConverterTool.vue`

---

## 📋 Namespace Rules

### ✅ DO (NEW SIMPLIFIED ARCHITECTURE)
1. Use `app_{namespace}_pages/` directory for ALL app code
2. Use clean directory names (components, stores, services) - NO SUFFIX
3. Put common code in `common/`
4. Validate namespace with TypeScript types
5. Include HTTP header for API requests
6. Support all global languages in app i18n
7. Use `useAppI18n()` for merged translations
8. Import with clean paths: `@/app_{namespace}_pages/components/...`

### ❌ DON'T (DEPRECATED PATTERNS)
1. ❌ Use `apps/app_{namespace}/components_app_{namespace}/` (OLD structure)
2. ❌ Use `pages/index.{namespace}.vue` (OLD entry pattern)
3. ❌ Use suffix naming like `stores_app_{namespace}` (OLD naming)
4. Hardcode namespace strings
5. Mix namespaces in single file
6. Skip namespace validation
7. Create routes without prefixes
8. Duplicate common code in app directories
9. Reference other app's code
10. Put app-specific translations in global i18n
11. Skip languages in app i18n files

---

## 🚀 Adding New App (NEW SIMPLIFIED STRUCTURE)

| Step | Action | Files/Locations |
|------|--------|----------------|
| 1. Create Dir | App structure | `app_myapp_pages/` with subdirs:<br>  - `components/` (with `myapp_index/MyappApp.vue`)<br>  - `composables/`<br>  - `stores/`<br>  - `services/`<br>  - `types/`<br>  - `config/`<br>  - `constants/`<br>  - `styles/`<br>  - `i18n/locales/`<br>  - `theme/`<br>  - `index.vue` (entry point) |
| 2. Register | Namespace | `utils/namespace-registry.ts`: `... \| 'myapp'`<br>`composables/useRouteNamespace.ts`: `myapp: { prefix: '/myapp' }` |
| 3. Create Files | Entry & config | `app_myapp_pages/index.vue` (imports `MyappApp.vue`)<br>`app_myapp_pages/components/myapp_index/MyappApp.vue`<br>`configs/myapp.config.ts`<br>`layouts/myapp.vue`<br>`app_myapp_pages/services/myapp-main-api.ts` (with `X-App-Namespace` header)<br>`app_myapp_pages/i18n/locales/{en,zh,ja,fa}.json` |

**Quick Start Template:**
```bash
# Create new app structure
mkdir -p app_myapp_pages/{components/myapp_index,composables,stores,services,types,config,constants,styles,i18n/locales,theme}

# Copy reference structure from app_main_pages
cp -r app_main_pages/components/... app_myapp_pages/components/
cp app_main_pages/index.vue app_myapp_pages/index.vue
# Edit and customize for your app
```

---

## 🔍 Key Files

| Purpose | File |
|---------|------|
| Namespace Types | `utils/namespace-registry.ts` |
| Route Detection | `composables/useRouteNamespace.ts` |
| App Configs | `configs/{namespace}.config.ts` |
| API Services | `services/api/{namespace}/` |
| App i18n | `apps/app_{namespace}/i18n_app_{namespace}/locales/` |
| Global i18n | `i18n/locales/` |
| i18n Composable | `composables/useAppI18n.ts` |
| Launcher | `scripts/start.ps1` |
| Entry Pages | `pages/index.{namespace}.vue` |

---

## ✅ Validation Checklist

### For Each App
**Required Structure:**
1. Namespace registered in `utils/namespace-registry.ts`
2. Route mapping in `composables/useRouteNamespace.ts`
3. Config file created in `configs/{namespace}.config.ts`
4. API service directory in `services/api/{namespace}/`
5. Entry page `pages/index.{namespace}.vue` (imports single component only)
6. Main app component `apps/app_{namespace}/components_app_{namespace}/{namespace}_index/{Namespace}App.vue`
7. Layout wrapper `layouts/{namespace}.vue`
8. App layout (optional) `apps/app_{namespace}/layouts_app_{namespace}/`
9. i18n directory `apps/app_{namespace}/i18n_app_{namespace}/locales/`
10. All global languages supported in app i18n (en, zh, ja, fa, etc.)
11. No duplicate translation keys between global and app i18n

**Component Naming:**
- Main component: `{namespace}_index/{Namespace}App.vue`
- Sub-components: `{namespace}_index_components/`
- Feature modules: organized in subdirectories

### Global Standards
**Common Layer:**
1. Generic, reusable code in `common/`
2. Global translations in `i18n/locales/`
3. All apps use consistent language set (16 languages)
4. No app-specific code in global layers
5. Common components are props-driven and configurable

**Services Layer:**
1. API services organized by namespace: `services/api/{namespace}/`
2. All API requests include `X-App-Namespace` header
3. No cross-namespace API imports

---

## 🎯 i18n Best Practices

### Global i18n (`i18n/locales/`)
**Include:** UI actions, status, navigation, settings
**Exclude:** App-specific features, domain terminology

### App i18n (`i18n_app_{namespace}/locales/`)
**Include:** Feature names, workflows, domain terminology unique to app
**Exclude:** Common translations, other app's translations

### Standards
- **Naming:** snake_case with feature prefix (`batch_connect`, `device_info`)
- **Languages:** Support all 16 global languages (en, zh, ja, fa, es, fr, de, ru, pt, it, pl, tr, sv, hu, da, el)
- **RTL:** Test Persian (fa) and Arabic (ar) for layout issues

---

## 📊 Current Apps

**AI Instruction:** Scan the following directories to discover all registered apps:

**Discovery Commands:**
```bash
# Scan for app directories
ls apps/ | grep "^app_"

# Scan for entry pages
ls pages/ | grep "^index\." | grep -v "index.vue"

# Verify namespace registry
cat utils/namespace-registry.ts | grep "RegisteredNamespace"
```

**Expected App Structure:**
Each discovered app should have:
- `apps/app_{namespace}/` - App directory
- `pages/index.{namespace}.vue` - Entry page
- `apps/app_{namespace}/components_app_{namespace}/{namespace}_index/{Namespace}App.vue` - Main component
- `apps/app_{namespace}/i18n_app_{namespace}/locales/` - Translation files
- `services/api/{namespace}/` - API services (optional)

**Example Apps:** example, codemart, dev, admin, dashboard, pymatrix, ittools, main

---

## 🔧 Common Patterns

| Pattern | Code |
|---------|------|
| Namespace Detection | `const { currentNamespace } = useRouteNamespace()` |
| App Translation | `const { t } = useAppI18n()` |
| API with Namespace | `$fetch('/api/endpoint', { headers: { 'X-App-Namespace': namespace }})` |
| Custom Layout | `definePageMeta({ layout: 'myapp' })` |

---

**Last Updated:** 2025-11-10
**Maintained By:** Core Node Team
