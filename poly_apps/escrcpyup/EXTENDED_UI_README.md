# Escrcpy Extended UI - Architecture Documentation

## 📋 Overview

This document describes the **Extended UI Framework** added to Escrcpy. The framework **wraps the existing UI** with a larger outer container, providing:

- **Left Sidebar**: Navigation and device groups
- **Center Canvas**: Main workspace for custom features
- **Right Sidebar**: **Original Escrcpy UI** (completely preserved)
- **Top Header**: Application title bar and global actions

## 🏗️ Architecture

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     Top Header (60px)                        │
│  Logo + Search + Notifications + User Menu + Toggles        │
├─────────────┬────────────────────────────┬──────────────────┤
│             │                            │                  │
│             │                            │                  │
│ Left        │   Center Canvas            │  Right Sidebar   │
│ Sidebar     │   (Main Workspace)         │  (Original UI)   │
│             │                            │                  │
│ - Nav Menu  │  ✏️ TO BE FILLED BY        │  ⛔ DO NOT       │
│ - Groups    │     ANOTHER AI             │     MODIFY       │
│ - Tools     │                            │                  │
│             │  - Device Grid             │  - Device Table  │
│ (240px)     │  - Video Streams           │  - Settings      │
│ or          │  - Controls                │  - WiFi Connect  │
│ (60px)      │  - File Manager            │  - QuickBar      │
│             │  - Dashboards              │  - All Features  │
│             │                            │                  │
│             │                            │  (420px)         │
└─────────────┴────────────────────────────┴──────────────────┘
```

### File Structure

```
src/
├── layouts/
│   ├── index.vue                    # Layout Router (updated)
│   ├── default/                     # ⛔ ORIGINAL UI - DO NOT MODIFY
│   │   └── index.vue                #    Preserved as-is
│   └── wrapper/                     # ✅ NEW WRAPPER LAYOUT
│       └── index.vue                #    Outer container framework
│
├── components/
│   └── layout/                      # ✅ NEW LAYOUT COMPONENTS
│       ├── TopHeader/
│       │   └── index.vue            # ✏️ Top title bar
│       ├── LeftSidebar/
│       │   └── index.vue            # ✏️ Left navigation panel
│       └── MainCanvas/
│           └── index.vue            # ✏️ Center workspace area
│
├── store/                           # ⛔ DO NOT MODIFY STORE LOGIC
│   ├── device/                      #    Read-only access recommended
│   ├── preference/
│   ├── control/
│   └── theme/
│
└── pages/                           # ⛔ DO NOT MODIFY EXISTING PAGES
    ├── device/                      #    These are in right sidebar
    ├── preference/
    └── about/
