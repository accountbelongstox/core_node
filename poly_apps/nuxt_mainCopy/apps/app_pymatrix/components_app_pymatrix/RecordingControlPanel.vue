<template>
  <div class="pm-panel pm-panel--fire" :class="{ recording: isRecording }">
    <div class="control-section">
      <div class="section-label">Recording</div>

      <div class="control-buttons">
        <button
          class="pm-button pm-button--fire"
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
          class="pm-button pm-button--danger"
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
        <span class="pm-video-status pm-video-status--recording"></span>
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
import { pyMatrixRecordingAPI } from '@/services/api/pymatrix/pymatrix-recording-api';
import type { RecordingFormat, RecordingMode } from '@/types/pymatrix';

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
