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
import { ref, computed, onMounted } from 'vue';
import { useDeviceStore } from '~/apps/app_pymatrix/stores_app_pymatrix/deviceStore';
import { useGroupStore } from '~/apps/app_pymatrix/stores_app_pymatrix/groupStore';
import { useDeviceControl } from '~/apps/app_pymatrix/composables_app_pymatrix/useDeviceControl';
import type { Device } from '~/types/pymatrix';

import PyMatrixTopBar from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixTopBar.vue';
import PyMatrixLeftPanel from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixLeftPanel.vue';
import PyMatrixRightPanel from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixRightPanel.vue';
import PyMatrixConnectDialog from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixConnectDialog.vue';
import PyMatrixSettingsDialog from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixSettingsDialog.vue';

const deviceStore = useDeviceStore();
const groupStore = useGroupStore();

const baseUrl = ref('ws://localhost:8000');
const showConnectDialog = ref(false);
const showSettings = ref(false);

const hostDevice = computed(() => {
  if (!groupStore.hostSerial) return null;
  return deviceStore.getDevice(groupStore.hostSerial);
});

async function handleConnect(formData: any) {
  try {
    const response = await fetch(`http://localhost:8000/api/devices/${formData.serial}/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        max_size: formData.maxSize,
        bit_rate: formData.bitRate * 1000000,
        max_fps: formData.maxFps
      })
    });

    const data = await response.json();

    if (data.success) {
      const deviceInfoRes = await fetch(`http://localhost:8000/api/devices/${formData.serial}/info`);
      const deviceInfo = await deviceInfoRes.json();

      if (deviceInfo.success) {
        const device: Device = {
          serial: formData.serial,
          name: deviceInfo.device.model || `Device ${formData.serial.substring(0, 8)}`,
          model: deviceInfo.device.model,
          state: 'connected',
          resolution: deviceInfo.device.resolution,
          streaming: true,
          controllable: true
        };

        deviceStore.addDevice(device);
        showConnectDialog.value = false;
      }
    } else {
      alert(`Failed to connect: ${data.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Connection error:', error);
    alert('Failed to connect to device');
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
