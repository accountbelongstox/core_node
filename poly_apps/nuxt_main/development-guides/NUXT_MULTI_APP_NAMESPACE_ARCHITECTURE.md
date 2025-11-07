# Nuxt Multi-App Namespace Architecture

**Version:** 4.0 (Updated: 2025-10-31)
**Status:** ✅ **COMPLETE** (100%)

---

## 🎯 Quick Reference

### Registered Apps (5)
```typescript
type AppEntryType = 'example' | 'codemart' | 'dev' | 'admin' | 'dashboard'
```

### Namespace Structure
| App | Namespace | Route Prefix | Config | API | Status |
|-----|-----------|--------------|--------|-----|--------|
| example | example | / | ✅ | ✅ | ✅ |
| codemart | codemart | /codemart | ✅ | ✅ | ✅ |
| dev | dev | /dev | ✅ | ✅ | ✅ |
| admin | admin | /admin | ✅ | ✅ | ✅ |
| dashboard | dashboard | /dashboard | ✅ | ✅ | ✅ |

---

## 📐 Architecture Layers

### 1. App Entry System
**File:** `app-entry.ts`

Defines app metadata, theme, features, and permissions:

```typescript
interface AppEntryConfig {
  name: string
  displayName: string
  namespace: string              // ⭐ Primary identifier
  defaultRoute: string
  theme: { primary, secondary, layout }
  api: { namespace, baseUrl, version }
  features: { [key: string]: boolean }
  permissions: { required, roles }
}
```

### 2. Route Namespace System
**File:** `composables/useRouteNamespace.ts`

Maps URL paths to app namespaces:

```typescript
const namespaceRegistry = {
  example: { prefix: '', ... },           // Root routes
  codemart: { prefix: '/codemart', ... },
  dev: { prefix: '/dev', ... },
  admin: { prefix: '/admin', ... },
  dashboard: { prefix: '/dashboard', ... }
}
```

**Detection Logic:**
- `/admin/users` → `admin`
- `/dev/tools` → `dev`
- `/dashboard` → `dashboard`
- `/` → `example` (default)

### 3. Configuration Files
**Location:** `configs/*.config.ts`

Each app has a dedicated config file:
- `example.config.ts` - Example app settings
- `codemart.config.ts` - CodeMart platform
- `dev.config.ts` - Development tools
- `subsite-admin.config.ts` - Admin panel
- `dashboard.config.ts` - Analytics dashboard

### 4. API Service Layer
**Location:** `services/api/{namespace}/`

Namespace isolation via HTTP headers:

```typescript
class ExampleDataSourceAPI {
  async getData() {
    return $fetch('/api/example/datasources', {
      headers: {
        'X-App-Namespace': 'example'  // ⭐ Isolation key
      }
    })
  }
}
```

**Directory Structure:**
```
services/api/
├── example/example-datasource-api.ts
├── codemart/codemart-projects-api.ts
├── dev/dev-tools-api.ts
├── admin/admin-datasource-api.ts
└── dashboard/dashboard-analytics-api.ts
```

### 5. Layout System
**Location:** `layouts/` and `apps/app_*/layouts_app_*/`

Layout isolation via custom app layouts. Each app can choose its own UI structure:

```vue
<!-- pages/index.pymatrix.vue -->
<script setup>
definePageMeta({
  layout: 'pymatrix'  // Uses apps/app_pymatrix/layouts_app_pymatrix/default.vue
})
</script>
```

**Directory Structure:**
```
layouts/
├── base.vue                    # Minimal: services only, no UI
├── default-with-nav.vue        # Standard: Header + Sidebar + Footer
├── admin.vue                   # Wrapper for app_admin layout
├── dashboard.vue               # Wrapper for app_dashboard layout
├── pymatrix.vue                # Wrapper for app_pymatrix layout
└── auth-layout.vue             # Auth pages

apps/
├── app_admin/
│   └── layouts_app_admin/
│       └── default.vue         # Admin layout (uses shared Header/Sidebar)
├── app_dashboard/
│   └── layouts_app_dashboard/
│       └── default.vue         # Dashboard layout (uses shared Header/Sidebar)
└── app_pymatrix/
    └── layouts_app_pymatrix/
        └── default.vue         # PyMatrix custom layout (own navigation)
```

**Layout Types:**

| Layout | Use Case | Navigation | Services |
|--------|----------|------------|----------|
| `base` | Minimal app, custom UI | None | ✅ Theme, Store, i18n |
| `default-with-nav` | Standard admin app | Header + Sidebar + Footer | ✅ All services |
| `app_*/layouts_app_*/default` | Custom app layout | App-defined | ✅ All services |

