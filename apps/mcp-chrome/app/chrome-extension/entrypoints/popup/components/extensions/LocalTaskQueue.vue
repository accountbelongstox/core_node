<template>
  <div class="bg-white rounded-xl p-6 shadow-sm space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-bold text-gray-800">🎯 Local Task Queue</h3>
      <div class="flex items-center gap-3">
        <span
          :class="[
            'px-3 py-1 text-xs font-bold rounded-full',
            isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600',
          ]"
        >
          {{ isActive ? '● RUNNING' : '○ STOPPED' }}
        </span>
        <button
          v-if="!isRunning"
          class="px-4 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors text-sm"
          @click="start"
        >
          Start
        </button>
        <button
          v-else
          class="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors text-sm"
          @click="stop"
        >
          Stop
        </button>
      </div>
    </div>

    <!-- Overall Stats -->
    <div class="grid grid-cols-4 gap-3">
      <div class="bg-blue-50 rounded-lg p-3 text-center space-y-1">
        <span class="block text-xs text-blue-600 font-medium">Pending</span>
        <span class="block text-lg font-bold text-blue-700">{{ stats.pending }}</span>
      </div>
      <div class="bg-yellow-50 rounded-lg p-3 text-center space-y-1">
        <span class="block text-xs text-yellow-600 font-medium">Processing</span>
        <span class="block text-lg font-bold text-yellow-700">{{ stats.processing }}</span>
      </div>
      <div class="bg-green-50 rounded-lg p-3 text-center space-y-1">
        <span class="block text-xs text-green-600 font-medium">Completed</span>
        <span class="block text-lg font-bold text-green-700">{{ stats.completed }}</span>
      </div>
      <div class="bg-red-50 rounded-lg p-3 text-center space-y-1">
        <span class="block text-xs text-red-600 font-medium">Failed</span>
        <span class="block text-lg font-bold text-red-700">{{ stats.failed }}</span>
      </div>
    </div>

    <!-- Task List -->
    <div v-if="tasks.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-semibold text-gray-800">Tasks ({{ tasks.length }})</h4>
        <button
          v-if="stats.completed > 0 || stats.failed > 0"
          class="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 font-medium rounded hover:bg-gray-100 transition-colors"
          @click="clearCompleted"
        >
          Clear Completed
        </button>
      </div>

      <div class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="task in displayTasks"
          :key="task.id"
          class="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2"
        >
          <!-- Task Header -->
          <div class="flex items-start justify-between">
            <div class="flex-1 space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-gray-800">{{ formatTaskType(task.type) }}</span>
                <span
                  :class="[
                    'px-2 py-0.5 text-xs font-bold rounded-full',
                    getStatusClass(task.status),
                  ]"
                >
                  {{ getStatusLabel(task.status) }}
                </span>
              </div>
              <span class="text-xs text-gray-500">ID: {{ task.id.substring(0, 20) }}...</span>
            </div>
            <button
              v-if="task.status === 'pending' || task.status === 'processing'"
              class="text-xs text-red-600 hover:text-red-800 font-medium"
              @click="cancelTask(task.id)"
            >
              Cancel
            </button>
          </div>

          <!-- Task Details -->
          <div class="text-xs text-gray-600 space-y-1">
            <div v-if="task.type === 'bing_dictionary'">
              Words: {{ task.details.words?.length || 0 }}
            </div>
            <div v-else-if="task.type === 'deepseek_chat'">
              Prompt: {{ task.details.prompt?.substring(0, 50) }}...
            </div>
            <div>
              Created: {{ formatTimestamp(task.createdAt) }}
            </div>
            <div v-if="task.startedAt">
              Started: {{ formatTimestamp(task.startedAt) }}
            </div>
          </div>

          <!-- Progress Bar -->
          <div v-if="task.status === 'processing' && task.progress !== undefined" class="space-y-1">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-500 h-2 rounded-full transition-all duration-300"
                :style="{ width: `${task.progress}%` }"
              ></div>
            </div>
            <span class="text-xs text-gray-600">{{ task.progress }}%</span>
          </div>

          <!-- Error Message -->
          <div v-if="task.status === 'failed' && task.error" class="text-xs text-red-600">
            Error: {{ task.error }}
          </div>

          <!-- Result Summary -->
          <div v-if="task.status === 'completed' && task.result" class="text-xs text-green-600">
            <div v-if="task.type === 'bing_dictionary'">
              ✓ {{ task.result.successCount }}/{{ task.result.totalWords }} words translated
            </div>
            <div v-else-if="task.type === 'deepseek_chat'">
              ✓ Response: {{ task.result.response?.substring(0, 100) }}...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8 text-gray-500">
      <div class="text-4xl mb-2">📋</div>
      <p class="text-sm">No tasks in queue</p>
      <p class="text-xs mt-1">Tasks will appear here when added</p>
    </div>

    <!-- Test Buttons (Development) -->
    <div class="pt-4 border-t border-gray-200 space-y-2">
      <p class="text-xs text-gray-600 font-medium">Test Actions:</p>
      <div class="flex gap-2">
        <button
          class="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 font-medium rounded hover:bg-purple-200 transition-colors"
          @click="testBingTask"
        >
          Add Bing Test Task
        </button>
        <button
          class="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 font-medium rounded hover:bg-blue-200 transition-colors"
          @click="testDeepSeekTask"
        >
          Add DeepSeek Test Task
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useLocalTaskQueue } from '../../composables/useLocalTaskQueue';
import { TaskStatus } from '@/entrypoints/background/services/local-task-queue';

const {
  stats,
  tasks,
  isRunning,
  isActive,
  addBingDictionaryTask,
  addDeepSeekTask,
  start,
  stop,
  cancelTask,
  clearCompleted,
  formatTimestamp,
  formatTaskType,
} = useLocalTaskQueue();

// Display tasks (most recent first)
const displayTasks = computed(() => {
  return [...tasks.value].sort((a, b) => b.createdAt - a.createdAt);
});

// Status helpers
const getStatusClass = (status: TaskStatus): string => {
  switch (status) {
    case TaskStatus.PENDING:
      return 'bg-blue-100 text-blue-700';
    case TaskStatus.PROCESSING:
      return 'bg-yellow-100 text-yellow-700';
    case TaskStatus.COMPLETED:
      return 'bg-green-100 text-green-700';
    case TaskStatus.FAILED:
      return 'bg-red-100 text-red-700';
    case TaskStatus.CANCELLED:
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const getStatusLabel = (status: TaskStatus): string => {
  return status.toUpperCase();
};

// Test actions
const testBingTask = async () => {
  await addBingDictionaryTask([
    { word: 'apple', md5: 'test-md5-1' },
    { word: 'banana', md5: 'test-md5-2' },
  ], {
    language: 'english',
    batchSize: 1,
    priority: 1,
  });
};

const testDeepSeekTask = async () => {
  await addDeepSeekTask(
    'What is the capital of France?',
    {
      priority: 1,
    },
  );
};
</script>
