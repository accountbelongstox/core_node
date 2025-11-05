<template>
  <div
    class="pm-video-container"
    ref="containerRef"
    @contextmenu="handleContextMenu"
  >
    <video
      ref="videoElement"
      class="pm-video"
      autoplay
      playsinline
      muted
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
    />

    <canvas ref="touchCanvas" class="touch-overlay" />

    <div class="pm-video-overlay" v-if="showOverlay">
      <div class="pm-video-info">
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

      <div class="pm-video-status" :class="videoConnected && controlConnected ? 'pm-video-status--connected' : 'pm-video-status--disconnected'">
        <span class="status-dot"></span>
        <span>{{ videoConnected && controlConnected ? 'Connected' : 'Disconnected' }}</span>
      </div>

      <button class="pm-video-btn pm-video-btn--info" @click="toggleDeviceInfo" title="Toggle device info">
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
      class="pm-video-btn pm-video-btn--fullscreen"
      @click="$emit('toggle-fullscreen', device)"
      title="Fullscreen (F)"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
      </svg>
    </button>

    <button
      class="pm-video-btn pm-video-btn--system-keys"
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
      class="pm-video-btn pm-video-btn--clipboard"
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
      class="pm-video-btn pm-video-btn--screen-control"
      @click="showScreenControl = !showScreenControl"
      title="Screen Control"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13zm13 1a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h13z"/>
        <path d="M3 5.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm9 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zM8 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
      </svg>
    </button>

    <button
      class="pm-video-btn pm-video-btn--file-push"
      @click="showFilePush = !showFilePush"
      title="Push File"
    >
      📁
    </button>

    <button
      class="pm-video-btn pm-video-btn--apk-install"
      @click="showApkInstall = !showApkInstall"
      title="Install APK"
    >
      📦
    </button>

    <button
      class="pm-video-btn pm-video-btn--audio-streaming"
      @click="showAudioStreaming = !showAudioStreaming"
      title="Audio Streaming (sndcpy)"
    >
      🎵
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
        @view-packages="handleViewPackagesFromApk"
      />
    </div>

    <div v-if="showAudioStreaming" class="audio-streaming-panel-overlay">
      <AudioStreamingPanel
        :show="showAudioStreaming"
        :device-serial="device.serial"
        @close="showAudioStreaming = false"
      />
    </div>

    <PackageListPanel
      :visible="showPackageList"
      :device-serial="device.serial"
      @close="showPackageList = false"
      @package-uninstalled="handlePackageUninstalled"
    />

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
import PackageListPanel from './PackageListPanel.vue';
import AudioStreamingPanel from './AudioStreamingPanel.vue';
import DeviceContextMenu from './DeviceContextMenu.vue';
import DeviceTagBadge from '@/common/components/ui/DeviceTagBadge.vue';
import { useTagsStore } from '../stores_app_pymatrix/tagsStore';
import { useToast } from '../composables_app_pymatrix/useToast';
import type { Device } from '@/types/pymatrix';

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
const showAudioStreaming = ref(false);
const showPackageList = ref(false);
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
  toast.success(`APK installed: ${packageName}`, 'Installation');
}

function handlePackageUninstalled(packageName: string) {
  console.log('[VideoPlayer] Package uninstalled:', packageName);
  toast.success(`Package uninstalled: ${packageName}`, 'Uninstall');
}

function handleViewPackagesFromApk() {
  console.log('[VideoPlayer] Opening package list from APK install');
  showPackageList.value = true;
}

function toggleDeviceInfo() {
  showDeviceInfo.value = !showDeviceInfo.value;
}

async function handleRefreshDeviceInfo() {
  // Call device info API to get detailed information
  console.log('[VideoPlayer] Refreshing device info for', props.device.serial);

  try {
    const { pyMatrixDeviceAPI } = await import('@/services/api/pymatrix/pymatrix-device-api');
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
        const { pyMatrixDeviceAPI } = await import('@/services/api/pymatrix/pymatrix-device-api');
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

    case 'view-packages':
      showPackageList.value = true;
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
        const { pyMatrixDeviceAPI } = await import('@/services/api/pymatrix/pymatrix-device-api');
        await pyMatrixDeviceAPI.restartDevice(serial);
        toast.success('Device restart initiated', 'Device Control');
      } catch (error) {
        console.error('[VideoPlayer] Restart failed:', error);
        toast.error('Failed to restart device', 'Device Error');
      }
      break;

    case 'disconnect':
      try {
        const { pyMatrixDeviceAPI } = await import('@/services/api/pymatrix/pymatrix-device-api');
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
/* VideoPlayer Styles with NFTMax Theme */
.pm-video-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: var(--pm-color-surface);
  border-radius: var(--pm-radius-lg);
  overflow: hidden;
  box-shadow: var(--pm-shadow-sm);
}

/* Video Element */
.pm-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  cursor: crosshair;
  transition: var(--pm-transition-fast);
}

