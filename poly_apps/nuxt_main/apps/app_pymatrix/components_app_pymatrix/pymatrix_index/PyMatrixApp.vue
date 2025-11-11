<!--
  PYMATRIX APP - MAIN COMPONENT

  Restores the original PyMatrix dashboard experience within the
  new multi-app architecture. All routes should import this component
  from pages/index.pymatrix.vue.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDeviceStore } from '@/apps/app_pymatrix/stores_app_pymatrix/deviceStore';
import { useGroupStore } from '@/apps/app_pymatrix/stores_app_pymatrix/groupStore';
import { useUIPreferencesStore } from '@/apps/app_pymatrix/stores_app_pymatrix/uiPreferencesStore';
import { useDeviceList } from '@/apps/app_pymatrix/composables_app_pymatrix/useDeviceList';
import { useGroupControl } from '@/apps/app_pymatrix/composables_app_pymatrix/useGroupControl';
import { useKeyboardShortcuts, createDefaultPyMatrixShortcuts } from '@/apps/app_pymatrix/composables_app_pymatrix/useKeyboardShortcuts';
import { pyMatrixDeviceAPI } from '@/services/api/pymatrix/pymatrix-device-api';
import type { Device } from '@/types/pymatrix';
import { INITIAL_DEVICES } from '@/apps/app_pymatrix/constants_app_pymatrix/initial-state';

import PyMatrixDeviceGrid from '@/apps/app_pymatrix/components_app_pymatrix/PyMatrixDeviceGrid.vue';
import PyMatrixEmptyState from '@/apps/app_pymatrix/components_app_pymatrix/PyMatrixEmptyState.vue';
import DeviceSearchBar from '@/apps/app_pymatrix/components_app_pymatrix/DeviceSearchBar.vue';
import DeviceFilterPanel from '@/apps/app_pymatrix/components_app_pymatrix/DeviceFilterPanel.vue';
import GroupControlPanel from '@/apps/app_pymatrix/components_app_pymatrix/GroupControlPanel.vue';
import GroupTreeView from '@/apps/app_pymatrix/components_app_pymatrix/GroupTreeView.vue';
import GroupBatchOperations from '@/apps/app_pymatrix/components_app_pymatrix/GroupBatchOperations.vue';
import GridLayoutControl from '@/apps/app_pymatrix/components_app_pymatrix/GridLayoutControl.vue';
import PyMatrixFullscreenPlayer from '@/apps/app_pymatrix/components_app_pymatrix/PyMatrixFullscreenPlayer.vue';
import PyMatrixScriptManager from '@/apps/app_pymatrix/components_app_pymatrix/PyMatrixScriptManager.vue';
import SystemHealthMonitor from '@/apps/app_pymatrix/components_app_pymatrix/SystemHealthMonitor.vue';

// Layout is now set by the page that imports this component
// (see pages/pymatrix/index.vue)

useHead({
  title: 'pyMatrix - Device Control',
  meta: [
    { name: 'description', content: 'Android device mirroring and group control system' }
  ]
});

const deviceStore = useDeviceStore();
const groupStore = useGroupStore();
const uiPreferencesStore = useUIPreferencesStore();

if (deviceStore.deviceCount === 0) {
  INITIAL_DEVICES.forEach(device => {
    deviceStore.addDevice({ ...device });
  });
}

const { devices, loading, error, refresh } = useDeviceList({
  autoRefresh: true,
  refreshInterval: 5000
});

watch(
  devices,
  (newDevices) => {
    const seenSerials = new Set<string>();

    newDevices.forEach(device => {
      deviceStore.addDevice(device);
      seenSerials.add(device.serial);
    });

    deviceStore.deviceList.forEach(device => {
      if (!seenSerials.has(device.serial)) {
        deviceStore.removeDevice(device.serial);
      }
    });
  },
  { deep: true }
);

const baseUrl = computed(() => 'ws://localhost:8000');
const filteredDevices = computed(() => deviceStore.filteredDevices);
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

const showGroupControl = ref(false);
const showGroupTreeView = ref(false);
const showFilterPanel = ref(false);
const showGridLayoutControl = ref(false);
const showFullscreen = ref(false);
const showScriptManager = ref(false);
const showHealthMonitor = ref(false);
const dragEnabled = ref(false);
const fullscreenDevices = ref<Device[]>([]);

