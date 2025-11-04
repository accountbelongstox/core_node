<template>
  <div class="pm-panel pm-panel--golden">
    <div class="panel-header">
      <h3 class="panel-title">Group Control</h3>
      <button
        class="close-btn"
        @click="emit('close')"
        title="Close"
      >
        ×
      </button>
    </div>

    <div class="panel-body">
      <!-- Group Status -->
      <div class="status-section">
        <div class="status-row">
          <span class="status-label">Status:</span>
          <span class="status-value" :class="{ active: groupEnabled }">
            {{ groupEnabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
        <div v-if="groupState" class="status-row">
          <span class="status-label">Group ID:</span>
          <span class="status-value">{{ groupState.groupId }}</span>
        </div>
        <div v-if="groupState" class="status-row">
          <span class="status-label">Devices:</span>
          <span class="status-value">{{ groupState.totalDevices || 0 }}</span>
        </div>
      </div>

      <!-- Create Group Section -->
      <div v-if="!groupState" class="control-section">
        <h4 class="section-title">Create Group</h4>
        <div class="form-group">
          <label class="form-label">Group ID</label>
          <input
            v-model="newGroupId"
            type="text"
            class="form-input"
            placeholder="e.g., group-1"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Host Device</label>
          <select v-model="selectedHost" class="form-select">
            <option value="">Select host device...</option>
            <option
              v-for="device in availableDevices"
              :key="device.serial"
              :value="device.serial"
            >
              {{ device.name || device.serial }}
            </option>
          </select>
        </div>
        <button
          class="pm-button pm-button--rainbow full-width"
          :disabled="!newGroupId || !selectedHost"
          @click="handleCreateGroup"
        >
          Create Group
        </button>
      </div>

      <!-- Group Management Section -->
      <div v-else class="control-section">
        <h4 class="section-title">Host Device</h4>
        <div class="device-card host">
          <div class="device-icon">👑</div>
          <div class="device-info">
            <div class="device-name">{{ getDeviceName(groupState.hostSerial) }}</div>
            <div class="device-serial">{{ groupState.hostSerial }}</div>
          </div>
        </div>

        <h4 class="section-title">Slave Devices ({{ groupState.slaveSerials?.length || 0 }})</h4>

        <div v-if="groupState.slaveSerials && groupState.slaveSerials.length > 0" class="device-list">
          <div
            v-for="serial in groupState.slaveSerials"
            :key="serial"
            class="device-card slave"
          >
            <div class="device-icon">📱</div>
            <div class="device-info">
              <div class="device-name">{{ getDeviceName(serial) }}</div>
              <div class="device-serial">{{ serial }}</div>
            </div>
            <button
              class="remove-btn"
              @click="handleRemoveSlave(serial)"
              title="Remove from group"
            >
              ×
            </button>
          </div>
        </div>

        <div v-else class="empty-message">
          <p>No slave devices in group</p>
        </div>

        <!-- Add Slave Section -->
        <div class="form-group">
          <label class="form-label">Add Slave Device</label>
          <select v-model="selectedSlave" class="form-select">
            <option value="">Select device to add...</option>
            <option
              v-for="device in availableSlaveDevices"
              :key="device.serial"
              :value="device.serial"
            >
              {{ device.name || device.serial }}
            </option>
          </select>
        </div>
        <button
          class="pm-button pm-button--sunset full-width"
          :disabled="!selectedSlave"
          @click="handleAddSlave"
        >
          Add to Group
        </button>

        <!-- Group Actions -->
        <div class="actions-section">
          <button
            v-if="!groupEnabled"
            class="pm-button pm-button--rainbow full-width"
            @click="handleEnableGroup"
          >
            Enable Group
          </button>
          <button
            v-else
            class="pm-button pm-button--sunset full-width"
            @click="handleDisableGroup"
          >
            Disable Group
          </button>
          <button
            class="pm-button pm-button--violet full-width"
            @click="handleDeleteGroup"
          >
            Delete Group
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Device, GroupState } from '@/types/pymatrix';

interface Props {
  show?: boolean;
  devices?: Device[];
  groupState?: GroupState | null;
  groupEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  devices: () => [],
  groupState: null,
  groupEnabled: false
});

const emit = defineEmits<{
  close: [];
  createGroup: [groupId: string, hostSerial: string];
  addSlave: [groupId: string, slaveSerial: string];
  removeSlave: [groupId: string, slaveSerial: string];
  enableGroup: [groupId: string];
  disableGroup: [groupId: string];
  deleteGroup: [groupId: string];
}>();

const newGroupId = ref('');
const selectedHost = ref('');
const selectedSlave = ref('');

const availableDevices = computed(() => {
  return props.devices.filter(d => d.state === 'connected');
});

const availableSlaveDevices = computed(() => {
  if (!props.groupState) return [];

  const usedSerials = [
    props.groupState.hostSerial,
    ...(props.groupState.slaveSerials || [])
  ];

  return availableDevices.value.filter(d => !usedSerials.includes(d.serial));
});

function getDeviceName(serial: string): string {
  const device = props.devices.find(d => d.serial === serial);
  return device?.name || serial.substring(0, 12);
}

function handleCreateGroup() {
  if (newGroupId.value && selectedHost.value) {
    emit('createGroup', newGroupId.value, selectedHost.value);
    newGroupId.value = '';
    selectedHost.value = '';
  }
}

function handleAddSlave() {
  if (props.groupState && selectedSlave.value) {
    emit('addSlave', props.groupState.groupId, selectedSlave.value);
    selectedSlave.value = '';
  }
}

function handleRemoveSlave(serial: string) {
  if (props.groupState) {
    emit('removeSlave', props.groupState.groupId, serial);
  }
}

function handleEnableGroup() {
  if (props.groupState) {
    emit('enableGroup', props.groupState.groupId);
  }
}

function handleDisableGroup() {
  if (props.groupState) {
    emit('disableGroup', props.groupState.groupId);
  }
}

function handleDeleteGroup() {
  if (props.groupState && confirm('Are you sure you want to delete this group?')) {
    emit('deleteGroup', props.groupState.groupId);
  }
}
</script>
