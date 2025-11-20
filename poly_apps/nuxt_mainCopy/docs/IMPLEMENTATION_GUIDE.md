# Implementation Guide - Layout Isolation Fix

**Purpose:** Step-by-step guide to refactor layout system so sub-apps control their own UI
**Target:** Make `components/layout/Header.vue` and `components/layout/Sidebar.vue` **optional** for sub-apps

---

## Overview

### Current Problem

```
layouts/default.vue (FORCES on everyone)
    ├── <layout-header />     ❌ Forced
    ├── <layout-sidebar />    ❌ Forced
    └── <NuxtPage />
        └── app_pymatrix (also has)
            ├── <PyMatrixTopBar />    ⚠️ Duplicate!
            └── <PyMatrixLeftPanel /> ⚠️ Duplicate!
```

### Target Solution

```
layouts/base.vue (NO UI, just services)
    └── <NuxtPage />

apps/app_admin/layouts_app_admin/default.vue
    ├── <layout-header />     ✅ Admin CHOOSES to use
    ├── <layout-sidebar />    ✅ Admin CHOOSES to use
    └── <NuxtPage />

apps/app_pymatrix/layouts_app_pymatrix/default.vue
    ├── <PyMatrixTopBar />    ✅ PyMatrix uses its own
    ├── <PyMatrixLeftPanel /> ✅ PyMatrix uses its own
    └── <NuxtPage />
```

**Key Principle:** Shared components are **available** in `components/layout/`, but each app **decides** whether to use them.

---

## Implementation Steps

### Step 1: Create Base Layout (No UI)

**File to create:** `layouts/base.vue`

