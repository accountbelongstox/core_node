<template>
  <aside class="pymatrix-left-panel">
    <div class="panel-header">
      <h3 class="panel-title">Device List</h3>
      <span class="device-count">{{ devices.length }}</span>
    </div>

    <div class="panel-body">
      <div v-if="devices.length === 0" class="empty-message">
        <span class="empty-icon">📱</span>
        <p>No devices connected</p>
      </div>

      <div v-else class="device-list">
        <div
          v-for="device in devices"
          :key="device.serial"
          class="device-item"
          :class="{
            'is-selected': device.serial === selectedSerial,
            'is-host': device.serial === hostSerial
          }"
          @click="$emit('select-device', device.serial)"
        >
          <div class="device-info">
            <div class="device-name">{{ device.name }}</div>
            <div class="device-serial">{{ device.serial.substring(0, 12) }}</div>
            <div class="device-resolution">{{ device.resolution.width }}×{{ device.resolution.height }}</div>
          </div>

          <div v-if="groupEnabled" class="device-actions">
            <button
              v-if="device.serial !== hostSerial"
              class="action-btn small"
              @click.stop="$emit('set-host', device.serial)"
              title="Set as Host"
            >
              👑 Host
            </button>
            <button
              v-else
              class="action-btn small active"
              @click.stop="$emit('remove-from-group', device.serial)"
              title="Remove Host"
            >
              👑 HOST
            </button>
          </div>

          <div v-if="device.serial === hostSerial" class="host-badge">
            <span>★ HOST</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Device } from '../../../types/pymatrix';

interface Props {
  devices: Device[];
  selectedSerial: string | null;
  groupEnabled: boolean;
  hostSerial: string | null;
}

interface Emits {
  (e: 'select-device', serial: string): void;
  (e: 'set-host', serial: string): void;
  (e: 'remove-from-group', serial: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<style scoped>
.pymatrix-left-panel {
  width: 300px;
  background: #1a1a1a;
  border-right: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #2a2a2a;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.device-count {
  padding: 4px 12px;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-item {
  position: relative;
  padding: 12px;
  background: #2a2a2a;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.device-item:hover {
  background: #3a3a3a;
  border-color: #3b82f6;
}

.device-item.is-selected {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.device-item.is-host {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
}

.device-info {
  margin-bottom: 8px;
}

.device-name {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin-bottom: 4px;
}

.device-serial {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-family: monospace;
}

.device-resolution {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

.device-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.6);
}

.action-btn.active {
  background: rgba(139, 92, 246, 0.3);
  border-color: rgba(139, 92, 246, 0.6);
  animation: pulse 2s infinite;
}

.host-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  color: white;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
