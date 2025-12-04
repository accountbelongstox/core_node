# ITTools - Developer Utilities Platform

**Version:** 1.0.0
**Namespace:** `ittools`
**Framework:** Nuxt 3 + Vue 3 + TypeScript

---

## 📋 Overview

ITTools is a comprehensive collection of 88+ handy online utilities for developers, featuring:

- **Crypto & Security Tools**: Hash generators, encryption, UUID/ULID, password tools
- **Converters**: Base64, URL, JSON/YAML/XML, temperature, date/time
- **Web Development**: JSON formatter, JWT parser, QR code generator
- **Text Processing**: Regex tester, text statistics, Lorem Ipsum
- **Network Tools**: IPv4/IPv6 calculators, MAC generator
- **Math Tools**: Expression evaluator, percentage calculator
- **Additional Features**: Browser automation, Windows operations, Nginx management

---

## 🏗️ Architecture

### Directory Structure

```
poly_apps/nuxt_main/apps/app_ittools/
├── components_app_ittools/        # Vue components
│   ├── ittools_index/            # Main app component
│   ├── ittools_index_components/ # Sub-components (sidebar, panels, etc.)
│   └── tools/                    # Individual tool components
├── composables_app_ittools/       # Vue composables
│   └── useApiClient.ts           # API client hook
├── config_app_ittools/            # Configuration files
│   ├── api-config.ts             # API endpoint configuration
│   ├── api-routes.ts             # Centralized API routes (NEW)
│   ├── index.ts                  # Main config
│   └── tool-params.ts            # Tool parameter definitions
├── constants_app_ittools/         # Constants and static data
│   ├── complete-tools.ts         # Complete tool registry
│   ├── tools.ts                  # Tool definitions
│   └── ui-config.ts              # UI configuration
├── i18n_app_ittools/             # Internationalization
│   └── locales/                  # Translation files (en, zh, ja, fa, etc.)
├── services_app_ittools/          # Services layer
│   ├── api-client.ts             # WebSocket API client
│   ├── http-client.ts            # HTTP client (NEW)
│   ├── ittools-api.ts            # ITTools API service
│   └── logger.ts                 # Application logger
├── stores_app_ittools/            # Pinia stores
│   └── ittools-store.ts          # Main store
├── styles_app_ittools/            # Styles
│   └── holographic.css           # Holographic theme
└── types_app_ittools/             # TypeScript types
    └── index.ts                  # Type definitions
```

---

## 🚀 Key Features

### 1. Centralized API Management

#### API Routes Configuration (`config_app_ittools/api-routes.ts`)
All API endpoints are defined in one central location:

```typescript
import { ITTOOLS_API_ROUTES } from '@/apps/app_ittools/config_app_ittools/api-routes';

// Example usage:
const hashEndpoint = ITTOOLS_API_ROUTES.CRYPTO.HASH;
// => '/api/ittools/v1/crypto/hash'
```

Benefits:
- ✅ No hardcoded URLs in components
- ✅ Type-safe endpoint access
- ✅ Easy to update and maintain
- ✅ Centralized documentation

#### HTTP Client Service (`services_app_ittools/http-client.ts`)
Standardized HTTP client with:
- Automatic endpoint selection
- Retry logic with exponential backoff
- Namespace header injection
- Timeout handling
- Type-safe responses

```typescript
import { httpClient } from '@/apps/app_ittools/services_app_ittools/http-client';

// Simple GET request
const response = await httpClient.get('/api/ittools/v1/tools');

// POST with body
const result = await httpClient.post('/api/ittools/v1/crypto/hash', {
  text: 'hello',
  algorithm: 'sha256'
});
```

#### ITTools API Service (`services_app_ittools/ittools-api.ts`)
High-level API with typed methods:

```typescript
import { itToolsApi } from '@/apps/app_ittools/services_app_ittools/ittools-api';

// Typed methods for all tools
const hash = await itToolsApi.hashText('hello', 'sha256');
const uuid = await itToolsApi.generateUuid(5);
const base64 = await itToolsApi.base64Encode('text');
```

---

### 2. State Management (Pinia Store)

Centralized state with `useItToolsStore`:

