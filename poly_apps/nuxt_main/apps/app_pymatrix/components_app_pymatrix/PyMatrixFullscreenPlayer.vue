<template>
  <Teleport to="body">
    <Transition name="fullscreen-fade">
      <div
        v-if="isFullscreen"
        ref="fullscreenContainer"
        class="fullscreen-container"
        @mousemove="handleMouseMove"
        @keydown="handleKeyDown"
        tabindex="0"
      >
        <!-- Device Grid -->
        <div
          :class="[
            'device-grid',
            `grid-layout-${gridLayout}`
          ]"
        >
          <div
            v-for="device in displayDevices"
            :key="device.serial"
            class="device-cell"
          >
            <!-- Video Player Integration -->
            <div class="video-wrapper">
              <VideoPlayer
                :device="device"
                :fullscreen-mode="true"
                @toggle-fullscreen="exitFullscreen"
              />
            </div>

            <!-- Device Label -->
            <div class="device-label">
              <span class="device-name">{{ device.name }}</span>
              <span class="device-serial">{{ device.serial }}</span>
            </div>

            <!-- Performance Stats (Optional) -->
            <div v-if="showStats" class="performance-stats">
              <div class="stat-item">
                <span class="stat-label">FPS:</span>
                <span class="stat-value">60</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Delay:</span>
                <span class="stat-value">45ms</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Control Bar (Hover-activated) -->
        <Transition name="control-slide">
          <div v-show="showControls" class="control-bar">
            <!-- Left Controls -->
            <div class="control-group control-left">
              <button
                class="control-btn"
                @click="exitFullscreen"
                title="Exit Fullscreen (Esc)"
              >
                <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Exit</span>
              </button>

              <button
                v-if="canSwitchDevice"
                class="control-btn"
                @click="previousDevice"
                title="Previous Device (←)"
              >
                <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>

              <button
                v-if="canSwitchDevice"
                class="control-btn"
                @click="nextDevice"
                title="Next Device (→)"
              >
                <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <!-- Center Controls -->
            <div class="control-group control-center">
              <div class="layout-selector">
                <button
                  :class="['layout-btn', { active: gridLayout === '1x1' }]"
                  @click="setGridLayout('1x1')"
                  title="Single Device"
                >
                  <svg class="layout-icon" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                </button>

                <button
                  :class="['layout-btn', { active: gridLayout === '2x1' }]"
                  @click="setGridLayout('2x1')"
                  title="2 Devices (Side by Side)"
                  :disabled="availableDevicesCount < 2"
                >
                  <svg class="layout-icon" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2" y="3" width="9" height="18" rx="2" />
                    <rect x="13" y="3" width="9" height="18" rx="2" />
                  </svg>
                </button>

                <button
                  :class="['layout-btn', { active: gridLayout === '2x2' }]"
                  @click="setGridLayout('2x2')"
                  title="4 Devices (2x2 Grid)"
                  :disabled="availableDevicesCount < 3"
                >
                  <svg class="layout-icon" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2" y="2" width="9" height="9" rx="1" />
                    <rect x="13" y="2" width="9" height="9" rx="1" />
                    <rect x="2" y="13" width="9" height="9" rx="1" />
                    <rect x="13" y="13" width="9" height="9" rx="1" />
                  </svg>
                </button>
              </div>

              <div class="device-info">
                <span v-if="displayDevices.length === 1" class="info-text">
                  {{ displayDevices[0].name }} ({{ displayDevices[0].serial }})
                </span>
                <span v-else class="info-text">
                  {{ displayDevices.length }} devices
                </span>
              </div>
            </div>

            <!-- Right Controls -->
            <div class="control-group control-right">
              <button
                class="control-btn"
                @click="toggleStats"
                :title="showStats ? 'Hide Stats' : 'Show Stats'"
              >
                <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Stats</span>
              </button>

              <button
                class="control-btn"
                @click="toggleHelp"
                title="Show Keyboard Shortcuts"
              >
                <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Help</span>
              </button>
            </div>
          </div>
        </Transition>

        <!-- Keyboard Shortcuts Help (Overlay) -->
        <Transition name="help-fade">
          <div v-if="showHelpOverlay" class="help-overlay" @click="toggleHelp">
            <div class="help-panel" @click.stop>
              <div class="help-header">
                <h3>Keyboard Shortcuts</h3>
                <button class="help-close" @click="toggleHelp">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="help-content">
                <div class="shortcut-item">
                  <kbd>Esc</kbd>
                  <span>Exit fullscreen</span>
                </div>
                <div class="shortcut-item">
                  <kbd>F</kbd>
                  <span>Toggle fullscreen</span>
                </div>
                <div class="shortcut-item">
                  <kbd>←</kbd>
                  <span>Previous device</span>
                </div>
                <div class="shortcut-item">
                  <kbd>→</kbd>
                  <span>Next device</span>
                </div>
                <div class="shortcut-item">
                  <kbd>1</kbd>
                  <span>Single device layout</span>
                </div>
                <div class="shortcut-item">
                  <kbd>2</kbd>
                  <span>2-device layout</span>
                </div>
                <div class="shortcut-item">
                  <kbd>4</kbd>
                  <span>4-device layout</span>
                </div>
                <div class="shortcut-item">
                  <kbd>S</kbd>
                  <span>Toggle stats</span>
                </div>
                <div class="shortcut-item">
                  <kbd>?</kbd>
                  <span>Show this help</span>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { Device } from '~/types/pymatrix';
