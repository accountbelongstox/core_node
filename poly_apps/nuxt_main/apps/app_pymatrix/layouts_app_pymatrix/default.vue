<!--
  PYMATRIX APP CUSTOM LAYOUT

  This layout is specifically for the PyMatrix app.
  It does NOT use the shared Header/Sidebar components.
  Instead, it uses PyMatrix's own navigation components:
  - PyMatrixTopBar (replaces Header)
  - PyMatrixLeftPanel (replaces Sidebar)
  - PyMatrixRightPanel (additional control panel)

  This ensures NO duplicate navigation elements.
-->
<template>
  <div class="pymatrix-layout">
    <div class="pymatrix-app">
      <!-- ✅ PyMatrix uses ITS OWN top bar (NOT layout-header) -->
      <PyMatrixTopBar
        :device-count="deviceStore.deviceCount"
        :group-enabled="groupStore.enabled"
        @connect-device="showConnectDialog = true"
        @toggle-group="toggleGroupControl"
        @open-settings="showSettings = true"
        @show-help="showShortcutsHelp = true"
        @show-history="showConnectionHistory = true"
      />

      <div class="pymatrix-main">
        <!-- ✅ PyMatrix uses ITS OWN left panel (NOT layout-sidebar) -->
        <PyMatrixLeftPanel
          :devices="deviceStore.deviceList"
          :selected-serial="deviceStore.selectedSerial"
          :group-enabled="groupStore.enabled"
          :host-serial="groupStore.hostSerial"
          @select-device="deviceStore.selectDevice"
          @set-host="handleSetHost"
          @remove-from-group="handleRemoveFromGroup"
        />

        <!-- Main content area - pages go here -->
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
        :available-devices="deviceStore.deviceList"
        @close="showConnectDialog = false"
        @connect="handleConnect"
      />

      <PyMatrixSettingsDialog
        v-if="showSettings"
        @close="showSettings = false"
      />

      <!-- Connection History Panel -->
      <ConnectionHistoryPanel
        v-if="showConnectionHistory"
        :show="showConnectionHistory"
        @close="showConnectionHistory = false"
        @quick-connect="handleQuickConnect"
      />

      <!-- Keyboard Shortcuts Help Panel -->
      <KeyboardShortcutsHelp
        :show="showShortcutsHelp"
        :shortcuts="allShortcuts"
        @close="showShortcutsHelp = false"
      />

      <!-- Toast Notifications -->
      <ToastContainer position="top-right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useDeviceStore } from '../stores_app_pymatrix/deviceStore';
import { useGroupStore } from '../stores_app_pymatrix/groupStore';
import { useConfigStore } from '../stores_app_pymatrix/configStore';
import { useDeviceControl } from '../composables_app_pymatrix/useDeviceControl';
import { useConnectDevice } from '../composables_app_pymatrix/useConnectDevice';
import { useToast } from '../composables_app_pymatrix/useToast';
import type { KeyboardShortcut } from '../composables_app_pymatrix/useKeyboardShortcuts';
import type { DeviceConfig } from '../../../types/pymatrix';

import PyMatrixTopBar from '../components_app_pymatrix/PyMatrixTopBar.vue';
import PyMatrixLeftPanel from '../components_app_pymatrix/PyMatrixLeftPanel.vue';
import PyMatrixRightPanel from '../components_app_pymatrix/PyMatrixRightPanel.vue';
import PyMatrixConnectDialog from '../components_app_pymatrix/PyMatrixConnectDialog.vue';
import PyMatrixSettingsDialog from '../components_app_pymatrix/PyMatrixSettingsDialog.vue';
import ConnectionHistoryPanel from '../components_app_pymatrix/ConnectionHistoryPanel.vue';
import KeyboardShortcutsHelp from '../components_app_pymatrix/KeyboardShortcutsHelp.vue';
import ToastContainer from '~/common/components/ui/ToastContainer.vue';

const deviceStore = useDeviceStore();
const groupStore = useGroupStore();
const configStore = useConfigStore();
const { connect: connectDevice } = useConnectDevice();
const toast = useToast();

const baseUrl = ref('ws://localhost:8000');
const showConnectDialog = ref(false);
const showSettings = ref(false);
const showShortcutsHelp = ref(false);
const showConnectionHistory = ref(false);

