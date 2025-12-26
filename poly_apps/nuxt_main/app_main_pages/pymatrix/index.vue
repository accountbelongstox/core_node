<!--
  PYMATRIX APP - HOMEPAGE

  This is the main entry page for PyMatrix application.
  It uses the PyMatrix layout and all functionality from the app.

  Architecture:
  - Layout: pymatrix (defined in layouts/pymatrix.vue)
  - Content: Complete device control interface with all features
  - Components: All PyMatrix components from app_pymatrix_pages/
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDeviceStore } from '@/app_pymatrix_pages/stores/deviceStore';
import { useGroupStore } from '@/app_pymatrix_pages/stores/groupStore';
import { useUIPreferencesStore } from '@/app_pymatrix_pages/stores/uiPreferencesStore';
import { useDeviceList } from '@/app_pymatrix_pages/composables/useDeviceList';
import { useGroupControl } from '@/app_pymatrix_pages/composables/useGroupControl';
import { useKeyboardShortcuts, createDefaultPyMatrixShortcuts } from '@/app_pymatrix_pages/composables/useKeyboardShortcuts';
import { useConnectDevice } from '@/app_pymatrix_pages/composables/useConnectDevice';
import { pyMatrixDeviceAPI } from '@/services/api/pymatrix/pymatrix-device-api';
import type { Device } from '@/types/pymatrix';
import type { DeviceConfig } from '@/types/pymatrix';
import { INITIAL_DEVICES } from '@/app_pymatrix_pages/constants/initial-state';

// Import all necessary components
import PyMatrixDeviceGrid from '@/app_pymatrix_pages/components/PyMatrixDeviceGrid.vue';
import PyMatrixEmptyState from '@/app_pymatrix_pages/components/PyMatrixEmptyState.vue';
import DeviceSearchBar from '@/app_pymatrix_pages/components/DeviceSearchBar.vue';
import DeviceFilterPanel from '@/app_pymatrix_pages/components/DeviceFilterPanel.vue';
import GroupControlPanel from '@/app_pymatrix_pages/components/GroupControlPanel.vue';
import GroupTreeView from '@/app_pymatrix_pages/components/GroupTreeView.vue';
import GroupBatchOperations from '@/app_pymatrix_pages/components/GroupBatchOperations.vue';
import GridLayoutControl from '@/app_pymatrix_pages/components/GridLayoutControl.vue';
import PyMatrixFullscreenPlayer from '@/app_pymatrix_pages/components/PyMatrixFullscreenPlayer.vue';
import PyMatrixScriptManager from '@/app_pymatrix_pages/components/PyMatrixScriptManager.vue';
import SystemHealthMonitor from '@/app_pymatrix_pages/components/SystemHealthMonitor.vue';

// ✅ Set layout for this page
definePageMeta({
  layout: 'pymatrix'
});

useHead({
  title: 'pyMatrix - Device Control',
  meta: [
    { name: 'description', content: 'Android device mirroring and group control system' }
  ]
});

const deviceStore = useDeviceStore();
const groupStore = useGroupStore();
const uiPreferencesStore = useUIPreferencesStore();

// Initialize with demo devices if empty (for frontend-only testing)
if (deviceStore.deviceCount === 0) {
  INITIAL_DEVICES.forEach(device => {
    deviceStore.addDevice({ ...device });
  });
}

// Use device list composable with graceful backend failure handling
const { devices, loading, error, refresh } = useDeviceList({
  autoRefresh: true,
  refreshInterval: 5000,
  // ✅ Graceful degradation when backend is offline
  onError: (err) => {
    console.warn('[PyMatrix] Backend connection failed, using demo data:', err);
  }
});

// Sync backend devices to store when available
watch(
  devices,
  (newDevices) => {
    if (newDevices && newDevices.length > 0) {
      const seenSerials = new Set<string>();

      newDevices.forEach(device => {
        deviceStore.addDevice(device);
        seenSerials.add(device.serial);
      });

      // Remove devices that are no longer in backend
      deviceStore.deviceList.forEach(device => {
        if (!seenSerials.has(device.serial) && !INITIAL_DEVICES.find(d => d.serial === device.serial)) {
          deviceStore.removeDevice(device.serial);
        }
      });
    }
  },
  { deep: true }
);

const baseUrl = computed(() => 'ws://localhost:8000');
const filteredDevices = computed(() => deviceStore.filteredDevices);

// Device Model Statistics
const modelStats = computed(() => {
  const stats = new Map<string, number>();

  deviceStore.deviceList.forEach(device => {
    const model = device.model || 'Unknown';
    stats.set(model, (stats.get(model) ?? 0) + 1);
  });

  return Array.from(stats.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model));
});

