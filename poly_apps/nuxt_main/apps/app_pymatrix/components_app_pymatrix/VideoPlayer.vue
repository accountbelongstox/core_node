<template>
  <div class="video-player-container" ref="containerRef">
    <video
      ref="videoElement"
      class="video-element"
      autoplay
      playsinline
      muted
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
    />

    <canvas ref="touchCanvas" class="touch-overlay" />

    <div class="video-overlay" v-if="showOverlay">
      <div class="video-info">
        <div class="info-item">
          <span class="info-label">Device:</span>
          <span class="info-value">{{ device?.name || device?.serial }}</span>
        </div>
        <div class="info-item" v-if="videoInfo">
          <span class="info-label">Resolution:</span>
          <span class="info-value">{{ videoInfo.width }}x{{ videoInfo.height }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">FPS:</span>
          <span class="info-value">{{ metrics.fps }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Latency:</span>
          <span class="info-value">{{ metrics.latency }}ms</span>
        </div>
      </div>

      <div class="connection-status" :class="{ connected: videoConnected && controlConnected }">
        <span class="status-dot"></span>
        <span>{{ videoConnected && controlConnected ? 'Connected' : 'Disconnected' }}</span>
      </div>

      <button class="info-toggle-btn" @click="toggleDeviceInfo" title="Toggle device info">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
        </svg>
      </button>
    </div>

    <div class="host-badge" v-if="device?.isHost">
      <span class="badge-icon">★</span>
      <span>HOST</span>
    </div>

    <VideoControlPanel
      :show="true"
      :metrics="metrics"
      :current-quality="currentQuality"
      @change-quality="handleQualityChange"
      @pause="handlePause"
      @resume="handleResume"
    />

    <DeviceInfoPanel
      :show="showDeviceInfo"
      :device-info="device"
      @close="showDeviceInfo = false"
      @refresh="handleRefreshDeviceInfo"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useVideoStream } from '../composables_app_pymatrix/useVideoStream';
import { useDeviceControl } from '../composables_app_pymatrix/useDeviceControl';
import { useGroupControl } from '../composables_app_pymatrix/useGroupControl';
import { useGroupStore } from '../stores_app_pymatrix/groupStore';
import { useDeviceStore } from '../stores_app_pymatrix/deviceStore';
import VideoControlPanel from './VideoControlPanel.vue';
import DeviceInfoPanel from './DeviceInfoPanel.vue';
import type { Device } from '~/types/pymatrix';

interface Props {
  device: Device;
  baseUrl?: string;
  showOverlay?: boolean;
  enableControl?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  baseUrl: 'ws://localhost:8000',
  showOverlay: true,
  enableControl: true
});

const containerRef = ref<HTMLDivElement | null>(null);
const touchCanvas = ref<HTMLCanvasElement | null>(null);
const isMouseDown = ref(false);
const currentQuality = ref<'high' | 'medium' | 'low'>('high');
const showDeviceInfo = ref(false);

const groupStore = useGroupStore();

const {
  videoElement,
  connected: videoConnected,
  metrics,
  videoInfo,
  connect: connectVideo,
  disconnect: disconnectVideo,
  changeQuality,
  pause: pauseVideo,
  resume: resumeVideo
} = useVideoStream({
  deviceSerial: props.device.serial,
  baseUrl: props.baseUrl
});

const {
  connected: controlConnected,
  connect: connectControl,
  disconnect: disconnectControl,
  sendTouch
} = useDeviceControl({
  deviceSerial: props.device.serial,
  baseUrl: props.baseUrl
});

const {
  connected: groupConnected,
  connect: connectGroup,
  broadcastTouch
} = useGroupControl({
  baseUrl: props.baseUrl
});

const isHost = computed(() => groupStore.isHost(props.device.serial));
const inGroup = computed(() => groupStore.hasGroup && (isHost.value || groupStore.isSlave(props.device.serial)));

function handleMouseDown(event: MouseEvent) {
  if (!props.enableControl || !videoElement.value) return;

  isMouseDown.value = true;
  const rect = videoElement.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  drawTouchPoint(x, y);

  if (isHost.value && groupStore.enabled) {
    broadcastTouch(props.device.serial, 'down', x, y, rect.width, rect.height);
  } else {
    sendTouch('down', x, y, rect.width, rect.height);
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!props.enableControl || !isMouseDown.value || !videoElement.value) return;

  const rect = videoElement.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  drawTouchPoint(x, y);

  if (isHost.value && groupStore.enabled) {
    broadcastTouch(props.device.serial, 'move', x, y, rect.width, rect.height);
  } else {
    sendTouch('move', x, y, rect.width, rect.height);
  }
}

