<template>
  <div class="space-y-2">
      <!-- Recording Status -->
      <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[9px] font-bold text-slate-400 uppercase">{{ getMessage('recordingStatusLabel') }}</span>
          <div class="flex items-center gap-1.5">
            <span :class="['w-2 h-2 rounded-full', recordingInfo.isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-600']"></span>
            <span class="text-[10px] font-medium" :class="recordingInfo.isRecording ? 'text-red-400' : 'text-slate-400'">{{ getRecordingStatusText() }}</span>
          </div>
        </div>
        <div v-if="recordingInfo.isRecording" class="grid grid-cols-2 gap-1.5">
          <div class="flex justify-between items-center px-1.5 py-1 bg-slate-900/50 rounded text-[9px]">
            <span class="text-slate-500">{{ getMessage('durationLabel') }}</span>
            <span class="text-slate-200 font-mono">{{ formatDuration(recordingInfo.duration) }}</span>
          </div>
          <div class="flex justify-between items-center px-1.5 py-1 bg-slate-900/50 rounded text-[9px]">
            <span class="text-slate-500">{{ getMessage('chunkCountLabel') }}</span>
            <span class="text-slate-200 font-mono">{{ recordingInfo.chunkCount }}</span>
          </div>
        </div>
      </div>

      <!-- Recording target: tabCapture cannot record chrome:// / extension pages. -->
      <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[9px] font-bold text-slate-400 uppercase">{{ getMessage('recordingTargetLabel') }}</span>
          <button @click="loadRecordableTabs" class="text-[9px] text-indigo-400 hover:underline" :disabled="recordingInfo.isRecording">↻</button>
        </div>
        <select
          v-if="recordableTabs.length"
          v-model="selectedTabId"
          :disabled="recordingInfo.isRecording"
          class="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-200 disabled:opacity-50"
        >
          <option v-for="tab in recordableTabs" :key="tab.id" :value="tab.id">{{ truncateTitle(tab.title) }}</option>
        </select>
        <p v-else class="text-[9px] text-amber-400">{{ getMessage('noRecordableTabs') }}</p>
      </div>

      <!-- Quick Actions -->
      <p v-if="isFirefox" class="text-[9px] text-amber-400">{{ firefoxUnsupportedMessage }}</p>
      <div class="flex gap-1.5">
        <button @click="startRecording" :disabled="isFirefox || recordingInfo.isRecording || selectedTabId === null"
          class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {{ getMessage('startRecordingButton') }}
        </button>
        <button @click="stopRecording" :disabled="!recordingInfo.isRecording"
          class="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {{ getMessage('stopRecordingButton') }}
        </button>
      </div>

      <p class="text-[9px] text-slate-500">{{ getMessage('recordingSettingsManagedHint') }}</p>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { getMessage } from '../../../utils/i18n';
import { useAudioRecordingConfig } from '../composables/useAudioRecordingConfig';

interface RecordingInfo {
  isRecording: boolean;
  duration: number;
  chunkCount: number;
}

// Firefox has no chrome.tabCapture / chrome.offscreen APIs, so the whole tab
// audio recording pipeline is Chrome-only; compile-time constant, tree-shaken
// out of Chrome builds.
const isFirefox = import.meta.env.FIREFOX;
const firefoxUnsupportedMessage =
  'Audio recording is not available on Firefox: it requires the Chrome-only tabCapture and offscreen APIs.';

const {
  apiServers,
  recordingSettings,
  sessionMetadata,
  initialize: initializeConfig,
  updateSessionMetadata,
} = useAudioRecordingConfig();

const recordingInfo = ref<RecordingInfo>({
  isRecording: false,
  duration: 0,
  chunkCount: 0,
});

// Recordable-tab picker. chrome.tabCapture CANNOT capture chrome://, extension,
// devtools, or other system pages, so the user must pick a real web-page tab
// (the active tab is often a system page, e.g. chrome://extensions).
interface RecordableTab {
  id: number;
  title: string;
  url: string;
}
const recordableTabs = ref<RecordableTab[]>([]);
const selectedTabId = ref<number | null>(null);

const isRecordableUrl = (url?: string): boolean => /^(https?|file):/i.test(url || '');

const truncateTitle = (s: string): string => (s.length > 48 ? s.slice(0, 48) + '…' : s);

const loadRecordableTabs = async () => {
  try {
    const tabs = await chrome.tabs.query({});
    recordableTabs.value = tabs
      .filter((t) => t.id !== undefined && isRecordableUrl(t.url))
      .map((t) => ({ id: t.id as number, title: t.title || t.url || `Tab ${t.id}`, url: t.url || '' }));

    // Default to the active tab when it is recordable; otherwise the first recordable tab.
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id !== undefined && isRecordableUrl(active.url)) {
      selectedTabId.value = active.id;
    } else if (
      recordableTabs.value.length &&
      !recordableTabs.value.some((t) => t.id === selectedTabId.value)
    ) {
      selectedTabId.value = recordableTabs.value[0].id;
    } else if (!recordableTabs.value.length) {
      selectedTabId.value = null;
    }
  } catch (error) {
    console.error('Failed to load recordable tabs:', error);
  }
};

const getRecordingStatusText = () => {
  return recordingInfo.value.isRecording ? getMessage('recordingStatus') : getMessage('idleStatus');
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const startRecording = async () => {
  try {
    if (isFirefox) {
      alert(firefoxUnsupportedMessage);
      return;
    }

    const metadataValid = updateSessionMetadata(true);
    if (!metadataValid) {
      return;
    }

    if (selectedTabId.value === null) {
      alert(getMessage('noRecordableTabs'));
      return;
    }
    const response = await chrome.runtime.sendMessage({
      type: 'audio_start_recording',
      config: {
        tabId: selectedTabId.value,
        apiServers: apiServers.value.filter(s => s.enabled),
        recordingSettings: recordingSettings.value,
        sessionMetadata: sessionMetadata.value,
      },
    });

    if (response && response.success) {
      recordingInfo.value.isRecording = true;
      startDurationTimer();
    } else {
      console.error('Failed to start recording:', response?.error);
      alert(getMessage('startRecordingError', [response?.error || getMessage('unknownErrorMessage')]));
    }
  } catch (error) {
    console.error('Error starting recording:', error);
    alert(getMessage('recordingGeneralError', [String(error)]));
  }
};

const stopRecording = async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'audio_stop_recording',
    });

    if (response && response.success) {
      recordingInfo.value.isRecording = false;
      recordingInfo.value.duration = 0;
      recordingInfo.value.chunkCount = 0;
      stopDurationTimer();
    } else {
      console.error('Failed to stop recording:', response?.error);
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
  }
};

let durationTimer: ReturnType<typeof setInterval> | null = null;

const startDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer);
  }
  durationTimer = setInterval(() => {
    recordingInfo.value.duration++;
  }, 1000);
};

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
};

const handleRecordingStatusMessage = (message: any) => {
  if (message.type === 'audio_recording_status_update') {
    recordingInfo.value = message.status;
  }
};

onMounted(async () => {
  await initializeConfig();
  await loadRecordableTabs();
  chrome.runtime.onMessage.addListener(handleRecordingStatusMessage);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'audio_get_recording_status',
    });
    if (response.success) {
      recordingInfo.value = response.status;
      if (recordingInfo.value.isRecording) {
        startDurationTimer();
      }
    }
  } catch (error) {
    console.error('Failed to get initial recording status:', error);
  }
});

onUnmounted(() => {
  stopDurationTimer();
  chrome.runtime.onMessage.removeListener(handleRecordingStatusMessage);
});
</script>