**Key Principles:**
- ✅ Shared components (`components/layout/Header.vue`, `Sidebar.vue`) are **optional**
- ✅ Apps **choose** whether to use shared navigation components
- ✅ Apps can implement their own complete UI structure
- ✅ Base layout provides services (theme, store, i18n) without forcing UI

**Creating Custom Layout:**

1. Create layout directory in app folder:
```bash
mkdir -p apps/app_myapp/layouts_app_myapp
```

2. Create layout file:
```vue
<!-- apps/app_myapp/layouts_app_myapp/default.vue -->
<template>
  <div class="my-app-layout">
    <!-- Custom structure -->
    <MyAppHeader />
    <NuxtPage />
    <MyAppFooter />
  </div>
</template>
```

3. Create wrapper in root layouts:
```vue
<!-- layouts/myapp.vue -->
<script setup>
import MyAppLayout from '~/apps/app_myapp/layouts_app_myapp/default.vue'
</script>

<template>
  <MyAppLayout />
</template>
```

4. Use in page:
```vue
<!-- pages/index.myapp.vue -->
<script setup>
definePageMeta({
  layout: 'myapp'
})
</script>
```

5. Update app-entry.ts:
```typescript
myapp: {
  theme: {
    layout: 'myapp'  // Matches layouts/myapp.vue
  }
}
```

### 6. Entry Point System
**Location:** `pages/index.{app}.vue`

Each app has a dedicated entry file:
- `index.example.vue`
- `index.codemart.vue`
- `index.dev.vue`
- `index.admin.vue`
- `index.dashboard.vue`

**Switch Script:** `scripts/switch-app-entry.js`

```bash
# Switch to codemart app
node scripts/switch-app-entry.js codemart

# Start dev server
yarn dev:codemart
```

---

## 🔧 Namespace Validation

### Built-in Validation
```typescript
import { useRouteNamespace } from '@/composables/useRouteNamespace'

const { validateNamespace, validateAllNamespaces } = useRouteNamespace()

// Validate single namespace
const result = validateNamespace('example')
// { valid: true, missing: [] }

// Validate all namespaces
const allResults = validateAllNamespaces()
// { example: {...}, codemart: {...}, dev: {...}, admin: {...}, dashboard: {...} }
```

### Type Safety
```typescript
import type { RegisteredNamespace } from '@/utils/namespace-registry'
import { validateNamespaceType } from '@/utils/namespace-registry'

function processNamespace(ns: RegisteredNamespace) {
  // TypeScript ensures ns is one of the 5 valid namespaces
}

// Runtime validation
validateNamespaceType('example') // OK
validateNamespaceType('invalid') // Throws error
```

---

## 🚀 Adding a New App

### 1. Register in App Entry
```typescript
// app-entry.ts
const appEntryRegistry = {
  myapp: {
    name: 'myapp',
    namespace: 'myapp',
    defaultRoute: '/myapp',
    theme: { primary: '#xxx', secondary: '#xxx', layout: 'myapp-layout' },
    api: { namespace: 'myapp', baseUrl: '/api/myapp', version: 'v1' },
    features: { ... },
    permissions: { ... }
  }
}
```

### 2. Create Config
```typescript
// configs/myapp.config.ts
export const myAppConfig = {
  name: 'My App',
  namespace: 'myapp',
  routes: { prefix: '/myapp', pages: [...] },
  theme: { ... },
  api: { baseUrl: '/api/myapp', endpoints: {...} }
}
```

### 3. Register Route Namespace
```typescript
// composables/useRouteNamespace.ts
import myAppConfig from '@/configs/myapp.config'

const namespaceRegistry = {
  myapp: {
    namespace: 'myapp',
    prefix: '/myapp',
    config: myAppConfig,
    pages: ['myapp-dashboard'],
    theme: myAppConfig.theme
  }
}
```

### 4. Create API Service
```typescript
// services/api/myapp/myapp-main-api.ts
export class MyAppMainAPI {
  private baseUrl = '/api/myapp'
  private namespace = 'myapp'

  async getData() {
    return $fetch(`${this.baseUrl}/data`, {
      headers: { 'X-App-Namespace': this.namespace }
    })
  }
}
```

### 5. Create Layout (Optional)
**Option A: Use Default Navigation Layout**
```typescript
// app-entry.ts
myapp: {
  theme: {
    layout: 'default-with-nav'  // Uses shared Header/Sidebar
  }
}
```

**Option B: Create Custom Layout**
1. Create layout directory:
```bash
mkdir -p apps/app_myapp/layouts_app_myapp
```

2. Create layout file:
```vue
<!-- apps/app_myapp/layouts_app_myapp/default.vue -->
<template>
  <div class="myapp-layout">
    <!-- Custom structure or use shared components -->
    <layout-header />  <!-- Optional: choose to use shared Header -->
    <layout-sidebar /> <!-- Optional: choose to use shared Sidebar -->
    <NuxtPage />
    <layout-footer />  <!-- Optional: choose to use shared Footer -->
  </div>
</template>
```

