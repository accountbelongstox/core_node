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

### Pages Directory Management Pattern
**Rule:** The `pages/` directory is **automatically managed** by the multi-app architecture. **DO NOT edit files in `pages/` directly.**

**Critical Rules:**
1. **Always edit files in `app_{namespace}_pages/` directories** - These are the source of truth
2. **Never edit files in `pages/` directly** - Changes will be lost when switching apps
3. **Use `app_main_pages/` as template** - Copy this directory when creating new apps
4. **Pages directory is recursively cleared and repopulated** when switching apps

**Directory Structure:**
```
poly_apps/nuxt_main/
├── app_main_pages/              # Main app pages template (source of truth)
│   ├── index.vue                # Main entry page
│   ├── index.{namespace}.vue    # App-specific entry pages
│   └── ...                      # Other pages
├── app_{namespace}_pages/        # App-specific pages (source of truth)
│   ├── index.vue                # App entry page
│   └── ...                      # App pages
└── pages/                       # Active pages (auto-managed, DO NOT EDIT)
    ├── INDEX.md                 # Indicator file (explains architecture)
    └── ...                      # Copied from active app_{namespace}_pages/
```

**Entry Page Pattern:**
Each `app_{namespace}_pages/index.vue` should **ONLY import a single component**, with all logic in the app component.

**Required Pattern:**
```vue
<!-- AI WARNING: Edit components under apps/app_{namespace}/components_app_{namespace}/{namespace}_index/ instead -->
<template>
  <{Namespace}App />
</template>

<script setup lang="ts">
import {Namespace}App from '@/apps/app_{namespace}/components_app_{namespace}/{namespace}_index/{Namespace}App.vue';
</script>
```

**Example:** `app_ittools_pages/index.vue` → `components_app_ittools/ittools_index/ItToolsApp.vue`

---

## 🎯 Core Principles

### Namespace Isolation
- Each app has unique namespace identifier
- No cross-app dependencies in code
- Shared resources via global `common/` layer
- API requests tagged with `X-App-Namespace` header

### Directory Structure
```
poly_apps/nuxt_main/
├── apps/app_{namespace}/          # App-specific code
│   ├── components_app_{namespace}/ # App components
│   ├── composables_app_{namespace}/# App composables
│   ├── stores_app_{namespace}/     # App stores
│   ├── layouts_app_{namespace}/    # App layouts
│   ├── i18n_app_{namespace}/       # App translations
│   │   └── locales/
│   │       ├── en.json
│   │       ├── zh.json
│   │       ├── ja.json
│   │       └── fa.json
│   └── config_app_{namespace}/     # App config
├── app_main_pages/                 # Main app pages template
│   ├── index.vue                   # Main entry page
│   ├── index.{namespace}.vue       # App-specific entry pages
│   └── ...                         # Other pages
├── app_{namespace}_pages/          # App-specific pages (source of truth)
│   ├── index.vue                   # App entry page
│   └── ...                         # App pages
├── pages/                          # Active pages (auto-managed, DO NOT EDIT)
│   ├── INDEX.md                    # Indicator file
│   └── ...                         # Copied from active app_{namespace}_pages/
├── common/                         # Shared foundation
│   ├── components/ui/
│   ├── composables/
│   ├── stores/
│   ├── utils/
│   └── plugins/
├── i18n/locales/                   # Global translations
├── configs/{namespace}.config.ts   # App configs
├── composables/useRouteNamespace.ts# Namespace detection
└── scripts/
    └── switch-pages-directory.js   # Pages directory switcher
```

### Location Example
- **Project Root:** `D:/programing/core_node/poly_apps/nuxt_main`
- **Sample File:** `apps/app_pymatrix/stores_app_pymatrix/scriptStore.ts`
  - Full path: `D:/programing/core_node/poly_apps/nuxt_main/apps/app_pymatrix/stores_app_pymatrix/scriptStore.ts`
  - Factory mirror path: `D:/programing/.build_dir/nuxt_factory/_app_pymatrix/apps/app_pymatrix/stores_app_pymatrix/scriptStore.ts`
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
**Location:** `services/api/{namespace}/`
**Convention:** `{namespace}-{resource}-api.ts`
**Header:** `X-App-Namespace: {namespace}`

### 5. Layout System
**Global:** `layouts/` - `base.vue`, `default-with-nav.vue`, `{namespace}.vue`
**App-Specific:** `apps/app_{namespace}/layouts_app_{namespace}/`
**Usage:** `definePageMeta({ layout: 'pymatrix' })`

### 6. Pages Directory & Build System

