<template>
  <div class="p-0 max-w-full overflow-x-hidden">
    <!-- Header -->
    <div class="px-6 py-5 bg-gradient-to-r from-purple-500 to-purple-700 text-white -mx-6 -mt-5 mb-5">
      <h3 class="text-2xl font-bold mb-2">⚙️ Settings Center</h3>
      <p class="text-sm opacity-90">Unified Configuration Management</p>
    </div>

    <div class="grid grid-cols-2 gap-5 px-1">
      <!-- Left Column -->
      <div class="flex flex-col gap-4 min-w-0">
        <!-- API Configuration -->
        <div class="bg-white rounded-xl p-5 shadow-sm overflow-hidden">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-100">
            <span class="text-xl">🌐</span>
            <h4 class="text-base font-semibold text-gray-800">API Configuration</h4>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-600 mb-2">API Endpoint</label>
            <select
              v-model="appStore.settings.value.currentEndpoint"
              class="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 box-border"
              @change="handleEndpointChange"
            >
              <option v-for="endpoint in apiEndpoints" :key="endpoint.id" :value="endpoint.id">
                {{ endpoint.description }} ({{ endpoint.url }})
              </option>
              <option value="custom">Custom...</option>
            </select>
          </div>

          <div v-if="appStore.settings.value.currentEndpoint === 'custom'" class="mb-4">
            <label class="block text-sm font-medium text-gray-600 mb-2">Custom URL</label>
            <input
              v-model="appStore.settings.value.customEndpoint"
              type="text"
              class="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 box-border"
              placeholder="http://localhost:9000"
            />
          </div>

          <div class="mt-2 px-3 py-2 bg-gray-50 rounded-md text-xs text-gray-600 break-all">
            Current: <strong>{{ getCurrentEndpointUrl() }}</strong>
          </div>
        </div>

        <!-- Task Queue -->
        <div class="bg-white rounded-xl p-5 shadow-sm overflow-hidden">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-100">
            <span class="text-xl">📋</span>
            <h4 class="text-base font-semibold text-gray-800">Task Queue</h4>
          </div>

          <div class="mb-4">
            <div class="flex justify-between items-center gap-4">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-600">Enable Task Queue</label>
                <span class="block text-xs text-gray-400 mt-1">Process API requests locally</span>
              </div>
              <label class="relative inline-block w-12 h-6.5 flex-shrink-0">
                <input
                  type="checkbox"
                  class="opacity-0 w-0 h-0"
                  :checked="appStore.settings.value.taskQueue.enabled"
                  @change="toggleTaskQueue"
                />
                <span class="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-300 transition-all duration-300 rounded-full before:absolute before:content-[''] before:h-4.5 before:w-4.5 before:left-1 before:bottom-1 before:bg-white before:transition-all before:duration-300 before:rounded-full" :class="appStore.settings.value.taskQueue.enabled ? 'bg-purple-500 before:translate-x-5.5' : ''"></span>
              </label>
            </div>
          </div>

          <template v-if="appStore.settings.value.taskQueue.enabled">
            <div class="mb-4">
              <div class="flex justify-between items-center gap-4">
                <div class="flex-1">
                  <label class="block text-sm font-medium text-gray-600">Queue Status</label>
                  <span class="block text-xs text-gray-400 mt-1">Pause to stop new tasks</span>
                </div>
                <button
                  class="px-4 py-2 rounded-md text-xs font-medium text-white transition-all"
                  :class="appStore.settings.value.taskQueue.paused ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-500 hover:bg-purple-700'"
                  @click="togglePause"
                >
                  {{ appStore.settings.value.taskQueue.paused ? '▶ Resume' : '⏸ Pause' }}
                </button>
              </div>
            </div>

            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-600 mb-2">
                Max Concurrent: {{ appStore.settings.value.taskQueue.maxConcurrent }}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                :value="appStore.settings.value.taskQueue.maxConcurrent"
                @input="updateMaxConcurrent"
                class="w-full h-1.5 rounded-full bg-gray-200 outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4.5 [&::-webkit-slider-thumb]:h-4.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb:hover]:bg-purple-700 [&::-webkit-slider-thumb:hover]:scale-110"
              />
            </div>

            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-600 mb-2">
                Retry Attempts: {{ appStore.settings.value.taskQueue.retryAttempts }}
              </label>
              <input
                type="range"
                min="0"
                max="5"
                :value="appStore.settings.value.taskQueue.retryAttempts"
                @input="updateRetryAttempts"
                class="w-full h-1.5 rounded-full bg-gray-200 outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4.5 [&::-webkit-slider-thumb]:h-4.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb:hover]:bg-purple-700 [&::-webkit-slider-thumb:hover]:scale-110"
              />
            </div>

            <!-- Queue Stats -->
            <div class="grid grid-cols-2 gap-3 my-4 p-4 bg-gray-50 rounded-lg">
              <div class="text-center">
                <span class="block text-2xs text-gray-500 mb-1">Pending</span>
                <span class="block text-xl font-bold text-gray-800">{{ taskStats.pending }}</span>
              </div>
              <div class="text-center">
                <span class="block text-2xs text-gray-500 mb-1">Running</span>
                <span class="block text-xl font-bold text-blue-500">{{ taskStats.running }}</span>
              </div>
              <div class="text-center">
                <span class="block text-2xs text-gray-500 mb-1">Completed</span>
                <span class="block text-xl font-bold text-green-500">{{ taskStats.completed }}</span>
              </div>
              <div class="text-center">
                <span class="block text-2xs text-gray-500 mb-1">Failed</span>
                <span class="block text-xl font-bold text-red-500">{{ taskStats.failed }}</span>
              </div>
            </div>

            <div class="flex gap-2">
              <button
                class="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium transition-all hover:bg-gray-200"
                @click="clearCompleted"
              >
                Clear Completed
              </button>
              <button
                class="flex-1 px-4 py-2.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium transition-all hover:bg-red-100"
                @click="clearAll"
              >
                Clear All
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- Right Column -->
      <div class="flex flex-col gap-4 min-w-0">
        <!-- Server Settings -->
        <div class="bg-white rounded-xl p-5 shadow-sm overflow-hidden">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-100">
            <span class="text-xl">🖥️</span>
            <h4 class="text-base font-semibold text-gray-800">Server</h4>
          </div>

          <div class="mb-4">
            <div class="flex justify-between items-center gap-4">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-600">Auto Connect</label>
                <span class="block text-xs text-gray-400 mt-1">Connect server on startup</span>
              </div>
              <label class="relative inline-block w-12 h-6.5 flex-shrink-0">
                <input
                  type="checkbox"
                  class="opacity-0 w-0 h-0"
                  :checked="appStore.settings.value.autoConnectServer"
                  @change="toggleAutoConnect"
                />
                <span class="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-300 transition-all duration-300 rounded-full before:absolute before:content-[''] before:h-4.5 before:w-4.5 before:left-1 before:bottom-1 before:bg-white before:transition-all before:duration-300 before:rounded-full" :class="appStore.settings.value.autoConnectServer ? 'bg-purple-500 before:translate-x-5.5' : ''"></span>
              </label>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-600 mb-2">Server Port</label>
            <input
              type="number"
              :value="appStore.settings.value.serverPort"
              @input="updateServerPort"
              class="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm bg-gray-50 transition-all focus:outline-none focus:border-purple-500 box-border"
              min="1024"
              max="65535"
            />
          </div>

          <div
            class="flex items-center gap-2 px-3 py-3 rounded-lg mt-3 transition-all"
            :class="appStore.serverStatus.value.isRunning ? 'bg-green-100' : 'bg-red-100'"
          >
            <span
              class="w-2.5 h-2.5 rounded-full"
              :class="appStore.serverStatus.value.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-600'"
            ></span>
            <span class="text-sm font-medium text-gray-800">
              {{ appStore.serverStatus.value.isRunning ? 'Connected' : 'Disconnected' }}
            </span>
            <span v-if="appStore.serverStatus.value.port" class="text-xs text-gray-600 font-mono">
              :{{ appStore.serverStatus.value.port }}
            </span>
          </div>
        </div>

        <!-- Other Settings -->
        <div class="bg-white rounded-xl p-5 shadow-sm overflow-hidden">
          <div class="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-100">
            <span class="text-xl">🔧</span>
            <h4 class="text-base font-semibold text-gray-800">Other</h4>
          </div>

          <div class="mb-4">
            <div class="flex justify-between items-center gap-4">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-600">Debug Mode</label>
                <span class="block text-xs text-gray-400 mt-1">Show detailed logs</span>
              </div>
              <label class="relative inline-block w-12 h-6.5 flex-shrink-0">
                <input
                  type="checkbox"
                  class="opacity-0 w-0 h-0"
                  :checked="appStore.settings.value.debugMode"
                  @change="toggleDebugMode"
                />
                <span class="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-300 transition-all duration-300 rounded-full before:absolute before:content-[''] before:h-4.5 before:w-4.5 before:left-1 before:bottom-1 before:bg-white before:transition-all before:duration-300 before:rounded-full" :class="appStore.settings.value.debugMode ? 'bg-purple-500 before:translate-x-5.5' : ''"></span>
              </label>
            </div>
          </div>

          <div>
            <button
              class="w-full px-4 py-2.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium transition-all hover:bg-red-100"
              @click="handleReset"
            >
              Reset All Settings
            </button>
          </div>
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
