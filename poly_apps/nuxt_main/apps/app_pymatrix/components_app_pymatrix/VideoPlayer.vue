<template>
  <div
    class="video-player-container"
    ref="containerRef"
    @contextmenu="handleContextMenu"
  >
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

    <div class="group-role-badge">
      <GroupRoleIndicator
        :device-serial="device.serial"
        :role="deviceRole"
        size="md"
        :show-label="true"
      />
    </div>

    <div v-if="deviceTags.length > 0" class="device-tags-display">
      <DeviceTagBadge
        v-for="tag in deviceTags"
        :key="tag.id"
        :label="tag.name"
        :color="tag.color"
        size="xs"
      />
    </div>

    <RecordingControlPanel
      :device-serial="device.serial"
      :show="true"
    />

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

    <button
      v-if="!fullscreenMode"
      class="fullscreen-toggle-btn"
      @click="$emit('toggle-fullscreen', device)"
      title="Fullscreen (F)"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
      </svg>
    </button>

    <button
      class="system-key-toggle-btn"
      @click="showSystemKeys = !showSystemKeys"
      title="System Keys"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
        <path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
      </svg>
    </button>

    <div v-if="showSystemKeys" class="system-key-panel-overlay">
      <SystemKeyPanel
        :show="showSystemKeys"
        @close="showSystemKeys = false"
        @key-press="handleSystemKeyPress"
      />
    </div>

    <button
      class="clipboard-toggle-btn"
      @click="showClipboard = !showClipboard"
      title="Clipboard Sync"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
        <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
      </svg>
    </button>

    <div v-if="showClipboard" class="clipboard-panel-overlay">
      <ClipboardSyncPanel
        :show="showClipboard"
        :device-serial="device.serial"
        @close="showClipboard = false"
      />
    </div>

    <button
      class="screen-control-toggle-btn"
      @click="showScreenControl = !showScreenControl"
      title="Screen Control"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13zm13 1a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h13z"/>
        <path d="M3 5.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm9 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zM8 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
      </svg>
    </button>

    <button
      class="file-push-toggle-btn"
      @click="showFilePush = !showFilePush"
      title="Push File"
    >
      📁
    </button>

    <button
      class="apk-install-toggle-btn"
      @click="showApkInstall = !showApkInstall"
      title="Install APK"
    >
      📦
    </button>

    <div v-if="showScreenControl" class="screen-control-panel-overlay">
      <ScreenControlPanel
        :show="showScreenControl"
        :device-serial="device.serial"
        @close="showScreenControl = false"
      />
    </div>

    <div v-if="showFilePush" class="file-push-panel-overlay">
      <FilePushPanel
        :show="showFilePush"
        :device-serial="device.serial"
        @close="showFilePush = false"
        @success="handleFilePushSuccess"
      />
    </div>

    <div v-if="showApkInstall" class="apk-install-panel-overlay">
      <ApkInstallPanel
        :show="showApkInstall"
        :device-serial="device.serial"
        @close="showApkInstall = false"
        @success="handleApkInstallSuccess"
      />
    </div>

    <DeviceContextMenu
      :show="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :device-serial="device.serial"
      @close="showContextMenu = false"
      @action="handleContextMenuAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useVideoStream } from '../composables_app_pymatrix/useVideoStream';
import { useDeviceControl } from '../composables_app_pymatrix/useDeviceControl';
import { useGroupControl } from '../composables_app_pymatrix/useGroupControl';
import { useDeviceRole } from '../composables_app_pymatrix/useDeviceRole';
import { useGroupStore } from '../stores_app_pymatrix/groupStore';
import { useDeviceStore } from '../stores_app_pymatrix/deviceStore';
import { useScriptRecorder } from '../composables_app_pymatrix/useScriptRecorder';
import VideoControlPanel from './VideoControlPanel.vue';
import DeviceInfoPanel from './DeviceInfoPanel.vue';
import SystemKeyPanel from './SystemKeyPanel.vue';
import GroupRoleIndicator from './GroupRoleIndicator.vue';
import RecordingControlPanel from './RecordingControlPanel.vue';
import ClipboardSyncPanel from './ClipboardSyncPanel.vue';
import ScreenControlPanel from './ScreenControlPanel.vue';
import FilePushPanel from './FilePushPanel.vue';
import ApkInstallPanel from './ApkInstallPanel.vue';
import DeviceContextMenu from './DeviceContextMenu.vue';
import DeviceTagBadge from '../../../common/components/ui/DeviceTagBadge.vue';
import { useTagsStore } from '../stores_app_pymatrix/tagsStore';
import { useToast } from '../composables_app_pymatrix/useToast';
import type { Device } from '../../../types/pymatrix';