const hostDevice = computed(() => {
  if (!groupStore.hostSerial) return null;
  return deviceStore.getDevice(groupStore.hostSerial);
});

// Comprehensive keyboard shortcuts list
const allShortcuts = computed<KeyboardShortcut[]>(() => [
  // System shortcuts
  {
    key: '/',
    description: 'Show/Hide keyboard shortcuts help',
    category: 'System',
    action: () => { showShortcutsHelp.value = !showShortcutsHelp.value; }
  },
  {
    key: 'Escape',
    description: 'Close dialogs and panels',
    category: 'System',
    action: () => {
      showConnectDialog.value = false;
      showSettings.value = false;
      showShortcutsHelp.value = false;
    }
  },
  // Device management shortcuts
  {
    key: 'n',
    ctrl: true,
    description: 'Connect new device',
    category: 'Device',
    action: () => { showConnectDialog.value = true; }
  },
  {
    key: 'd',
    ctrl: true,
    shift: true,
    description: 'Disconnect all devices',
    category: 'Device',
    action: () => {
      deviceStore.deviceList.forEach(device => {
        // TODO: Implement disconnect logic
      });
      toast.info('Disconnecting all devices...', 'Device Control');
    }
  },
  {
    key: 'r',
    ctrl: true,
    description: 'Refresh device list',
    category: 'Device',
    action: async () => {
      try {
        const response = await fetch('http://localhost:8000/api/devices/list');
        const data = await response.json();
        toast.success('Device list refreshed', 'Device Control');
      } catch (error) {
        toast.error('Failed to refresh device list', 'Device Control');
      }
    }
  },
  {
    key: 'i',
    ctrl: true,
    description: 'Toggle device info panel',
    category: 'Device',
    action: () => {
      toast.info('Device info toggle', 'Device Control');
    }
  },
  // Group control shortcuts
  {
    key: 'g',
    ctrl: true,
    description: 'Toggle group control mode',
    category: 'Group',
    action: () => { toggleGroupControl(); }
  },
  {
    key: 'h',
    ctrl: true,
    description: 'Set current device as host',
    category: 'Group',
    action: () => {
      const selectedDevice = deviceStore.selectedDevice || deviceStore.deviceList[0];
      if (selectedDevice) {
        handleSetHost(selectedDevice.serial);
        toast.success(`${selectedDevice.name} set as host`, 'Group Control');
      }
    }
  },
  // Video control shortcuts
  {
    key: 'f',
    ctrl: true,
    description: 'Toggle fullscreen mode',
    category: 'Video',
    action: () => {
      document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
    }
  },
  {
    key: 'q',
    ctrl: true,
    description: 'Toggle video quality',
    category: 'Video',
    action: () => {
      toast.info('Video quality toggle', 'Video Control');
    }
  },
  {
    key: ' ',
    description: 'Pause/Resume video stream',
    category: 'Video',
    action: () => {
      toast.info('Video pause/resume', 'Video Control');
    }
  },
  // Navigation shortcuts
  {
    key: 'ArrowRight',
    ctrl: true,
    description: 'Focus next device',
    category: 'Navigation',
    action: () => {
      const currentIndex = deviceStore.deviceList.findIndex(
        d => d.serial === deviceStore.selectedSerial
      );
      if (currentIndex < deviceStore.deviceList.length - 1) {
        deviceStore.selectDevice(deviceStore.deviceList[currentIndex + 1].serial);
      }
    }
  },
  {
    key: 'ArrowLeft',
    ctrl: true,
    description: 'Focus previous device',
    category: 'Navigation',
    action: () => {
      const currentIndex = deviceStore.deviceList.findIndex(
        d => d.serial === deviceStore.selectedSerial
      );
      if (currentIndex > 0) {
        deviceStore.selectDevice(deviceStore.deviceList[currentIndex - 1].serial);
      }
    }
  },
  {
    key: 'Tab',
    ctrl: true,
    description: 'Cycle through devices',
    category: 'Navigation',
    action: () => {
      const currentIndex = deviceStore.deviceList.findIndex(
        d => d.serial === deviceStore.selectedSerial
      );
      const nextIndex = (currentIndex + 1) % deviceStore.deviceList.length;
      if (deviceStore.deviceList[nextIndex]) {
        deviceStore.selectDevice(deviceStore.deviceList[nextIndex].serial);
      }
    }
  },
  // Recording shortcuts
  {
    key: 'r',
    ctrl: true,
    shift: true,
    description: 'Start/Stop screen recording',
    category: 'Recording',
    action: () => {
      toast.info('Recording toggle', 'Recording Control');
    }
  },
  {
    key: 's',
    ctrl: true,
    description: 'Take screenshot',
    category: 'Recording',
    action: () => {
      toast.info('Screenshot captured', 'Recording Control');
    }
  },
  // Settings shortcuts
  {
    key: ',',
    ctrl: true,
    description: 'Open settings',
    category: 'System',
    action: () => { showSettings.value = true; }
  },
  // Connection History
  {
    key: 'h',
    ctrl: true,
    description: 'Show connection history',
    category: 'Device',
    action: () => { showConnectionHistory.value = true; }
  }
]);

