<!--
  PYMATRIX MAIN ROUTE - /pymatrix

  This is the main entry point for the pymatrix app at /pymatrix route.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDeviceStore } from '~/apps/app_pymatrix/stores_app_pymatrix/deviceStore';
import { useGroupStore } from '~/apps/app_pymatrix/stores_app_pymatrix/groupStore';
import { useDeviceList } from '~/apps/app_pymatrix/composables_app_pymatrix/useDeviceList';
import { useKeyboardShortcuts, createDefaultPyMatrixShortcuts } from '~/apps/app_pymatrix/composables_app_pymatrix/useKeyboardShortcuts';
import { pyMatrixDeviceAPI } from '~/services/api/pymatrix/pymatrix-device-api';

import PyMatrixDeviceGrid from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixDeviceGrid.vue';
import PyMatrixEmptyState from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixEmptyState.vue';
import PyMatrixConnectDialog from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixConnectDialog.vue';
import KeyboardShortcutsHelp from '~/apps/app_pymatrix/components_app_pymatrix/KeyboardShortcutsHelp.vue';
import GroupControlPanel from '~/apps/app_pymatrix/components_app_pymatrix/GroupControlPanel.vue';
import { useGroupControl } from '~/apps/app_pymatrix/composables_app_pymatrix/useGroupControl';

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

const showConnectDialog = ref(false);
const showShortcutsHelp = ref(false);
const showGroupControl = ref(false);

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

useKeyboardShortcuts({
  shortcuts,
  enabled: true
});

async function handleConnect(formData: any) {
  try {
    // Extract serial from form data
    const serial = formData.serial;

    const response = await pyMatrixDeviceAPI.connectDevice(serial);

    if (response.success && response.device) {
      deviceStore.addDevice(response.device);
      showConnectDialog.value = false;
      await refresh();
    }
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

    <!-- Device Grid - when devices are connected -->
    <PyMatrixDeviceGrid
      v-else-if="devices.length > 0"
      :devices="devices"
      :base-url="baseUrl"
      :group-enabled="groupStore.enabled"
      @disconnect="handleDisconnect"
    />

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
</style>
