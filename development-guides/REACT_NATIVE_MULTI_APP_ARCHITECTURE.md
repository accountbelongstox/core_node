# React Native Multi-App Namespace Architecture

**Version:** 2.1 (Updated: 2025-12-03)
**Status:** ✅ COMPLETE

---

## 🤖 AI Development Guide

### Priority: Extend Common Libraries First
Always check and extend `common/` libraries first before creating app-specific code.

**Common Libraries (Scan First):**
- `src/common/components/` - Reusable UI components
- `src/common/utils/` - Utility functions
- `src/common/services/` - Shared API services
- `src/common/hooks/` - Custom React hooks
- `src/common/types/` - Common TypeScript types

**Extension Rule:**
- ✅ Extend common libraries when functionality is reusable across multiple apps
- ✅ Keep common code generic and configurable
- ❌ Avoid adding app-specific business logic to common layer

### ⚠️ CRITICAL: Source Code vs Build Directory
**Rule:** ALWAYS modify source code in `poly_apps/react_native/`, NEVER modify `_build_dir/` (auto-synced mirror). Convert error paths: `_build_dir/rn_factory/_app_{namespace}/` → `poly_apps/react_native/`.

---

## 🎯 Core Principles

### Namespace Isolation
- Each app has unique namespace identifier
- No cross-app dependencies in code
- Shared resources via global `common/` layer
- Platform-specific resource management (iOS, Android, Web)

### Directory Structure
Root project structure for multi-app React Native workspace.

**Project Root:**
```
poly_apps/react_native/
├─ configs/                    # (Deprecated) Legacy configs, not used anymore
├─ src/
│  ├─ common/                  # Shared foundation (all apps can use)
│  │  ├─ components/          # Common components
│  │  ├─ utils/               # Common utilities
│  │  ├─ services/            # Common API services
│  │  ├─ hooks/               # Common React Hooks
│  │  ├─ store/               # Common state management
│  │  ├─ types/               # Common TypeScript types
│  │  ├─ constants/           # Common constants
│  │  ├─ styles/              # Common styles/theme base
│  │  └─ common_assets.ts      # Common resources (REQUIRED)
│  │
│  ├─ apps/                    # App-specific code (auto-scanned)
│  │  ├─ demo/                # Demo app namespace
│  │  │  ├─ demo_pages/       # Demo pages
│  │  │  ├─ demo_components/  # Demo components
│  │  │  ├─ demo_navigation/  # Demo navigation
│  │  │  ├─ demo_theme/       # Demo theme
│  │  │  ├─ demo_store/       # Demo state
│  │  │  ├─ demo_services/    # Demo API services
│  │  │  ├─ demo_hooks/       # Demo custom hooks
│  │  │  ├─ demo_types/       # Demo type definitions
│  │  │  ├─ demo_assets.ts    # Demo app resources (REQUIRED)
│  │  │  └─ App.tsx           # Demo app entry
│  └─ app-registry.ts         # App discovery and registration
│
├─ assets/
│  └─ apps/
│     ├─ app_demo/            # Demo app resources
│     │  ├─ android/          # Android resources
│     │  └─ ios/              # iOS resources
│     └─ app_example/         # Example app resources
│        ├─ android/
│        └─ ios/
│
├─ index.js                   # Dynamic entry (loads app based on APP_ENTRY)
├─ App.tsx                    # (Deprecated) Replaced by src/apps/{namespace}/App.tsx
└─ scripts/                   # Build and deployment automation
```

**App-Specific Structure:**
Each app in `src/apps/{namespace}/` follows namespace-prefixed pattern: `{namespace}_pages/`, `{namespace}_components/`, `{namespace}_navigation/`, `{namespace}_theme/`, `{namespace}_store/`, `{namespace}_services/`, `{namespace}_hooks/`, `{namespace}_types/`, plus required `App.tsx`, `build_config.ini`, and `{namespace}_assets.ts`.

---

## 📐 Architecture Layers

### Entry Point System
**Files:** `index.js`, `src/common/utils/app-registry.ts`
**Purpose:** Dynamic app discovery and loading based on `APP_ENTRY` environment variable.