```vue
<template>
  <div class="app-base" :class="[store.menu, store.rtlClass]">
    <!-- Screen Loader (utility, not UI structure) -->
    <div
      v-show="store.isShowMainLoader"
      class="screen_loader animate__animated fixed inset-0 z-[60] grid place-content-center bg-[#fafafa] dark:bg-[#060818]"
    >
      <svg width="64" height="64" viewBox="0 0 135 135" xmlns="http://www.w3.org/2000/svg" fill="#4361ee">
        <path d="M67.447 58c5.523 0 10-4.477 10-10s-4.477-10-10-10-10 4.477-10 10 4.477 10 10 10zm9.448 9.447c0 5.523 4.477 10 10 10 5.522 0 10-4.477 10-10s-4.478-10-10-10c-5.523 0-10 4.477-10 10zm-9.448 9.448c-5.523 0-10 4.477-10 10 0 5.522 4.477 10 10 10s10-4.478 10-10c0-5.523-4.477-10-10-10zM58 67.447c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10z">
          <animateTransform attributeName="transform" type="rotate" from="0 67 67" to="-360 67 67" dur="2.5s" repeatCount="indefinite" />
        </path>
        <path d="M28.19 40.31c6.627 0 12-5.374 12-12 0-6.628-5.373-12-12-12-6.628 0-12 5.372-12 12 0 6.626 5.372 12 12 12zm30.72-19.825c4.686 4.687 12.284 4.687 16.97 0 4.686-4.686 4.686-12.284 0-16.97-4.686-4.687-12.284-4.687-16.97 0-4.687 4.686-4.687 12.284 0 16.97zm35.74 7.705c0 6.627 5.37 12 12 12 6.626 0 12-5.373 12-12 0-6.628-5.374-12-12-12-6.63 0-12 5.372-12 12zm19.822 30.72c-4.686 4.686-4.686 12.284 0 16.97 4.687 4.686 12.285 4.686 16.97 0 4.687-4.686 4.687-12.284 0-16.97-4.685-4.687-12.283-4.687-16.97 0zm-7.704 35.74c-6.627 0-12 5.37-12 12 0 6.626 5.373 12 12 12s12-5.374 12-12c0-6.63-5.373-12-12-12zm-30.72 19.822c-4.686-4.686-12.284-4.686-16.97 0-4.686 4.687-4.686 12.285 0 16.97 4.686 4.687 12.284 4.687 16.97 0 4.687-4.685 4.687-12.283 0-16.97zm-35.74-7.704c0-6.627-5.372-12-12-12-6.626 0-12 5.373-12 12s5.374 12 12 12c6.628 0 12-5.373 12-12zm-19.823-30.72c4.687-4.686 4.687-12.284 0-16.97-4.686-4.686-12.284-4.686-16.97 0-4.687 4.686-4.687 12.284 0 16.97 4.686 4.687 12.284 4.687 16.97 0z">
          <animateTransform attributeName="transform" type="rotate" from="0 67 67" to="360 67 67" dur="8s" repeatCount="indefinite" />
        </path>
      </svg>
    </div>

    <!-- Scroll to Top Button (utility) -->
    <div class="fixed bottom-6 z-50 ltr:right-6 rtl:left-6">
      <button v-if="showTopButton" type="button" class="btn btn-outline-primary animate-pulse rounded-full bg-[#fafafa] p-2 dark:bg-[#060818] dark:hover:bg-primary" @click="goToTop">
        <svg width="24" height="24" class="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path opacity="0.5" fill-rule="evenodd" clip-rule="evenodd" d="M12 20.75C12.4142 20.75 12.75 20.4142 12.75 20L12.75 10.75L11.25 10.75L11.25 20C11.25 20.4142 11.5858 20.75 12 20.75Z" fill="currentColor" />
          <path d="M6.00002 10.75C5.69667 10.75 5.4232 10.5673 5.30711 10.287C5.19103 10.0068 5.25519 9.68417 5.46969 9.46967L11.4697 3.46967C11.6103 3.32902 11.8011 3.25 12 3.25C12.1989 3.25 12.3897 3.32902 12.5304 3.46967L18.5304 9.46967C18.7449 9.68417 18.809 10.0068 18.6929 10.287C18.5768 10.5673 18.3034 10.75 18 10.75L6.00002 10.75Z" fill="currentColor" />
        </svg>
      </button>
    </div>

    <!-- Theme Customizer (optional utility) -->
    <theme-customizer v-if="showThemeCustomizer" />

    <!-- PURE CONTENT SLOT - NO FORCED UI STRUCTURE -->
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

  const eleanimation: any = document.querySelector('.animation');
  if (eleanimation) {
    eleanimation.addEventListener('animationend', function () {
      appSetting.changeAnimation('remove');
    });
  }

  store.toggleMainLoader();
});

const goToTop = () => {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
};
</script>
```

**What this provides:**
- ✅ Theme initialization (appSetting.init)
- ✅ Store initialization
- ✅ i18n setup
- ✅ Utility features (scroll to top, loader)
- ❌ NO Header
- ❌ NO Sidebar
- ❌ NO Footer

---

### Step 2: Rename Current default.vue

**Action:** Rename to indicate it includes navigation

```bash
# In poly_apps/nuxt_main/layouts/
mv default.vue default-with-nav.vue
```

**Then edit** `layouts/default-with-nav.vue`:
- Keep entire content as-is
- Add comment at top explaining it's for apps that want standard nav

```vue
<!-- layouts/default-with-nav.vue -->
<!--
  STANDARD LAYOUT WITH NAVIGATION

  This layout includes:
  - Header (top navbar)
  - Sidebar (left menu)
  - Footer

  Use this layout for apps that want the standard admin interface.

  Apps using this layout:
  - app_admin
  - app_dashboard
  - app_example

  If your app needs custom navigation, create a custom layout instead.
-->
<template>
  <!-- Keep existing default.vue content exactly as-is -->
</template>
```

---

### Step 3: Create Admin App Custom Layout

**Directory to create:** `apps/app_admin/layouts_app_admin/`

**File to create:** `apps/app_admin/layouts_app_admin/default.vue`

