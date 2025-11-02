<template>
  <BasePanel
    v-model="isOpen"
    title="Clipboard Sync"
    header-icon="📋"
    size="lg"
    variant="info"
    custom-header-color="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
    @close="handleClose"
  >
    <template #header>
      <h3 class="panel-custom-title">Clipboard Sync</h3>
      <BaseToggle
        v-model="autoSync"
        label="Auto"
        size="sm"
        variant="info"
        @change="handleAutoSyncChange"
      />
    </template>

    <div class="clipboard-sync-content">
      <!-- Sync Status -->
      <div class="sync-status">
        <div class="status-indicator" :class="{ active: syncEnabled }">
          <span class="status-dot"></span>
          <span class="status-text">{{ syncEnabled ? 'Sync Active' : 'Sync Disabled' }}</span>
        </div>
        <BaseButton
          :variant="syncEnabled ? 'success' : 'default'"
          size="sm"
          @click="toggleSync"
        >
          {{ syncEnabled ? 'Disable' : 'Enable' }}
        </BaseButton>
      </div>

      <!-- Clipboard Sections -->
      <div class="clipboard-sections">
        <!-- PC Clipboard -->
        <div class="clipboard-section pc-section">
          <div class="section-header">
            <div class="section-icon">💻</div>
            <h4 class="section-title">PC Clipboard</h4>
          </div>

          <div class="clipboard-content">
            <textarea
              v-model="pcClipboard"
              class="clipboard-text"
              placeholder="PC clipboard content..."
              rows="4"
              readonly
            />
          </div>

          <div class="section-actions">
            <BaseButton
              variant="info"
              size="sm"
              icon="⬇"
              :disabled="!deviceClipboard || syncing"
              :loading="syncing"
              @click="sendToPc"
            >
              From Device
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="sm"
              icon="🔄"
              :disabled="syncing"
              @click="refreshPcClipboard"
            />
          </div>
        </div>

        <!-- Sync Direction -->
        <div class="sync-direction">
          <div class="direction-arrows">
            <svg width="20" height="40" viewBox="0 0 20 40" fill="currentColor">
              <path d="M10 5 L15 10 L5 10 Z" opacity="0.6"/>
              <path d="M10 35 L15 30 L5 30 Z" opacity="0.6"/>
            </svg>
          </div>
        </div>

        <!-- Device Clipboard -->
        <div class="clipboard-section device-section">
          <div class="section-header">
            <div class="section-icon">📱</div>
            <h4 class="section-title">Device Clipboard</h4>
          </div>

          <div class="clipboard-content">
            <textarea
              v-model="deviceClipboard"
              class="clipboard-text"
              placeholder="Device clipboard content..."
              rows="4"
              readonly
            />
          </div>

          <div class="section-actions">
            <BaseButton
              variant="info"
              size="sm"
              icon="⬆"
              :disabled="!pcClipboard || syncing"
              :loading="syncing"
              @click="sendToDevice"
            >
              To Device
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="sm"
              icon="🔄"
              :disabled="syncing"
              @click="refreshDeviceClipboard"
            />
          </div>
        </div>
      </div>

      <!-- Last Sync Info -->
      <div v-if="lastSync" class="last-sync-info">
        <div class="last-sync-icon">
          {{ lastSync.source === 'pc' ? '💻→📱' : '📱→💻' }}
        </div>
        <div class="last-sync-details">
          <div class="last-sync-label">Last sync:</div>
          <div class="last-sync-time">{{ formatTime(lastSync.timestamp) }}</div>
        </div>
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useToast } from '../composables_app_pymatrix/useToast';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';
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

<style scoped>
.panel-custom-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: white;
  flex: 1;
}

.clipboard-sync-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sync-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse-inactive 2s infinite;
}

.status-indicator.active .status-dot {
  background: #10b981;
  animation: pulse-active 2s infinite;
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.clipboard-sections {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: start;
}

.clipboard-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  font-size: 20px;
}

.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.clipboard-content {
  flex: 1;
}

.clipboard-text {
  width: 100%;
  padding: 12px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #1f2937;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  resize: vertical;
  min-height: 100px;
}

.clipboard-text:focus {
  outline: none;
  border-color: #8b5cf6;
  background: white;
}

.section-actions {
  display: flex;
  gap: 6px;
}

.sync-direction {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 40px;
}

.direction-arrows {
  color: #8b5cf6;
}

.last-sync-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
}

.last-sync-icon {
  font-size: 24px;
}

.last-sync-details {
  flex: 1;
}

.last-sync-label {
  font-size: 11px;
  font-weight: 600;
  color: #15803d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.last-sync-time {
  font-size: 13px;
  color: #166534;
  font-weight: 500;
}

@keyframes pulse-active {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
  }
}

@keyframes pulse-inactive {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 768px) {
  .clipboard-sections {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }

  .sync-direction {
    padding: 8px 0;
  }

  .direction-arrows {
    transform: rotate(90deg);
  }
}
</style>
