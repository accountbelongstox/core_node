<template>
  <!--
    ================================================================
    WRAPPER LAYOUT - Outer Container for Extended UI
    ================================================================
    This layout WRAPS the existing escrcpy UI and adds:
    - Left Sidebar (navigation panel)
    - Center Canvas (main workspace)
    - Right Sidebar (ORIGINAL ESCRCPY UI - completely preserved)

    ⚠️ CRITICAL - DO NOT MODIFY EXISTING UI:
    The DefaultLayout component on the right contains ALL existing
    escrcpy functionality and must remain 100% unchanged in logic.

    ✏️ CUSTOMIZATION ZONES (for another AI to fill):
    - TopHeader: Logo, title, global actions
    - LeftSidebar: Navigation menu, device groups
    - MainCanvas: Device grid, video streams, controls
    - Styling: Colors, animations, responsive behavior
    ================================================================
  -->
  <div class="wrapper-layout">
    <!-- Top Header Bar (optional, can be removed if not needed) -->
    <div v-if="showTopHeader" class="wrapper-header">
      <TopHeader
        :left-collapsed="leftCollapsed"
        :right-collapsed="rightCollapsed"
        @toggle-left="leftCollapsed = !leftCollapsed"
        @toggle-right="rightCollapsed = !rightCollapsed"
      />
    </div>

    <!-- Main 3-Panel Layout -->
    <div class="wrapper-body">
      <!-- LEFT SIDEBAR - New Navigation Panel -->
      <!--
        ✏️ TO BE FILLED BY ANOTHER AI
        Suggested content:
        - Navigation menu
        - Device groups/filters
        - Quick access tools
        - Collapsible design
      -->
      <div
        class="wrapper-left"
        :class="{ 'wrapper-left-collapsed': leftCollapsed }"
      >
        <LeftSidebar
          :collapsed="leftCollapsed"
          @toggle="leftCollapsed = !leftCollapsed"
        />
      </div>

      <!-- CENTER CANVAS - Main Workspace -->
      <!--
        ✏️ TO BE FILLED BY ANOTHER AI
        Suggested content:
        - Device grid with live video streams
        - Batch control panels
        - File manager
        - Script execution interface
        - Dashboard and monitoring

        ⚠️ IMPORTANT: Can access device data via stores but
        DO NOT modify store logic or APIs
      -->
      <div class="wrapper-center">
        <MainCanvas
          :devices="deviceList"
          :selected="selectedDevices"
          @select="handleSelect"
          @action="handleAction"
        />
      </div>

      <!-- RIGHT SIDEBAR - ORIGINAL ESCRCPY UI (PRESERVED) -->
      <!--
        ⛔ CRITICAL - DO NOT MODIFY THIS SECTION
        ================================================================
        This is the COMPLETE ORIGINAL escrcpy UI, rendered as-is.
        It contains:
        - Tab navigation (Device / Preferences / About)
        - QuickBar (Search, Arrange, Logs, Terminal, etc.)
        - Device table with all controls
        - Wireless connection UI
        - Settings and configuration
        - All existing routes and pages

        The DefaultLayout component must:
        - Receive NO props (it manages its own state)
        - Work exactly as before
        - Have all existing functionality preserved
        - Not be modified in any way
        ================================================================
      -->
      <div
        v-if="!rightCollapsed"
        class="wrapper-right"
      >
        <!--
          This is the existing escrcpy layout, rendered completely unchanged
          ⛔ DO NOT add props, events, or wrappers that modify its behavior
        -->
        <DefaultLayout />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDeviceStore } from '@/store/device'

// ================================================================
// IMPORT COMPONENTS
// ================================================================
// New UI components (to be created)
import TopHeader from '@/components/layout/TopHeader/index.vue'
import LeftSidebar from '@/components/layout/LeftSidebar/index.vue'
import MainCanvas from '@/components/layout/MainCanvas/index.vue'

// ⛔ CRITICAL: Import the ORIGINAL default layout unchanged
import DefaultLayout from '@/layouts/default/index.vue'

// ================================================================
// UI STATE
// ================================================================
const showTopHeader = ref(true) // Toggle top header visibility
const leftCollapsed = ref(false) // Left sidebar collapse state
const rightCollapsed = ref(false) // Right sidebar (original UI) collapse state

// ================================================================
// DEVICE DATA - Access existing store
// ⚠️ DO NOT MODIFY - This uses the existing device store
// ================================================================
const deviceStore = useDeviceStore()
const { list: deviceList } = storeToRefs(deviceStore)

// ================================================================
// SELECTION STATE - For main canvas
// ✏️ TO BE CUSTOMIZED by another AI
// ================================================================
const selectedDevices = ref([])

// ================================================================
// EVENT HANDLERS - For main canvas interactions
// ✏️ TO BE IMPLEMENTED by another AI
// ================================================================
function handleSelect(deviceIds) {
  // Handle device selection from main canvas
  selectedDevices.value = deviceIds
}

function handleAction(action) {
  // Handle actions from main canvas
  // action: { type: 'mirror' | 'screenshot' | 'install' | ..., deviceId: string, params: any }

  // ⚠️ IMPORTANT: Use existing store methods, don't create new APIs
  console.log('Action from canvas:', action)
}
</script>

<style scoped>
/*
  ================================================================
  WRAPPER LAYOUT STYLES
  ================================================================
  This defines the outer container structure
  ✏️ Customize colors, sizing, transitions as needed
  ================================================================
*/

.wrapper-layout {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #0a0c10; /* Dark background */
}

/* Top Header (optional) */
.wrapper-header {
  flex: none;
  height: 60px;
  background-color: rgba(10, 12, 16, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  z-index: 100;
}

/* Main Body - 3 Panel Layout */
.wrapper-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* LEFT SIDEBAR - New Navigation */
.wrapper-left {
  flex: none;
  width: 240px;
  background-color: rgba(17, 24, 39, 0.95);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  transition: width 0.3s ease;
  overflow: hidden;
}

.wrapper-left-collapsed {
  width: 60px;
}

/* CENTER CANVAS - Main Workspace */
.wrapper-center {
  flex: 1;
  background-color: #111827;
  overflow: auto;
}

/* RIGHT SIDEBAR - Original Escrcpy UI */
.wrapper-right {
  flex: none;
  width: 420px;
  background-color: rgba(17, 24, 39, 0.98);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

/*
  ✏️ CUSTOMIZATION ZONE - Add your styles below
  ================================================================
  Feel free to add:
  - Glassmorphism effects
  - Gradient backgrounds
  - Animations and transitions
  - Responsive breakpoints
  - Theme variants
  ================================================================
*/

/* Example responsive behavior */
@media (max-width: 1024px) {
  .wrapper-right {
    width: 360px;
  }
}

@media (max-width: 768px) {
  .wrapper-left {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 200;
  }

  .wrapper-left-collapsed {
    transform: translateX(-100%);
  }
}
</style>