/* Touch Canvas Overlay */
.touch-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

/* Video Overlay - Info Panel */
.pm-video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.8) 0%,
    rgba(0, 0, 0, 0.4) 70%,
    transparent 100%
  );
  backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  opacity: 0;
  transform: translateY(-10px);
  transition: var(--pm-transition-fast);
  z-index: 20;
}

.pm-video-container:hover .pm-video-overlay {
  opacity: 1;
  transform: translateY(0);
}

/* Video Info */
.pm-video-info {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  border-radius: var(--pm-radius-pill);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: var(--pm-transition-fast);
  animation: pm-fadeIn 0.5s ease;
}

.info-item:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}

.info-label {
  font-size: var(--pm-font-size-xs);
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: var(--pm-font-size-xs);
  color: #ffffff;
  font-weight: 700;
}

/* Video Status */
.pm-video-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  border-radius: var(--pm-radius-pill);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: var(--pm-font-size-xs);
  font-weight: 600;
  color: #ffffff;
  transition: var(--pm-transition-fast);
  animation: pm-fadeIn 0.5s ease 0.1s backwards;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pm-text-muted);
  transition: var(--pm-transition-fast);
}

.pm-video-status--connected {
  background: rgba(39, 174, 96, 0.2);
  border-color: rgba(39, 174, 96, 0.4);
}

.pm-video-status--connected .status-dot {
  background: var(--pm-color-success);
  box-shadow: 0 0 8px var(--pm-color-success);
  animation: pm-pulse 2s ease-in-out infinite;
}

.pm-video-status--disconnected {
  background: rgba(235, 87, 87, 0.2);
  border-color: rgba(235, 87, 87, 0.4);
}

.pm-video-status--disconnected .status-dot {
  background: var(--pm-color-danger);
}

/* Video Buttons - Base Style */
.pm-video-btn {
  position: absolute;
  z-index: 30;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  transition: var(--pm-transition-fast);
  opacity: 0;
  transform: scale(0.9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.pm-video-container:hover .pm-video-btn {
  opacity: 1;
  transform: scale(1);
}

.pm-video-btn:hover {
  background: var(--pm-color-primary);
  border-color: var(--pm-color-primary);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(83, 86, 251, 0.4);
}

.pm-video-btn:active {
  transform: scale(1);
}

.pm-video-btn svg {
  transition: var(--pm-transition-fast);
}

.pm-video-btn:hover svg {
  transform: scale(1.1);
}

/* Video Button Positions */
.pm-video-btn--info {
  top: 16px;
  right: 16px;
  animation: pm-fadeIn 0.4s ease 0.2s backwards;
}

.pm-video-btn--fullscreen {
  bottom: 16px;
  right: 16px;
  animation: pm-fadeIn 0.4s ease 0.3s backwards;
}

.pm-video-btn--system-keys {
  bottom: 16px;
  right: 68px;
  animation: pm-fadeIn 0.4s ease 0.35s backwards;
}

.pm-video-btn--clipboard {
  bottom: 16px;
  right: 120px;
  animation: pm-fadeIn 0.4s ease 0.4s backwards;
}

.pm-video-btn--screen-control {
  bottom: 16px;
  right: 172px;
  animation: pm-fadeIn 0.4s ease 0.45s backwards;
}

.pm-video-btn--file-push {
  bottom: 16px;
  right: 224px;
  font-size: 18px;
  animation: pm-fadeIn 0.4s ease 0.5s backwards;
}

.pm-video-btn--apk-install {
  bottom: 16px;
  right: 276px;
  font-size: 18px;
  animation: pm-fadeIn 0.4s ease 0.55s backwards;
}

/* Group Role Badge */
.group-role-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 25;
  animation: pm-fadeIn 0.5s ease 0.15s backwards;
}

/* Device Tags Display */
.device-tags-display {
  position: absolute;
  bottom: 68px;
  left: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: calc(100% - 340px);
  z-index: 25;
  animation: pm-fadeIn 0.5s ease 0.2s backwards;
}

/* Panel Overlays - Common Style */
.system-key-panel-overlay,
.clipboard-panel-overlay,
.screen-control-panel-overlay,
.file-push-panel-overlay,
.apk-install-panel-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pm-fadeIn 0.3s ease;
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

@keyframes pm-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}

