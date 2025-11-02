<!--
  PYMATRIX MAIN ROUTE - /pymatrix

  This is the main entry point for the pymatrix app at /pymatrix route.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDeviceStore } from '../apps/app_pymatrix/stores_app_pymatrix/deviceStore';
import { useGroupStore } from '../apps/app_pymatrix/stores_app_pymatrix/groupStore';
import { useDeviceList } from '../apps/app_pymatrix/composables_app_pymatrix/useDeviceList';
import { useKeyboardShortcuts, createDefaultPyMatrixShortcuts } from '../apps/app_pymatrix/composables_app_pymatrix/useKeyboardShortcuts';
import { pyMatrixDeviceAPI } from '../services/api/pymatrix/pymatrix-device-api';
import { useConnectDevice } from '../apps/app_pymatrix/composables_app_pymatrix/useConnectDevice';
import type { DeviceConfig } from '../types/pymatrix';

import PyMatrixDeviceGrid from '../apps/app_pymatrix/components_app_pymatrix/PyMatrixDeviceGrid.vue';
import PyMatrixEmptyState from '../apps/app_pymatrix/components_app_pymatrix/PyMatrixEmptyState.vue';
import PyMatrixConnectDialog from '../apps/app_pymatrix/components_app_pymatrix/PyMatrixConnectDialog.vue';
import KeyboardShortcutsHelp from '../apps/app_pymatrix/components_app_pymatrix/KeyboardShortcutsHelp.vue';
import GroupControlPanel from '../apps/app_pymatrix/components_app_pymatrix/GroupControlPanel.vue';
import GroupBatchOperations from '../apps/app_pymatrix/components_app_pymatrix/GroupBatchOperations.vue';
import GridLayoutControl from '../apps/app_pymatrix/components_app_pymatrix/GridLayoutControl.vue';
import GroupTreeView from '../apps/app_pymatrix/components_app_pymatrix/GroupTreeView.vue';
import DeviceSearchBar from '../apps/app_pymatrix/components_app_pymatrix/DeviceSearchBar.vue';
import DeviceFilterPanel from '../apps/app_pymatrix/components_app_pymatrix/DeviceFilterPanel.vue';
import PyMatrixFullscreenPlayer from '../apps/app_pymatrix/components_app_pymatrix/PyMatrixFullscreenPlayer.vue';
import PyMatrixScriptManager from '../apps/app_pymatrix/components_app_pymatrix/PyMatrixScriptManager.vue';
import { useGroupControl } from '../apps/app_pymatrix/composables_app_pymatrix/useGroupControl';
import { useUIPreferencesStore } from '../apps/app_pymatrix/stores_app_pymatrix/uiPreferencesStore';
import { useGroupTreeStore } from '../apps/app_pymatrix/stores_app_pymatrix/groupTreeStore';
import type { Device } from '../types/pymatrix';

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
const groupTreeStore = useGroupTreeStore();

// Use new device list API
const { devices, loading, error, refresh } = useDeviceList({
  autoRefresh: true,
  refreshInterval: 5000
});

// Sync devices to store when they change
watch(devices, (newDevices) => {
  newDevices.forEach(device => {
    deviceStore.addDevice(device);
  });
}, { deep: true });

const baseUrl = computed(() => 'ws://localhost:8000');

// Get filtered devices from store
const filteredDevices = computed(() => deviceStore.filteredDevices);

const showConnectDialog = ref(false);
const showShortcutsHelp = ref(false);
const showGroupControl = ref(false);
const showGridLayoutControl = ref(false);
const showGroupTreeView = ref(false);
const showFilterPanel = ref(false);
const showFullscreen = ref(false);
const fullscreenDevices = ref<Device[]>([]);
const dragEnabled = ref(false);
const showScriptManager = ref(false);

const { connect: connectDevice } = useConnectDevice();

// Group Control WebSocket
const {
  connect: connectGroupControl,
  disconnect: disconnectGroupControl,
  createGroup,
  addSlave,
  removeSlave,
  enableGroup,
  disableGroup,
  getGroupState
} = useGroupControl({
  baseUrl: baseUrl.value
});

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

shortcuts.push({
  key: '?',
  shift: true,
  description: 'Show keyboard shortcuts help',
  action: () => {
    showShortcutsHelp.value = !showShortcutsHelp.value;
  }
});

shortcuts.push({
  key: 'g',
  ctrl: true,
  description: 'Open group control panel',
  action: () => {
    showGroupControl.value = !showGroupControl.value;
    if (showGroupControl.value) {
      connectGroupControl();
    }
  }
});

shortcuts.push({
  key: 'l',
  ctrl: true,
  description: 'Toggle grid layout control',
  action: () => {
    showGridLayoutControl.value = !showGridLayoutControl.value;
  }
});

shortcuts.push({
  key: 't',
  ctrl: true,
  description: 'Toggle group tree view',
  action: () => {
    showGroupTreeView.value = !showGroupTreeView.value;
  }
});

shortcuts.push({
  key: 'f',
  ctrl: true,
  description: 'Toggle device filter panel',
  action: () => {
    showFilterPanel.value = !showFilterPanel.value;
  }
});

shortcuts.push({
  key: 'f',
  description: 'Toggle fullscreen for selected device',
  action: () => {
    // If only one device, fullscreen it
    if (devices.value.length === 1) {
      handleToggleFullscreen(devices.value[0]);
    } else if (showFullscreen.value) {
      showFullscreen.value = false;
    }
  }
});

