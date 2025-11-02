<template>
  <div class="group-control-panel">
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
          class="action-btn primary full-width"
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
          class="action-btn secondary full-width"
          :disabled="!selectedSlave"
          @click="handleAddSlave"
        >
          Add to Group
        </button>

        <!-- Group Actions -->
        <div class="actions-section">
          <button
            v-if="!groupEnabled"
            class="action-btn success full-width"
            @click="handleEnableGroup"
          >
            Enable Group
          </button>
          <button
            v-else
            class="action-btn warning full-width"
            @click="handleDisableGroup"
          >
            Disable Group
          </button>
          <button
            class="action-btn danger full-width"
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
import type { Device, GroupState } from '../../../types/pymatrix';

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

<style scoped>
.group-control-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 400px;
  max-width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.status-section {
  background: #f9fafb;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 20px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.status-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.status-value {
  font-size: 13px;
  color: #374151;
  font-weight: 600;
}

.status-value.active {
  color: #10b981;
}

.control-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.form-input,
.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.device-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 8px;
}

.device-card.host {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-color: #fbbf24;
}

.device-card.slave {
  background: white;
}

.device-icon {
  font-size: 24px;
  line-height: 1;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-serial {
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.device-list {
  margin-bottom: 16px;
}

.empty-message {
  text-align: center;
  padding: 20px;
  color: #9ca3af;
  font-size: 13px;
}

.action-btn {
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
}

.action-btn.full-width {
  width: 100%;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  background: #3b82f6;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: #2563eb;
}

.action-btn.secondary {
  background: #6b7280;
  color: white;
}

.action-btn.secondary:hover:not(:disabled) {
  background: #4b5563;
}

.action-btn.success {
  background: #10b981;
  color: white;
}

.action-btn.success:hover {
  background: #059669;
}

.action-btn.warning {
  background: #f59e0b;
  color: white;
}

.action-btn.warning:hover {
  background: #d97706;
}

.action-btn.danger {
  background: #ef4444;
  color: white;
}

.action-btn.danger:hover {
  background: #dc2626;
}

.actions-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}
</style>
