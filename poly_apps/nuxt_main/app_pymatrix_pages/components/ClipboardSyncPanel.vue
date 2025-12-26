<template>
  <div class="pm-panel pm-panel--blue">
    <div class="pm-panel-header">
      <h3 class="pm-panel-title">📋 Clipboard Sync</h3>
      <button class="pm-panel-close" @click="handleClose">×</button>
    </div>

    <div class="pm-panel-content">
      <!-- Header Controls -->
      <div class="pm-form-group">
        <BaseToggle
          v-model="autoSync"
          label="Auto Sync"
          size="sm"
          variant="info"
          @change="handleAutoSyncChange"
        />
      </div>

      <!-- Sync Status -->
      <div class="pm-form-group">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="pm-status-dot" :class="syncEnabled ? 'pm-status-dot--online' : 'pm-status-dot--offline'"></span>
            <span class="pm-form-label">{{ syncEnabled ? 'Sync Active' : 'Sync Disabled' }}</span>
          </div>
          <button
            class="pm-button"
            :class="syncEnabled ? 'pm-button--forest' : 'pm-button--electric-blue'"
            @click="toggleSync"
          >
            {{ syncEnabled ? 'Disable' : 'Enable' }}
          </button>
        </div>
      </div>

      <!-- Clipboard Sections -->
      <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: start;">
        <!-- PC Clipboard -->
        <div class="pm-form-group">
          <label class="pm-form-label">
            <span style="font-size: 20px; margin-right: 8px;">💻</span>
            PC Clipboard
          </label>
          <textarea
            v-model="pcClipboard"
            class="pm-textarea"
            placeholder="PC clipboard content..."
            rows="4"
            readonly
          ></textarea>
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <button
              class="pm-button pm-button--electric-blue"
              :disabled="!deviceClipboard || syncing"
              @click="sendToPc"
            >
              ⬇ From Device
            </button>
            <button
              class="pm-button pm-button--electric-blue"
              :disabled="syncing"
              @click="refreshPcClipboard"
            >
              🔄
            </button>
          </div>
        </div>

        <!-- Sync Direction -->
        <div style="display: flex; align-items: center; justify-content: center; padding-top: 40px;">
          <svg width="20" height="40" viewBox="0 0 20 40" fill="currentColor">
            <path d="M10 5 L15 10 L5 10 Z" opacity="0.6"/>
            <path d="M10 35 L15 30 L5 30 Z" opacity="0.6"/>
          </svg>
        </div>

        <!-- Device Clipboard -->
        <div class="pm-form-group">
          <label class="pm-form-label">
            <span style="font-size: 20px; margin-right: 8px;">📱</span>
            Device Clipboard
          </label>
          <textarea
            v-model="deviceClipboard"
            class="pm-textarea"
            placeholder="Device clipboard content..."
            rows="4"
            readonly
          ></textarea>
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <button
              class="pm-button pm-button--electric-blue"
              :disabled="!pcClipboard || syncing"
              @click="sendToDevice"
            >
              ⬆ To Device
            </button>
            <button
              class="pm-button pm-button--electric-blue"
              :disabled="syncing"
              @click="refreshDeviceClipboard"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      <!-- Last Sync Info -->
      <div v-if="lastSync" class="pm-form-group">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
          <div style="font-size: 24px;">
            {{ lastSync.source === 'pc' ? '💻→📱' : '📱→💻' }}
          </div>
          <div>
            <div class="pm-form-label" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Last sync:</div>
            <div style="font-size: 13px; font-weight: 500;">{{ formatTime(lastSync.timestamp) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useToast } from '@/app_pymatrix_pages/composables/useToast';
import BaseToggle from '~/common/components/ui/BaseToggle.vue';
import { pyMatrixDeviceAPI } from '~/services/api/pymatrix/pymatrix-device-api';

const toast = useToast();

interface ClipboardData {
  text: string;
  timestamp: number;
  source: 'device' | 'pc';
}

interface Props {
  show?: boolean;
  deviceSerial: string;
}

interface Emits {
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: true
});

const emit = defineEmits<Emits>();

const isOpen = ref(props.show);
const syncEnabled = ref(false);
const autoSync = ref(false);
const syncing = ref(false);
const pcClipboard = ref('');
const deviceClipboard = ref('');
const lastSync = ref<ClipboardData | null>(null);
let syncInterval: NodeJS.Timeout | null = null;

