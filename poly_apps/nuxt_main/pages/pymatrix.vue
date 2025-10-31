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
</style>