```

## 🔐 CRITICAL - DO NOT MODIFY Rules

### ⛔ ABSOLUTELY FORBIDDEN

**DO NOT modify the following:**

1. **`src/layouts/default/index.vue`**
   - This is the original Escrcpy UI
   - All existing functionality is here
   - Must work exactly as before

2. **Store Logic** (`src/store/*`)
   - DO NOT add new actions/mutations
   - DO NOT change existing APIs
   - Read-only access is recommended

3. **Existing Pages** (`src/pages/*`)
   - Device, Preference, About pages
   - All component logic and templates
   - These render in the right sidebar

4. **Router Configuration** (`src/router/index.js`)
   - Route definitions and navigation
   - File-based routing system

5. **Component Interfaces**
   - Props and events defined in wrapper components
   - These ensure layout integration works

### ⚠️ INTERFACE PRESERVATION

The following interfaces MUST remain unchanged:

**WrapperLayout Props** (none - uses stores directly)

**WrapperLayout Events** (none - internal state only)

**TopHeader Component:**
```vue
Props:
- leftCollapsed: Boolean
- rightCollapsed: Boolean

Events:
- toggle-left: void
- toggle-right: void
```

**LeftSidebar Component:**
```vue
Props:
- collapsed: Boolean

Events:
- toggle: void
```

**MainCanvas Component:**
```vue
Props:
- devices: Array
- selected: Array

Events:
- select: deviceIds[]
- action: { type, deviceIds, params }
```

## ✏️ CUSTOMIZATION ZONES

### ✅ SAFE TO MODIFY

You (another AI) can freely customize:

1. **TopHeader** (`src/components/layout/TopHeader/index.vue`)
   - Logo and branding
   - Search functionality
   - Notifications
   - User menu
   - Global actions
   - Styling and animations

2. **LeftSidebar** (`src/components/layout/LeftSidebar/index.vue`)
   - Navigation menu items
   - Device groups display
   - Quick access tools
   - Collapsible behavior
   - Styling and themes

3. **MainCanvas** (`src/components/layout/MainCanvas/index.vue`)
   - Device grid/list views
   - Live video streams (WebRTC, WebGL, etc.)
   - Batch control panels
   - File manager UI
   - Script execution interface
   - Dashboards and monitoring
   - Custom tools and features
   - ALL CONTENT AND FUNCTIONALITY

4. **WrapperLayout** (`src/layouts/wrapper/index.vue`)
   - Panel dimensions (widths, heights)
   - Colors and theming
   - Collapse/expand behavior
   - Responsive breakpoints
   - Animations and transitions

### 📖 What You Can Do

#### Reading Device Data
```vue
<script setup>
import { useDeviceStore } from '@/store/device'

const deviceStore = useDeviceStore()
const devices = computed(() => deviceStore.list)
</script>
```

#### Emitting Actions (Recommended Pattern)
```vue
// In MainCanvas or other custom components
emit('action', {
  type: 'mirror',
  deviceIds: ['device-id-1', 'device-id-2'],
  params: { resolution: 1080 }
})

// The wrapper will handle this and call appropriate store methods
```

#### Adding New Features
- Create new components in `src/components/custom/`
- Use them in MainCanvas, TopHeader, or LeftSidebar
- Build your own UI logic and state management
- Integrate with existing stores (read-only)

## 🎨 Styling Guide

### Current Color Scheme

```css
/* Dark theme colors */
--bg-primary: #0a0c10        /* Almost black */
--bg-secondary: #111827      /* Dark gray */
--bg-panel: rgba(17, 24, 39, 0.95)  /* Translucent panel */

--accent-primary: #667eea    /* Purple-blue */
--accent-secondary: #764ba2  /* Purple */

--text-primary: #e5e7eb      /* Light gray */
--text-secondary: #9ca3af    /* Medium gray */

--border: rgba(255, 255, 255, 0.1)  /* Subtle borders */
```

### Design Principles

- **Glassmorphism**: Translucent panels with backdrop blur
- **Gradient Accents**: Purple-blue gradients for highlights
- **Smooth Transitions**: 0.2-0.3s ease animations
- **Consistent Spacing**: 0.5rem, 0.75rem, 1rem, 1.5rem
- **Responsive**: Mobile-first with `md:` and `lg:` breakpoints

## 🔄 Switching Layouts

### Default Layout (Wrapper)
The app defaults to the **wrapper layout** (extended UI).

**To change default back to original UI:**
Edit `src/layouts/index.vue`:
```vue
// Change this line:
const activeLayout = computed(() => LayoutMap[route.meta.layout || 'wrapper'])

// To this:
const activeLayout = computed(() => LayoutMap[route.meta.layout || 'default'])
```

### Per-Route Layout
Set `layout` in route meta:
```js
// Use wrapper layout
{ path: '/device', meta: { layout: 'wrapper' } }

// Use original layout
{ path: '/device', meta: { layout: 'default' } }
```

## 📦 Component Dependencies

### Required Imports (already configured)

**Wrapper Layout:**
```vue
import TopHeader from '@/components/layout/TopHeader/index.vue'
import LeftSidebar from '@/components/layout/LeftSidebar/index.vue'
import MainCanvas from '@/components/layout/MainCanvas/index.vue'
import DefaultLayout from '@/layouts/default/index.vue'
```

**Stores (read-only access):**
```vue
import { useDeviceStore } from '@/store/device'
import { usePreferenceStore } from '@/store/preference'
import { useThemeStore } from '@/store/theme'
```

### Existing UI Libraries Available

- **Element Plus**: Full component library (already imported)
- **UnoCSS**: Tailwind-like utility classes
- **Vue Router**: Navigation and routing
- **Pinia**: State management

## 🛠️ Development Workflow

### 1. Setup
```bash
cd D:\programing\core_node\poly_apps\escrcpyup
pnpm install
```

### 2. Run Development Server
```bash
# Windows
.\scripts\start.ps1
# Then select "1. Start Development Server"

