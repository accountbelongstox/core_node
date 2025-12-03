# React Native Multi-App Namespace Architecture

**Version:** 1.0 (Created: 2025-12-03)
**Status:** 🚧 DRAFT

---

## 🤖 AI Development Guide

### Priority: Extend Common Libraries First
When developing features, **always check and extend `common/` libraries first** before creating app-specific code.

**Common Libraries (Scan First):**
- `src/common/stores/` - Global state management (app-config-store, base-store)
- `src/common/components/` - Reusable UI components (buttons, forms, modals, etc.)
- `src/common/hooks/` - Custom React hooks (useAppConfig, useTheme, useI18n)
- `src/common/utils/` - Utility functions (storage, validation, formatting)
- `src/common/services/` - Shared API services and network clients
- `src/common/navigation/` - Navigation utilities and wrappers
- `src/common/theme/` - Theme configurations and styling system

**Extension Rule:**
- ✅ Extend common libraries when the functionality is **reusable across multiple apps**
- ✅ Keep common code **generic and configurable**
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
- `poly_apps/react_native/` - Main workspace
- `apps/app_{namespace}/` - App-specific code
- `src/common/` - Shared foundation
- `assets/common/` - Shared assets (fonts, base images)
- `assets/apps/app_{namespace}/` - App-specific assets (icons, splash screens)
- `configs/{namespace}.config.ts` - App configurations
- `scripts/` - Build and deployment automation

**App-Specific Structure:**
Each app follows the isolated directory pattern with namespace-prefixed folders.

- `apps/app_{namespace}/components_app_{namespace}/` - App components
- `apps/app_{namespace}/screens_app_{namespace}/` - App screens
- `apps/app_{namespace}/navigation_app_{namespace}/` - App navigation
- `apps/app_{namespace}/stores_app_{namespace}/` - App state stores
- `apps/app_{namespace}/services_app_{namespace}/` - App API services
- `apps/app_{namespace}/hooks_app_{namespace}/` - App custom hooks
- `apps/app_{namespace}/i18n_app_{namespace}/locales/` - App translations (en, zh, ja, fa, etc.)
- `apps/app_{namespace}/theme_app_{namespace}/` - App theme customization
- `apps/app_{namespace}/config_app_{namespace}/` - App configuration

---

## 📐 Architecture Layers

### 1. Namespace Registry
**File:** `src/utils/namespace-registry.ts`
**Purpose:** Type-safe namespace management with TypeScript literal types

**Required Fields per Namespace:**
- Unique string identifier (kebab-case recommended)
- Platform support flags (iOS, Android, Web)
- Display name and metadata

### 2. Entry Point System
**Files:** `index.js`, `src/app-registry.ts`
**Purpose:** Dynamic app registration and initialization

**Registration Flow:**
Each app registers itself with React Native's AppRegistry. The active app is determined by environment variables or build configuration. Apps are lazy-loaded to optimize bundle size.

**Environment Variables:**
Configuration through environment variables controls which app to load.

- `APP_ENTRY` - Active namespace identifier
- `APP_DISPLAY_NAME` - App display name for native UI
- `APP_VERSION` - Version string for app metadata

### 3. Configuration System
**Location:** `configs/{namespace}.config.ts`
**Purpose:** Centralized app-specific configuration

**Required Configuration Fields:**
Each config file must define app identity, navigation settings, API endpoints, theme preferences, feature flags, and platform-specific settings.

**Config Structure:**
Type-safe configuration object with namespace, display name, bundle identifier, API base URL, supported platforms, default theme, enabled features, and navigation structure.

### 4. Platform Resource Management
**Locations:**
- `assets/apps/app_{namespace}/android/` - Android-specific resources
- `assets/apps/app_{namespace}/ios/` - iOS-specific resources
- `assets/apps/app_{namespace}/web/` - Web-specific resources
- `assets/apps/app_{namespace}/common/` - Cross-platform assets

**Resource Categories:**
Icons, splash screens, fonts, images, platform manifests (AndroidManifest.xml, Info.plist, index.html).

**Resource Replacement Strategy:**
Build scripts automatically swap resources based on target app and platform. Original resources are preserved for restoration. Resources use namespace-based naming to prevent conflicts.