import VideoPlayer from './VideoPlayer.vue';

interface Props {
  /**
   * Device(s) to display in fullscreen
   * Single device or array of devices
   */
  devices: Device | Device[];

  /**
   * All available devices for switching
   */
  availableDevices?: Device[];

  /**
   * Initial grid layout
   */
  initialLayout?: '1x1' | '2x1' | '2x2';

  /**
   * Show performance stats
   */
  initialShowStats?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  availableDevices: () => [],
  initialLayout: '1x1',
  initialShowStats: false
});

const emit = defineEmits<{
  close: [];
  'layout-change': [layout: '1x1' | '2x1' | '2x2'];
  'device-change': [device: Device];
}>();

// State
const fullscreenContainer = ref<HTMLElement | null>(null);
const isFullscreen = ref(false);
const showControls = ref(true);
const showStats = ref(props.initialShowStats);
const showHelpOverlay = ref(false);
const gridLayout = ref<'1x1' | '2x1' | '2x2'>(props.initialLayout);
const currentDeviceIndex = ref(0);

let controlsTimer: NodeJS.Timeout | null = null;

// Computed
const devicesArray = computed(() => {
  return Array.isArray(props.devices) ? props.devices : [props.devices];
});

const availableDevicesCount = computed(() => {
  return props.availableDevices.length || devicesArray.value.length;
});

const displayDevices = computed(() => {
  if (gridLayout.value === '1x1') {
    // Single device mode
    return [devicesArray.value[currentDeviceIndex.value] || devicesArray.value[0]];
  } else if (gridLayout.value === '2x1') {
    // 2 devices side by side
    return devicesArray.value.slice(0, 2);
  } else {
    // 2x2 grid - 4 devices
    return devicesArray.value.slice(0, 4);
  }
});

const canSwitchDevice = computed(() => {
  return gridLayout.value === '1x1' && devicesArray.value.length > 1;
});

// Methods
function enterFullscreen() {
  isFullscreen.value = true;

  // Request fullscreen API
  if (fullscreenContainer.value) {
    if (fullscreenContainer.value.requestFullscreen) {
      fullscreenContainer.value.requestFullscreen();
    }
  }

  // Focus container for keyboard events
  fullscreenContainer.value?.focus();

  console.log('[PyMatrixFullscreenPlayer] Entered fullscreen mode');
}

function exitFullscreen() {
  isFullscreen.value = false;

  // Exit fullscreen API
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }

  emit('close');

  console.log('[PyMatrixFullscreenPlayer] Exited fullscreen mode');
}

function setGridLayout(layout: '1x1' | '2x1' | '2x2') {
  const requiredDevices = layout === '1x1' ? 1 : layout === '2x1' ? 2 : 4;

  if (devicesArray.value.length < requiredDevices) {
    console.warn(`[PyMatrixFullscreenPlayer] Not enough devices for ${layout} layout`);
    return;
  }

  gridLayout.value = layout;
  emit('layout-change', layout);

  console.log('[PyMatrixFullscreenPlayer] Changed layout to', layout);
}

function nextDevice() {
  if (!canSwitchDevice.value) return;

  currentDeviceIndex.value = (currentDeviceIndex.value + 1) % devicesArray.value.length;
  emit('device-change', devicesArray.value[currentDeviceIndex.value]);

  console.log('[PyMatrixFullscreenPlayer] Switched to next device');
}

function previousDevice() {
  if (!canSwitchDevice.value) return;

  currentDeviceIndex.value = currentDeviceIndex.value === 0
    ? devicesArray.value.length - 1
    : currentDeviceIndex.value - 1;
  emit('device-change', devicesArray.value[currentDeviceIndex.value]);

  console.log('[PyMatrixFullscreenPlayer] Switched to previous device');
}