// UI State
const showGroupControl = ref(false);
const showGroupTreeView = ref(false);
const showFilterPanel = ref(false);
const showGridLayoutControl = ref(false);
const showFullscreen = ref(false);
const showScriptManager = ref(false);
const showHealthMonitor = ref(false);
const dragEnabled = ref(false);
const fullscreenDevices = ref<Device[]>([]);

// Get shared state from layout
const showConnectDialog = useState<boolean>('pymatrix-connect-dialog', () => false);
const showShortcutsHelp = useState<boolean>('pymatrix-shortcuts-help', () => false);

const { connect: connectDevice } = useConnectDevice();

// Group Control WebSocket
const {
  connect: connectGroupControl,
  disconnect: disconnectGroupControl,
  createGroup,
  addSlave,
  removeSlave,
  enableGroup,
  disableGroup
} = useGroupControl({
  baseUrl: baseUrl.value
});

// Keyboard Shortcuts Setup
function handleConnectDevice() {
  showConnectDialog.value = true;
}

const shortcuts = createDefaultPyMatrixShortcuts({
  onConnectDevice: () => {
    showConnectDialog.value = true;
  },
  onRefreshDevices: async () => {
    await refresh();
  },
  onDisconnectAll: async () => {
    for (const device of devices.value) {
      await handleDisconnect(device.serial);
    }
  }
});

// Add additional shortcuts
shortcuts.push(
  {
    key: '?',
    shift: true,
    description: 'Show keyboard shortcuts help',
    action: () => {
      showShortcutsHelp.value = !showShortcutsHelp.value;
    }
  },
  {
    key: 'g',
    ctrl: true,
    description: 'Open group control panel',
    action: () => {
      showGroupControl.value = !showGroupControl.value;
      if (showGroupControl.value) {
        connectGroupControl();
      } else {
        disconnectGroupControl();
      }
    }
  },
  {
    key: 'l',
    ctrl: true,
    description: 'Toggle grid layout control',
    action: () => {
      showGridLayoutControl.value = !showGridLayoutControl.value;
    }
  },
  {
    key: 't',
    ctrl: true,
    description: 'Toggle group tree view',
    action: () => {
      showGroupTreeView.value = !showGroupTreeView.value;
    }
  },
  {
    key: 'f',
    ctrl: true,
    description: 'Toggle device filter panel',
    action: () => {
      showFilterPanel.value = !showFilterPanel.value;
    }
  },
  {
    key: 'f',
    description: 'Toggle fullscreen for selected device',
    action: () => {
      if (devices.value.length === 1) {
        handleToggleFullscreen(devices.value[0]);
      } else if (showFullscreen.value) {
        showFullscreen.value = false;
      }
    }
  },
  {
    key: 's',
    ctrl: true,
    shift: true,
    description: 'Open script manager',
    action: () => {
      showScriptManager.value = !showScriptManager.value;
    }
  },
  {
    key: 'h',
    ctrl: true,
    description: 'Open system health monitor',
    action: () => {
      showHealthMonitor.value = !showHealthMonitor.value;
    }
  }
);

useKeyboardShortcuts({
  shortcuts,
  enabled: true
});

// Event Handlers
function handleResetLayout() {
  uiPreferencesStore.resetGridLayout();
  dragEnabled.value = false;
}

async function handleConnect(payload: { serial: string; deviceName?: string; config: DeviceConfig }) {
  try {
    await connectDevice(payload, refresh);
    showConnectDialog.value = false;
  } catch (error) {
    console.error('[PyMatrix] Connect error:', error);
  }
}

async function handleDisconnect(serial: string) {
  try {
    const response = await pyMatrixDeviceAPI.disconnectDevice(serial);

    if (response.success) {
      deviceStore.removeDevice(serial);

      if (groupStore.isHost(serial)) {
        if (groupStore.hostSerial) {
          deviceStore.updateDevice(groupStore.hostSerial, { isHost: false });
        }
        groupStore.destroyGroup();
      } else if (groupStore.isSlave(serial)) {
        groupStore.removeSlave(serial);
      }

      await refresh();
    }
  } catch (error) {
    console.error('[PyMatrix] Disconnect error:', error);
  }
}

function handleCreateGroup(groupId: string, hostSerial: string) {
  createGroup(groupId, hostSerial);
  groupStore.createGroup(groupId, hostSerial);
  deviceStore.updateDevice(hostSerial, { isHost: true });
}

function handleAddSlave(groupId: string, slaveSerial: string) {
  addSlave(groupId, slaveSerial);
  groupStore.addSlave(slaveSerial);
}

