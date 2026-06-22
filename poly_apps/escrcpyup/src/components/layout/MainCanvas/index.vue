<template>
  <!--
    ================================================================
    MAIN CANVAS - Central Workspace Area
    ================================================================
    This is the PRIMARY content area for the extended UI.

    ✏️ FULLY CUSTOMIZABLE by another AI - Fill with:
    - Device grid/matrix view with live video streams
    - Batch control panels
    - File manager interface
    - Script execution dashboard
    - Monitoring charts and statistics
    - Custom features and tools

    ⚠️ DO NOT MODIFY:
    - Props interface (devices, selected)
    - Events interface (select, action)
    - Device store access patterns (read-only recommended)

    ⚠️ IMPORTANT:
    - This component can READ from device store
    - Actions should emit events to wrapper, not directly modify store
    - This keeps the logic boundary clean
    ================================================================
  -->
  <div class="main-canvas">
    <!--
      ✏️ TOOLBAR / ACTION BAR
      ================================================================
      TO BE FILLED: Quick actions, filters, view controls
      ================================================================
    -->
    <div class="canvas-toolbar">
      <div class="toolbar-left">
        <!-- TODO: Add filters, search, view mode toggles -->
        <div class="toolbar-title">
          <h2 class="text-xl font-bold">Device Matrix</h2>
          <span class="text-sm text-gray-400">{{ deviceCount }} devices connected</span>
        </div>
      </div>

      <div class="toolbar-right">
        <!-- TODO: Add quick action buttons -->
        <button class="toolbar-btn" title="Refresh">
          <span>🔄</span>
        </button>
        <button class="toolbar-btn" title="Settings">
          <span>⚙️</span>
        </button>
      </div>
    </div>

    <!--
      ✏️ MAIN CONTENT AREA
      ================================================================
      TO BE FILLED: Your custom UI goes here!

      Suggested implementations:
      1. Device Grid View
         - Grid of device cards with live video streams
         - Selection support (click, shift-click, drag-select)
         - Device status indicators
         - Quick action overlays

      2. Dashboard View
         - Statistics and charts
         - System health monitoring
         - Activity logs
         - Performance metrics

      3. File Manager
         - Directory tree
         - File list with preview
         - Drag-drop upload/download
         - Multi-device sync

      4. Script Execution
         - Script library
         - Batch execution controls
         - Real-time output logs
         - Scheduling interface

      You have FULL FREEDOM to design this area!
      ================================================================
    -->
    <div class="canvas-content">
      <!--
        PLACEHOLDER CONTENT - Replace with your implementation
        ================================================================
      -->
      <div class="placeholder-content">
        <div class="placeholder-icon">🎨</div>
        <h3 class="placeholder-title">Main Canvas - Ready for Customization</h3>
        <p class="placeholder-text">
          This is the central workspace area. Another AI will fill this with:
        </p>
        <ul class="placeholder-list">
          <li>📹 Device grid with live video streams</li>
          <li>⚡ Batch control panels</li>
          <li>📁 File manager interface</li>
          <li>📊 Monitoring dashboards</li>
          <li>🎬 Custom tools and features</li>
        </ul>

        <!-- Example device list display -->
        <div class="device-list-preview">
          <h4 class="text-lg font-semibold mb-3">Available Devices:</h4>
          <div class="device-grid">
            <div
              v-for="device in devices"
              :key="device.id"
              class="device-card"
              :class="{ selected: isSelected(device.id) }"
              @click="toggleSelect(device.id)"
            >
              <div class="device-icon">📱</div>
              <div class="device-info">
                <div class="device-name">{{ device.name || device.$model || 'Unknown Device' }}</div>
                <div class="device-serial">{{ device.id }}</div>
                <div class="device-status" :class="`status-${device.status}`">
                  {{ device.status }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!--
      ✏️ FOOTER / STATUS BAR (optional)
      ================================================================
      TO BE FILLED: Status info, selection counter, batch actions
      ================================================================
    -->
    <div class="canvas-footer">
      <div class="footer-info">
        <span v-if="selected.length > 0">
          {{ selected.length }} device(s) selected
        </span>
        <span v-else class="text-gray-500">
          No devices selected
        </span>
      </div>

      <div class="footer-actions">
        <!-- TODO: Add batch action buttons when devices are selected -->
        <button
          v-if="selected.length > 0"
          class="footer-btn"
          @click="handleBatchAction('mirror')"
        >
          🎬 Mirror All
        </button>
        <button
          v-if="selected.length > 0"
          class="footer-btn"
          @click="handleBatchAction('screenshot')"
        >
          📸 Screenshot All
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

/*
  ================================================================
  PROPS & EMITS - DO NOT MODIFY THESE INTERFACES
  ================================================================
  These are required by the wrapper layout
*/
const props = defineProps({
  devices: {
    type: Array,
    default: () => [],
  },
  selected: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['select', 'action'])

/*
  ================================================================
  ✏️ YOUR CUSTOM LOGIC GOES HERE
  ================================================================
  Add:
  - View mode switching (grid/list/timeline)
  - Device selection logic
  - Drag-and-drop support
  - Video stream rendering
  - Real-time data updates
  - Custom interactions

  You can access stores:
  import { useDeviceStore } from '@/store/device'
  import { usePreferenceStore } from '@/store/preference'

  ⚠️ IMPORTANT: Only READ from stores, emit events for actions
  ================================================================
*/

// Device count computed
const deviceCount = computed(() => props.devices.length)

// Selection helpers
function isSelected(deviceId) {
  return props.selected.includes(deviceId)
}

function toggleSelect(deviceId) {
  const newSelection = isSelected(deviceId)
    ? props.selected.filter(id => id !== deviceId)
    : [...props.selected, deviceId]

  emit('select', newSelection)
}

// Batch action handler
function handleBatchAction(actionType) {
  emit('action', {
    type: actionType,
    deviceIds: props.selected,
    params: {},
  })
}

/*
  ================================================================
  TODO: Add your custom implementations below
  ================================================================
  Examples:
  - Video stream components
  - WebGL/Canvas rendering
  - WebSocket connections for live data
  - Drag selection box
  - Context menus
  - Keyboard shortcuts
  ================================================================
*/
</script>

<style scoped>
/*
  ================================================================
  MAIN CANVAS STYLES
  ================================================================
  ✏️ FULLY CUSTOMIZABLE - Modify colors, layout, animations
  ================================================================
*/

.main-canvas {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #111827;
  color: #e5e7eb;
}

/* TOOLBAR */
.canvas-toolbar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background-color: rgba(17, 24, 39, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toolbar-title {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toolbar-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toolbar-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

/* CONTENT AREA */
.canvas-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

/* PLACEHOLDER CONTENT (to be replaced) */
.placeholder-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 3rem 2rem;
  text-align: center;
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
}

.placeholder-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.placeholder-text {
  color: #9ca3af;
  margin-bottom: 2rem;
  font-size: 1.125rem;
}

.placeholder-list {
  list-style: none;
  padding: 0;
  margin-bottom: 3rem;
  display: inline-block;
  text-align: left;
}

.placeholder-list li {
  padding: 0.75rem 1.5rem;
  margin-bottom: 0.5rem;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 1rem;
}

/* DEVICE LIST PREVIEW */
.device-list-preview {
  margin-top: 3rem;
  text-align: left;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.device-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.device-card:hover {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(102, 126, 234, 0.5);
  transform: translateY(-2px);
}

.device-card.selected {
  background-color: rgba(102, 126, 234, 0.2);
  border-color: #667eea;
}

.device-icon {
  flex: none;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-name {
  font-weight: 600;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-serial {
  font-size: 0.75rem;
  color: #9ca3af;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-status {
  display: inline-block;
  margin-top: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 12px;
  text-transform: capitalize;
}

.status-device {
  background-color: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.status-offline {
  background-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.status-unauthorized {
  background-color: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

/* FOOTER */
.canvas-footer {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background-color: rgba(17, 24, 39, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.footer-info {
  font-size: 0.875rem;
  color: #d1d5db;
}

.footer-actions {
  display: flex;
  gap: 0.75rem;
}

.footer-btn {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.footer-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Scrollbar */
.canvas-content::-webkit-scrollbar {
  width: 8px;
}

.canvas-content::-webkit-scrollbar-track {
  background: transparent;
}

.canvas-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.canvas-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/*
  ✏️ ADD YOUR CUSTOM STYLES BELOW
  ================================================================
  Feel free to add:
  - Video stream container styles
  - Grid/list view variations
  - Animation keyframes
  - Responsive breakpoints
  - Theme variants
  ================================================================
*/
</style>