```typescript
import { useItToolsStore } from '@/apps/app_ittools/stores_app_ittools/ittools-store';

const store = useItToolsStore();

// State
store.allTools       // All available tools
store.activeTool     // Currently active tool
store.favorites      // Favorite tool IDs
store.history        // Execution history

// Actions
store.setActiveTool(toolId);
store.toggleFavorite(toolId);
store.addToHistory(toolId, input, output);
store.filterTools();
```

---

### 3. Internationalization (i18n)

Full i18n support with structured translations:

```typescript
// Translation structure
{
  "app": {
    "name": "IT Tools",
    "tagline": "Handy online tools for developers"
  },
  "nav": { ... },
  "common": { ... },
  "categories": { ... },
  "crypto": { ... },
  "converter": { ... },
  ...
}
```

Supported languages:
- ✅ English (en)
- ✅ Chinese (zh)
- 🔄 Japanese (ja)
- 🔄 Persian (fa)
- 🔄 Spanish, French, German, Russian, etc. (16 languages total)

---

### 4. Tool Registry System

All tools are registered in `constants_app_ittools/complete-tools.ts`:

```typescript
export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params: Record<string, ToolParam>;
  keywords: string[];
  tags?: string[];
  examples?: { input: any; output: any }[];
}
```

---

### 5. UI Configuration

Centralized UI constants in `constants_app_ittools/ui-config.ts`:

- **Main Tabs**: IT Tools, Browser Automation, Windows Operations, Nginx Management
- **Category Menus**: Organized in 2 rows (Laravel-style)
- **Icons & Colors**: Per-category visual identity
- **Status Indicators**: Connection status, log levels
- **Action Configs**: Browser automation, Windows ops, Nginx management

---

## 🔧 Development Guidelines

### 1. Adding a New Tool

**Step 1:** Define tool in `constants_app_ittools/complete-tools.ts`
```typescript
{
  id: 'my_tool',
  name: 'My Tool',
  description: 'Does something useful',
  category: 'crypto',
  icon: 'key',
  endpoint: ITTOOLS_API_ROUTES.CRYPTO.MY_TOOL,
  method: 'POST',
  params: {
    input: {
      type: 'string',
      required: true,
      placeholder: 'Enter input'
    }
  },
  keywords: ['my', 'tool', 'keywords']
}
```

**Step 2:** Add API route to `config_app_ittools/api-routes.ts`
```typescript
export const ITTOOLS_API_ROUTES = {
  CRYPTO: {
    // ... existing routes
    MY_TOOL: '/api/ittools/v1/crypto/my-tool',
  }
}
```

**Step 3:** Add API method to `services_app_ittools/ittools-api.ts`
```typescript
async myTool(input: string): Promise<ApiResponse<{ result: string }>> {
  return httpClient.post(ITTOOLS_API_ROUTES.CRYPTO.MY_TOOL, { input });
}
```

**Step 4:** Create tool component (optional)
```vue
<!-- components_app_ittools/tools/crypto/MyTool.vue -->
<template>
  <div class="my-tool">
    <!-- Tool UI -->
  </div>
</template>
```

**Step 5:** Add i18n translations
```json
// i18n_app_ittools/locales/en.json
{
  "crypto": {
    "my_tool": "My Tool",
    "my_tool_desc": "Does something useful"
  }
}
```

---

### 2. Best Practices

#### ✅ DO:
- Use centralized API routes from `api-routes.ts`
- Use `httpClient` or `itToolsApi` for all API calls
- Store state in Pinia store
- Use i18n for all user-facing text
- Add types for all API responses
- Follow naming conventions: `snake_case` for tool IDs, `camelCase` for code

#### ❌ DON'T:
- Hardcode API endpoints in components
- Use direct `fetch()` calls (use `httpClient` instead)
- Inline styles (use CSS classes from `styles_app_ittools/`)
- Skip i18n for new text
- Create global state outside Pinia
- Mix namespace-specific code with common code

---

### 3. API Client Usage Patterns

**Pattern 1: Using httpClient directly**
```typescript
import { httpClient } from '@/apps/app_ittools/services_app_ittools/http-client';
import { ITTOOLS_API_ROUTES } from '@/apps/app_ittools/config_app_ittools/api-routes';

const response = await httpClient.post(ITTOOLS_API_ROUTES.CRYPTO.HASH, {
  text: 'hello',
  algorithm: 'sha256'
});
```