```vue
<template>
  <div class="admin-layout main-section relative font-nunito text-sm font-normal antialiased" :class="[store.sidebar ? 'toggle-sidebar' : '', store.menu, store.layout, store.rtlClass]">
    <div class="relative">
      <!-- Sidebar menu overlay -->
      <div class="fixed inset-0 z-50 bg-[black]/60 lg:hidden" :class="{ hidden: !store.sidebar }" @click="store.toggleSidebar()"></div>

      <!-- Screen loader -->
      <div v-show="store.isShowMainLoader" class="screen_loader animate__animated fixed inset-0 z-[60] grid place-content-center bg-[#fafafa] dark:bg-[#060818]">
        <svg width="64" height="64" viewBox="0 0 135 135" xmlns="http://www.w3.org/2000/svg" fill="#4361ee">
          <path d="M67.447 58c5.523 0 10-4.477 10-10s-4.477-10-10-10-10 4.477-10 10 4.477 10 10 10zm9.448 9.447c0 5.523 4.477 10 10 10 5.522 0 10-4.477 10-10s-4.478-10-10-10c-5.523 0-10 4.477-10 10zm-9.448 9.448c-5.523 0-10 4.477-10 10 0 5.522 4.477 10 10 10s10-4.478 10-10c0-5.523-4.477-10-10-10zM58 67.447c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10z">
            <animateTransform attributeName="transform" type="rotate" from="0 67 67" to="-360 67 67" dur="2.5s" repeatCount="indefinite" />
          </path>
          <path d="M28.19 40.31c6.627 0 12-5.374 12-12 0-6.628-5.373-12-12-12-6.628 0-12 5.372-12 12 0 6.626 5.372 12 12 12zm30.72-19.825c4.686 4.687 12.284 4.687 16.97 0 4.686-4.686 4.686-12.284 0-16.97-4.686-4.687-12.284-4.687-16.97 0-4.687 4.686-4.687 12.284 0 16.97zm35.74 7.705c0 6.627 5.37 12 12 12 6.626 0 12-5.373 12-12 0-6.628-5.374-12-12-12-6.63 0-12 5.372-12 12zm19.822 30.72c-4.686 4.686-4.686 12.284 0 16.97 4.687 4.686 12.285 4.686 16.97 0 4.687-4.686 4.687-12.284 0-16.97-4.685-4.687-12.283-4.687-16.97 0zm-7.704 35.74c-6.627 0-12 5.37-12 12 0 6.626 5.373 12 12 12s12-5.374 12-12c0-6.63-5.373-12-12-12zm-30.72 19.822c-4.686-4.686-12.284-4.686-16.97 0-4.686 4.687-4.686 12.285 0 16.97 4.686 4.687 12.284 4.687 16.97 0 4.687-4.685 4.687-12.283 0-16.97zm-35.74-7.704c0-6.627-5.372-12-12-12-6.626 0-12 5.373-12 12s5.374 12 12 12c6.628 0 12-5.373 12-12zm-19.823-30.72c4.687-4.686 4.687-12.284 0-16.97-4.686-4.686-12.284-4.686-16.97 0-4.687 4.686-4.687 12.284 0 16.97 4.686 4.687 12.284 4.687 16.97 0z">
            <animateTransform attributeName="transform" type="rotate" from="0 67 67" to="360 67 67" dur="8s" repeatCount="indefinite" />
          </path>
        </svg>
      </div>

      <!-- Scroll to top -->
      <div class="fixed bottom-6 z-50 ltr:right-6 rtl:left-6">
        <button v-if="showTopButton" type="button" class="btn btn-outline-primary animate-pulse rounded-full bg-[#fafafa] p-2 dark:bg-[#060818] dark:hover:bg-primary" @click="goToTop">
          <svg width="24" height="24" class="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path opacity="0.5" fill-rule="evenodd" clip-rule="evenodd" d="M12 20.75C12.4142 20.75 12.75 20.4142 12.75 20L12.75 10.75L11.25 10.75L11.25 20C11.25 20.4142 11.5858 20.75 12 20.75Z" fill="currentColor" />
            <path d="M6.00002 10.75C5.69667 10.75 5.4232 10.5673 5.30711 10.287C5.19103 10.0068 5.25519 9.68417 5.46969 9.46967L11.4697 3.46967C11.6103 3.32902 11.8011 3.25 12 3.25C12.1989 3.25 12.3897 3.32902 12.5304 3.46967L18.5304 9.46967C18.7449 9.68417 18.809 10.0068 18.6929 10.287C18.5768 10.5673 18.3034 10.75 18 10.75L6.00002 10.75Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <!-- Theme customizer -->
      <theme-customizer />

      <div class="main-container min-h-screen text-black dark:text-white-dark" :class="[store.navbar]">
        <!-- ✅ ADMIN CHOOSES TO USE SHARED SIDEBAR -->
        <layout-sidebar />

        <!-- BEGIN CONTENT AREA -->
        <div class="main-content">
          <!-- ✅ ADMIN CHOOSES TO USE SHARED HEADER -->
          <layout-header />

          <div class="animation p-6">
            <!-- Page content goes here -->
            <NuxtPage />

            <!-- ✅ ADMIN CHOOSES TO USE SHARED FOOTER -->
            <layout-footer />
          </div>
        </div>
        <!-- END CONTENT AREA -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import appSetting from '@/app-setting';
import { useAppStore } from '@/stores/index';

const store = useAppStore();
const showTopButton = ref(false);
const { setLocale } = useI18n();

onMounted(() => {
  appSetting.init(setLocale);

  window.onscroll = () => {
    showTopButton.value = document.body.scrollTop > 50 || document.documentElement.scrollTop > 50;
  };

  const eleanimation: any = document.querySelector('.animation');
  if (eleanimation) {
    eleanimation.addEventListener('animationend', function () {
      appSetting.changeAnimation('remove');
    });
  }

  store.toggleMainLoader();
});

const goToTop = () => {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
};
</script>
```

