<template>
  <div class="device-grid" :class="gridClass" :style="gridStyle">
    <div
      v-for="(device, index) in orderedDevices"
      :key="device.serial"
      class="device-item"
      :class="{
        'is-host': device.isHost,
        'is-selected': selectedSerial === device.serial,
        'is-dragging': draggedIndex === index,
        'is-drag-over': dragOverIndex === index,
        'drag-enabled': dragEnabled
      }"
      :draggable="dragEnabled"
      @dragstart="handleDragStart($event, index)"
      @dragend="handleDragEnd"
      @dragover.prevent="handleDragOver($event, index)"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop($event, index)"
    >
      <div v-if="dragEnabled" class="drag-handle" title="Drag to reorder">
        <span class="drag-icon">⋮⋮</span>
      </div>

      <VideoPlayer
        :device="device"
        :base-url="baseUrl"
        :enable-control="enableControl"
        @toggle-fullscreen="emit('toggle-fullscreen', $event)"
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
import { computed, ref, watch } from 'vue';
import { useUIPreferencesStore } from '../stores_app_pymatrix/uiPreferencesStore';
import VideoPlayer from './VideoPlayer.vue';
import type { Device } from '@/types/pymatrix';

interface Props {
  devices: Device[];
  selectedSerial?: string | null;
  baseUrl?: string;
  enableControl?: boolean;
  groupEnabled?: boolean;
  dragEnabled?: boolean;
}

interface Emits {
  (e: 'setHost', serial: string): void;
  (e: 'removeHost', serial: string): void;
  (e: 'disconnect', serial: string): void;
  (e: 'toggle-fullscreen', device: Device): void;
}

const props = withDefaults(defineProps<Props>(), {
  baseUrl: 'ws://localhost:8000',
  enableControl: true,
  groupEnabled: false,
  dragEnabled: false
});

const emit = defineEmits<Emits>();

const uiPreferencesStore = useUIPreferencesStore();

// Drag and drop state
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// Computed: Effective columns based on store preference or auto-detect
const effectiveColumns = computed(() =>
  uiPreferencesStore.getEffectiveColumns(props.devices.length)
);

// Computed: Grid class for legacy support
const gridClass = computed(() => {
  const cols = effectiveColumns.value;
  return `grid-cols-${cols}`;
});

// Computed: Grid style with dynamic columns
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${effectiveColumns.value}, 1fr)`
}));

// Computed: Ordered devices based on stored order
const orderedDevices = computed(() => {
  const devices = [...props.devices];
  const storedOrder = uiPreferencesStore.deviceOrder;

  // If no stored order or devices changed, return original order
  if (storedOrder.length === 0) {
    return devices;
  }

  // Sort devices according to stored order
  return devices.sort((a, b) => {
    const indexA = storedOrder.indexOf(a.serial);
    const indexB = storedOrder.indexOf(b.serial);

    // If both devices are in the stored order, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }

    // If only one device is in the stored order, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    // If neither device is in the stored order, maintain original order
    return 0;
  });
});

// Watch devices and sync with store order
watch(
  () => props.devices,
  (newDevices) => {
    const currentOrder = uiPreferencesStore.deviceOrder;
    const deviceSerials = newDevices.map(d => d.serial);

    // Remove disconnected devices from order
    const filteredOrder = currentOrder.filter(serial => deviceSerials.includes(serial));

    // Add new devices to order
    const newSerials = deviceSerials.filter(serial => !filteredOrder.includes(serial));
    const updatedOrder = [...filteredOrder, ...newSerials];

    // Update store if order changed
    if (JSON.stringify(currentOrder) !== JSON.stringify(updatedOrder)) {
      uiPreferencesStore.setDeviceOrder(updatedOrder);
    }
  },
  { immediate: true, deep: true }
);

// Drag and drop handlers
function handleDragStart(event: DragEvent, index: number) {
  if (!props.dragEnabled) return;

  draggedIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
  }
  console.log('[PyMatrixDeviceGrid] Drag started:', index);
}

function handleDragEnd() {
  draggedIndex.value = null;
  dragOverIndex.value = null;
  console.log('[PyMatrixDeviceGrid] Drag ended');
}

function handleDragOver(event: DragEvent, index: number) {
  if (!props.dragEnabled || draggedIndex.value === null) return;

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dragOverIndex.value = index;
}

function handleDragLeave() {
  dragOverIndex.value = null;
}

function handleDrop(event: DragEvent, toIndex: number) {
  if (!props.dragEnabled || draggedIndex.value === null) return;

  event.preventDefault();
  const fromIndex = draggedIndex.value;

  if (fromIndex !== toIndex) {
    // Get the serial numbers in the current order
    const currentSerials = orderedDevices.value.map(d => d.serial);

    // Reorder the serials
    const reorderedSerials = [...currentSerials];
    const [movedSerial] = reorderedSerials.splice(fromIndex, 1);
    reorderedSerials.splice(toIndex, 0, movedSerial);

    // Update store
    uiPreferencesStore.setDeviceOrder(reorderedSerials);

    console.log('[PyMatrixDeviceGrid] Device moved from', fromIndex, 'to', toIndex);
  }

  draggedIndex.value = null;
  dragOverIndex.value = null;
}
</script>

<style scoped>
.device-grid {
  display: grid;
  gap: 16px;
  padding: 16px;
  height: 100%;
  width: 100%;
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

/* Drag and Drop Styles */
.device-item.drag-enabled {
  cursor: grab;
}

.device-item.drag-enabled:active {
  cursor: grabbing;
}

.device-item.is-dragging {
  opacity: 0.5;
  border-color: #6366f1;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
  transform: scale(0.95);
}

.device-item.is-drag-over {
  border-color: #22c55e;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
  background: rgba(34, 197, 94, 0.05);
}

.drag-handle {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  cursor: grab;
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

.drag-handle:hover {
  background: rgba(0, 0, 0, 0.85);
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.1);
}

.drag-handle:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.drag-icon {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: -2px;
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