3. Create wrapper in root layouts:
```vue
<!-- layouts/myapp.vue -->
<script setup>
import MyAppLayout from '~/apps/app_myapp/layouts_app_myapp/default.vue'
</script>
<template>
  <MyAppLayout />
</template>
```

4. Update app-entry.ts:
```typescript
myapp: {
  theme: {
    layout: 'myapp'  // Matches layouts/myapp.vue
  }
}
```

### 6. Create Entry Page
```vue
<!-- pages/index.myapp.vue -->
<template>
  <div>
    <h1>My App</h1>
  </div>
</template>
```

### 7. Add to Switch Script
```javascript
// scripts/switch-app-entry.js
const SUPPORTED_APPS = ['example', 'codemart', 'dev', 'admin', 'dashboard', 'myapp']
```

### 8. Update Type System
```typescript
// utils/namespace-registry.ts
export type RegisteredNamespace

getNamespacesList(): RegisteredNamespace[] {
}
```

---

## 📋 Best Practices

### ✅ Do
1. **Use HTTP headers** for namespace isolation: `X-App-Namespace`
2. **Follow naming convention**: `{namespace}-{resource}-api.ts`
3. **Keep namespace consistent** across all layers
4. **Validate namespaces** before processing
5. **Use TypeScript types** for compile-time safety
6. **Create custom layouts** if app needs unique navigation structure
7. **Use shared components** (`layout-header`, `layout-sidebar`) when appropriate
8. **Choose layout explicitly** in pages via `definePageMeta`

### ❌ Don't
1. Don't hardcode namespace strings (use types)
2. Don't mix namespaces in a single file
3. Don't skip validation
4. Don't create routes without prefixes (except root namespace)
5. Don't bypass the app entry system
6. Don't modify shared layouts for app-specific needs
7. Don't duplicate navigation components when custom layout exists
8. Don't force UI structure on apps that need custom layouts

---

## 🔍 Common Patterns

### Pattern 1: Namespace Detection
```typescript
const { currentNamespace } = useRouteNamespace()
// Automatically detects from route path
```

### Pattern 2: Conditional Features
```typescript
const appConfig = getAppEntryConfig('codemart')
if (appConfig.features.marketplace) {
  // Show marketplace features
}
```

### Pattern 3: Dynamic Theming
```typescript
// Middleware applies theme on route change
document.documentElement.style.setProperty('--color-primary', appConfig.theme.primary)
```

### Pattern 4: Custom Layout Selection
```vue
<!-- pages/index.myapp.vue -->
<script setup>
definePageMeta({
  layout: 'myapp'  // Uses custom layout from apps/app_myapp/layouts_app_myapp/
})
</script>
```

### Pattern 5: Optional Shared Components
```vue
<!-- apps/app_myapp/layouts_app_myapp/default.vue -->
<template>
  <div class="myapp-layout">
    <!-- Choose to use shared components or implement custom -->
    <layout-header />  <!-- ✅ Optional: shared component -->
    <MyAppCustomNav /> <!-- ✅ Custom component -->
    <NuxtPage />
  </div>
</template>
```

---

## 🎯 Key Files Reference

| Purpose | File |
|---------|------|
| App Registry | `app-entry.ts` |
| Route Namespaces | `composables/useRouteNamespace.ts` |
| Type Safety | `utils/namespace-registry.ts` |
| Switch Script | `scripts/switch-app-entry.js` |
| Middleware | `middleware/app-entry.global.ts` |
| Base Layout | `layouts/base.vue` |
| Default Layout | `layouts/default-with-nav.vue` |
| App Layouts | `apps/app_*/layouts_app_*/default.vue` |
| Layout Wrappers | `layouts/{app}.vue` |

---

## ✅ Architecture Status

**Overall Completeness: 100%** 🎉

- ✅ App Entry System (5/5 apps)
- ✅ Route Namespaces (5/5 registered)
- ✅ Config Files (5/5 created)
- ✅ API Services (5/5 namespaces)
- ✅ Layout System (Layout isolation implemented)
- ✅ Page Entries (5/5 files)
- ✅ Validation System
- ✅ Type Safety

**Layout Isolation Status:**
- ✅ Base layout created (`layouts/base.vue`)
- ✅ Default navigation layout (`layouts/default-with-nav.vue`)
- ✅ Custom app layouts (admin, dashboard, pymatrix)
- ✅ Layout wrappers in root layouts directory
- ✅ Shared components are optional (opt-in model)
- ✅ No forced UI structure on sub-apps

**All critical gaps resolved.**

---

**Last Updated:** 2025-10-31
**Maintained By:** Core Node Team