**Pattern 2: Using itToolsApi (recommended)**
```typescript
import { itToolsApi } from '@/apps/app_ittools/services_app_ittools/ittools-api';

const response = await itToolsApi.hashText('hello', 'sha256');
```

**Pattern 3: Using composable in components**
```vue
<script setup>
import { useApiClient } from '@/apps/app_ittools/composables_app_ittools/useApiClient';

const { itToolsApi, connectionState } = useApiClient();

const hash = await itToolsApi.hashText('hello', 'sha256');
</script>
```

---

## 📦 Dependencies

### Core
- **Nuxt 3**: Framework
- **Vue 3**: UI library
- **Pinia**: State management
- **TypeScript**: Type safety

### Utilities
- **@nuxt/i18n**: Internationalization
- **FontAwesome**: Icons
- **LocalStorage API**: Persistence

---

## 🎯 Architecture Principles

1. **Separation of Concerns**
   - Services handle API communication
   - Stores manage state
   - Components handle UI
   - Config files contain constants

2. **Single Source of Truth**
   - API routes: `api-routes.ts`
   - Tools registry: `complete-tools.ts`
   - UI config: `ui-config.ts`
   - Translations: `i18n_app_ittools/locales/`

3. **Type Safety**
   - All API responses typed
   - Tool definitions typed
   - Store state typed
   - Config constants typed

4. **Reusability**
   - Common HTTP client (`common/utils/http-client.ts`)
   - Shared components (`common/components/`)
   - Shared utilities (`common/utils/`)
   - App-specific extensions (`apps/app_ittools/`)

5. **Maintainability**
   - Clear directory structure
   - Consistent naming conventions
   - Centralized configuration
   - Comprehensive documentation

---

## 🔍 File Organization

### Configuration Files
- `config_app_ittools/api-routes.ts` - API endpoint definitions (NEW)
- `config_app_ittools/api-config.ts` - Legacy API config
- `config_app_ittools/index.ts` - Main app config
- `config_app_ittools/tool-params.ts` - Tool parameter schemas

### Service Layer
- `services_app_ittools/http-client.ts` - HTTP client (NEW)
- `services_app_ittools/ittools-api.ts` - ITTools API service
- `services_app_ittools/api-client.ts` - WebSocket client
- `services_app_ittools/logger.ts` - Application logger

### Data Layer
- `constants_app_ittools/complete-tools.ts` - Tool registry
- `constants_app_ittools/ui-config.ts` - UI constants
- `stores_app_ittools/ittools-store.ts` - Pinia store

### Presentation Layer
- `components_app_ittools/ittools_index/ItToolsApp.vue` - Main app
- `components_app_ittools/ittools_index_components/` - Sub-components
- `components_app_ittools/tools/` - Tool-specific components

---

## 📚 Additional Resources

- **Nuxt Multi-App Architecture**: See `development-guides/NUXT_MULTI_APP_ARCHITECTURE.md`
- **Refactoring Guide**: See `development-guides/REFACTORING_DETAILED_GUIDE.md`
- **Common Utilities**: See `poly_apps/nuxt_main/common/`
- **Global i18n**: See `poly_apps/nuxt_main/i18n/locales/`

---

## 🎨 Styling

The app uses a holographic glassmorphism theme:
- **Primary Color**: #6366f1 (Indigo)
- **Glass Effect**: Backdrop blur + transparency
- **Animations**: Smooth transitions
- **Responsive**: Mobile-first design

Styles are located in:
- `styles_app_ittools/holographic.css` - Main theme
- Component-scoped styles in `.vue` files

---

## 🚦 Status

- ✅ Architecture: Complete
- ✅ API Layer: Complete
- ✅ State Management: Complete
- ✅ i18n (en, zh): Complete
- 🔄 i18n (other languages): In Progress
- ✅ UI Configuration: Complete
- 🔄 Tool Components: In Progress (88+ tools)
- 🔄 Browser Automation: In Progress
- 🔄 Windows Operations: In Progress
- 🔄 Nginx Management: In Progress

---

**Last Updated:** 2025-12-03
**Maintainer:** Core Development Team
