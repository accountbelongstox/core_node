<template>
  <div class="device-grid" :class="gridClass">
    <div
      v-for="device in devices"
      :key="device.serial"
      class="device-item"
      :class="{
        'is-host': device.isHost,
        'is-selected': selectedSerial === device.serial
      }"
    >
      <VideoPlayer
        :device="device"
        :base-url="baseUrl"
        :enable-control="enableControl"
      />

      <div class="device-actions">
        <button
          v-if="!device.isHost && groupEnabled"
          class="action-btn primary"
          @click="emit('setHost', device.serial)"
        >
          Set as Host
        </button>
        <button
          v-if="device.isHost && groupEnabled"
          class="action-btn danger"
          @click="emit('removeHost', device.serial)"
        >
          Remove Host
        </button>
        <button
          class="action-btn"
          @click="emit('disconnect', device.serial)"
        >
          Disconnect
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VideoPlayer from './VideoPlayer.vue';
import type { Device } from '~/types/pymatrix';

interface Props {
  devices: Device[];
  selectedSerial?: string | null;
  baseUrl?: string;
  enableControl?: boolean;
  groupEnabled?: boolean;
}

interface Emits {
  (e: 'setHost', serial: string): void;
  (e: 'removeHost', serial: string): void;
  (e: 'disconnect', serial: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  baseUrl: 'ws://localhost:8000',
  enableControl: true,
  groupEnabled: false
});

const emit = defineEmits<Emits>();

const gridClass = computed(() => {
  const count = props.devices.length;
  if (count <= 1) return 'grid-1';
  if (count <= 4) return 'grid-2x2';
  if (count <= 9) return 'grid-3x3';
  if (count <= 16) return 'grid-4x4';
  return 'grid-5x5';
});
</script>

<style scoped>
.device-grid {
  display: grid;
  gap: 16px;
  padding: 16px;
  height: 100%;
  width: 100%;
}

.grid-1 {
  grid-template-columns: 1fr;
}

.grid-2x2 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.grid-3x3 {
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
}

.grid-4x4 {
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
}

.grid-5x5 {
  grid-template-columns: repeat(5, 1fr);
  grid-auto-rows: 1fr;
}

.device-item {
  position: relative;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.device-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.device-item.is-host {
  border-color: #8b5cf6;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
}

.device-item.is-selected {
  border-color: #10b981;
}

.device-actions {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 10;
}

.device-item:hover .device-actions {
  opacity: 1;
}

.action-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
}

.action-btn.primary {
  background: rgba(59, 130, 246, 0.9);
  border-color: rgba(59, 130, 246, 1);
}

.action-btn.primary:hover {
  background: rgba(59, 130, 246, 1);
}

.action-btn.danger {
  background: rgba(239, 68, 68, 0.9);
  border-color: rgba(239, 68, 68, 1);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 1);
}
</style>