# Unix/Linux/macOS
./scripts/start.sh
# Then select "1. Start Development Server"
```

### 3. Access the App
```
http://localhost:1535
```

### 4. Customize Components

**Step 1: Start with MainCanvas**
- Open `src/components/layout/MainCanvas/index.vue`
- Replace placeholder content with your UI
- Add device grid, video streams, controls, etc.

**Step 2: Enhance LeftSidebar**
- Open `src/components/layout/LeftSidebar/index.vue`
- Add real navigation menu
- Connect device groups from store
- Add filters and quick actions

**Step 3: Complete TopHeader**
- Open `src/components/layout/TopHeader/index.vue`
- Implement search functionality
- Add notification system
- Create user menu dropdown

**Step 4: Adjust WrapperLayout**
- Open `src/layouts/wrapper/index.vue`
- Tweak panel dimensions
- Adjust responsive breakpoints
- Customize colors and theming

## 🎯 Example: Adding a Feature

### Example: Device Video Grid in MainCanvas

```vue
<template>
  <div class="main-canvas">
    <div class="canvas-toolbar">
      <h2>Live Device Streams</h2>
      <button @click="refreshAll">Refresh All</button>
    </div>

    <div class="canvas-content">
      <!-- Device Grid -->
      <div class="device-grid">
        <div
          v-for="device in devices"
          :key="device.id"
          class="device-card"
          @click="toggleSelect(device.id)"
        >
          <!-- Video Stream Component -->
          <video-stream :device-id="device.id" />

          <!-- Device Info Overlay -->
          <div class="device-overlay">
            <div class="device-name">{{ device.name }}</div>
            <div class="device-status">{{ device.status }}</div>
          </div>

          <!-- Quick Actions -->
          <div class="device-actions">
            <button @click.stop="handleMirror(device.id)">Mirror</button>
            <button @click.stop="handleScreenshot(device.id)">Screenshot</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import VideoStream from '@/components/custom/VideoStream.vue'

const props = defineProps({
  devices: Array,
  selected: Array,
})

const emit = defineEmits(['select', 'action'])

function toggleSelect(deviceId) {
  const newSelection = props.selected.includes(deviceId)
    ? props.selected.filter(id => id !== deviceId)
    : [...props.selected, deviceId]
  emit('select', newSelection)
}

function handleMirror(deviceId) {
  emit('action', {
    type: 'mirror',
    deviceIds: [deviceId],
    params: {},
  })
}

function handleScreenshot(deviceId) {
  emit('action', {
    type: 'screenshot',
    deviceIds: [deviceId],
    params: {},
  })
}
</script>

<style scoped>
.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.device-card {
  position: relative;
  aspect-ratio: 9 / 16;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
}

/* Add more styles... */
</style>
```

## 🐛 Troubleshooting

### Issue: Original UI not showing in right sidebar
**Solution:** Check that `DefaultLayout` is imported correctly in `wrapper/index.vue`

### Issue: Stores not accessible
**Solution:** Import from correct path: `@/store/device` not `$/store/device`

### Issue: Styles not applying
**Solution:** Ensure UnoCSS is loaded and classes are valid

### Issue: Component not rendering
**Solution:** Check browser console for import errors

## 📚 Additional Resources

- **Element Plus Docs**: https://element-plus.org/
- **UnoCSS Docs**: https://unocss.dev/
- **Vue 3 Docs**: https://vuejs.org/
- **Pinia Docs**: https://pinia.vuejs.org/

## 🎉 Summary

### What This Framework Provides

✅ **Wrapper Layout** - Outer container with 3-panel structure
✅ **Top Header** - Customizable title bar
✅ **Left Sidebar** - Navigation and tools
✅ **Main Canvas** - YOUR custom workspace
✅ **Right Sidebar** - Original Escrcpy UI preserved
✅ **Layout Switching** - Toggle between wrapper and original
✅ **Full Customization** - Colors, sizing, features

### What You Must Preserve

⛔ **Original UI** - `layouts/default/index.vue` unchanged
⛔ **Store Logic** - Read-only access only
⛔ **Existing Pages** - Device, Preferences, About
⛔ **Component Interfaces** - Props and events defined
⛔ **Router Config** - Route definitions and navigation

---

**Happy Coding! 🚀**

For questions or issues, refer to this document and the inline comments in each component file.