function toggleStats() {
  showStats.value = !showStats.value;
}

function toggleHelp() {
  showHelpOverlay.value = !showHelpOverlay.value;
}

function handleMouseMove() {
  // Show controls on mouse move
  showControls.value = true;

  // Hide controls after 3 seconds of inactivity
  if (controlsTimer) {
    clearTimeout(controlsTimer);
  }

  controlsTimer = setTimeout(() => {
    showControls.value = false;
  }, 3000);
}

function handleKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      exitFullscreen();
      break;
    case 'f':
    case 'F':
      exitFullscreen();
      break;
    case 'ArrowLeft':
      previousDevice();
      break;
    case 'ArrowRight':
      nextDevice();
      break;
    case '1':
      setGridLayout('1x1');
      break;
    case '2':
      setGridLayout('2x1');
      break;
    case '4':
      setGridLayout('2x2');
      break;
    case 's':
    case 'S':
      toggleStats();
      break;
    case '?':
      toggleHelp();
      break;
  }
}

// Handle native fullscreen change
function handleFullscreenChange() {
  if (!document.fullscreenElement && isFullscreen.value) {
    exitFullscreen();
  }
}

// Lifecycle
onMounted(() => {
  enterFullscreen();
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  if (controlsTimer) {
    clearTimeout(controlsTimer);
  }
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
});

// Watch for device changes
watch(() => props.devices, () => {
  currentDeviceIndex.value = 0;
});

// Expose methods for parent component
defineExpose({
  enterFullscreen,
  exitFullscreen,
  setGridLayout
});
</script>

<style scoped>
.fullscreen-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #000;
  z-index: 10000;
  overflow: hidden;
  outline: none;
}

/* Device Grid Layouts */
.device-grid {
  width: 100%;
  height: 100%;
  display: grid;
  gap: 2px;
  background: #000;
}

.grid-layout-1x1 {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.grid-layout-2x1 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: 1fr;
}

.grid-layout-2x2 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.device-cell {
  position: relative;
  background: #111;
  overflow: hidden;
}

.video-wrapper {
  width: 100%;
  height: 100%;
}

/* Device Label */
.device-label {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  padding: 8px 12px;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
}

.device-name {
  font-size: 14px;
  font-weight: 600;
}

.device-serial {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

/* Performance Stats */
.performance-stats {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  gap: 16px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: white;
  font-weight: 500;
  pointer-events: none;
}

.stat-item {
  display: flex;
  gap: 6px;
}

.stat-label {
  color: rgba(255, 255, 255, 0.6);
}

.stat-value {
  color: #10b981;
  font-weight: 600;
}

/* Control Bar */
.control-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-left {
  flex-shrink: 0;
}

.control-center {
  flex: 1;
  justify-content: center;
  gap: 24px;
}

.control-right {
  flex-shrink: 0;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.control-btn:active {
  transform: translateY(0);
}

.control-icon {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

/* Layout Selector */
.layout-selector {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
}

.layout-btn {
  padding: 8px;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}

.layout-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.layout-btn.active {
  background: rgba(59, 130, 246, 0.3);
  border-color: #3b82f6;
  color: white;
}

.layout-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.layout-icon {
  width: 24px;
  height: 24px;
  display: block;
}

/* Device Info */
.device-info {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.info-text {
  color: white;
  font-size: 14px;
  font-weight: 500;
}

/* Help Overlay */
.help-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
}

.help-panel {
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.help-header h3 {
  color: white;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.help-close {
  padding: 6px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: color 0.2s;
}

.help-close:hover {
  color: white;
}

.help-close svg {
  width: 24px;
  height: 24px;
  display: block;
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.shortcut-item kbd {
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
}

.shortcut-item span {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

/* Transitions */
.fullscreen-fade-enter-active,
.fullscreen-fade-leave-active {
  transition: opacity 0.3s;
}

.fullscreen-fade-enter-from,
.fullscreen-fade-leave-to {
  opacity: 0;
}

.control-slide-enter-active,
.control-slide-leave-active {
  transition: transform 0.3s, opacity 0.3s;
}

.control-slide-enter-from,
.control-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.help-fade-enter-active,
.help-fade-leave-active {
  transition: opacity 0.3s;
}

.help-fade-enter-from,
.help-fade-leave-to {
  opacity: 0;
}

.help-fade-enter-active .help-panel,
.help-fade-leave-active .help-panel {
  transition: transform 0.3s;
}

.help-fade-enter-from .help-panel,
.help-fade-leave-to .help-panel {
  transform: scale(0.95);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .fullscreen-container {
    background: #000;
  }
}
</style>
