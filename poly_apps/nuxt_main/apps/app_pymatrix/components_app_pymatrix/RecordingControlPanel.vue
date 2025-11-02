<template>
  <div class="recording-control-panel" :class="{ recording: isRecording }">
    <div class="control-section">
      <div class="section-label">Recording</div>

      <div class="control-buttons">
        <button
          class="control-btn record-btn"
          :class="{ active: isRecording }"
          @click="toggleRecording"
          :title="isRecording ? 'Stop Recording' : 'Start Recording'"
        >
          <svg v-if="!isRecording" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="5"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="4" y="4" width="8" height="8" rx="1"/>
          </svg>
          <span class="btn-label">{{ isRecording ? 'Stop' : 'Record' }}</span>
        </button>

        <button
          class="control-btn screenshot-btn"
          @click="takeScreenshot"
          :disabled="!props.deviceSerial"
          title="Take Screenshot"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M15 12V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 8.172 2H7.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 4.172 4H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2z"/>
            <circle cx="8" cy="9" r="2.5" fill="white"/>
          </svg>
          <span class="btn-label">Screenshot</span>
        </button>
      </div>
    </div>

    <div v-if="isRecording" class="recording-info">
      <div class="recording-indicator">
        <span class="recording-dot"></span>
        <span class="recording-time">{{ formattedDuration }}</span>
      </div>

      <div class="recording-details">
        <div class="detail-item">
          <span class="detail-label">Format:</span>
          <span class="detail-value">{{ recordingState?.format?.toUpperCase() }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Mode:</span>
          <span class="detail-value">{{ recordingState?.mode }}</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="setting-row">
        <label class="setting-label">Format:</label>
        <select v-model="format" class="setting-select" :disabled="isRecording">
          <option value="mp4">MP4</option>
          <option value="mkv">MKV</option>
        </select>
      </div>

      <div class="setting-row">
        <label class="setting-label">Mode:</label>
        <select v-model="mode" class="setting-select" :disabled="isRecording">
          <option value="normal">Normal</option>
          <option value="background">Background</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useToast } from '../composables_app_pymatrix/useToast';
import { useRecordingStore } from '../stores_app_pymatrix/recordingStore';
import { pyMatrixRecordingAPI } from '~/services/api/pymatrix/pymatrix-recording-api';
import type { RecordingFormat, RecordingMode } from '../../../types/pymatrix';

const toast = useToast();

interface Props {
  deviceSerial: string;
  show?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  show: true
});

const recordingStore = useRecordingStore();

const format = ref<RecordingFormat>('mp4');
const mode = ref<RecordingMode>('normal');
const duration = ref(0);
const durationInterval = ref<NodeJS.Timeout | null>(null);

const isRecording = computed(() => {
  return recordingStore.isRecording(props.deviceSerial);
});

const recordingState = computed(() => {
  return recordingStore.getRecordingState(props.deviceSerial);
});

const formattedDuration = computed(() => {
  const totalSeconds = duration.value;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});

function toggleRecording() {
  if (isRecording.value) {
    stopRecording();
  } else {
    startRecording();
  }
}

async function startRecording() {
  console.log('[RecordingControlPanel] Starting recording...', {
    serial: props.deviceSerial,
    format: format.value,
    mode: mode.value
  });

  const result = await pyMatrixRecordingAPI.startRecording(props.deviceSerial, {
    format: format.value,
    mode: mode.value,
    quality: 'high'
  });

  if (result.success) {
    console.log('[RecordingControlPanel] Recording started successfully:', result);
    recordingStore.startRecording(props.deviceSerial, format.value, mode.value);
    startDurationCounter();
    toast.success('Recording started successfully', 'Recording');
  } else {
    console.error('[RecordingControlPanel] Failed to start recording:', result.error);
    toast.error(`Failed to start recording: ${result.error}`, 'Recording Error');
  }
}

async function stopRecording() {
  console.log('[RecordingControlPanel] Stopping recording...', {
    serial: props.deviceSerial
  });

  const result = await pyMatrixRecordingAPI.stopRecording(props.deviceSerial);

  if (result.success) {
    console.log('[RecordingControlPanel] Recording stopped successfully:', result);
    recordingStore.stopRecording(props.deviceSerial);
    stopDurationCounter();

    // Show success message with recording details
    toast.success(`Recording saved! Duration: ${Math.floor(result.duration)}s`, 'Recording Complete');
  } else {
    console.error('[RecordingControlPanel] Failed to stop recording:', result.error);
    toast.error(`Failed to stop recording: ${result.error}`, 'Recording Error');
  }
}

async function takeScreenshot() {
  console.log('[RecordingControlPanel] Taking screenshot...', {
    serial: props.deviceSerial
  });

  const result = await pyMatrixRecordingAPI.captureScreenshot(props.deviceSerial, {
    format: 'png'
  });

  if (result.success) {
    console.log('[RecordingControlPanel] Screenshot captured successfully:', result);
    toast.success('Screenshot saved successfully', 'Screenshot');
  } else {
    console.error('[RecordingControlPanel] Failed to capture screenshot:', result.error);
    toast.error(`Failed to capture screenshot: ${result.error}`, 'Screenshot Error');
  }
}

function startDurationCounter() {
  duration.value = 0;
  durationInterval.value = setInterval(() => {
    duration.value++;
  }, 1000);
}

function stopDurationCounter() {
  if (durationInterval.value) {
    clearInterval(durationInterval.value);
    durationInterval.value = null;
  }
  duration.value = 0;
}

watch(() => props.deviceSerial, () => {
  stopDurationCounter();
});

onUnmounted(() => {
  stopDurationCounter();
});
</script>

<style scoped>
.recording-control-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 5;
  min-width: 220px;
  opacity: 0;
  transition: opacity 0.3s ease, border-color 0.3s ease;
}

.recording-control-panel:hover,
.recording-control-panel:focus-within,
.recording-control-panel.recording {
  opacity: 1;
}

.recording-control-panel.recording {
  border-color: rgba(239, 68, 68, 0.5);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
}

@media (hover: none) {
  .recording-control-panel {
    opacity: 0.9;
  }
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.control-buttons {
  display: flex;
  gap: 6px;
}

.control-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.control-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.record-btn.active {
  background: rgba(239, 68, 68, 0.8);
  border-color: rgba(239, 68, 68, 1);
  color: white;
  animation: pulse-record 2s ease-in-out infinite;
}

.screenshot-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.btn-label {
  font-size: 11px;
}

.recording-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

.recording-time {
  font-size: 16px;
  font-weight: 700;
  color: white;
  font-variant-numeric: tabular-nums;
}

.recording-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.detail-label {
  color: rgba(255, 255, 255, 0.5);
}

.detail-value {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  text-transform: capitalize;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.setting-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.setting-select {
  flex: 1;
  padding: 4px 8px;
  font-size: 11px;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.setting-select:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.25);
}

.setting-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.setting-select option {
  background: #1a1a1a;
  color: white;
}

@keyframes pulse-record {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}
</style>