#### Pages Directory Management
The `pages/` directory is **automatically managed** by the architecture system:
1. **Source of Truth:** Each app has its own `app_{namespace}_pages/` directory
2. **Active Directory:** The `pages/` directory is recursively cleared and repopulated from the active app's pages directory
3. **Indicator File:** `pages/INDEX.md` explains the architecture and warns against direct edits
4. **Template:** `app_main_pages/` serves as the template for creating new apps

#### Entry Pages
Follow the **Entry Point Pattern** described earlier: each `app_{namespace}_pages/index.vue` only imports the matching `{Namespace}App` component from `components_app_{namespace}/{namespace}_index/` and contains no additional logic.

#### Pages Directory Switcher (switch-pages-directory.js)
**How It Works:**
1. **Validates** target app namespace
2. **Backs up** current `pages/` directory to `.app-backups/pages.backup.{timestamp}/`
3. **Recursively clears** `pages/` directory (prevents directory lock issues)
4. **Copies** `app_{namespace}_pages/` → `pages/` (recursive copy)
5. **Creates** `pages/INDEX.md` indicator file with architecture information
6. Nuxt dev/build starts → only sees `pages/` (which is copied from `app_{namespace}_pages/`)

**Usage:**
```bash
# Switch to specific app
node scripts/switch-pages-directory.js [appname]

# Switch to main app
node scripts/switch-pages-directory.js main

# Show current app
node scripts/switch-pages-directory.js --current

# List backups
node scripts/switch-pages-directory.js --list

# Restore from backup
node scripts/switch-pages-directory.js --restore pages.backup.{timestamp}
```

**Environment Variable:**
```bash
APP_ENTRY=ittools node scripts/switch-pages-directory.js
```

#### Launcher Scripts
**Development:** `.\scripts\start.ps1 [namespace]` or `node scripts/switch-app-entry-plus.js [namespace]`
**Build:** `.\scripts\start.ps1 [namespace] build`

**Note:** Launcher scripts should call `switch-pages-directory.js` before starting Nuxt dev/build.

#### Multi-App Factory System (switch-app-entry-plus.js)
**How It Works:**
1. **Mirrors** source workspace to factory build directory per app (`factory_root/_app_{namespace}/`)
2. **Runs** `switch-pages-directory.js` in mirrored tree to activate specific app pages
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

### Factory Mirror Path Mapping
- The factory sync runtime is a **1:1 mirror** of `poly_apps/nuxt_main` stored under `.build_dir/nuxt_factory/_app_{namespace}/`.
- **Always translate mirrored paths back to source paths** when filing issues or sharing logs (especially with AI assistants) so fixes happen in the real workspace.
- Conversion rule: Replace the factory prefix `D:/programing/.build_dir/nuxt_factory/_app_{namespace}` with `D:/programing/core_node/poly_apps/nuxt_main` and keep the remainder of the path.
- **Example:**
  - Error path: `D:/programing/.build_dir/nuxt_factory/_app_pymatrix/apps/app_pymatrix/stores_app_pymatrix/scriptStore.ts`
  - Source path: `D:/programing/core_node/poly_apps/nuxt_main/apps/app_pymatrix/stores_app_pymatrix/scriptStore.ts`
- This mapping also applies when debugging services (`services/api/**`), composables, or any generated asset living inside the mirrored runtime.

### 7. i18n Namespace System

#### Global Layer
**Location:** `i18n/locales/`
**Content:** Common translations (save, cancel, settings, theme, etc.) — match the language set defined in the i18n standards below.

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

### App-Specific Layer Standards

| Category | Location | Naming / Structure | Rules |
|----------|----------|-------------------|-------|
| **Components** | `components_app_{namespace}/` | `{namespace}_index/{Namespace}App.vue` (main)<br>`{namespace}_index_components/` (sub-components)<br>`{feature}/` (feature modules) | App-specific UI, can import common, no cross-app imports |
| **Stores** | `stores_app_{namespace}/` | `deviceStore.ts`, `groupStore.ts` | App-specific state, can compose common stores, no cross-app imports |
| **Services** | `services/api/{namespace}/` or<br>`services_app_{namespace}/` | `{namespace}-{resource}-api.ts` | Must add `X-App-Namespace` header, no cross-namespace imports |
| **Composables** | `composables_app_{namespace}/` | App-specific composables | Can use common composables, no cross-app imports |
| **Config** | `config_app_{namespace}/` | Tool registries, constants | App-specific config only |