**Key Points:**
- ✅ Admin app **CHOOSES** to import `<layout-sidebar />`
- ✅ Admin app **CHOOSES** to import `<layout-header />`
- ✅ Admin app **CHOOSES** to import `<layout-footer />`
- ✅ Components come from shared `components/layout/`, not duplicated
- ✅ Admin app can still customize if needed (e.g., pass props, override styles)

**Then update admin pages:**

```vue
<!-- pages/admin/datasources.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'apps/app_admin/layouts_app_admin/default'
  // Or if Nuxt doesn't support paths, register in nuxt.config.ts first
});
</script>

<template>
  <!-- Your admin datasources content -->
</template>
```

---

### Step 4: Create Dashboard App Custom Layout

**Directory to create:** `apps/app_dashboard/layouts_app_dashboard/`

**File to create:** `apps/app_dashboard/layouts_app_dashboard/default.vue`

```vue
<template>
  <div class="dashboard-layout main-section relative font-nunito text-sm font-normal antialiased" :class="[store.sidebar ? 'toggle-sidebar' : '', store.menu, store.layout, store.rtlClass]">
    <div class="relative">
      <!-- Sidebar overlay -->
      <div class="fixed inset-0 z-50 bg-[black]/60 lg:hidden" :class="{ hidden: !store.sidebar }" @click="store.toggleSidebar()"></div>

      <!-- Screen loader (same as base) -->
      <div v-show="store.isShowMainLoader" class="screen_loader animate__animated fixed inset-0 z-[60] grid place-content-center bg-[#fafafa] dark:bg-[#060818]">
        <!-- SVG loader -->
      </div>

      <!-- Scroll to top (same as base) -->
      <div class="fixed bottom-6 z-50 ltr:right-6 rtl:left-6">
        <button v-if="showTopButton" type="button" class="btn btn-outline-primary animate-pulse rounded-full bg-[#fafafa] p-2 dark:bg-[#060818] dark:hover:bg-primary" @click="goToTop">
          <!-- SVG arrow -->
        </button>
      </div>

      <!-- Theme customizer -->
      <theme-customizer />

      <div class="main-container min-h-screen text-black dark:text-white-dark" :class="[store.navbar]">
        <!-- ✅ DASHBOARD CHOOSES TO USE SHARED SIDEBAR -->
        <layout-sidebar />

        <div class="main-content">
          <!-- ✅ DASHBOARD CHOOSES TO USE SHARED HEADER -->
          <layout-header />

          <div class="animation p-6">
            <NuxtPage />
            <layout-footer />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Same setup as admin layout
</script>
```