**App Discovery:**
- Automatically scans `src/apps/` directory
- Each app must have `App.tsx` in `src/apps/{namespace}/App.tsx`
- No configuration files needed - apps are auto-discovered

**Environment Variables:**
- `APP_ENTRY` - Active namespace identifier (default: 'demo')

### Import Path Rules
**MANDATORY: Always use path aliases, NEVER use relative paths**
- ✅ Use `@/common/*` for common code
- ✅ Use `@/apps/{namespace}/*` for app-specific code
- ❌ Never use `../../common/*` or relative paths
- Each app MUST have its own store and navigation (no shared `src/common/store`)

**Configuration Files:**
- `tsconfig.json` - Path aliases: `@/common/*`, `@/apps/*`
- `babel.config.js` - `babel-plugin-module-resolver` with same aliases
- `metro.config.js` - Metro bundler configuration
- Required package: `babel-plugin-module-resolver` in `devDependencies`

### Resource Management System
**MANDATORY: All resources must be registered in `{namespace}_assets.ts` (app) or `common_assets.ts` (common), code must reference by key only, never hardcode paths.**

### Build Configuration
**Location:** `src/apps/{namespace}/build_config.ini` (required for each app)
**Sections:** `[app_info]`, `[package_settings]`, `[build_settings]`, `[resources]`, `[splash_config]`
**Purpose:** Defines app-specific build settings, package information, and resource configuration.

---

## 📋 Namespace Rules

### ✅ DO
1. Use consistent namespace across all layers
2. Put common code in `src/common/`
3. Prefix app-specific directories with `{namespace}_`
4. Create `App.tsx` in `src/apps/{namespace}/` for app entry
5. Include `build_config.ini` in each app directory
6. Use TypeScript path aliases (`@/common/*`, `@/apps/*`)
7. Support all global languages in app i18n (if used)

### ❌ DON'T
1. Hardcode namespace strings in code
2. Mix namespaces in single file
3. Create apps without `App.tsx` entry file
4. Create directories without namespace prefix in app folders
5. Reference other app's code directly
6. Use old `configs/` directory (deprecated, use auto-discovery)
7. Use relative paths for imports
8. Hardcode resource paths in components - always use asset keys
9. Create apps without `{namespace}_assets.ts` file
10. Use `require()` with relative paths directly in components

---

## 🚀 Adding New App

**Step 1:** Create directory `src/apps/{namespace}/`

**Step 2:** Create `App.tsx` entry file

**Step 3:** Create `build_config.ini` configuration file

**Step 4:** Create namespace-prefixed directories: `{namespace}_pages/`, `{namespace}_components/`, `{namespace}_navigation/`, `{namespace}_theme/`, `{namespace}_store/`, `{namespace}_services/`, `{namespace}_hooks/`, `{namespace}_types/`

**Step 5:** Create `{namespace}_assets.ts` file to register all app-specific resources with keys

**Step 6:** Add platform resources in `assets/apps/app_{namespace}/` and register them in `{namespace}_assets.ts`

**Step 7:** Set `APP_ENTRY={namespace}` and run - app will be auto-discovered

**No Configuration Files Needed!** Apps are automatically discovered by scanning `src/apps/`.

---

## ✅ Validation Checklist

**For Each App:**
- App directory exists in `src/apps/{namespace}/`
- `App.tsx` entry file exists and exports default component
- `build_config.ini` file exists
- `{namespace}_assets.ts` file exists and exports all app resources
- All directories use `{namespace}_` prefix
- No cross-app dependencies
- No hardcoded resource paths - all resources use asset keys
- Platform resources provided in `assets/apps/app_{namespace}/` and registered in asset file

**Global Standards:**
- No app-specific logic in common layer
- All shared code properly abstracted
- TypeScript types enforced

---

## 🔧 Build System

**Factory Mirror System:** Creates isolated build environments per app. Mirrors source to dedicated build directories.

**Resource Replacement Pipeline:** Pre-build phase backs up original resources, copies app-specific resources, runs build, restores original resources.

**Supported Build Modes:** Debug (fast refresh, development server), Build (production optimization), Test (Jest test runner).

---

**Last Updated:** 2025-12-03
**Maintained By:** Core Node Team