/* Responsive Design */
@media (max-width: 1278px) {
  .pm-video-container {
    min-height: 250px;
  }

  .pm-video-overlay {
    padding: 10px 12px;
  }

  .pm-video-info {
    gap: 6px 12px;
  }

  .info-item {
    padding: 3px 10px;
  }

  .info-label,
  .info-value {
    font-size: 10px;
  }

  .pm-video-status {
    padding: 4px 12px;
    font-size: 10px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
  }

  .pm-video-btn {
    width: 36px;
    height: 36px;
  }

  .pm-video-btn svg {
    width: 14px;
    height: 14px;
  }

  .pm-video-btn--info {
    top: 12px;
    right: 12px;
  }

  .pm-video-btn--fullscreen {
    bottom: 12px;
    right: 12px;
  }

  .pm-video-btn--system-keys {
    right: 56px;
  }

  .pm-video-btn--clipboard {
    right: 100px;
  }

  .pm-video-btn--screen-control {
    right: 144px;
  }

  .pm-video-btn--file-push {
    right: 188px;
  }

  .pm-video-btn--apk-install {
    right: 232px;
  }

  .group-role-badge {
    top: 12px;
    left: 12px;
  }

  .device-tags-display {
    bottom: 56px;
    left: 12px;
    max-width: calc(100% - 280px);
  }
}

@media (max-width: 767px) {
  .pm-video-container {
    min-height: 200px;
    border-radius: var(--pm-radius-md);
  }

  .pm-video-overlay {
    flex-direction: column;
    align-items: stretch;
    padding: 8px 10px;
  }

  .pm-video-info {
    flex-direction: column;
    gap: 4px;
  }

  .info-item {
    padding: 2px 8px;
  }

  .pm-video-status {
    align-self: flex-start;
  }

  .pm-video-btn {
    width: 32px;
    height: 32px;
  }

  .pm-video-btn svg {
    width: 12px;
    height: 12px;
  }

  .pm-video-btn--info {
    top: 8px;
    right: 8px;
  }

  .pm-video-btn--fullscreen {
    bottom: 8px;
    right: 8px;
  }

  .pm-video-btn--system-keys {
    bottom: 8px;
    right: 48px;
  }

  .pm-video-btn--clipboard {
    bottom: 48px;
    right: 8px;
  }

  .pm-video-btn--screen-control {
    bottom: 48px;
    right: 48px;
  }

  .pm-video-btn--file-push {
    bottom: 88px;
    right: 8px;
  }

  .pm-video-btn--apk-install {
    bottom: 88px;
    right: 48px;
  }

  .group-role-badge {
    top: 8px;
    left: 8px;
  }

  .device-tags-display {
    bottom: auto;
    top: 48px;
    left: 8px;
    right: 48px;
    max-width: none;
  }
}

/* Touch Feedback */
.pm-video:active {
  cursor: grabbing;
}

/* Loading State */
.pm-video-container::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--pm-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  z-index: 5;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.pm-video-container.loading::before {
  opacity: 1;
}

@keyframes spin {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

/* Hover Effects Enhancement */
.pm-video-btn--info:hover {
  background: linear-gradient(135deg, var(--pm-color-primary) 0%, var(--pm-color-accent) 100%);
  border-color: transparent;
}

.pm-video-btn--fullscreen:hover {
  background: var(--pm-gradient-main);
  border-color: transparent;
}

/* Button Group Effect */
.pm-video-btn--system-keys:hover,
.pm-video-btn--clipboard:hover,
.pm-video-btn--screen-control:hover,
.pm-video-btn--file-push:hover,
.pm-video-btn--apk-install:hover {
  background: linear-gradient(135deg, var(--pm-color-accent) 0%, var(--pm-color-primary) 100%);
  border-color: transparent;
}

/* Focus States */
.pm-video-btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(83, 86, 251, 0.3);
}

.pm-video-btn:focus:not(:hover) {
  background: rgba(255, 255, 255, 0.25);
}
</style>
