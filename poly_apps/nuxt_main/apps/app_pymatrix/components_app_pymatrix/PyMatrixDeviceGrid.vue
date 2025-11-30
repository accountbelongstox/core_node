<template>
  <div class="pm-device-grid" :class="gridClass" :style="gridStyle">
    <div
      v-for="(device, index) in orderedDevices"
      :key="device.serial"
      class="pm-grid-item"
      :class="{
        'pm-grid-item--host': device.isHost,
        'pm-grid-item--selected': selectedSerial === device.serial,
        'pm-grid-item--dragging': draggedIndex === index,
        'pm-grid-item--drag-over': dragOverIndex === index,
        'pm-grid-item--drag-enabled': dragEnabled
      }"
      :draggable="dragEnabled"
      @dragstart="handleDragStart($event, index)"
      @dragend="handleDragEnd"
      @dragover.prevent="handleDragOver($event, index)"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop($event, index)"
    >
      <div v-if="dragEnabled" class="pm-drag-handle" title="Drag to reorder">
        <span class="pm-drag-icon">⋮⋮</span>
      </div>

      <VideoPlayer
        :device="device"
        :base-url="baseUrl"
        :enable-control="enableControl"
        @toggle-fullscreen="emit('toggle-fullscreen', $event)"
      />

      <div class="pm-device-actions">
        <button
          v-if="!device.isHost && groupEnabled"
          class="pm-action-btn pm-action-btn--primary"
          @click="emit('setHost', device.serial)"
        >
          Set as Host
        </button>
        <button
          v-if="device.isHost && groupEnabled"
          class="pm-action-btn pm-action-btn--danger"
          @click="emit('removeHost', device.serial)"
        >
          Remove Host
        </button>
        <button
          class="pm-action-btn"
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
/* DeviceGrid Styles with NFTMax Theme */
.pm-device-grid {
  display: grid;
  gap: var(--pm-space-lg);
  padding: var(--pm-space-lg);
  width: 100%;
  height: 100%;
  overflow-y: auto;
  animation: pm-fadeIn 0.5s ease;
}

/* Grid Item */
.pm-grid-item {
  position: relative;
  background: var(--pm-color-surface);
  border-radius: var(--pm-radius-lg);
  overflow: hidden;
  box-shadow: var(--pm-shadow-sm);
  transition: var(--pm-transition-fast);
  animation: pm-scaleUp 0.3s ease;
  display: flex;
  flex-direction: column;
}

.pm-grid-item:hover {
  box-shadow: var(--pm-shadow-md);
  transform: translateY(-4px);
}

/* Drag Handle */
.pm-drag-handle {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 100;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: grab;
  opacity: 0;
  transition: var(--pm-transition-fast);
}

.pm-grid-item:hover .pm-drag-handle {
  opacity: 1;
}

.pm-drag-handle:active {
  cursor: grabbing;
}

.pm-drag-icon {
  font-size: 16px;
  color: var(--pm-text-muted);
  font-weight: bold;
  letter-spacing: -2px;
}

/* Drag States */
.pm-grid-item--drag-enabled {
  cursor: move;
}

.pm-grid-item--dragging {
  opacity: 0.5;
  transform: scale(0.95);
  box-shadow: var(--pm-shadow-lg);
}

.pm-grid-item--drag-over {
  border: 2px dashed var(--pm-color-primary);
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.05) 0%, rgba(243, 57, 248, 0.05) 100%);
}

/* Host Device */
.pm-grid-item--host {
  border: 2px solid transparent;
  background-clip: padding-box;
  position: relative;
}

.pm-grid-item--host::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: var(--pm-gradient-main);
  border-radius: var(--pm-radius-lg);
  z-index: -1;
  opacity: 0.8;
  animation: pm-pulse 2s ease-in-out infinite;
}

.pm-grid-item--host::after {
  content: '★ HOST';
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 16px;
  background: var(--pm-gradient-main);
  color: #ffffff;
  font-size: var(--pm-font-size-xs);
  font-weight: 700;
  border-radius: var(--pm-radius-pill);
  box-shadow: 0 2px 8px rgba(243, 57, 248, 0.4);
  z-index: 100;
  letter-spacing: 0.5px;
}

/* Selected Device */
.pm-grid-item--selected {
  border: 2px solid var(--pm-color-primary);
  box-shadow: 0 0 0 3px rgba(83, 86, 251, 0.15);
}

/* Device Actions */
.pm-device-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  opacity: 0;
  transform: translateY(10px);
  transition: var(--pm-transition-fast);
  z-index: 50;
}

.pm-grid-item:hover .pm-device-actions {
  opacity: 1;
  transform: translateY(0);
}

.pm-action-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: var(--pm-font-size-xs);
  font-weight: 600;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--pm-radius-pill);
  cursor: pointer;
  transition: var(--pm-transition-fast);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.pm-action-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: #ffffff;
  opacity: 0;
  transition: var(--pm-transition-fast);
}

.pm-action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.pm-action-btn:hover::before {
  opacity: 0.2;
}

/* Primary Action Button */
.pm-action-btn--primary {
  background: var(--pm-gradient-main);
  border-color: transparent;
}

.pm-action-btn--primary::before {
  background: linear-gradient(135deg, #ec4899 0%, #a855f7 45%, #7c5cff 95%);
  opacity: 1;
}

.pm-action-btn--primary:hover {
  box-shadow: 0 4px 16px rgba(243, 57, 248, 0.5);
}

/* Danger Action Button */
.pm-action-btn--danger {
  background: var(--pm-color-danger);
  border-color: transparent;
}

.pm-action-btn--danger::before {
  background: linear-gradient(135deg, #EB5757 0%, #E74C3C 100%);
  opacity: 1;
}

.pm-action-btn--danger:hover {
  box-shadow: 0 4px 16px rgba(235, 87, 87, 0.5);
}

/* Animations */
@keyframes pm-fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pm-scaleUp {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pm-pulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

/* Scrollbar Styling */
.pm-device-grid::-webkit-scrollbar {
  width: 8px;
}

.pm-device-grid::-webkit-scrollbar-track {
  background: var(--pm-color-surface);
  border-radius: 10px;
}

.pm-device-grid::-webkit-scrollbar-thumb {
  background: var(--pm-color-border-soft);
  border-radius: 10px;
  transition: var(--pm-transition-fast);
}

.pm-device-grid::-webkit-scrollbar-thumb:hover {
  background: var(--pm-color-primary);
}

/* Responsive Grid */
@media (max-width: 1920px) {
  .pm-device-grid {
    gap: var(--pm-space-md);
    padding: var(--pm-space-md);
  }
}

@media (max-width: 1278px) {
  .pm-device-grid {
    gap: 16px;
    padding: 16px;
  }

  .pm-grid-item {
    min-height: 300px;
  }

  .pm-action-btn {
    font-size: 10px;
    padding: 6px 12px;
  }

  .pm-drag-handle {
    width: 28px;
    height: 28px;
    top: 8px;
    left: 8px;
  }
}

@media (max-width: 767px) {
  .pm-device-grid {
    gap: 12px;
    padding: 12px;
    grid-template-columns: 1fr !important;
  }

  .pm-grid-item {
    min-height: 250px;
  }

  .pm-device-actions {
    position: static;
    opacity: 1;
    transform: none;
    background: var(--pm-color-surface);
    border-top: 1px solid var(--pm-color-border-soft);
  }

  .pm-action-btn {
    font-size: var(--pm-font-size-xs);
    padding: 8px 12px;
  }
}
</style>