**Component Naming Examples:**
- Main: `ittools_index/ItToolsApp.vue`, `pymatrix_index/PyMatrixApp.vue`
- Sub: `ittools_index_components/CategoryTreePanel.vue`
- Feature: `tools/converter/Base64ConverterTool.vue`

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
1. Hardcode namespace strings
2. Mix namespaces in single file
3. Skip namespace validation
4. Create routes without prefixes
5. Duplicate common code in app directories
6. Reference other app's code
7. Put app-specific translations in global i18n
8. Skip languages in app i18n files

---

## 🚀 Adding New App

| Step | Action | Files/Locations |
|------|--------|----------------|
| 1. Create Pages Dir | Copy template | `cp -r app_main_pages app_myapp_pages`<br>Edit `app_myapp_pages/index.vue` to import `MyappApp.vue` |
| 2. Create Dirs | App structure | `apps/app_myapp/{components,composables,stores,layouts,i18n_app_myapp/locales}_app_myapp`<br>`services/api/myapp/` |
| 3. Register | Namespace | `utils/namespace-registry.ts`: `... \| 'myapp'`<br>`composables/useRouteNamespace.ts`: `myapp: { prefix: '/myapp' }` |
| 4. Create Files | Entry & config | `app_myapp_pages/index.vue` (imports `MyappApp.vue`)<br>`components_app_myapp/myapp_index/MyappApp.vue`<br>`configs/myapp.config.ts`<br>`layouts/myapp.vue`<br>`services/api/myapp/myapp-main-api.ts` (with `X-App-Namespace` header)<br>`i18n_app_myapp/locales/{en,zh,ja,fa}.json` |
| 5. Switch Pages | Activate app | `node scripts/switch-pages-directory.js myapp` |

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
| Pages Switcher | `scripts/switch-pages-directory.js` |
| App Pages (Source) | `app_{namespace}_pages/` |
| Active Pages (Managed) | `pages/` (DO NOT EDIT DIRECTLY) |
| Pages Template | `app_main_pages/` |

---

## ✅ Validation Checklist

### For Each App
Confirm that every namespace is registered (`utils/namespace-registry.ts`, `useRouteNamespace.ts`), owns its config plus API directory, and exposes the entry stack described earlier (single entry page, `{Namespace}App` component, layout wrapper, optional internal layouts). Each app must ship `i18n_app_{namespace}/locales/` covering the full global language set with unique keys.

**Pages Directory Requirements:**
- Each app must have `app_{namespace}_pages/` directory (copy from `app_main_pages/` as template)
- `app_{namespace}_pages/index.vue` must follow the Entry Point Pattern
- **Never edit `pages/` directly** - always edit `app_{namespace}_pages/` and run the switcher script

Use the component naming conventions in the **App-Specific Layer Standards** section (main file under `{namespace}_index/`, supporting modules grouped by feature).

### Global Standards
Re-use the guidance from **Common vs App-Specific Architecture**: keep shared logic under `common/`, enforce the i18n language set once in `i18n/locales/`, and structure API clients by namespace with the `X-App-Namespace` header.

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

# Scan for app pages directories
ls . | grep "^app_.*_pages$"

# Scan for entry pages in app pages directories
ls app_*_pages/ | grep "^index\."

# Verify namespace registry
cat utils/namespace-registry.ts | grep "RegisteredNamespace"
```

**Expected App Structure:**
Every discovered namespace must satisfy the validation checklist above (directory scaffold, entry page, primary component, i18n files, and API surface when applicable).

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

**Last Updated:** 2025-11-12
**Maintained By:** Core Node Team

---

## 📝 Important Notes

### Pages Directory Management

**⚠️ CRITICAL:** The `pages/` directory is automatically managed by the architecture system. 

**DO:**
- ✅ Edit files in `app_{namespace}_pages/` directories
- ✅ Run `node scripts/switch-pages-directory.js [appname]` to activate changes
- ✅ Use `app_main_pages/` as template when creating new apps
- ✅ Check `pages/INDEX.md` for architecture information

**DON'T:**
- ❌ Edit files in `pages/` directly (changes will be lost)
- ❌ Manually rename or move `pages/` directory
- ❌ Commit changes to `pages/` directory (it's auto-generated)

### Migration from Old System

If you're migrating from the old `pages/index.{namespace}.vue` system:
1. Copy existing `pages/index.{namespace}.vue` files to `app_{namespace}_pages/index.vue`
2. Copy other app-specific pages to `app_{namespace}_pages/`
3. Run `node scripts/switch-pages-directory.js [appname]` to activate
4. Remove old `pages/index.{namespace}.vue` files (they're no longer used)
