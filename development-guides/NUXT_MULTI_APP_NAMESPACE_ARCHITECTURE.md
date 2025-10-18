# Nuxt Multi-App Namespace Architecture

**Version:** 3.0 (Updated: 2025-10-18)
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

### 5. Entry Point System
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

### 5. Create Entry Page
```vue
<!-- pages/index.myapp.vue -->
<template>
  <div>
    <h1>My App</h1>
  </div>
</template>
```

### 6. Add to Switch Script
```javascript
// scripts/switch-app-entry.js
const SUPPORTED_APPS = ['example', 'codemart', 'dev', 'admin', 'dashboard', 'myapp']
```

### 7. Update Type System
```typescript
// utils/namespace-registry.ts
export type RegisteredNamespace = 'example' | 'codemart' | 'dev' | 'admin' | 'dashboard' | 'myapp'

getNamespacesList(): RegisteredNamespace[] {
  return ['example', 'codemart', 'dev', 'admin', 'dashboard', 'myapp']
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

### ❌ Don't
1. Don't hardcode namespace strings (use types)
2. Don't mix namespaces in a single file
3. Don't skip validation
4. Don't create routes without prefixes (except root namespace)
5. Don't bypass the app entry system

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

---

## 🎯 Key Files Reference

| Purpose | File |
|---------|------|
| App Registry | `app-entry.ts` |
| Route Namespaces | `composables/useRouteNamespace.ts` |
| Type Safety | `utils/namespace-registry.ts` |
| Switch Script | `scripts/switch-app-entry.js` |
| Middleware | `middleware/app-entry.global.ts` |

---

## ✅ Architecture Status

**Overall Completeness: 100%** 🎉

- ✅ App Entry System (5/5 apps)
- ✅ Route Namespaces (5/5 registered)
- ✅ Config Files (5/5 created)
- ✅ API Services (5/5 namespaces)
- ✅ Page Entries (5/5 files)
- ✅ Validation System
- ✅ Type Safety

**All critical gaps resolved.**

---

**Last Updated:** 2025-10-18
**Maintained By:** Core Node Team