**Update dashboard pages:**

```vue
<!-- pages/index.dashboard.vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'apps/app_dashboard/layouts_app_dashboard/default'
});
</script>
```

---

### Step 5: Create PyMatrix Custom Layout (NO shared nav)

**Directory to create:** `apps/app_pymatrix/layouts_app_pymatrix/`

**File to create:** `apps/app_pymatrix/layouts_app_pymatrix/default.vue`

```vue
<template>
  <div class="pymatrix-layout">
    <!-- PyMatrix custom structure - NO layout-header, NO layout-sidebar -->
    <div class="pymatrix-app">
      <!-- ✅ PyMatrix uses ITS OWN top bar -->
      <PyMatrixTopBar
        :device-count="deviceStore.deviceCount"
        :group-enabled="groupStore.enabled"
        @connect-device="showConnectDialog = true"
        @toggle-group="toggleGroupControl"
        @open-settings="showSettings = true"
      />

      <div class="pymatrix-main">
        <!-- ✅ PyMatrix uses ITS OWN left panel -->
        <PyMatrixLeftPanel
          :devices="deviceStore.deviceList"
          :selected-serial="deviceStore.selectedSerial"
          :group-enabled="groupStore.enabled"
          :host-serial="groupStore.hostSerial"
          @select-device="deviceStore.selectDevice"
          @set-host="handleSetHost"
          @remove-from-group="handleRemoveFromGroup"
        />

        <!-- Main content area -->
        <div class="pymatrix-screen-area">
          <NuxtPage />
        </div>

        <!-- ✅ PyMatrix uses ITS OWN right panel -->
        <PyMatrixRightPanel
          :selected-device="deviceStore.selectedDevice || deviceStore.deviceList[0]"
          :group-enabled="groupStore.enabled"
          :host-device="hostDevice"
          :device-count="groupStore.deviceCount"
          @system-key="handleSystemKey"
          @send-text="handleSendText"
        />
      </div>

      <!-- Dialogs -->
      <PyMatrixConnectDialog
        v-if="showConnectDialog"
        @close="showConnectDialog = false"
        @connect="handleConnect"
      />

      <PyMatrixSettingsDialog
        v-if="showSettings"
        @close="showSettings = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDeviceStore } from '~/apps/app_pymatrix/stores_app_pymatrix/deviceStore';
import { useGroupStore } from '~/apps/app_pymatrix/stores_app_pymatrix/groupStore';

import PyMatrixTopBar from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixTopBar.vue';
import PyMatrixLeftPanel from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixLeftPanel.vue';
import PyMatrixRightPanel from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixRightPanel.vue';
import PyMatrixConnectDialog from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixConnectDialog.vue';
import PyMatrixSettingsDialog from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixSettingsDialog.vue';

const deviceStore = useDeviceStore();
const groupStore = useGroupStore();

const showConnectDialog = ref(false);
const showSettings = ref(false);

const hostDevice = computed(() => {
  if (!groupStore.hostSerial) return null;
  return deviceStore.getDevice(groupStore.hostSerial);
});

function toggleGroupControl() {
  if (groupStore.enabled) {
    disableGroupControl();
  } else {
    enableGroupControl();
  }
}

function enableGroupControl() {
  if (deviceStore.deviceCount < 2) {
    alert('At least 2 devices are required for group control');
    return;
  }

  const firstDevice = deviceStore.deviceList[0];
  groupStore.createGroup('group-001', firstDevice.serial);
  deviceStore.updateDevice(firstDevice.serial, { isHost: true });

  deviceStore.deviceList.slice(1).forEach(device => {
    groupStore.addSlave(device.serial);
  });
}

function disableGroupControl() {
  if (groupStore.hostSerial) {
    deviceStore.updateDevice(groupStore.hostSerial, { isHost: false });
  }
  groupStore.destroyGroup();
}

function handleSetHost(serial: string) {
  if (groupStore.hostSerial) {
    deviceStore.updateDevice(groupStore.hostSerial, { isHost: false });
  }

  groupStore.setHost(serial);
  deviceStore.updateDevice(serial, { isHost: true });
}

function handleRemoveFromGroup(serial: string) {
  if (groupStore.isHost(serial)) {
    deviceStore.updateDevice(serial, { isHost: false });
    groupStore.destroyGroup();
  } else {
    groupStore.removeSlave(serial);
  }
}

function handleSystemKey(key: string) {
  // Implementation
}

function handleSendText(text: string) {
  // Implementation
}

async function handleConnect(formData: any) {
  // Implementation
}
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

**Update PyMatrix page:**

```vue
<!-- pages/index.vue (after step 6 switchapp generates from index.pymatrix.vue) -->
<script setup lang="ts">
definePageMeta({
  layout: 'apps/app_pymatrix/layouts_app_pymatrix/default'
});

