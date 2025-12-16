<template>
  <div class="bg-white rounded-xl p-6 shadow-sm space-y-6">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-bold text-gray-800">🎯 Local Task Center</h3>
      <div class="flex items-center gap-3">
        <span :class="['px-3 py-1 text-xs font-bold rounded-full', state.isRunning ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600']">
          {{ state.isRunning ? '● RUNNING' : '○ STOPPED' }}
        </span>
        <button
          class="px-4 py-2 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
          @click="toggleCenter"
          :disabled="!config.apiUrl"
        >
          {{ state.isRunning ? 'Stop' : 'Start' }}
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">Server API URL:</label>
        <input
          v-model="config.apiUrl"
          @blur="saveConfig"
          type="text"
          placeholder="https://api.example.com"
          class="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>
    </div>

    <div v-if="state.stats" class="space-y-4">
      <!-- Overall Stats -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-purple-50 rounded-lg p-3 text-center space-y-1">
          <span class="block text-xs text-purple-600 font-medium">Processors</span>
          <span class="block text-lg font-bold text-purple-700">{{ state.stats.runningProcessors }}/{{ state.stats.totalProcessors }}</span>
        </div>
        <div class="bg-blue-50 rounded-lg p-3 text-center space-y-1">
          <span class="block text-xs text-blue-600 font-medium">Pending</span>
          <span class="block text-lg font-bold text-blue-700">{{ state.stats.totalPending }}</span>
        </div>
        <div class="bg-green-50 rounded-lg p-3 text-center space-y-1">
          <span class="block text-xs text-green-600 font-medium">Completed</span>
          <span class="block text-lg font-bold text-green-700">{{ state.stats.totalTranslated }}</span>
        </div>
        <div class="bg-red-50 rounded-lg p-3 text-center space-y-1">
          <span class="block text-xs text-red-600 font-medium">Failed</span>
          <span class="block text-lg font-bold text-red-700">{{ state.stats.totalFailed }}</span>
        </div>
      </div>

      <!-- Individual Processors -->
      <div class="space-y-3">
        <div
          v-for="(processor, type) in state.stats.processors"
          :key="type"
          class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-gray-800">{{ getProcessorName(type) }}</span>
            <span :class="['px-2.5 py-1 text-xs font-bold rounded-full', processor.isRunning ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600']">
              {{ processor.isRunning ? '▶ Active' : '⏸ Inactive' }}
            </span>
          </div>

          <div v-if="processor.isRunning" class="space-y-3">
            <!-- Bento Queue Stats -->
            <div class="grid grid-cols-3 gap-2">
              <div class="bg-blue-100 rounded-lg p-2 text-center space-y-1">
                <div class="text-xs text-blue-700 font-medium">Queue</div>
                <div class="text-base font-bold text-blue-800">{{ processor.stats.queueTotal || 0 }}</div>
              </div>
              <div class="bg-green-100 rounded-lg p-2 text-center space-y-1">
                <div class="text-xs text-green-700 font-medium">New</div>
                <div class="text-base font-bold text-green-800">{{ processor.stats.newTasks || 0 }}</div>
              </div>
              <div class="bg-orange-100 rounded-lg p-2 text-center space-y-1">
                <div class="text-xs text-orange-700 font-medium">Dup</div>
                <div class="text-base font-bold text-orange-800">{{ processor.stats.duplicateTasks || 0 }}</div>
              </div>
            </div>

            <!-- Traditional Stats -->
            <div class="flex flex-wrap gap-3 text-xs text-gray-600">
              <span class="font-medium">Pending: <span class="text-gray-800">{{ processor.stats.pending }}</span></span>
              <span class="font-medium">Done: <span class="text-gray-800">{{ processor.stats.translated }}</span></span>
              <span class="font-medium">Failed: <span class="text-gray-800">{{ processor.stats.failed }}</span></span>
              <span v-if="processor.stats.lastRun" class="font-medium">
                Last: <span class="text-gray-800">{{ formatTimestamp(processor.stats.lastRun) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useTaskCenter } from '../../composables/useTaskCenter';

const { isActive, config, state, saveConfig, startTaskCenter, stopTaskCenter, formatTimestamp, initialize } = useTaskCenter();

const toggleCenter = async () => {
  if (state.value.isRunning) {
    await stopTaskCenter();
  } else {
    await startTaskCenter();
  }
};

const getProcessorName = (type: string): string => {
  const names: Record<string, string> = {
    bing_dictionary: 'Bing Dictionary',
    deepseek: 'DeepSeek AI',
  };
  return names[type] || type;
};

onMounted(() => {
  initialize();
});
</script>

