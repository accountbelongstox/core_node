<template>
  <div class="max-w-full overflow-x-hidden">
    <!-- Header -->
    <div class="px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg mb-2">
      <h3 class="text-xs font-bold">Settings Center</h3>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <!-- Left Column -->
      <div class="flex flex-col gap-2 min-w-0">
        <!-- API Configuration -->
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 overflow-hidden">
          <h4 class="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1.5">API Configuration</h4>
          <div class="mb-2">
            <label class="block text-[9px] text-slate-400 mb-1">API Endpoint</label>
            <select
              v-model="appStore.settings.value.currentEndpoint"
              class="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-200"
              @change="handleEndpointChange"
            >
              <option v-for="endpoint in apiEndpoints" :key="endpoint.id" :value="endpoint.id">
                {{ endpoint.description }} ({{ endpoint.url }})
              </option>
              <option value="custom">Custom...</option>
            </select>
          </div>
          <div v-if="appStore.settings.value.currentEndpoint === 'custom'" class="mb-2">
            <label class="block text-[9px] text-slate-400 mb-1">Custom URL</label>
            <input
              v-model="appStore.settings.value.customEndpoint"
              type="text"
              class="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-200"
              placeholder="http://localhost:9000"
            />
          </div>
          <div class="px-2 py-1 bg-slate-900/50 rounded text-[9px] text-slate-500 break-all">
            Current: <strong class="text-slate-300">{{ getCurrentEndpointUrl() }}</strong>
          </div>
        </div>

        <!-- Task Queue -->
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 overflow-hidden">
          <h4 class="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1.5">Task Queue</h4>
          <div class="flex justify-between items-center mb-2">
            <div>
              <label class="block text-[10px] text-slate-300">Enable Task Queue</label>
              <span class="block text-[8px] text-slate-500">Process API requests locally</span>
            </div>
            <button @click="toggleTaskQueue" :class="['w-7 h-4 rounded-full relative transition-colors', appStore.settings.value.taskQueue.enabled ? 'bg-purple-600' : 'bg-slate-600']">
              <div :class="['absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', appStore.settings.value.taskQueue.enabled ? 'left-3.5' : 'left-0.5']" />
            </button>
          </div>

          <template v-if="appStore.settings.value.taskQueue.enabled">
            <div class="flex justify-between items-center mb-2">
              <div>
                <label class="block text-[10px] text-slate-300">Queue Status</label>
              </div>
              <button
                class="px-2 py-0.5 rounded text-[9px] font-bold text-white transition-all"
                :class="appStore.settings.value.taskQueue.paused ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'"
                @click="togglePause"
              >
                {{ appStore.settings.value.taskQueue.paused ? 'Resume' : 'Pause' }}
              </button>
            </div>
            <div class="mb-1.5">
              <label class="block text-[9px] text-slate-400 mb-0.5">Max Concurrent: {{ appStore.settings.value.taskQueue.maxConcurrent }}</label>
              <input type="range" min="1" max="10" :value="appStore.settings.value.taskQueue.maxConcurrent" @input="updateMaxConcurrent"
                class="w-full h-1 rounded-full bg-slate-700 outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer" />
            </div>
            <div class="mb-1.5">
              <label class="block text-[9px] text-slate-400 mb-0.5">Retry Attempts: {{ appStore.settings.value.taskQueue.retryAttempts }}</label>
              <input type="range" min="0" max="5" :value="appStore.settings.value.taskQueue.retryAttempts" @input="updateRetryAttempts"
                class="w-full h-1 rounded-full bg-slate-700 outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer" />
            </div>
            <div class="grid grid-cols-4 gap-1 my-1.5 p-1.5 bg-slate-900/50 rounded">
              <div class="text-center">
                <span class="block text-[8px] text-slate-500">Pending</span>
                <span class="block text-xs font-bold text-slate-200">{{ taskStats.pending }}</span>
              </div>
              <div class="text-center">
                <span class="block text-[8px] text-slate-500">Running</span>
                <span class="block text-xs font-bold text-blue-400">{{ taskStats.running }}</span>
              </div>
              <div class="text-center">
                <span class="block text-[8px] text-slate-500">Done</span>
                <span class="block text-xs font-bold text-green-400">{{ taskStats.completed }}</span>
              </div>
              <div class="text-center">
                <span class="block text-[8px] text-slate-500">Failed</span>
                <span class="block text-xs font-bold text-red-400">{{ taskStats.failed }}</span>
              </div>
            </div>
            <div class="flex gap-1.5">
              <button class="flex-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[9px] transition-colors" @click="clearCompleted">Clear Done</button>
              <button class="flex-1 px-2 py-1 bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 rounded text-[9px] transition-colors" @click="clearAll">Clear All</button>
            </div>
          </template>
        </div>
      </div>

      <!-- Right Column -->
      <div class="flex flex-col gap-2 min-w-0">
        <!-- Server Settings -->
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 overflow-hidden">
          <h4 class="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1.5">Server</h4>
          <div class="flex justify-between items-center mb-2">
            <div>
              <label class="block text-[10px] text-slate-300">Auto Connect</label>
              <span class="block text-[8px] text-slate-500">Connect on startup</span>
            </div>
            <button @click="toggleAutoConnect" :class="['w-7 h-4 rounded-full relative transition-colors', appStore.settings.value.autoConnectServer ? 'bg-purple-600' : 'bg-slate-600']">
              <div :class="['absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', appStore.settings.value.autoConnectServer ? 'left-3.5' : 'left-0.5']" />
            </button>
          </div>
          <div class="mb-2">
            <label class="block text-[9px] text-slate-400 mb-1">Server Port</label>
            <input type="number" :value="appStore.settings.value.serverPort" @input="updateServerPort"
              class="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-200" min="1024" max="65535" />
          </div>
          <div class="flex items-center gap-1.5 px-2 py-1.5 rounded-md" :class="appStore.serverStatus.value.isRunning ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'">
            <span class="w-2 h-2 rounded-full" :class="appStore.serverStatus.value.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'"></span>
            <span class="text-[10px] font-medium" :class="appStore.serverStatus.value.isRunning ? 'text-emerald-400' : 'text-rose-400'">
              {{ appStore.serverStatus.value.isRunning ? 'Connected' : 'Disconnected' }}
            </span>
            <span v-if="appStore.serverStatus.value.port" class="text-[9px] text-slate-500 font-mono">:{{ appStore.serverStatus.value.port }}</span>
          </div>
        </div>

        <!-- Other Settings -->
        <div class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 overflow-hidden">
          <h4 class="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1.5">Other</h4>
          <div class="flex justify-between items-center mb-2">
            <div>
              <label class="block text-[10px] text-slate-300">Debug Mode</label>
              <span class="block text-[8px] text-slate-500">Show detailed logs</span>
            </div>
            <button @click="toggleDebugMode" :class="['w-7 h-4 rounded-full relative transition-colors', appStore.settings.value.debugMode ? 'bg-purple-600' : 'bg-slate-600']">
              <div :class="['absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', appStore.settings.value.debugMode ? 'left-3.5' : 'left-0.5']" />
            </button>
          </div>
          <button class="w-full px-2 py-1.5 bg-rose-900/20 border border-rose-900/40 text-rose-400 rounded text-[9px] font-bold transition-all hover:bg-rose-900/30" @click="handleReset">
            Reset All Settings
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useAppStore } from '@/composables/useAppStore';
import { useTaskQueue } from '@/composables/useTaskQueue';
import { API_ENDPOINTS } from '@/config/api-endpoints';