useHead({
  title: 'pyMatrix - Device Control',
  meta: [{ name: 'description', content: 'Android device mirroring and group control system' }]
});
</script>

<template>
  <div class="pymatrix-content">
    <!-- Just device grid content, panels are in layout now -->
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
  </div>
</template>

<script lang="ts">
// Move remaining logic here (device connection, etc.)
</script>
```

**Key Points:**
- ❌ PyMatrix does NOT use `<layout-header />`
- ❌ PyMatrix does NOT use `<layout-sidebar />`
- ✅ PyMatrix uses its OWN components
- ✅ No duplicate navigation

---

### Step 6: Register Custom Layouts in Nuxt Config

**If Nuxt doesn't auto-discover app layouts**, register them:

**File:** `nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  // ... existing config

  // Register custom layouts from apps
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
    {
      path: '~/common/components',
      pathPrefix: false,
    },
    // Register app-specific layouts
    {
      path: '~/apps/app_admin/layouts_app_admin',
      prefix: 'admin-layout',
      global: true
    },
    {
      path: '~/apps/app_dashboard/layouts_app_dashboard',
      prefix: 'dashboard-layout',
      global: true
    },
    {
      path: '~/apps/app_pymatrix/layouts_app_pymatrix',
      prefix: 'pymatrix-layout',
      global: true
    }
  ]
})
```

---

### Step 7: Update app-entry.ts Configuration

**File:** `app-entry.ts`

```typescript
const appEntryRegistry: Record<AppEntryType, AppEntryConfig> = {
  admin: {
    name: 'admin',
    displayName: 'Admin Management System',
    description: 'Administrative management interface',
    namespace: 'admin',
    defaultRoute: '/admin',
    theme: {
      primary: '#e7515a',
      secondary: '#e2a03f',
      layout: 'apps/app_admin/layouts_app_admin/default' // ✅ Updated
    },
    // ... rest of config
  },

  dashboard: {
    name: 'dashboard',
    displayName: 'Analytics Dashboard',
    description: 'Data analytics and visualization dashboard',
    namespace: 'dashboard',
    defaultRoute: '/dashboard',
    theme: {
      primary: '#00ab55',
      secondary: '#2196f3',
      layout: 'apps/app_dashboard/layouts_app_dashboard/default' // ✅ Updated
    },
    // ... rest of config
  },

  pymatrix: {
    name: 'pymatrix',
    displayName: 'pyMatrix Device Control',
    description: 'Android device mirroring and group control system',
    namespace: 'pymatrix',
    defaultRoute: '/pymatrix',
    theme: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      layout: 'apps/app_pymatrix/layouts_app_pymatrix/default' // ✅ Updated
    },
    // ... rest of config
  },

  example: {
    name: 'example',
    displayName: 'Core Node Examples',
    description: 'Example application with demo features',
    namespace: 'example',
    defaultRoute: '/',
    theme: {
      primary: '#4361ee',
      secondary: '#805dca',
      layout: 'default-with-nav' // ✅ Uses shared nav layout
    },
    // ... rest of config
  }
};
```

---

## Summary of Changes

### What Gets Created

```
layouts/
├── base.vue                    ✅ NEW - No UI, just services
└── default-with-nav.vue        ✅ RENAMED from default.vue