const showConnectDialog = useState<boolean>('pymatrix-connect-dialog', () => false);
const showShortcutsHelp = useState<boolean>('pymatrix-shortcuts-help', () => false);

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
    } else {
      disconnectGroupControl();
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

shortcuts.push({
  key: 'h',
  ctrl: true,
  description: 'Open system health monitor',
  action: () => {
    showHealthMonitor.value = !showHealthMonitor.value;
  }
});

useKeyboardShortcuts({
  shortcuts,
  enabled: true
});

function handleResetLayout() {
  uiPreferencesStore.resetGridLayout();
  dragEnabled.value = false;
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
    <!-- Loading State - only show if loading AND no devices in store -->
    <div v-if="loading && deviceStore.deviceCount === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading devices...</p>
    </div>

    <!-- Device Controls - show if we have devices (from store OR API) -->
    <div v-else-if="deviceStore.deviceCount > 0" class="device-controls-section">
      <!-- Backend connection warning (non-blocking) -->
      <div v-if="error" class="backend-warning">
        <span class="warning-icon">⚠️</span>
        <span class="warning-text">Backend offline - Using demo devices</span>
        <button @click="refresh" class="warning-retry-btn" title="Retry connection">🔄</button>
      </div>

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

      <div v-if="showFilterPanel" class="filter-panel-container">
        <DeviceFilterPanel />
      </div>

      <PyMatrixDeviceGrid
        :devices="filteredDevices"
        :base-url="baseUrl"
        :group-enabled="groupStore.enabled"
        :drag-enabled="dragEnabled"
        @disconnect="handleDisconnect"
        @toggle-fullscreen="handleToggleFullscreen"
      />
    </div>

    <PyMatrixEmptyState
      v-else
      @connect-device="handleConnectDevice"
    />

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

    <GroupTreeView
      :model-value="showGroupTreeView"
      @close="showGroupTreeView = false"
      @apply="handleTreeApply"
      @refresh="handleTreeRefresh"
    />

    <GroupBatchOperations />

    <div v-if="showGridLayoutControl" class="grid-layout-control-overlay">
      <GridLayoutControl
        :device-count="devices.length"
        :drag-enabled="dragEnabled"
        @update:drag-enabled="dragEnabled = $event"
        @reset="handleResetLayout"
      />
    </div>

    <button
      v-if="devices.length > 0"
      class="grid-layout-toggle-btn"
      :class="{ 'is-active': showGridLayoutControl }"
      @click="showGridLayoutControl = !showGridLayoutControl"
      title="Grid Layout Settings (Ctrl+L)"
    >
      <span class="toggle-icon">⚙️</span>
    </button>

    <PyMatrixFullscreenPlayer
      v-if="showFullscreen"
      :devices="fullscreenDevices"
      :available-devices="devices"
      @close="handleFullscreenClose"
      @layout-change="handleFullscreenLayoutChange"
      @device-change="handleFullscreenDeviceChange"
    />

    <PyMatrixScriptManager
      :model-value="showScriptManager"
      :available-devices="devices"
      @close="showScriptManager = false"
    />

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

.device-controls-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.backend-warning {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 8px;
  color: #fbbf24;
  font-size: 14px;
  animation: slideDown 0.3s ease;
}

.warning-icon {
  font-size: 18px;
}

.warning-text {
  flex: 1;
  font-weight: 500;
}

.warning-retry-btn {
  padding: 4px 12px;
  background: rgba(251, 191, 36, 0.2);
  border: 1px solid rgba(251, 191, 36, 0.4);
  border-radius: 6px;
  color: #fbbf24;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.warning-retry-btn:hover {
  background: rgba(251, 191, 36, 0.3);
  transform: rotate(180deg);
}

.search-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(15, 23, 42, 0.65);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-toggle-btn.is-active {
  background: rgba(124, 92, 255, 0.2);
  border-color: rgba(124, 92, 255, 0.45);
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
}

.filter-panel-container {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  padding: 16px;
}

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
  z-index: 200;
}

.grid-layout-control-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 150;
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

.grid-layout-toggle-btn.is-active {
  transform: rotate(45deg);
  box-shadow: 0 20px 40px rgba(99, 102, 241, 0.5);
}

.toggle-icon {
  display: inline-block;
  transform: translateY(1px);
}
</style>