### 5. Navigation System
**Global:** `src/common/navigation/` - Base navigation utilities
**App-Specific:** `apps/app_{namespace}/navigation_app_{namespace}/`

**Navigation Stack:**
Each app defines its own navigation structure. Common navigation wrappers provide consistent behavior. Deep linking supports namespace-based routing.

**Routing Convention:**
URL paths follow pattern `{namespace}://{screen}/{params}` for deep links. Screen names use format `{Namespace}_{ScreenName}` to prevent collisions.

### 6. State Management
**Global:** `src/common/stores/` - Shared state management
**App-Specific:** `apps/app_{namespace}/stores_app_{namespace}/`

**Store Architecture:**
Uses Redux Toolkit or Zustand for state management. Common stores handle auth, theme, i18n, network status. App stores manage feature-specific state. State is namespaced to prevent conflicts.

### 7. i18n Namespace System

#### Global Layer
**Location:** `src/common/i18n/locales/`
**Content:** Common translations (buttons, errors, validation messages, etc.)
**Languages:** Must support all defined languages consistently

#### App-Specific Layer
**Location:** `apps/app_{namespace}/i18n_app_{namespace}/locales/`
**Naming:** `i18n_app_{namespace}`, e.g., `i18n_app_myapp`
**Content:** App-specific translations only
**Languages:** Must match global language set

#### Merging Strategy
Translation loading follows three-step process: load global translations, load app translations, merge with app overriding global.

#### Required Languages
Minimum supported language set includes English, Chinese (Simplified), Japanese, Persian (RTL support), Spanish, French, German, Russian, Portuguese, Italian, Polish, Turkish, Swedish, Hungarian, Danish, Greek.

---

## 📦 Common vs App-Specific Architecture

### Common Layer Standards

**Components:** `src/common/components/`
Reusable UI components with prop-driven configuration. No namespace-specific logic. Platform-agnostic where possible.

**Hooks:** `src/common/hooks/`
Pure React hooks with no app dependencies. Composable and testable. Type-safe with TypeScript.

**Services:** `src/common/services/`
Generic API clients and network utilities. No hardcoded endpoints. Supports multiple auth strategies.

**Utils:** `src/common/utils/`
Pure functions for common operations. Platform utilities for iOS/Android/Web detection. Storage wrappers (AsyncStorage, MMKV, etc.).

### App-Specific Layer Standards

**Screens:** `screens_app_{namespace}/`
App-specific screen components. Can import common components. No cross-app imports.

**Services:** `services_app_{namespace}/`
App-specific API integrations. Must use namespace in HTTP headers. Can compose common service utilities.

**Navigation:** `navigation_app_{namespace}/`
App-specific routing and screen stacks. Uses common navigation wrappers. Defines deep link handlers.

**Theme:** `theme_app_{namespace}/`
App-specific color schemes and styling. Extends common theme system. Platform-specific overrides allowed.

---

## 📋 Namespace Rules

### ✅ DO
1. Use consistent namespace across all layers
2. Put common code in `src/common/`
3. Validate namespace with TypeScript types
4. Prefix app-specific directories with `app_{namespace}`
5. Include namespace in API headers
6. Support all global languages in app i18n
7. Use resource replacement for platform assets
8. Follow naming conventions strictly

### ❌ DON'T
1. Hardcode namespace strings in code
2. Mix namespaces in single file
3. Skip namespace validation
4. Create routes without namespace prefixes
5. Duplicate common code in app directories
6. Reference other app's code directly
7. Put app-specific translations in global i18n
8. Skip languages in app i18n files
9. Manually edit platform-generated files

---

## 🚀 Adding New App

**Step 1: Create Directories**
Create app directory structure following namespace convention.

**Step 2: Register Namespace**
Add to namespace registry with type-safe literal. Update app-registry for dynamic loading.

**Step 3: Create Configuration**
Create config file with all required fields. Define API endpoints and feature flags.

**Step 4: Setup Navigation**
Define screen stack and routing. Implement deep link handlers.

**Step 5: Create Resources**
Add platform-specific icons and splash screens. Create resource manifests for build scripts.

**Step 6: Setup i18n**
Create translation files for all supported languages. Define app-specific translation keys.

**Step 7: Implement Entry Screen**
Create main app screen component. Register with app-registry.

**Step 8: Configure Build**
Update build scripts for resource replacement. Add platform-specific configurations.