apps/
├── app_admin/
│   └── layouts_app_admin/
│       └── default.vue         ✅ NEW - Uses layout-header + layout-sidebar
├── app_dashboard/
│   └── layouts_app_dashboard/
│       └── default.vue         ✅ NEW - Uses layout-header + layout-sidebar
└── app_pymatrix/
    └── layouts_app_pymatrix/
        └── default.vue         ✅ NEW - Uses PyMatrix components only
```

### What Stays the Same

```
components/layout/
├── Header.vue                  ✅ UNCHANGED - Available for apps to use
├── Sidebar.vue                 ✅ UNCHANGED - Available for apps to use
└── Footer.vue                  ✅ UNCHANGED - Available for apps to use
```

**Key Insight:** `components/layout/Header.vue` doesn't change! It becomes **opt-in** instead of **forced**.

---

## Testing Checklist

After implementation:

```bash
# Test Admin app
yarn dev
# Navigate to /admin
# ✅ Should see layout-header and layout-sidebar
# ✅ Should see admin-specific content
# ❌ Should NOT see PyMatrix navigation

# Test Dashboard app
# Navigate to /dashboard
# ✅ Should see layout-header and layout-sidebar
# ✅ Should see dashboard-specific content

# Test PyMatrix app
yarn dev
# Navigate to /pymatrix
# ✅ Should see PyMatrixTopBar and PyMatrixLeftPanel
# ❌ Should NOT see layout-header or layout-sidebar
# ✅ Should NOT see duplicate navigation

# Test Example app
# Navigate to /
# ✅ Should see layout-header and layout-sidebar
# ✅ Should work exactly as before
```

---

## Rollback Plan

If something breaks:

1. **Quick rollback:**
```bash
mv layouts/default-with-nav.vue layouts/default.vue
```

2. **Revert pages:**
```vue
<!-- Remove definePageMeta from all pages -->
```

3. **System back to original state**

---

## Next Steps

1. ✅ Implement Step 1-2 (create base.vue, rename default.vue)
2. ✅ Test that example app still works
3. ✅ Implement Step 3-4 (admin and dashboard layouts)
4. ✅ Test admin and dashboard apps
5. ✅ Implement Step 5 (pymatrix layout)
6. ✅ Test pymatrix app - verify NO duplicate navigation
7. ✅ Update documentation

---

**Implementation Time Estimate:**
- Base layouts: 1 hour
- Admin/Dashboard layouts: 2 hours
- PyMatrix layout: 2 hours
- Testing: 1 hour
- **Total: ~6 hours**

---

*This guide implements the architecture analysis recommendations from ARCHITECTURE_ANALYSIS_MULTI_LAYER_ISSUES.md*