shortcuts.push({
  key: 's',
  ctrl: true,
  shift: true,
  description: 'Open script manager',
  action: () => {
    showScriptManager.value = !showScriptManager.value;
  }
});

useKeyboardShortcuts({
  shortcuts,
  enabled: true
});

function handleResetLayout() {
  uiPreferencesStore.resetGridLayout();
  dragEnabled.value = false;
  console.log('[PyMatrix] Grid layout reset');
}

async function handleConnect(payload: { serial: string; deviceName?: string; config: DeviceConfig }) {
  try {
    await connectDevice(payload, refresh);
    showConnectDialog.value = false;
  } catch (error) {
    console.error('Connect error:', error);
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
    console.error('Disconnect error:', error);
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
  // TODO: Handle selected devices/groups from tree
  showGroupTreeView.value = false;
}

function handleTreeRefresh() {
  console.log('[PyMatrix] Tree refresh requested');
  // TODO: Reload tree data from backend
}

function handleToggleFullscreen(device: Device | Device[]) {
  if (Array.isArray(device)) {
    fullscreenDevices.value = device;
  } else {
    fullscreenDevices.value = [device];
  }
  showFullscreen.value = true;
  console.log('[PyMatrix] Entering fullscreen mode with', fullscreenDevices.value.length, 'device(s)');
}

function handleFullscreenClose() {
  showFullscreen.value = false;
  fullscreenDevices.value = [];
  console.log('[PyMatrix] Exited fullscreen mode');
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
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading devices...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button @click="refresh" class="retry-btn">Retry</button>
    </div>

    <!-- Device Controls - Search and Filter (when devices exist) -->
    <div v-else-if="devices.length > 0" class="device-controls-section">
      <!-- Search Bar -->
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

      <!-- Filter Panel -->
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

    <!-- Empty State - when no devices connected -->
    <PyMatrixEmptyState
      v-else
      @connect-device="handleConnectDevice"
    />

    <!-- Connect Device Dialog -->
    <PyMatrixConnectDialog
      v-if="showConnectDialog"
      :available-devices="devices"
      @connect="handleConnect"
      @close="showConnectDialog = false"
    />

    <!-- Keyboard Shortcuts Help -->
    <KeyboardShortcutsHelp
      :show="showShortcutsHelp"
      :shortcuts="shortcuts"
      @close="showShortcutsHelp = false"
    />

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
      :show="showGroupTreeView"
      @close="showGroupTreeView = false"
      @apply="handleTreeApply"
      @refresh="handleTreeRefresh"
    />

    <!-- Group Batch Operations Toolbar -->
    <GroupBatchOperations />

    <!-- Grid Layout Control Panel -->
    <div v-if="showGridLayoutControl" class="grid-layout-control-overlay">
      <GridLayoutControl
        :device-count="devices.length"
        :drag-enabled="dragEnabled"
        @update:drag-enabled="dragEnabled = $event"
        @reset="handleResetLayout"
      />
    </div>

    <!-- Grid Layout Toggle Button -->
    <button
      v-if="devices.length > 0"
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
      :show="showScriptManager"
      :available-devices="devices"
      @close="showScriptManager = false"
    />
  </div>
</template>

<style scoped>
.pymatrix-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
}

.error-message {
  color: #ef4444;
  font-size: 16px;
  margin: 0;
}

.retry-btn {
  padding: 10px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #2563eb;
}

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
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Grid Layout Control Styles */
.grid-layout-control-overlay {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 900;
  animation: slideInRight 0.3s ease-out;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.grid-layout-toggle-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, rgba(20, 20, 20, 0.9) 0%, rgba(30, 30, 30, 0.9) 100%);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.grid-layout-toggle-btn:hover {
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(40, 40, 40, 0.95) 100%);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.grid-layout-toggle-btn.is-active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #3b82f6;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
}

.grid-layout-toggle-btn.is-active:hover {
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.6);
}

.toggle-icon {
  font-size: 24px;
  transition: transform 0.3s ease;
}

.grid-layout-toggle-btn.is-active .toggle-icon {
  transform: rotate(90deg);
}

/* Device Controls Section */
.device-controls-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  height: 100%;
}

.search-bar-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e5e7eb;
}

.filter-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: #374151;
  background-color: #ffffff;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-toggle-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background-color: #eff6ff;
}

.filter-toggle-btn.is-active {
  border-color: #3b82f6;
  color: #ffffff;
  background-color: #3b82f6;
}

.filter-icon {
  font-size: 1.25rem;
}

.filter-label {
  font-size: 0.95rem;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #ffffff;
  background-color: #ef4444;
  border-radius: 9999px;
}

.filter-toggle-btn.is-active .filter-badge {
  background-color: rgba(255, 255, 255, 0.3);
}

.filter-panel-container {
  padding: 0 1rem;
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

/* Dark mode support for device controls */
@media (prefers-color-scheme: dark) {
  .search-bar-container {
    background-color: rgba(31, 41, 55, 0.95);
    border-bottom-color: #374151;
  }

  .filter-toggle-btn {
    color: #d1d5db;
    background-color: #1f2937;
    border-color: #374151;
  }

  .filter-toggle-btn:hover {
    border-color: #60a5fa;
    color: #60a5fa;
    background-color: #1e3a8a;
  }

  .filter-toggle-btn.is-active {
    border-color: #60a5fa;
    color: #ffffff;
    background-color: #3b82f6;
  }
}
</style>
