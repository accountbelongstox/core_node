# React Native Multi-App Architecture

## Overview

This architecture enables multiple React Native applications to coexist in a single codebase while sharing common code, utilities, themes, and components. Each application maintains its own isolated logic, pages, and navigation while leveraging shared infrastructure.

## Core Principles

1. **Automatic Discovery**: Applications are automatically discovered by scanning `src/apps/` directory
2. **Namespace Isolation**: Each app uses prefixed directories (`{appname}_pages`, `{appname}_components`, etc.)
3. **Code Sharing**: Common code is centralized in `src/common/` for all apps to use
4. **Dynamic Entry**: Applications are loaded dynamically based on environment variables
5. **Resource Separation**: Platform-specific resources are managed per-app

---

## Directory Structure

```
poly_apps/react_native/
│
├─ src/
│  ├─ common/                      # Shared code across all applications
│  │  ├─ components/              # Shared UI components
│  │  ├─ utils/                   # Shared utility functions
│  │  ├─ services/                # Shared API services
│  │  ├─ hooks/                   # Shared React hooks
│  │  ├─ store/                   # Shared state management
│  │  ├─ types/                   # Shared TypeScript types
│  │  ├─ constants/               # Shared constants
│  │  └─ styles/                  # Shared theme foundations
│  │
│  └─ apps/                        # Application-specific code
│     │
│     ├─ demo/                     # Demo Application
│     │  ├─ demo_pages/           # Demo-specific pages
│     │  ├─ demo_components/      # Demo-specific components
│     │  ├─ demo_navigation/      # Demo-specific navigation
│     │  ├─ demo_theme/           # Demo-specific theme
│     │  ├─ demo_store/           # Demo-specific state
│     │  ├─ demo_services/        # Demo-specific API services
│     │  ├─ demo_hooks/           # Demo-specific hooks
│     │  ├─ demo_types/           # Demo-specific types
│     │  ├─ demo_config.ts        # Demo app configuration
│     │  └─ App.tsx               # Demo app entry point
│     │
│     └─ example/                  # Example Application
│        ├─ example_pages/        # Example-specific pages
│        ├─ example_components/   # Example-specific components
│        ├─ example_navigation/   # Example-specific navigation
│        ├─ example_theme/        # Example-specific theme
│        ├─ example_store/        # Example-specific state
│        ├─ example_services/     # Example-specific API services
│        ├─ example_hooks/        # Example-specific hooks
│        ├─ example_types/        # Example-specific types
│        ├─ example_config.ts     # Example app configuration
│        └─ App.tsx               # Example app entry point
│
├─ assets/                         # Static assets
│  └─ apps/
│     ├─ app_demo/                # Demo app assets
│     │  ├─ android/              # Android-specific resources
│     │  └─ ios/                  # iOS-specific resources
│     └─ app_example/             # Example app assets
│        ├─ android/
│        └─ ios/
│
├─ scripts/                        # Build and development scripts
│  └─ build_scripts/
│     └─ react_native_scripts/
│        ├─ AppScanner.ps1        # Auto-discovers apps from src/apps/
│        ├─ InteractiveMenu.ps1   # Interactive app selector
│        └─ ResourceManager.ps1   # Platform resource management
│
├─ index.js                        # Dynamic entry point
├─ App.tsx                         # Dynamically loaded app
└─ tsconfig.json                   # TypeScript configuration
```

---

## Application Discovery

### Automatic Scanning

Applications are **automatically discovered** by scanning the `src/apps/` directory. No configuration files needed!

**Discovery Logic:**
1. Script scans `src/apps/` for subdirectories
2. Each subdirectory is treated as an application namespace
3. App configuration is read from `{appname}_config.ts` in each app directory
4. Apps are displayed in the interactive menu for selection

### App Configuration File

Each app must have a `{appname}_config.ts` file:

**Location**: `src/apps/{appname}/{appname}_config.ts`

**Example**: `src/apps/demo/demo_config.ts`