function handleRemoveSlave(groupId: string, slaveSerial: string) {
  removeSlave(groupId, slaveSerial);
  groupStore.removeSlave(slaveSerial);
}

function handleEnableGroup(groupId: string) {
  enableGroup(groupId);
  groupStore.enableGroup();
}

function handleDisableGroup(groupId: string) {
  disableGroup(groupId);
  groupStore.disableGroup();
}

function handleDeleteGroup(groupId: string) {
  disableGroup(groupId);
  if (groupStore.hostSerial) {
    deviceStore.updateDevice(groupStore.hostSerial, { isHost: false });
  }
  groupStore.destroyGroup();
  showGroupControl.value = false;
}

function handleTreeApply(selectedIds: string[]) {
  console.log('[PyMatrix] Tree selection applied:', selectedIds);
  showGroupTreeView.value = false;
}

function handleTreeRefresh() {
  console.log('[PyMatrix] Tree refresh requested');
}

function handleToggleFullscreen(device: Device | Device[]) {
  fullscreenDevices.value = Array.isArray(device) ? device : [device];
  showFullscreen.value = true;
}

function handleFullscreenClose() {
  showFullscreen.value = false;
  fullscreenDevices.value = [];
}

function handleFullscreenLayoutChange(layout: '1x1' | '2x1' | '2x2') {
  console.log('[PyMatrix] Fullscreen layout changed to', layout);
}

function handleFullscreenDeviceChange(device: Device) {
  console.log('[PyMatrix] Fullscreen device changed to', device.serial);
}
</script>

<template>
  <div class="pymatrix-content">
    <!-- Loading State -->
    <div v-if="loading && devices.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading devices...</p>
    </div>

    <!-- Error State (non-blocking when we have demo devices) -->
    <div v-else-if="error && devices.length === 0" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button @click="refresh" class="retry-btn">Retry Connection</button>
      <p class="error-hint">Using demo devices for now</p>
    </div>

    <!-- Device Controls - Main Content -->
    <div v-else-if="filteredDevices.length > 0" class="device-controls-section">
      <!-- Search Bar with Filter Toggle -->
      <div class="search-bar-container">
        <DeviceSearchBar />
        <button
          class="filter-toggle-btn"
          :class="{ 'is-active': showFilterPanel || deviceStore.hasActiveFilters }"
          @click="showFilterPanel = !showFilterPanel"
          title="Filter Devices (Ctrl+F)"
        >
          <span class="filter-icon">🎛️</span>
          <span class="filter-label">Filters</span>
          <span v-if="deviceStore.hasActiveFilters" class="filter-badge">
            {{ Object.keys(deviceStore.filters).filter(k => {
              const val = deviceStore.filters[k];
              return k === 'searchQuery' ? val.trim() : Array.isArray(val) ? val.length > 0 : val !== null;
            }).length }}
          </span>
        </button>
      </div>

      <!-- Device Model Summary -->
      <div v-if="modelStats.length" class="device-model-summary">
        <div class="summary-title">Device Models</div>
        <div class="summary-chips">
          <div
            v-for="stat in modelStats"
            :key="stat.model"
            class="model-chip"
          >
            <span class="model-name">{{ stat.model }}</span>
            <span class="model-count">{{ stat.count }}</span>
          </div>
        </div>
      </div>

      <!-- Filter Panel (collapsible) -->
      <div v-if="showFilterPanel" class="filter-panel-container">
        <DeviceFilterPanel />
      </div>

      <!-- Device Grid -->
      <PyMatrixDeviceGrid
        :devices="filteredDevices"
        :base-url="baseUrl"
        :group-enabled="groupStore.enabled"
        :drag-enabled="dragEnabled"
        @disconnect="handleDisconnect"
        @toggle-fullscreen="handleToggleFullscreen"
      />
    </div>

    <!-- Empty State - No Devices -->
    <PyMatrixEmptyState
      v-else
      @connect-device="handleConnectDevice"
    />

    <!-- ========== ADVANCED OVERLAYS & PANELS ========== -->

    <!-- Group Control Panel -->
    <div v-if="showGroupControl" class="modal-overlay" @click.self="showGroupControl = false">
      <GroupControlPanel
        :show="showGroupControl"
        :devices="devices"
        :group-state="groupStore.groupState"
        :group-enabled="groupStore.enabled"
        @close="showGroupControl = false"
        @create-group="handleCreateGroup"
        @add-slave="handleAddSlave"
        @remove-slave="handleRemoveSlave"
        @enable-group="handleEnableGroup"
        @disable-group="handleDisableGroup"
        @delete-group="handleDeleteGroup"
      />
    </div>

    <!-- Group Tree View -->
    <GroupTreeView
      :model-value="showGroupTreeView"
      @close="showGroupTreeView = false"
      @apply="handleTreeApply"
      @refresh="handleTreeRefresh"
    />

    <!-- Group Batch Operations Toolbar -->
    <GroupBatchOperations />

    <!-- Grid Layout Control Panel -->
    <div v-if="showGridLayoutControl" class="grid-layout-control-overlay">
      <GridLayoutControl
        :device-count="filteredDevices.length"
        :drag-enabled="dragEnabled"
        @update:drag-enabled="dragEnabled = $event"
        @reset="handleResetLayout"
      />
    </div>

    <!-- Grid Layout Toggle Button (FAB) -->
    <button
      v-if="filteredDevices.length > 0"
      class="grid-layout-toggle-btn"
      :class="{ 'is-active': showGridLayoutControl }"
      @click="showGridLayoutControl = !showGridLayoutControl"
      title="Grid Layout Settings (Ctrl+L)"
    >
      <span class="toggle-icon">⚙️</span>
    </button>

    <!-- Fullscreen Player -->
    <PyMatrixFullscreenPlayer
      v-if="showFullscreen"
      :devices="fullscreenDevices"
      :available-devices="devices"
      @close="handleFullscreenClose"
      @layout-change="handleFullscreenLayoutChange"
      @device-change="handleFullscreenDeviceChange"
    />

    <!-- Script Manager -->
    <PyMatrixScriptManager
      :model-value="showScriptManager"
      :available-devices="devices"
      @close="showScriptManager = false"
    />

    <!-- System Health Monitor -->
    <SystemHealthMonitor
      :model-value="showHealthMonitor"
      @close="showHealthMonitor = false"
    />
  </div>
