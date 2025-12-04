<template>
  <BasePanel
    :model-value="show"
    title="Audio Streaming (sndcpy)"
    @close="$emit('close')"
    class="audio-streaming-panel"
  >
    <div class="audio-panel-content">
      <div v-if="status?.error" class="audio-error-message">
        <div class="error-icon">⚠️</div>
        <div class="error-text">
          <strong>Error:</strong> {{ status.error }}
        </div>
        <button @click="clearError" class="error-dismiss-btn">×</button>
      </div>

      <div class="audio-status-section">
        <div class="status-item">
          <span class="status-label">Device:</span>
          <span class="status-value">{{ deviceSerial }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Installation Status:</span>
          <span class="status-value" :class="installStatusClass">
            {{ installStatusText }}
          </span>
        </div>
        <div class="status-item" v-if="isStreaming">
          <span class="status-label">Streaming Duration:</span>
          <span class="status-value">{{ formattedDuration }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">State:</span>
          <span class="status-value" :class="stateClass">
            {{ stateText }}
          </span>
        </div>
      </div>

      <div v-if="installing || installProgress" class="install-progress-section">
        <div class="progress-label">Installing sndcpy...</div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${installProgress?.progress || 0}%` }"
          ></div>
        </div>
        <div class="progress-text">
          {{ installProgress?.status || 'Downloading...' }}
        </div>
      </div>

      <div class="audio-actions">
        <button
          v-if="!isInstalled"
          @click="handleInstall"
          :disabled="installing"
          class="audio-btn audio-btn-primary"
        >
          <span class="btn-icon">📦</span>
          <span>{{ installing ? 'Installing...' : 'Install sndcpy' }}</span>
        </button>

        <button
          v-if="isInstalled && !isStreaming"
          @click="handleStart"
          :disabled="starting || !isInstalled"
          class="audio-btn audio-btn-success"
        >
          <span class="btn-icon">🎵</span>
          <span>{{ starting ? 'Starting...' : 'Start Audio Streaming' }}</span>
        </button>

        <button
          v-if="isInstalled && isStreaming"
          @click="handleStop"
          :disabled="stopping"
          class="audio-btn audio-btn-danger"
        >
          <span class="btn-icon">⏹️</span>
          <span>{{ stopping ? 'Stopping...' : 'Stop Audio Streaming' }}</span>
        </button>

        <button
          v-if="isInstalled"
          @click="handleCheckStatus"
          class="audio-btn audio-btn-secondary"
        >
          <span class="btn-icon">🔄</span>
          <span>Check Status</span>
        </button>
      </div>

      <div class="audio-info-section">
        <div class="info-title">About sndcpy</div>
        <div class="info-content">
          <p>sndcpy forwards audio from Android devices to your computer.</p>
          <ul>
            <li>Low latency audio streaming</li>
            <li>Works over USB or WiFi</li>
            <li>No root required (Android 10+)</li>
          </ul>
        </div>
      </div>

      <div v-if="metadata" class="audio-metadata-section">
        <div class="metadata-title">Audio Stream Info</div>
        <div class="metadata-grid">
          <div class="metadata-item">
            <span class="metadata-label">Sample Rate:</span>
            <span class="metadata-value">{{ metadata.sampleRate }} Hz</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Channels:</span>
            <span class="metadata-value">{{ metadata.channels }}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Bit Depth:</span>
            <span class="metadata-value">{{ metadata.bitDepth }} bit</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Codec:</span>
            <span class="metadata-value">{{ metadata.codec }}</span>
          </div>
        </div>
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAudioStream } from '@/app_pymatrix_pages/composables/useAudioStream';
import { useToast } from '@/app_pymatrix_pages/composables/useToast';
import BasePanel from '@/common/components/ui/BasePanel.vue';

interface Props {
  show: boolean;
  deviceSerial: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const toast = useToast();

const {
  status,
  isInstalled,
  isStreaming,
  installing,
  starting,
  stopping,
  installProgress,
  metadata,
  streamDuration,
  installSndcpy,
  startStreaming,
  stopStreaming,
  checkInstallStatus,
  clearError,
} = useAudioStream({ deviceSerial: props.deviceSerial });

const installStatusText = computed(() => {
  if (installing.value) return 'Installing...';
  if (isInstalled.value) return 'Installed';
  return 'Not Installed';
});

const installStatusClass = computed(() => ({
  'status-success': isInstalled.value,
  'status-warning': installing.value,
  'status-error': !isInstalled.value && !installing.value,
}));

const stateText = computed(() => {
  if (!status.value) return 'Idle';
  const stateMap: Record<string, string> = {
    idle: 'Idle',
    installing: 'Installing',
    starting: 'Starting',
    streaming: 'Streaming',
    stopping: 'Stopping',
    error: 'Error',
  };
  return stateMap[status.value.state] || status.value.state;
});

const stateClass = computed(() => ({
  'status-success': status.value?.state === 'streaming',
  'status-warning': ['installing', 'starting', 'stopping'].includes(status.value?.state || ''),
  'status-error': status.value?.state === 'error',
  'status-idle': status.value?.state === 'idle',
}));

const formattedDuration = computed(() => {
  const seconds = Math.floor(streamDuration.value / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
});

async function handleInstall() {
  const success = await installSndcpy();
  if (success) {
    toast.success('sndcpy installed successfully');
  } else {
    toast.error('Failed to install sndcpy');
  }
}

async function handleStart() {
  const success = await startStreaming();
  if (success) {
    toast.success('Audio streaming started');
  } else {
    toast.error('Failed to start audio streaming');
  }
}

async function handleStop() {
  const success = await stopStreaming();
  if (success) {
    toast.info('Audio streaming stopped');
  } else {
    toast.error('Failed to stop audio streaming');
  }
}

async function handleCheckStatus() {
  const installed = await checkInstallStatus();
  if (installed) {
    toast.success('sndcpy is installed');
  } else {
    toast.info('sndcpy is not installed');
  }
}

onMounted(() => {
  checkInstallStatus();
});
</script>

<style scoped>
.audio-panel-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.audio-error-message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--error-bg, #fee);
  border: 1px solid var(--error-border, #fcc);
  border-radius: 6px;
  color: var(--error-text, #c33);
}

.error-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.error-text {
  flex: 1;
  font-size: 0.875rem;
}

.error-dismiss-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--error-text, #c33);
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.error-dismiss-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

.audio-status-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--panel-bg, #f9f9f9);
  border-radius: 6px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  font-weight: 500;
  color: var(--text-secondary, #666);
  font-size: 0.875rem;
}

.status-value {
  font-weight: 600;
  font-size: 0.875rem;
}

.status-success {
  color: var(--success-color, #0a0);
}

.status-warning {
  color: var(--warning-color, #f90);
}

.status-error {
  color: var(--error-color, #c33);
}

.status-idle {
  color: var(--text-tertiary, #999);
}

.install-progress-section {
  padding: 1rem;
  background: var(--panel-bg, #f9f9f9);
  border-radius: 6px;
}

.progress-label {
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.progress-bar {
  height: 8px;
  background: var(--progress-bg, #ddd);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color, #4CAF50);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--text-secondary, #666);
}

.audio-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.audio-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  flex: 1;
  min-width: 140px;
  justify-content: center;
}

.audio-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.audio-btn-primary {
  background: var(--primary-color, #2196F3);
  color: white;
}

.audio-btn-primary:hover:not(:disabled) {
  background: var(--primary-hover, #1976D2);
}

.audio-btn-success {
  background: var(--success-color, #4CAF50);
  color: white;
}

.audio-btn-success:hover:not(:disabled) {
  background: var(--success-hover, #388E3C);
}

.audio-btn-danger {
  background: var(--danger-color, #f44336);
  color: white;
}

.audio-btn-danger:hover:not(:disabled) {
  background: var(--danger-hover, #d32f2f);
}

.audio-btn-secondary {
  background: var(--secondary-color, #757575);
  color: white;
}

.audio-btn-secondary:hover:not(:disabled) {
  background: var(--secondary-hover, #616161);
}

.btn-icon {
  font-size: 1.125rem;
}

.audio-info-section {
  padding: 1rem;
  background: var(--info-bg, #e3f2fd);
  border-radius: 6px;
  border-left: 4px solid var(--info-color, #2196F3);
}

.info-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--info-color, #2196F3);
}

.info-content {
  font-size: 0.875rem;
  color: var(--text-primary, #333);
}

.info-content p {
  margin: 0 0 0.5rem 0;
}

.info-content ul {
  margin: 0;
  padding-left: 1.5rem;
}

.info-content li {
  margin-bottom: 0.25rem;
}

.audio-metadata-section {
  padding: 1rem;
  background: var(--panel-bg, #f9f9f9);
  border-radius: 6px;
}

.metadata-title {
  font-weight: 600;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metadata-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

.metadata-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #333);
}
</style>