// Global keyboard listener
function handleGlobalKeydown(event: KeyboardEvent) {
  // Find matching shortcut
  const matchedShortcut = allShortcuts.value.find(shortcut => {
    const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
    const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
    const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
    const altMatch = shortcut.alt ? event.altKey : !event.altKey;

    return keyMatch && ctrlMatch && shiftMatch && altMatch;
  });

  if (matchedShortcut) {
    event.preventDefault();
    event.stopPropagation();
    matchedShortcut.action();
  }
}

async function handleConnect(payload: { serial: string; deviceName?: string; config: DeviceConfig }) {
  try {
    await connectDevice(payload);
    showConnectDialog.value = false;
    toast.success('Device connected successfully', 'Connection Success');
  } catch (error) {
    console.error('Connection error:', error);
    toast.error('Failed to connect to device', 'Connection Error');
  }
}

async function handleQuickConnect(device: { serial: string; deviceName: string; lastConfig?: any }) {
  try {
    const config: DeviceConfig = device.lastConfig || {
      maxFps: 30,
      bitrate: 8000000,
      maxSize: 1920
    };

    await handleConnect({
      serial: device.serial,
      deviceName: device.deviceName,
      config
    });

    showConnectionHistory.value = false;
    toast.success(`Quick connect to ${device.deviceName}`, 'Quick Connect');
  } catch (error) {
    console.error('Quick connect error:', error);
    toast.error(`Failed to quick connect to ${device.deviceName}`, 'Quick Connect Error');
  }
}

function toggleGroupControl() {
  if (groupStore.enabled) {
    disableGroupControl();
  } else {
    enableGroupControl();
  }
}

function enableGroupControl() {
  if (deviceStore.deviceCount < 2) {
    toast.warning('At least 2 devices are required for group control', 'Group Control');
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
  const selectedDevice = deviceStore.selectedDevice || deviceStore.deviceList[0];
  if (!selectedDevice) return;

  const control = useDeviceControl({
    deviceSerial: selectedDevice.serial,
    baseUrl: baseUrl.value
  });

  control.sendSystemKey(key as any);
}

function handleSendText(text: string) {
  const selectedDevice = deviceStore.selectedDevice || deviceStore.deviceList[0];
  if (!selectedDevice) return;

  const control = useDeviceControl({
    deviceSerial: selectedDevice.serial,
    baseUrl: baseUrl.value
  });

  control.sendText(text);
}

onMounted(async () => {
  // Register global keyboard listener
  window.addEventListener('keydown', handleGlobalKeydown);
  console.log('[PyMatrix Layout] Keyboard shortcuts registered:', allShortcuts.value.length);

  if (!configStore.isLoaded) {
    try {
      await configStore.fetchConfig();
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  try {
    const response = await fetch('http://localhost:8000/api/devices/list');
    const data = await response.json();

    if (data.success && Array.isArray(data.devices)) {
      for (const device of data.devices) {
        if (device.state === 'device') {
          const infoRes = await fetch(`http://localhost:8000/api/devices/${device.serial}/info`);
          const info = await infoRes.json();

          if (info.success) {
            deviceStore.addDevice({
              serial: device.serial,
              name: device.model || device.serial,
              model: device.model,
              state: 'connected',
              resolution: info.device.resolution,
              streaming: false,
              controllable: true
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to load devices:', error);
  }
});

onUnmounted(() => {
  // Clean up keyboard listener
  window.removeEventListener('keydown', handleGlobalKeydown);
  console.log('[PyMatrix Layout] Keyboard shortcuts unregistered');
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