function handleClose() {
  isOpen.value = false;
  emit('close');
}

function toggleSync() {
  syncEnabled.value = !syncEnabled.value;

  if (syncEnabled.value) {
    startAutoSync();
  } else {
    stopAutoSync();
  }
}

function handleAutoSyncChange() {
  if (autoSync.value && !syncEnabled.value) {
    toggleSync();
  }
}

function startAutoSync() {
  if (syncInterval) return;

  syncInterval = setInterval(() => {
    if (autoSync.value) {
      refreshBothClipboards();
    }
  }, 2000);
}

function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

async function sendToDevice() {
  if (!pcClipboard.value || !props.deviceSerial) return;

  syncing.value = true;

  try {
    console.log('[ClipboardSyncPanel] Sending to device:', props.deviceSerial);
    const result = await pyMatrixDeviceAPI.setClipboard(props.deviceSerial, pcClipboard.value);

    if (result.success) {
      deviceClipboard.value = pcClipboard.value;
      lastSync.value = {
        text: pcClipboard.value,
        timestamp: Date.now(),
        source: 'pc'
      };
      console.log('[ClipboardSyncPanel] Successfully sent to device');
      toast.success('Clipboard sent to device', 'Clipboard Sync');
    } else {
      console.error('[ClipboardSyncPanel] Failed to send to device:', result.error);
      toast.error(`Failed to send to device: ${result.error}`, 'Clipboard Sync Error');
    }
  } catch (error) {
    console.error('[ClipboardSyncPanel] Error sending to device:', error);
    toast.error('Failed to send clipboard to device', 'Clipboard Sync Error');
  } finally {
    setTimeout(() => {
      syncing.value = false;
    }, 500);
  }
}

async function sendToPc() {
  if (!deviceClipboard.value) return;

  syncing.value = true;

  try {
    pcClipboard.value = deviceClipboard.value;
    await navigator.clipboard.writeText(deviceClipboard.value);

    lastSync.value = {
      text: deviceClipboard.value,
      timestamp: Date.now(),
      source: 'device'
    };

    console.log('[ClipboardSyncPanel] Successfully sent to PC clipboard');
    toast.success('Clipboard sent to PC', 'Clipboard Sync');
  } catch (error) {
    console.error('[ClipboardSyncPanel] Failed to write to PC clipboard:', error);
    toast.error('Failed to write to PC clipboard', 'Clipboard Sync Error');
  } finally {
    setTimeout(() => {
      syncing.value = false;
    }, 500);
  }
}

async function refreshPcClipboard() {
  syncing.value = true;

  try {
    const text = await navigator.clipboard.readText();
    pcClipboard.value = text;
    console.log('[ClipboardSyncPanel] PC clipboard refreshed');
  } catch (error) {
    console.error('[ClipboardSyncPanel] Failed to read PC clipboard:', error);
  } finally {
    setTimeout(() => {
      syncing.value = false;
    }, 300);
  }
}

async function refreshDeviceClipboard() {
  if (!props.deviceSerial) return;

  syncing.value = true;

  try {
    console.log('[ClipboardSyncPanel] Refreshing device clipboard:', props.deviceSerial);
    const result = await pyMatrixDeviceAPI.getClipboard(props.deviceSerial);

    if (result.success && result.text !== undefined) {
      deviceClipboard.value = result.text;
      console.log('[ClipboardSyncPanel] Device clipboard refreshed');
    } else {
      console.error('[ClipboardSyncPanel] Failed to refresh device clipboard:', result.error);
    }
  } catch (error) {
    console.error('[ClipboardSyncPanel] Error refreshing device clipboard:', error);
  } finally {
    setTimeout(() => {
      syncing.value = false;
    }, 300);
  }
}

async function refreshBothClipboards() {
  await Promise.all([
    refreshPcClipboard(),
    refreshDeviceClipboard()
  ]);
}

onMounted(() => {
  refreshBothClipboards();
});

onBeforeUnmount(() => {
  stopAutoSync();
});

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) {
    return 'Just now';
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleString();
  }
}

defineExpose({
  updatePcClipboard: (text: string) => {
    pcClipboard.value = text;
  },
  updateDeviceClipboard: (text: string) => {
    deviceClipboard.value = text;
  }
});
</script>