```typescript
export default {
  namespace: 'demo',
  displayName: 'Demo App',
  bundleId: 'com.demo.app',
  version: '1.0.0',
  platforms: ['android', 'ios'],
  defaultTheme: 'dark',
  features: {
    authentication: true,
    pushNotifications: true,
    analytics: true
  },
  apiBaseUrl: 'https://api.demo.com'
};
```

---

## Namespace Convention

### Why Namespace Prefixes?

Each application uses **prefixed directory names** to:
- **Prevent Conflicts**: Avoid name collisions between apps
- **Clear Ownership**: Instantly identify which app owns the code
- **Easy Search**: Search for `demo_` to find all Demo app code
- **Enforce Isolation**: Discourage cross-app dependencies

### Naming Pattern

All app-specific directories use the pattern: `{appname}_{type}`

**Examples:**
- `demo_pages/` - Demo application pages
- `demo_components/` - Demo application components
- `example_services/` - Example application API services
- `example_theme/` - Example application theme configuration

### Standard Directory Types

Each application should maintain these namespaced directories:

| Directory Pattern | Purpose | Example Files |
|------------------|---------|---------------|
| `{app}_pages/` | Application screens/pages | `Dashboard.tsx`, `Login.tsx` |
| `{app}_components/` | App-specific UI components | `Header.tsx`, `Footer.tsx` |
| `{app}_navigation/` | Navigation configuration | `MainNavigator.tsx`, `routes.ts` |
| `{app}_theme/` | App-specific theme/styles | `colors.ts`, `typography.ts` |
| `{app}_store/` | App-specific state management | `userSlice.ts`, `store.ts` |
| `{app}_services/` | App-specific API services | `authService.ts`, `api.ts` |
| `{app}_hooks/` | App-specific React hooks | `useAuth.ts`, `useData.ts` |
| `{app}_types/` | App-specific TypeScript types | `models.ts`, `interfaces.ts` |

---

## Import Conventions

### TypeScript Path Aliases

