<!--
  PYMATRIX APP - MAIN COMPONENT

  This is the main app component for PyMatrix namespace.
  All business logic and state management is contained here.

  Entry: pages/index.pymatrix.vue imports this component only.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useDeviceStore } from '~/apps/app_pymatrix/stores_app_pymatrix/deviceStore';
import { useGroupStore } from '~/apps/app_pymatrix/stores_app_pymatrix/groupStore';

import PyMatrixDeviceGrid from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixDeviceGrid.vue';
import PyMatrixEmptyState from '~/apps/app_pymatrix/components_app_pymatrix/PyMatrixEmptyState.vue';

// Page metadata
definePageMeta({
  layout: 'pymatrix'
});

useHead({
  title: 'pyMatrix - Device Control',
  meta: [
    { name: 'description', content: 'Android device mirroring and group control system' }
  ]
});

// Stores
const deviceStore = useDeviceStore();
const groupStore = useGroupStore();

// Computed
const baseUrl = computed(() => 'ws://localhost:8000');

// Handlers
async function handleDisconnect(serial: string) {
  try {
    const response = await fetch(`http://localhost:8000/api/devices/${serial}/disconnect`, {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      deviceStore.removeDevice(serial);

      if (groupStore.isHost(serial)) {
        if (groupStore.hostSerial) {
          deviceStore.updateDevice(groupStore.hostSerial, { isHost: false });
        }
        groupStore.destroyGroup();
      } else if (groupStore.isSlave(serial)) {
        groupStore.removeSlave(serial);
      }
    }
  } catch (error) {
    console.error('Disconnect error:', error);
  }
}
</script>

<template>
  <div class="pymatrix-content">
    <!-- Device Grid - only content, navigation is in layout -->
    <PyMatrixDeviceGrid
      v-if="deviceStore.deviceCount > 0"
      :devices="deviceStore.deviceList"
      :base-url="baseUrl"
      :group-enabled="groupStore.enabled"
      @disconnect="handleDisconnect"
    />

    <!-- Empty State - when no devices connected -->
    <PyMatrixEmptyState
      v-else
      @connect-device="() => {}"
    />
  </div>
</template>

<style scoped>
.pymatrix-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>