function handleMouseUp(event: MouseEvent) {
  if (!props.enableControl || !videoElement.value) return;

  isMouseDown.value = false;
  const rect = videoElement.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  clearTouchPoints();

  if (isHost.value && groupStore.enabled) {
    broadcastTouch(props.device.serial, 'up', x, y, rect.width, rect.height);
  } else {
    sendTouch('up', x, y, rect.width, rect.height);
  }
}

function handleMouseLeave() {
  if (isMouseDown.value) {
    isMouseDown.value = false;
    clearTouchPoints();
  }
}

function drawTouchPoint(x: number, y: number) {
  if (!touchCanvas.value) return;

  const ctx = touchCanvas.value.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, touchCanvas.value.width, touchCanvas.value.height);

  ctx.beginPath();
  ctx.arc(x, y, 20, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(64, 158, 255, 0.3)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(64, 158, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function clearTouchPoints() {
  if (!touchCanvas.value) return;
  const ctx = touchCanvas.value.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, touchCanvas.value.width, touchCanvas.value.height);
  }
}

function updateCanvasSize() {
  if (touchCanvas.value && videoElement.value) {
    const rect = videoElement.value.getBoundingClientRect();
    touchCanvas.value.width = rect.width;
    touchCanvas.value.height = rect.height;
  }
}

function handleQualityChange(quality: 'high' | 'medium' | 'low') {
  currentQuality.value = quality;
  changeQuality(quality);
  console.log('[VideoPlayer] Quality changed to:', quality);
}

function handlePause() {
  pauseVideo();
  console.log('[VideoPlayer] Video paused');
}

function handleResume() {
  resumeVideo();
  console.log('[VideoPlayer] Video resumed');
}

function toggleDeviceInfo() {
  showDeviceInfo.value = !showDeviceInfo.value;
}

async function handleRefreshDeviceInfo() {
  // Call device info API to get detailed information
  console.log('[VideoPlayer] Refreshing device info for', props.device.serial);

  try {
    const { pyMatrixDeviceAPI } = await import('~/services/api/pymatrix/pymatrix-device-api');
    const response = await pyMatrixDeviceAPI.getDeviceInfo(props.device.serial);

    if (response.device) {
      // Update the device in store
      const deviceStore = useDeviceStore();
      deviceStore.updateDevice(props.device.serial, response.device);

      console.log('[VideoPlayer] Device info refreshed successfully');
    }
  } catch (error) {
    console.error('[VideoPlayer] Failed to refresh device info:', error);
  }
}

onMounted(() => {
  connectVideo();
  if (props.enableControl) {
    connectControl();
    connectGroup();
  }

  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);
});

onBeforeUnmount(() => {
  disconnectVideo();
  disconnectControl();
  window.removeEventListener('resize', updateCanvasSize);
});

watch(() => videoElement.value, () => {
  if (videoElement.value) {
    videoElement.value.addEventListener('loadedmetadata', updateCanvasSize);
  }
});
</script>

<style scoped>
.video-player-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
}

.touch-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 12px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, transparent 100%);
  z-index: 2;
}

.video-info {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  gap: 4px;
  font-size: 12px;
  color: white;
}

.info-label {
  font-weight: 600;
  opacity: 0.8;
}

.info-value {
  font-weight: 400;
}

.connection-status {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.9);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.connection-status.connected {
  background: rgba(34, 197, 94, 0.9);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  animation: pulse 2s infinite;
}

.host-badge {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  border-radius: 16px;
  font-size: 12px;
  font-weight: 700;
  color: white;
  z-index: 3;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.badge-icon {
  font-size: 14px;
  animation: star-glow 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes star-glow {
  0%, 100% {
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
  }
  50% {
    text-shadow: 0 0 20px rgba(255, 255, 255, 1);
  }
}

.info-toggle-btn {
  position: absolute;
  top: 12px;
  right: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 4;
}

.info-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
  color: white;
  transform: scale(1.05);
}

.info-toggle-btn:active {
  transform: scale(0.95);
}
</style>