</template>

<style scoped>
.pymatrix-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* Add padding to prevent content from touching edges */
  padding: var(--pm-space-lg, 24px);
  box-sizing: border-box;
}

/* Loading & Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  padding: 32px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(124, 92, 255, 0.2);
  border-top-color: #7c5cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  color: var(--pm-text-soft);
  font-size: 16px;
}

.error-message {
  color: #ef4444;
  font-size: 16px;
  margin: 0;
  text-align: center;
}

.error-hint {
  color: var(--pm-text-soft);
  font-size: 14px;
  margin-top: 8px;
}

.retry-btn {
  padding: 10px 24px;
  background: #7c5cff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #6a4de6;
}

/* Device Controls Section */
.device-controls-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

/* Device Model Summary */
.device-model-summary {
  margin: 4px 0 8px;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(124, 92, 255, 0.2);
  background: rgba(15, 23, 42, 0.6);
  box-shadow: 0 25px 45px rgba(1, 4, 20, 0.45);
}

.summary-title {
  font-size: 13px;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  margin-bottom: 12px;
}

.summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.model-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(124, 92, 255, 0.15);
  border: 1px solid rgba(124, 92, 255, 0.3);
}

.model-name {
  font-weight: 600;
  font-size: 13px;
  color: white;
}

.model-count {
  min-width: 24px;
  height: 24px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.2);
  color: rgba(255, 255, 255, 0.9);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 12px;
}

.search-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
}

.filter-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid var(--pm-color-border-soft);
  background: var(--pm-color-surface);
  color: var(--pm-text-strong);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-toggle-btn:hover {
  border-color: rgba(124, 92, 255, 0.45);
  background: rgba(124, 92, 255, 0.1);
}

.filter-toggle-btn.is-active {
  background: rgba(124, 92, 255, 0.2);
  border-color: rgba(124, 92, 255, 0.45);
  color: #7c5cff;
}

.filter-icon {
  font-size: 18px;
}

.filter-label {
  font-size: 14px;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #ef4444;
  color: white;
  font-size: 12px;
  font-weight: 700;
}

.filter-panel-container {
  background: var(--pm-color-surface);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: 16px;
  padding: 16px;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Grid Layout Controls */
.grid-layout-control-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 150;
  animation: fadeIn 0.3s ease;
}

.grid-layout-toggle-btn {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 15px 35px rgba(99, 102, 241, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 180;
}

.grid-layout-toggle-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(99, 102, 241, 0.5);
}

.grid-layout-toggle-btn.is-active {
  transform: rotate(90deg);
  box-shadow: 0 20px 40px rgba(99, 102, 241, 0.6);
}

.toggle-icon {
  display: inline-block;
  transition: transform 0.3s ease;
}
</style>
