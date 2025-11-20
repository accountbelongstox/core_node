# Architecture Refactoring Proposal - Layered Composition Fix

**Proposal Date:** 2025-10-31
**Related Analysis:** `ARCHITECTURE_ANALYSIS_MULTI_LAYER_ISSUES.md`
**Target:** `D:\programing\core_node\poly_apps\nuxt_main`

---

## Objective

Refactor the layout system to implement proper **layered composition**, where:
- **Top layer** provides shared services (theme, storage, network, logging) WITHOUT forcing UI structure
- **Sub-app layer** has full autonomy to compose its own UI from shared components OR implement custom components

---

## Design Principles

### 1. Inversion of Control
- Top layer provides **capabilities**, not **structure**
- Sub-apps **pull** what they need, not **pushed** what top layer decides

### 2. Composition over Inheritance
- Sub-apps **compose** UI from library of shared components
- Sub-apps can **extend** or **replace** any component

### 3. Namespace Isolation (Complete)
- API layer isolation: ✅ (via headers)
- Route layer isolation: ✅ (via prefixes)
- **UI layer isolation: 🔴 MISSING - this proposal fixes it**

---

## Proposed Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 0: Base Services (layouts/base.vue)                  │
│  Provides: Theme, Store, I18n, Router, Error Handling       │
│  UI: None (just <NuxtPage /> slot)                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Common Component Library (common/components/)     │
│  Provides: Header, Sidebar, Footer, DataTable, etc.         │
│  Usage: Optional - apps can use, extend, or ignore          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: App-Specific Resources (apps/app_xxx/)            │
│  Contains: App's own layouts, components, stores, etc.      │
│  Decides: Entire UI structure and composition               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Create Base Layout System

#### Step 1.1: Create Minimal Base Layout

**File:** `layouts/base.vue` (NEW)

```vue
<template>
  <div
    class="app-root font-nunito text-sm font-normal antialiased"
    :class="[store.menu, store.rtlClass]"
  >
    <!-- Screen Loader -->
    <div
      v-show="store.isShowMainLoader"
      class="screen_loader animate__animated fixed inset-0 z-[60] grid place-content-center bg-[#fafafa] dark:bg-[#060818]"
    >
      <svg width="64" height="64" viewBox="0 0 135 135" xmlns="http://www.w3.org/2000/svg" fill="#4361ee">
        <!-- SVG content from current default.vue -->
      </svg>
    </div>

    <!-- Scroll to Top Button -->
    <div class="fixed bottom-6 z-50 ltr:right-6 rtl:left-6">
      <button
        v-if="showTopButton"
        type="button"
        class="btn btn-outline-primary animate-pulse rounded-full bg-[#fafafa] p-2 dark:bg-[#060818]"
        @click="goToTop"
      >
        <!-- Button SVG -->
      </button>
    </div>

    <!-- Theme Customizer (Optional - can be disabled via prop) -->
    <theme-customizer v-if="showThemeCustomizer" />

    <!-- Main Content Slot - NO FORCED STRUCTURE -->
    <div class="app-container min-h-screen text-black dark:text-white-dark">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import appSetting from '@/app-setting';
import { useAppStore } from '@/stores/index';

interface Props {
  showThemeCustomizer?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showThemeCustomizer: true
});

const store = useAppStore();
const showTopButton = ref(false);
const { setLocale } = useI18n();

onMounted(() => {
  appSetting.init(setLocale);

  window.onscroll = () => {
    showTopButton.value = document.body.scrollTop > 50 || document.documentElement.scrollTop > 50;
  };

  store.toggleMainLoader();
});

const goToTop = () => {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
};
</script>
```

**Key Changes:**
- ❌ Removed: `<layout-sidebar />`
- ❌ Removed: `<layout-header />`
- ❌ Removed: `<layout-footer />`
- ✅ Kept: Theme initialization, store, i18n
- ✅ Kept: Utility features (scroll to top, loader)
- ✅ Added: `showThemeCustomizer` prop for apps that don't want it