---

## 🔍 Key Files

**Namespace Management:**
- `src/utils/namespace-registry.ts` - Namespace type definitions
- `src/app-registry.ts` - App registration and loading
- `configs/{namespace}.config.ts` - App configuration

**Build System:**
- `scripts/start.ps1` - Main launcher script
- `scripts/build.ps1` - Build automation
- `scripts/resource-manager.ps1` - Asset replacement
- `scripts/test-runner.ps1` - Test execution

**i18n System:**
- `src/common/i18n/locales/` - Global translations
- `apps/app_{namespace}/i18n_app_{namespace}/locales/` - App translations
- `src/common/hooks/useAppI18n.ts` - Translation hook

**Platform Resources:**
- `assets/apps/app_{namespace}/android/` - Android resources
- `assets/apps/app_{namespace}/ios/` - iOS resources
- `assets/apps/app_{namespace}/web/` - Web resources

---

## ✅ Validation Checklist

### For Each App

**Registration:**
Namespace registered in type system. Config file created with all fields. App registered in app-registry.

**Directory Structure:**
All namespace-prefixed directories created. Follows common layer conventions. No cross-app dependencies.

**i18n:**
Translation files for all languages. Keys namespaced to prevent conflicts. Falls back to global translations.

**Resources:**
Platform icons provided for iOS and Android. Splash screens for all platforms. Resource manifests configured.

**Navigation:**
Screen stack defined. Deep links configured. Uses common navigation wrappers.

**Build:**
Can build for iOS, Android, Web independently. Resources replaced correctly. Environment variables set properly.

### Global Standards

**Common Layer:**
No app-specific logic in common. All shared code properly abstracted. TypeScript types enforced.

**i18n:**
All languages supported globally. RTL languages tested. No missing translation keys.

**Testing:**
Unit tests for common utilities. Integration tests for app flows. Platform-specific tests where needed.

---

## 🎯 Platform-Specific Considerations

### iOS Resources
**Icon Sets:** AppIcon.appiconset with all required sizes
**Launch Screen:** LaunchScreen.storyboard or launch images
**Info.plist:** Bundle identifier, display name, permissions

### Android Resources
**Icons:** mipmap folders for all densities (mdpi, hdpi, xhdpi, etc.)
**Splash:** drawable resources or splash screen API
**Manifest:** Package name, app name, permissions

### Web Resources
**Favicon:** Multiple sizes for different devices
**Manifest:** PWA manifest.json configuration
**Index:** Custom HTML template per app

---

## 🔧 Build System Architecture

### Factory Mirror System
Similar to Nuxt architecture, creates isolated build environments per app. Mirrors source to dedicated build directories. Enables concurrent multi-app development.

**Factory Locations:**
- Windows: `D:/programing/_build_dir/rn_factory/_app_{namespace}/`
- Linux: `{base}/_build_dir/rn_factory/linux/_app_{namespace}/`

### Resource Replacement Pipeline
Pre-build phase identifies target app and platform. Backs up original resources. Copies app-specific resources to platform directories. Runs platform-specific build commands. Restores original resources post-build.

### Supported Build Modes
**Debug Mode:** Fast refresh enabled. Development server running. Source maps included. No resource optimization.

**Build Mode:** Production optimization. Minification and bundling. Resource compression. Platform-specific outputs.

**Test Mode:** Jest test runner. Platform-specific test environments. Coverage reporting.

---

## 📊 Current Apps

**Discovery Commands:**
Scan apps directory for namespaces. Read namespace registry for registered apps. Check configs directory for configurations.

**Expected App Structure:**
Each app must satisfy all validation criteria. Complete directory structure. All required configuration files. Platform resources for each target.

---

## 🔄 Migration from Single-App Structure

**Phase 1: Prepare Common Layer**
Extract shared code to `src/common/`. Create common component library. Setup common hooks and utils.

**Phase 2: Create First App Namespace**
Choose primary app namespace. Move existing code to app-specific directories. Create app configuration.

**Phase 3: Setup Build System**
Implement resource replacement scripts. Configure factory mirror system. Test build pipeline.

**Phase 4: Add Additional Apps**
Follow "Adding New App" workflow. Reuse common layer components. Test namespace isolation.

---

**Last Updated:** 2025-12-03
**Maintained By:** Core Node Team

---