interface Props {
  device: Device;
  baseUrl?: string;
  showOverlay?: boolean;
  enableControl?: boolean;
  fullscreenMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  baseUrl: 'ws://localhost:8000',
  showOverlay: true,
  enableControl: true,
  fullscreenMode: false
});

defineEmits<{
  'toggle-fullscreen': [device: Device];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const touchCanvas = ref<HTMLCanvasElement | null>(null);
const isMouseDown = ref(false);
const currentQuality = ref<'high' | 'medium' | 'low'>('high');
const showDeviceInfo = ref(false);
const showSystemKeys = ref(false);
const showClipboard = ref(false);
const showScreenControl = ref(false);
const showFilePush = ref(false);
const showApkInstall = ref(false);
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

const groupStore = useGroupStore();
const deviceStore = useDeviceStore();
const tagsStore = useTagsStore();
const toast = useToast();
const recorder = useScriptRecorder();

const { role: deviceRole, isHost } = useDeviceRole(props.device.serial);

// Check if recording is active for this device
const isRecordingThisDevice = computed(() =>
  recorder.isRecording.value &&
  recorder.recordingDeviceSerial.value === props.device.serial
);

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
  sendTouch,
  sendSystemKey
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

const inGroup = computed(() => groupStore.hasGroup && (isHost.value || groupStore.isSlave(props.device.serial)));

/**
 * Get device tags
 */
const deviceTags = computed(() => {
  const tagIds = deviceStore.getDeviceTagIds(props.device.serial);
  return tagsStore.getTagsByIds(tagIds);
});

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

  // Record touch if recording is active for this device
  if (isRecordingThisDevice.value) {
    // Store the start position for tap recording
    (event.target as any)._recordStartX = x;
    (event.target as any)._recordStartY = y;
    (event.target as any)._recordStartTime = Date.now();
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

  // Record touch action if recording is active
  if (isRecordingThisDevice.value && event.target) {
    const target = event.target as any;
    const startX = target._recordStartX;
    const startY = target._recordStartY;
    const startTime = target._recordStartTime;

    if (startX !== undefined && startY !== undefined && startTime !== undefined) {
      const duration = Date.now() - startTime;
      const distance = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));

      // Determine action type based on duration and distance
      if (distance > 20) {
        // It's a swipe
        recorder.recordSwipe(startX, startY, x, y, duration);
      } else if (duration > 800) {
        // It's a long press
        recorder.recordTouch('long_press', startX, startY, duration);
      } else {
        // It's a tap
        recorder.recordTouch('tap', startX, startY);
      }

      // Clean up temporary data
      delete target._recordStartX;
      delete target._recordStartY;
      delete target._recordStartTime;
    }
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

function handleFilePushSuccess(filePath: string) {
  console.log('[VideoPlayer] File pushed successfully:', filePath);
  // Could show a toast notification here
}

function handleApkInstallSuccess(packageName: string) {
  console.log('[VideoPlayer] APK installed successfully:', packageName);
  // Could show a toast notification here
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

function handleSystemKeyPress(action: string) {
  console.log('[VideoPlayer] System key pressed:', action);
  const systemKey = action as 'home' | 'back' | 'recent' | 'power' | 'volume_up' | 'volume_down';
  sendSystemKey(systemKey);

  // Record system key if recording is active
  if (isRecordingThisDevice.value) {
    recorder.recordSystemKey(systemKey);
  }

  showSystemKeys.value = false;
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault();
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  showContextMenu.value = true;
}

async function handleContextMenuAction(action: string, serial: string) {
  console.log('[VideoPlayer] Context menu action:', action, serial);

  const deviceStore = useDeviceStore();

  switch (action) {
    case 'show-info':
      showDeviceInfo.value = true;
      break;

    case 'toggle-recording':
      // Toggle recording via RecordingStore
      const recordingStore = await import('../stores_app_pymatrix/recordingStore');
      const isRecording = recordingStore.useRecordingStore().isRecording(serial);

      if (isRecording) {
        recordingStore.useRecordingStore().stopRecording(serial);
        toast.success('Recording stopped', 'Recording');
      } else {
        recordingStore.useRecordingStore().startRecording(serial);
        toast.success('Recording started', 'Recording');
      }
      break;

    case 'screenshot':
      try {
        const { pyMatrixDeviceAPI } = await import('~/services/api/pymatrix/pymatrix-device-api');
        const response = await pyMatrixDeviceAPI.takeScreenshot(serial);

        if (response.success) {
          toast.success(`Screenshot saved: ${response.path}`, 'Screenshot');
        } else {
          toast.error('Failed to take screenshot', 'Screenshot Error');
        }
      } catch (error) {
        console.error('[VideoPlayer] Screenshot failed:', error);
        toast.error('Failed to take screenshot', 'Screenshot Error');
      }
      break;

    case 'screen-control':
      showScreenControl.value = true;
      break;

    case 'clipboard-sync':
      showClipboard.value = true;
      break;

    case 'text-input':
      // TODO: Implement text input dialog
      toast.info('Text input feature coming soon', 'Text Input');
      break;

    case 'push-file':
      showFilePush.value = true;
      break;

    case 'install-apk':
      showApkInstall.value = true;
      break;

    case 'add-to-group':
      if (groupStore.hasHost) {
        groupStore.addSlave(serial);
        toast.success('Device added to group', 'Group Management');
      } else {
        toast.warning('Please set a host device first', 'Group Management');
      }
      break;

    case 'set-host':
      groupStore.setHost(serial);
      toast.success('Device set as host', 'Group Management');
      break;

    case 'remove-host':
      groupStore.removeHost();
      toast.success('Host removed', 'Group Management');
      break;

    case 'remove-from-group':
      groupStore.removeSlave(serial);
      toast.success('Device removed from group', 'Group Management');
      break;

    case 'restart':
      try {
        const { pyMatrixDeviceAPI } = await import('~/services/api/pymatrix/pymatrix-device-api');
        await pyMatrixDeviceAPI.restartDevice(serial);
        toast.success('Device restart initiated', 'Device Control');
      } catch (error) {
        console.error('[VideoPlayer] Restart failed:', error);
        toast.error('Failed to restart device', 'Device Error');
      }
      break;

    case 'disconnect':
      try {
        const { pyMatrixDeviceAPI } = await import('~/services/api/pymatrix/pymatrix-device-api');
        await pyMatrixDeviceAPI.disconnectDevice(serial);
        deviceStore.removeDevice(serial);
        toast.success('Device disconnected', 'Device Control');
      } catch (error) {
        console.error('[VideoPlayer] Disconnect failed:', error);
        toast.error('Failed to disconnect device', 'Device Error');
      }
      break;

    default:
      console.warn('[VideoPlayer] Unknown context menu action:', action);
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

.group-role-badge {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
}

.device-tags-display {
  position: absolute;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 90%;
  justify-content: center;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
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

.fullscreen-toggle-btn {
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

.fullscreen-toggle-btn:hover {
  background: rgba(59, 130, 246, 0.8);
  border-color: #3b82f6;
  color: white;
  transform: scale(1.05);
}

.fullscreen-toggle-btn:active {
  transform: scale(0.95);
}

.system-key-toggle-btn {
  position: absolute;
  top: 12px;
  right: 100px;
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

.system-key-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
  color: white;
  transform: scale(1.05);
}

.system-key-toggle-btn:active {
  transform: scale(0.95);
}

.system-key-panel-overlay {
  position: absolute;
  top: 50px;
  right: 12px;
  z-index: 5;
  animation: slideInDown 0.2s ease-out;
}

.clipboard-toggle-btn {
  position: absolute;
  top: 12px;
  right: 60px;
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

.clipboard-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
  color: white;
  transform: scale(1.05);
}

.clipboard-toggle-btn:active {
  transform: scale(0.95);
}

.clipboard-panel-overlay {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  animation: slideInDown 0.2s ease-out;
}

.screen-control-toggle-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
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

.screen-control-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
  color: white;
  transform: scale(1.05);
}

.screen-control-toggle-btn:active {
  transform: scale(0.95);
}

.screen-control-panel-overlay {
  position: absolute;
  bottom: 50px;
  right: 12px;
  z-index: 6;
  animation: slideInUp 0.2s ease-out;
}

.file-push-toggle-btn {
  position: absolute;
  bottom: 12px;
  right: 56px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 4;
}

.file-push-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(59, 130, 246, 0.6);
  color: white;
  transform: scale(1.05);
}

.file-push-toggle-btn:active {
  transform: scale(0.95);
}

.file-push-panel-overlay {
  position: absolute;
  bottom: 50px;
  right: 56px;
  z-index: 6;
  animation: slideInUp 0.2s ease-out;
}

.apk-install-toggle-btn {
  position: absolute;
  bottom: 12px;
  right: 100px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 4;
}

.apk-install-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(34, 197, 94, 0.6);
  color: white;
  transform: scale(1.05);
}

.apk-install-toggle-btn:active {
  transform: scale(0.95);
}

.apk-install-panel-overlay {
  position: absolute;
  bottom: 50px;
  right: 100px;
  z-index: 6;
  animation: slideInUp 0.2s ease-out;
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