#### Step 1.2: Create Default UI Layout

**File:** `layouts/default-with-nav.vue` (NEW - renamed from current default.vue)

```vue
<template>
  <div
    class="main-section relative font-nunito text-sm font-normal antialiased"
    :class="[store.sidebar ? 'toggle-sidebar' : '', store.menu, store.layout, store.rtlClass]"
  >
    <div class="relative">
      <!-- Sidebar Overlay -->
      <div
        class="fixed inset-0 z-50 bg-[black]/60 lg:hidden"
        :class="{ hidden: !store.sidebar }"
        @click="store.toggleSidebar()"
      ></div>

      <!-- Screen Loader -->
      <div
        v-show="store.isShowMainLoader"
        class="screen_loader animate__animated fixed inset-0 z-[60] grid place-content-center bg-[#fafafa] dark:bg-[#060818]"
      >
        <!-- Loader SVG -->
      </div>

      <!-- Scroll to Top -->
      <div class="fixed bottom-6 z-50 ltr:right-6 rtl:left-6">
        <button v-if="showTopButton" type="button" class="btn btn-outline-primary animate-pulse rounded-full bg-[#fafafa] p-2 dark:bg-[#060818]" @click="goToTop">
          <!-- Button SVG -->
        </button>
      </div>

      <!-- Theme Customizer -->
      <theme-customizer />

      <div class="main-container min-h-screen text-black dark:text-white-dark" :class="[store.navbar]">
        <!-- BEGIN SIDEBAR -->
        <layout-sidebar />
        <!-- END SIDEBAR -->

        <!-- BEGIN CONTENT AREA -->
        <div class="main-content">
          <!-- BEGIN TOP NAVBAR -->
          <layout-header />
          <!-- END TOP NAVBAR -->

          <div class="animation p-6">
            <NuxtPage />
            <!-- BEGIN FOOTER -->
            <layout-footer />
            <!-- END FOOTER -->
          </div>
        </div>
        <!-- END CONTENT AREA -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Same as current default.vue
</script>
```

**Purpose:**
- For apps that WANT the default Header/Sidebar/Footer
- Example app, admin app can use this
- Clear name indicates it includes navigation

#### Step 1.3: Rename Current default.vue

```bash
# Rename current default.vue to avoid breaking existing apps immediately
mv layouts/default.vue layouts/default-with-nav.vue.backup

# Create symbolic link for backward compatibility (temporary)
# Windows: mklink layouts\default.vue layouts\default-with-nav.vue
# Linux: ln -s default-with-nav.vue default.vue
```

**Deprecation Strategy:**
- Keep `default.vue` pointing to `default-with-nav.vue` for 1-2 releases
- Add deprecation warning in console
- Update all apps to use explicit layout names
- Remove `default.vue` symlink in final release

---

### Phase 2: Create PyMatrix Custom Layout

#### Step 2.1: Create PyMatrix Layout

**File:** `apps/app_pymatrix/layouts_app_pymatrix/default.vue` (NEW)