const appStore = useAppStore();
const taskQueue = useTaskQueue();

const apiEndpoints = API_ENDPOINTS;

// Task queue statistics
const taskStats = computed(() => taskQueue.getStats());

// Get current endpoint URL
const getCurrentEndpointUrl = () => {
  const currentId = appStore.settings.value.currentEndpoint;

  if (currentId === 'custom') {
    return appStore.settings.value.customEndpoint || 'Not set';
  }

  const endpoint = apiEndpoints.find(e => e.id === currentId);
  if (endpoint) {
    const port = endpoint.port ? `:${endpoint.port}` : '';
    return `${endpoint.protocol}://${endpoint.url}${port}`;
  }

  return 'Unknown';
};

// API endpoint change
const handleEndpointChange = () => {
  console.log('[Settings] Endpoint changed:', appStore.settings.value.currentEndpoint);
};

// Task queue control
const toggleTaskQueue = () => {
  if (appStore.settings.value.taskQueue.enabled) {
    appStore.disableTaskQueue();
  } else {
    appStore.enableTaskQueue();
  }
};

const togglePause = () => {
  if (appStore.settings.value.taskQueue.paused) {
    appStore.resumeTaskQueue();
  } else {
    appStore.pauseTaskQueue();
  }
};

const updateMaxConcurrent = (e: Event) => {
  const value = parseInt((e.target as HTMLInputElement).value);
  appStore.setMaxConcurrent(value);
};

const updateRetryAttempts = (e: Event) => {
  const value = parseInt((e.target as HTMLInputElement).value);
  appStore.setRetryAttempts(value);
};

const clearCompleted = () => {
  taskQueue.clearCompletedTasks();
};

const clearAll = () => {
  if (confirm('Are you sure you want to clear the entire task queue?')) {
    taskQueue.clearAllTasks();
  }
};

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
