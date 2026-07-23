<template>
  <div class="max-w-full overflow-x-hidden">
    <div class="grid grid-cols-2 gap-2">
      <!-- Server Settings -->
      <div class="tk-card rounded-lg p-2.5 overflow-hidden border">
        <h4 class="text-[9px] font-bold uppercase tracking-tight mb-1.5" style="color: var(--text-muted)">Server</h4>
        <div class="flex justify-between items-center mb-2">
          <div>
            <label class="block text-[10px]" style="color: var(--text)">Auto Connect</label>
            <span class="block text-[8px]" style="color: var(--text-faint)">Connect on startup</span>
          </div>
          <button @click="toggleAutoConnect" :class="['w-7 h-4 rounded-full relative transition-colors', appStore.settings.value.autoConnectServer ? 'bg-purple-600' : 'bg-slate-600']">
            <div :class="['absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', appStore.settings.value.autoConnectServer ? 'left-3.5' : 'left-0.5']" />
          </button>
        </div>
        <div class="mb-2">
          <label class="block text-[9px] mb-1" style="color: var(--text-muted)">Native MCP Port</label>
          <input type="number" :value="appStore.settings.value.serverPort" @input="updateServerPort"
            class="tk-input w-full px-2 py-1 border rounded text-[10px]" min="1024" max="65535" />
        </div>
        <div class="flex items-center gap-1.5 px-2 py-1.5 rounded-md" :class="appStore.serverStatus.value.isRunning ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'">
          <span class="w-2 h-2 rounded-full" :class="appStore.serverStatus.value.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'" />
          <span class="text-[10px] font-medium" :class="appStore.serverStatus.value.isRunning ? 'text-emerald-400' : 'text-rose-400'">
            {{ appStore.serverStatus.value.isRunning ? 'Connected' : 'Disconnected' }}
          </span>
          <span v-if="appStore.serverStatus.value.port" class="text-[9px] font-mono" style="color: var(--text-faint)">:{{ appStore.serverStatus.value.port }}</span>
        </div>
      </div>

      <!-- Other Settings -->
      <div class="tk-card rounded-lg p-2.5 overflow-hidden border">
        <h4 class="text-[9px] font-bold uppercase tracking-tight mb-1.5" style="color: var(--text-muted)">Other</h4>
        <div class="flex justify-between items-center mb-2">
          <div>
            <label class="block text-[10px]" style="color: var(--text)">Debug Mode</label>
            <span class="block text-[8px]" style="color: var(--text-faint)">Show detailed logs</span>
          </div>
          <button @click="toggleDebugMode" :class="['w-7 h-4 rounded-full relative transition-colors', appStore.settings.value.debugMode ? 'bg-purple-600' : 'bg-slate-600']">
            <div :class="['absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', appStore.settings.value.debugMode ? 'left-3.5' : 'left-0.5']" />
          </button>
        </div>
        <div class="mb-2">
          <label class="block text-[9px] mb-1" style="color: var(--text-muted)">Backend Timeout (ms)</label>
          <input type="number" :value="backendTimeoutMs" @input="updateBackendTimeout"
            class="tk-input w-full px-2 py-1 border rounded text-[10px]" min="1000" max="3600000" step="1000" />
          <span class="block text-[8px] mt-1" style="color: var(--text-faint)">Pending retries: {{ outboxPending }}</span>
        </div>
        <button class="w-full px-2 py-1.5 bg-rose-900/20 border border-rose-900/40 text-rose-400 rounded text-[9px] font-bold transition-all hover:bg-rose-900/30" @click="handleReset">
          Reset All Settings
        </button>
      </div>
    </div>

    <!-- AI Web Provider (full width) -->
    <div class="mt-2">
      <ApiSettings />
    </div>

    <div class="mt-2">
      <TaskCapabilitySettings />
    </div>

    <div class="mt-2">
      <QwenTtsSettings />
    </div>

    <div class="mt-2">
      <BingWorkerSettings />
    </div>

    <div class="mt-2">
      <AudioRecordingSettings />
    </div>

    <div class="mt-2">
      <AiWebProviderSettings />
    </div>

    <!-- Cache Storage (full width) -->
    <div class="mt-2">
      <CacheSettings />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useAppStore } from '@/composables/useAppStore';
import CacheSettings from './CacheSettings.vue';
import AiWebProviderSettings from './AiWebProviderSettings.vue';
import ApiSettings from './ApiSettings.vue';
import TaskCapabilitySettings from './TaskCapabilitySettings.vue';
import QwenTtsSettings from './QwenTtsSettings.vue';
import BingWorkerSettings from './BingWorkerSettings.vue';
import AudioRecordingSettings from './AudioRecordingSettings.vue';
import {
  getBackendTimeoutMs,
  setBackendTimeoutMs,
  DEFAULT_BACKEND_TIMEOUT_MS,
  MIN_BACKEND_TIMEOUT_MS,
  MAX_BACKEND_TIMEOUT_MS,
} from '@/utils/backend-timeout';
import { SUBMIT_OUTBOX_MSG } from '@/utils/task-center-types';

const appStore = useAppStore();

// Backend timeout — single-sourced in utils/backend-timeout (NOT in AppSettings,
// to avoid a second source of truth). Hydrated from storage, written on input.
const backendTimeoutMs = ref<number>(DEFAULT_BACKEND_TIMEOUT_MS);
const outboxPending = ref<number>(0);
let outboxTimer: ReturnType<typeof setInterval> | null = null;

const updateBackendTimeout = (e: Event) => {
  const value = parseInt((e.target as HTMLInputElement).value, 10);
  if (!Number.isFinite(value)) return;
  backendTimeoutMs.value = Math.max(MIN_BACKEND_TIMEOUT_MS, Math.min(MAX_BACKEND_TIMEOUT_MS, value));
  void setBackendTimeoutMs(backendTimeoutMs.value);
};

const refreshOutbox = () => {
  try {
    chrome.runtime.sendMessage({ type: SUBMIT_OUTBOX_MSG, action: 'status' }, (resp: any) => {
      if (chrome.runtime.lastError) return;
      if (resp?.success && resp.status) outboxPending.value = resp.status.pending ?? 0;
    });
  } catch {
    /* popup may be detached */
  }
};

onMounted(async () => {
  try {
    backendTimeoutMs.value = await getBackendTimeoutMs();
  } catch {
    /* keep default */
  }
  refreshOutbox();
  outboxTimer = setInterval(refreshOutbox, 3000);
});

onUnmounted(() => {
  if (outboxTimer) clearInterval(outboxTimer);
});

// Server settings
const toggleAutoConnect = () => {
  appStore.setAutoConnectServer(!appStore.settings.value.autoConnectServer);
};

const updateServerPort = (e: Event) => {
  const value = parseInt((e.target as HTMLInputElement).value);
  if (value >= 1024 && value <= 65535) {
    appStore.setServerPort(value);
  }
};

// Other settings
const toggleDebugMode = () => {
  appStore.setDebugMode(!appStore.settings.value.debugMode);
};

const handleReset = () => {
  if (confirm('Are you sure you want to reset all settings? This action cannot be undone.')) {
    appStore.resetSettings();
  }
};
</script>

<style scoped>
/* Token-driven surfaces for utilities Tailwind can't express as a variable. */
.tk-card {
  background: var(--surface);
  border-color: var(--border);
}
.tk-btn {
  background: var(--surface-2);
  color: var(--text);
}
.tk-btn:hover {
  background: var(--surface-solid);
}
.tk-input {
  background: var(--surface-2);
  border-color: var(--border);
  color: var(--text);
}
.tk-range {
  background: var(--border-strong);
}
</style>