```vue
<template>
  <div class="pymatrix-layout">
    <!-- PyMatrix-specific structure -->
    <div class="pymatrix-app">
      <!-- Top Toolbar - PyMatrix's own navigation -->
      <PyMatrixTopBar
        :device-count="deviceStore.deviceCount"
        :group-enabled="groupStore.enabled"
        @connect-device="emits.connectDevice"
        @toggle-group="emits.toggleGroup"
        @open-settings="emits.openSettings"
      />

      <div class="pymatrix-main">
        <!-- Left Panel - PyMatrix's device list -->
        <PyMatrixLeftPanel
          :devices="deviceStore.deviceList"
          :selected-serial="deviceStore.selectedSerial"
          :group-enabled="groupStore.enabled"
          :host-serial="groupStore.hostSerial"
          @select-device="emits.selectDevice"
          @set-host="emits.setHost"
          @remove-from-group="emits.removeFromGroup"
        />

        <!-- Main Content Area -->
        <div class="pymatrix-screen-area">
          <NuxtPage />
        </div>

        <!-- Right Panel - PyMatrix's control panel -->
        <PyMatrixRightPanel
          :selected-device="deviceStore.selectedDevice || deviceStore.deviceList[0]"
          :group-enabled="groupStore.enabled"
          :host-device="hostDevice"
          :device-count="groupStore.deviceCount"
          @system-key="emits.systemKey"
          @send-text="emits.sendText"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDeviceStore } from '~/apps/app_pymatrix/stores_app_pymatrix/deviceStore';
import { useGroupStore } from '~/apps/app_pymatrix/stores_app_pymatrix/groupStore';

import PyMatrixTopBar from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixTopBar.vue';
import PyMatrixLeftPanel from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixLeftPanel.vue';
import PyMatrixRightPanel from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixRightPanel.vue';

// Define emits for layout to expose to pages
const emits = defineEmits([
  'connectDevice',
  'toggleGroup',
  'openSettings',
  'selectDevice',
  'setHost',
  'removeFromGroup',
  'systemKey',
  'sendText'
]);

const deviceStore = useDeviceStore();
const groupStore = useGroupStore();

const hostDevice = computed(() => {
  if (!groupStore.hostSerial) return null;
  return deviceStore.getDevice(groupStore.hostSerial);
});
</script>

<style scoped>
.pymatrix-layout {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0a0a0a;
}

.pymatrix-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: white;
}

.pymatrix-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.pymatrix-screen-area {
  flex: 1;
  overflow: auto;
  background: #0a0a0a;
}
</style>
```

#### Step 2.2: Update PyMatrix Page

**File:** `pages/index.vue` (MODIFY)

```vue
<template>
  <div class="pymatrix-content">
    <!-- Device Grid or Empty State -->
    <PyMatrixDeviceGrid
      v-if="deviceStore.deviceCount > 0"
      :devices="deviceStore.deviceList"
      :base-url="baseUrl"
      :group-enabled="groupStore.enabled"
      @disconnect="handleDisconnect"
    />

    <PyMatrixEmptyState
      v-else
      @connect-device="showConnectDialog = true"
    />

    <!-- Connect Device Dialog -->
    <PyMatrixConnectDialog
      v-if="showConnectDialog"
      @close="showConnectDialog = false"
      @connect="handleConnect"
    />

    <!-- Settings Dialog -->
    <PyMatrixSettingsDialog
      v-if="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDeviceStore } from '~/apps/app_pymatrix/stores_app_pymatrix/deviceStore';
import { useGroupStore } from '~/apps/app_pymatrix/stores_app_pymatrix/groupStore';
import { useDeviceControl } from '~/apps/app_pymatrix/composables_app_pymatrix/useDeviceControl';
import type { Device } from '~/types/pymatrix';

// Import only dialog components (panels are in layout now)
import PyMatrixDeviceGrid from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixDeviceGrid.vue';
import PyMatrixEmptyState from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixEmptyState.vue';
import PyMatrixConnectDialog from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixConnectDialog.vue';
import PyMatrixSettingsDialog from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixSettingsDialog.vue';

// ✅ KEY CHANGE: Specify custom layout
definePageMeta({
  layout: 'apps/app_pymatrix/layouts_app_pymatrix/default'
  // Alternative if Nuxt doesn't support paths:
  // layout: 'pymatrix-default'
});

useHead({
  title: 'pyMatrix - Device Control',
  meta: [
    { name: 'description', content: 'Android device mirroring and group control system' }
  ]
});

const deviceStore = useDeviceStore();
const groupStore = useGroupStore();

// ... rest of logic (keep as-is)
</script>

<style scoped>
.pymatrix-content {
  width: 100%;
  height: 100%;
}
</style>
```

**Key Changes:**
- ✅ Removed: TopBar, LeftPanel, RightPanel (now in layout)
- ✅ Added: `definePageMeta({ layout: ... })` to specify custom layout
- ✅ Kept: Core business logic
- ✅ Simplified: Page only handles content area