**Configure in `tsconfig.json`:**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/common/*": ["src/common/*"],
      "@/apps/*": ["src/apps/*"]
    }
  }
}
```

### Import Examples

#### 1. Importing Common/Shared Code

```typescript
// Shared components
import { Button } from '@/common/components/Button';
import { Card } from '@/common/components/Card';

// Shared utilities
import { formatDate, formatCurrency } from '@/common/utils/format';
import { logger } from '@/common/utils/logger';

// Shared services
import { apiClient } from '@/common/services/api';
import { storageService } from '@/common/services/storage';

// Shared hooks
import { useAuth } from '@/common/hooks/useAuth';
import { useTheme } from '@/common/hooks/useTheme';

// Shared types
import { User, ApiResponse } from '@/common/types';

// Shared constants
import { API_BASE_URL, APP_VERSION } from '@/common/constants';
```

#### 2. Importing App-Specific Code (Demo)

```typescript
// Demo pages
import { Dashboard } from '@/apps/demo/demo_pages/Dashboard';
import { ProductList } from '@/apps/demo/demo_pages/ProductList';

// Demo components
import { DemoHeader } from '@/apps/demo/demo_components/Header';
import { DemoButton } from '@/apps/demo/demo_components/Button';

// Demo navigation
import { DemoNavigator } from '@/apps/demo/demo_navigation/MainNavigator';

// Demo theme
import { demoTheme } from '@/apps/demo/demo_theme';

// Demo services
import { demoApiService } from '@/apps/demo/demo_services/api';

// Demo hooks
import { useDemoData } from '@/apps/demo/demo_hooks/useDemoData';

// Demo types
import { DemoProduct } from '@/apps/demo/demo_types';
```

#### 3. Importing App-Specific Code (Example)

```typescript
// Example pages
import { Home } from '@/apps/example/example_pages/Home';
import { Profile } from '@/apps/example/example_pages/Profile';

// Example components
import { ExampleHeader } from '@/apps/example/example_components/Header';
import { ExampleCard } from '@/apps/example/example_components/Card';

// Example navigation
import { ExampleNavigator } from '@/apps/example/example_navigation/RootNavigator';

// Example theme
import { exampleTheme } from '@/apps/example/example_theme';

// Example services
import { exampleApiService } from '@/apps/example/example_services/api';

// Example hooks
import { useExampleAuth } from '@/apps/example/example_hooks/useAuth';

// Example types
import { ExampleUser } from '@/apps/example/example_types';
```

---

## Dynamic Entry Point

### index.js - Application Loader

The root `index.js` dynamically loads the correct application based on environment variables:

```javascript
import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';

// Get app namespace from environment variable
const APP_NAMESPACE = process.env.APP_ENTRY || 'demo';

// Dynamically import the correct app entry point
let App;
try {
  App = require(`./src/apps/${APP_NAMESPACE}/App`).default;
} catch (error) {
  console.error(`Failed to load app: ${APP_NAMESPACE}`, error);
  // Fallback to demo app
  App = require('./src/apps/demo/App').default;
}

AppRegistry.registerComponent(appName, () => App);
```

### Environment Variables

The build scripts automatically set `APP_ENTRY` based on user selection:

```bash
# Demo app
APP_ENTRY=demo

# Example app
APP_ENTRY=example
```

---

## Application Entry Point

### App.tsx Structure

Each application has its own `App.tsx` entry point.

**Location**: `src/apps/{appname}/App.tsx`

**Example**: `src/apps/demo/App.tsx`

```typescript
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Common/shared code
import { StoreProvider } from '@/common/store';

// Demo app-specific code (namespaced)
import { DemoNavigator } from '@/apps/demo/demo_navigation/MainNavigator';
import { DemoStoreProvider } from '@/apps/demo/demo_store';
import { demoTheme } from '@/apps/demo/demo_theme';

const DemoApp: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <DemoStoreProvider theme={demoTheme}>
            <StatusBar barStyle="light-content" />
            <DemoNavigator />
          </DemoStoreProvider>
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default DemoApp;
```

---

## Adding a New Application

### Step 1: Create App Directory

Create a new directory under `src/apps/`:

```bash
mkdir src/apps/myapp
```

### Step 2: Create Namespaced Subdirectories

Create all standard namespaced directories:

```bash
mkdir src/apps/myapp/myapp_pages
mkdir src/apps/myapp/myapp_components
mkdir src/apps/myapp/myapp_navigation
mkdir src/apps/myapp/myapp_theme
mkdir src/apps/myapp/myapp_store
mkdir src/apps/myapp/myapp_services
mkdir src/apps/myapp/myapp_hooks
mkdir src/apps/myapp/myapp_types
```

### Step 3: Create Configuration File

**File**: `src/apps/myapp/myapp_config.ts`

```typescript
export default {
  namespace: 'myapp',
  displayName: 'My Application',
  bundleId: 'com.myapp.app',
  version: '1.0.0',
  platforms: ['android', 'ios'],
  defaultTheme: 'light',
  features: {
    authentication: true,
    pushNotifications: false,
    analytics: true
  },
  apiBaseUrl: 'https://api.myapp.com'
};
```

### Step 4: Create App Entry Point

**File**: `src/apps/myapp/App.tsx`

```typescript
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StoreProvider } from '@/common/store';
import { MyAppNavigator } from '@/apps/myapp/myapp_navigation/MainNavigator';
import { MyAppStoreProvider } from '@/apps/myapp/myapp_store';
import { myAppTheme } from '@/apps/myapp/myapp_theme';

const MyApp: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <MyAppStoreProvider theme={myAppTheme}>
            <MyAppNavigator />
          </MyAppStoreProvider>
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default MyApp;
```

### Step 5: Create Platform Resources (Optional)

```bash
mkdir assets/apps/app_myapp
mkdir assets/apps/app_myapp/android
mkdir assets/apps/app_myapp/ios
```

### Step 6: Run the Launcher

The app will be **automatically discovered**! Just run:

```bash
.\scripts\start.ps1
```

Your new app will appear in the interactive menu!

---

## Build & Development Scripts

### Interactive Launcher

Run the multi-app launcher:

```powershell
.\scripts\start.ps1
```

**Features:**
- Auto-discovers all apps in `src/apps/`
- Interactive menu with arrow key navigation
- Toggle mode: Debug / Build / Test
- Toggle platform: Android / iOS
- Persistent preferences per app

### AppScanner Logic

**File**: `scripts/build_scripts/react_native_scripts/AppScanner.ps1`

**Discovery Process:**
1. Scan `src/apps/` for subdirectories
2. Check for `{appname}_config.ts` in each directory
3. Parse config file for display name and metadata
4. Build app registry for launcher menu

### Resource Management

**File**: `scripts/build_scripts/react_native_scripts/ResourceManager.ps1`

**Functions:**
- Backup platform resources before build
- Copy app-specific resources to platform directories
- Restore original resources after build
- Update `app.json` with app-specific configuration

---

## Best Practices

### 1. Code Sharing

✅ **DO:**
- Put reusable components in `src/common/components/`
- Share API utilities in `src/common/services/`
- Use common types in `src/common/types/`

❌ **DON'T:**
- Import from another app (e.g., don't import `demo_components` in `example`)
- Duplicate common code across apps

### 2. Namespace Discipline

✅ **DO:**
- Always use `{appname}_` prefix for app-specific directories
- Keep app-specific code isolated in `src/apps/{appname}/`
- Use clear, descriptive names

❌ **DON'T:**
- Create non-prefixed directories in app folders
- Mix app-specific code with common code

### 3. Configuration

✅ **DO:**
- Put app-specific config in `{appname}_config.ts`
- Use environment-specific values (dev, staging, prod)
- Document all config options

❌ **DON'T:**
- Hardcode API URLs or secrets
- Use shared config for app-specific values

### 4. Dependency Management

✅ **DO:**
- Keep shared dependencies in root `package.json`
- Document app-specific dependencies in app README
- Use common versions across apps

❌ **DON'T:**
- Install duplicate packages
- Use conflicting dependency versions

---

## Benefits of This Architecture

### 1. Code Reusability
- Single implementation of common components, utilities, and services
- Reduced duplication and maintenance burden
- Consistent UX across applications

### 2. Isolation & Safety
- App-specific code is clearly separated
- Namespace prefixes prevent accidental coupling
- Easy to identify impact of changes

### 3. Scalability
- Add new apps without modifying existing ones
- Share infrastructure improvements across all apps
- Independent versioning and deployment

### 4. Developer Experience
- Clear code organization
- Type-safe imports with path aliases
- Interactive development tools
- Fast app switching

### 5. Maintainability
- Single codebase to manage
- Consistent build and test processes
- Shared CI/CD pipeline
- Easy code review and collaboration

---

## Troubleshooting

### App Not Appearing in Menu

**Check:**
1. Directory exists under `src/apps/{appname}`
2. Config file exists: `src/apps/{appname}/{appname}_config.ts`
3. Config exports valid object with `namespace` and `displayName`

### Import Errors

**Check:**
1. `tsconfig.json` has correct path aliases
2. Using `@/common/*` or `@/apps/*` prefixes
3. File extensions are correct (.ts, .tsx, .js, .jsx)

### Build Failures

**Check:**
1. App has `App.tsx` entry point
2. All imports are valid
3. Platform resources exist in `assets/apps/app_{appname}/`

---

## Summary

This multi-app architecture provides:
- ✅ **Automatic app discovery** from `src/apps/` directory
- ✅ **Namespace isolation** with `{appname}_` prefixes
- ✅ **Code sharing** through `src/common/` directory
- ✅ **Dynamic loading** via environment variables
- ✅ **Interactive tools** for development
- ✅ **Clear conventions** for maintainability

Add new apps by simply creating a directory structure - the system handles the rest!