---

### Phase 3: Update Other Apps

#### Step 3.1: Example App (Keep Current Behavior)

**File:** `pages/index.example.vue` (MODIFY)

```vue
<script setup>
definePageMeta({
  layout: 'default-with-nav' // Explicitly use nav layout
});
</script>
```

#### Step 3.2: CodeMart App (Already Has Custom Layout)

**File:** `pages/index.codemart.vue` (MODIFY - if needed)

```vue
<script setup>
definePageMeta({
  layout: 'codemart-layout' // Keep existing custom layout
});
</script>
```

**Note:** CodeMart already has `layouts/codemart-layout.vue`, so minimal changes needed.

#### Step 3.3: Admin App

**File:** `pages/admin/datasources.vue` (MODIFY)

```vue
<script setup>
definePageMeta({
  layout: 'default-with-nav' // Use nav layout (has admin sidebar)
});
</script>
```

---

### Phase 4: Create Layout Registration System

#### Step 4.1: Update app-entry.ts

**File:** `app-entry.ts` (MODIFY)

```typescript
export interface AppEntryConfig {
  // ... existing fields
  theme: {
    primary: string;
    secondary: string;
    layout: string; // ✅ Keep but make it layout NAME, not path
  };
  // ✅ NEW: Layout configuration
  layouts: {
    default: string;        // Default layout for this app
    alternatives?: string[]; // Optional alternative layouts
    hasNavigation: boolean;  // Whether default layout includes nav
  };
}

const appEntryRegistry: Record<AppEntryType, AppEntryConfig> = {
  pymatrix: {
    // ... existing config
    theme: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      layout: 'pymatrix-default' // ✅ Changed: layout name
    },
    layouts: {
      default: 'apps/app_pymatrix/layouts_app_pymatrix/default',
      hasNavigation: true // Has TopBar + LeftPanel + RightPanel
    }
  },
  example: {
    // ... existing config
    theme: {
      layout: 'default-with-nav' // ✅ Changed
    },
    layouts: {
      default: 'default-with-nav',
      alternatives: ['base'],
      hasNavigation: true // Uses shared Header + Sidebar
    }
  },
  ittools: {
    // ... existing config
    layouts: {
      default: 'base', // ✅ IT Tools might want clean layout
      hasNavigation: false
    }
  }
  // ... other apps
};
```

#### Step 4.2: Create Layout Helper Composable

**File:** `composables/useAppLayout.ts` (NEW)

```typescript
import { getAppEntryConfig, getCurrentAppEntry } from '@/app-entry';

export const useAppLayout = () => {
  const getCurrentLayout = () => {
    const entry = getCurrentAppEntry();
    const config = getAppEntryConfig(entry);
    return config.layouts.default;
  };

  const hasNavigation = () => {
    const entry = getCurrentAppEntry();
    const config = getAppEntryConfig(entry);
    return config.layouts.hasNavigation;
  };

  const getLayoutPath = (layoutName: string) => {
    // Resolve layout name to file path
    if (layoutName.startsWith('apps/')) {
      return layoutName; // Already a path
    }
    return `layouts/${layoutName}.vue`;
  };

  return {
    getCurrentLayout,
    hasNavigation,
    getLayoutPath
  };
};
```

---

### Phase 5: Update Documentation

#### Step 5.1: Update Architecture Guide

**File:** `development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md` (MODIFY)

Add new section after line 93:

```markdown
### 6. Layout System

**Location:** `layouts/` and `apps/app_*/layouts_app_*/`

Layout isolation via custom app layouts:

```typescript
// pages/index.vue
definePageMeta({
  layout: 'apps/app_pymatrix/layouts_app_pymatrix/default'
})
```

**Directory Structure:**
```
layouts/
├── base.vue                  # Minimal: services only, no UI
├── default-with-nav.vue      # Standard: Header + Sidebar + Footer
├── auth-layout.vue           # Auth pages
└── codemart-layout.vue       # CodeMart custom

apps/
└── app_pymatrix/
    └── layouts_app_pymatrix/
        └── default.vue       # PyMatrix custom: TopBar + Panels
```

**Layout Types:**

| Layout | Use Case | Navigation | Theme | Stores |
|--------|----------|------------|-------|--------|
| `base` | Minimal app, custom UI | None | ✅ | ✅ |
| `default-with-nav` | Standard admin app | Header + Sidebar | ✅ | ✅ |
| `app_*/layouts_app_*/default` | Custom app layout | App-defined | ✅ | ✅ |

**Creating Custom Layout:**

1. Create layout file in app directory:
```bash
mkdir -p apps/app_myapp/layouts_app_myapp
touch apps/app_myapp/layouts_app_myapp/default.vue
```

2. Implement layout structure:
```vue
<template>
  <div class="my-app-layout">
    <!-- Your custom structure -->
    <MyAppHeader />
    <NuxtPage />
    <MyAppFooter />
  </div>
</template>
```

3. Use in page:
```vue
<script setup>
definePageMeta({
  layout: 'apps/app_myapp/layouts_app_myapp/default'
})
</script>
```

**Best Practices:**
- ✅ Create custom layout if app needs unique navigation structure
- ✅ Use `base.vue` if app has minimal/embedded UI
- ✅ Use `default-with-nav.vue` if app fits standard admin pattern
- ❌ Don't modify shared layouts for app-specific needs
- ❌ Don't duplicate layout code - extend base layouts when possible
```

---

## Migration Guide

### For Existing Apps

#### PyMatrix (app_pymatrix)

**Current:**
```vue
<!-- pages/index.vue -->
<template>
  <div class="pymatrix-app">
    <PyMatrixTopBar />
    <!-- Conflicts with layout Header -->
    <PyMatrixLeftPanel />
    <!-- Conflicts with layout Sidebar -->
  </div>
</template>
```

**After Migration:**
```vue
<!-- apps/app_pymatrix/layouts_app_pymatrix/default.vue -->
<template>
  <div class="pymatrix-app">
    <PyMatrixTopBar />
    <PyMatrixLeftPanel />
    <NuxtPage /> <!-- Page content goes here -->
    <PyMatrixRightPanel />
  </div>
</template>

<!-- pages/index.vue -->
<script setup>
definePageMeta({ layout: 'apps/app_pymatrix/layouts_app_pymatrix/default' })
</script>
<template>
  <PyMatrixDeviceGrid />
  <!-- Just content, no panels -->
</template>
```

**Steps:**
1. Create `apps/app_pymatrix/layouts_app_pymatrix/` directory
2. Move TopBar/LeftPanel/RightPanel from page to layout
3. Add `definePageMeta` to page
4. Test navigation doesn't duplicate

#### IT Tools (app_ittools)

**If IT Tools needs clean layout (no default nav):**

```vue
<!-- pages/index.ittools.vue -->
<script setup>
definePageMeta({
  layout: 'base' // No navigation, just services
})
</script>
```

#### Example/Admin Apps

**Keep using default navigation:**

```vue
<script setup>
definePageMeta({
  layout: 'default-with-nav'
})
</script>
```

---

## Rollout Strategy

### Week 1: Foundation
- ✅ Create `layouts/base.vue`
- ✅ Rename `layouts/default.vue` → `layouts/default-with-nav.vue`
- ✅ Create deprecation warning
- ✅ Test example app still works

### Week 2: PyMatrix Migration
- ✅ Create `apps/app_pymatrix/layouts_app_pymatrix/default.vue`
- ✅ Refactor `pages/index.vue` to use custom layout
- ✅ Test no duplicate navigation
- ✅ Verify all PyMatrix features work

### Week 3: Other Apps
- ✅ Audit remaining apps (ittools, admin, dashboard, dev)
- ✅ Migrate each to appropriate layout
- ✅ Test each app individually

### Week 4: Documentation & Cleanup
- ✅ Update `NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md`
- ✅ Create migration guide for future apps
- ✅ Remove deprecated `default.vue` symlink
- ✅ Final testing across all apps

---

## Testing Checklist

### Per-App Tests

**PyMatrix:**
- [ ] Open `/pymatrix` - should see ONLY PyMatrix navigation
- [ ] No default Header visible
- [ ] No default Sidebar visible
- [ ] PyMatrix TopBar functions correctly
- [ ] PyMatrix LeftPanel shows devices
- [ ] PyMatrix RightPanel shows controls
- [ ] Can connect/disconnect devices
- [ ] Group control works

**Example:**
- [ ] Open `/` - should see default Header + Sidebar
- [ ] Navigation menu works
- [ ] Dashboard loads correctly
- [ ] All example features work

**CodeMart:**
- [ ] Open `/codemart` - should see CodeMart custom layout
- [ ] No duplicate navigation
- [ ] Custom sidebar present

**Admin:**
- [ ] Open `/admin/datasources` - should see admin layout
- [ ] Admin sidebar present
- [ ] Default header present

**IT Tools:**
- [ ] Open `/ittools` - should see minimal/clean layout
- [ ] No forced navigation if using `base` layout

### Cross-App Tests

- [ ] Switch between apps doesn't break layouts
- [ ] Theme persists correctly
- [ ] Store state isolated per app
- [ ] No console errors
- [ ] Performance acceptable (no layout re-renders)

---

## Risk Assessment

### Low Risk
- ✅ Creating new layouts (doesn't affect existing code)
- ✅ Creating composables (purely additive)

### Medium Risk
- ⚠️ Renaming `default.vue` - mitigated by symlink
- ⚠️ Modifying `app-entry.ts` - well-tested file, low coupling

### High Risk
- 🔴 Refactoring page structures - could break functionality
- 🔴 Moving components between page/layout - event handling changes

**Mitigation:**
- Implement behind feature flag
- Test each app individually before deployment
- Keep rollback plan ready
- Monitor error logs post-deployment

---

## Success Metrics

### Code Metrics
- [ ] Duplicate navigation components eliminated
- [ ] Token count reduced by ~64k for pymatrix
- [ ] Layout files organized by app namespace
- [ ] Zero instances of forced UI in base layouts

### User Experience Metrics
- [ ] PyMatrix users see only PyMatrix navigation
- [ ] No user confusion about which menu to use
- [ ] Faster initial render (fewer components)
- [ ] Consistent navigation per app

### Developer Experience Metrics
- [ ] New apps can create custom layouts in <1 hour
- [ ] Layout isolation documented
- [ ] Clear examples for each layout pattern
- [ ] Architecture guide updated

---

## Future Enhancements

### Phase 3 (Optional)
- Layout component library documentation
- Visual layout selector in dev tools
- Hot-reload for layout changes
- Layout preview in Storybook

### Phase 4 (Long-term)
- Dynamic layout loading based on user preferences
- Layout themes (dark/light variants)
- Responsive layout switching
- Layout performance monitoring

---

## Conclusion

This refactoring establishes clear boundaries between shared services and UI structure, giving each sub-app full control over its layout while maintaining code reusability through optional component libraries.

**Key Benefits:**
- ✅ Eliminates duplicate navigation in PyMatrix
- ✅ Enables future apps to easily create custom layouts
- ✅ Maintains backward compatibility during migration
- ✅ Improves code organization and maintainability
- ✅ Reduces coupling between top layer and sub-apps

**Estimated Effort:**
- Phase 1: 4 hours
- Phase 2: 6 hours
- Phase 3: 4 hours
- Phase 4: 2 hours
- **Total:** ~16 hours (2 days)

---

**Next Actions:**
1. Review and approve proposal
2. Create feature branch: `refactor/layout-isolation`
3. Implement Phase 1 (base layouts)
4. Deploy to dev environment for testing
5. Proceed with subsequent phases

---

*Prepared by Claude Code Architecture Team*
*Reference: ARCHITECTURE_ANALYSIS_MULTI_LAYER_ISSUES.md*
