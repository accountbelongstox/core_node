<template>
  <div class="max-w-6xl mx-auto space-y-8">
    <!-- 全局任务控制中心 -->
    <div class="bg-white rounded-lg border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-4">
          <div :class="[
            'w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300',
            isTaskSystemRunning
              ? 'bg-green-500 shadow-lg shadow-green-500/30 animate-pulse'
              : 'bg-gray-300'
          ]">
            <span class="text-2xl">{{ isTaskSystemRunning ? '⚡' : '⏸️' }}</span>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Global Task System</h3>
            <p class="text-sm text-gray-500">
              {{ isTaskSystemRunning ? (isPaused ? 'Paused' : 'Running') : 'Stopped' }}
              • {{ enabledExtensionsCount }} extensions enabled
            </p>
          </div>
        </div>

        <!-- 实时统计信息 -->
        <div v-if="isTaskSystemRunning" class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <div :class="[
              'w-2 h-2 rounded-full bg-green-500 transition-all duration-300',
              hasProcessingTasks ? 'scale-150 opacity-100' : 'scale-100 opacity-60'
            ]"></div>
            <span class="text-xs font-mono text-gray-500">
              {{ stats.completed }} completed
            </span>
          </div>
          <div v-if="stats.pending > 0" class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-yellow-500"></div>
            <span class="text-xs font-mono text-gray-500">
              {{ stats.pending }} pending
            </span>
          </div>
        </div>
      </div>

      <!-- 控制按钮组 -->
      <div class="flex gap-3">
        <button
          v-if="!isTaskSystemRunning"
          @click="startTaskSystem"
          class="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
        >
          <span class="text-lg">▶️</span>
          <span>Start Task System</span>
        </button>

        <template v-else>
          <button
            v-if="!isPaused"
            @click="pauseTaskSystem"
            class="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition-colors"
          >
            <span class="text-lg">⏸️</span>
            <span>Pause</span>
          </button>

          <button
            v-else
            @click="resumeTaskSystem"
            class="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <span class="text-lg">▶️</span>
            <span>Resume</span>
          </button>

          <button
            @click="stopTaskSystem"
            class="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            <span class="text-lg">⏹️</span>
            <span>Stop</span>
          </button>
        </template>
      </div>

      <!-- 运行状态信息 -->
      <div v-if="isTaskSystemRunning && !isPaused" class="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
        <div class="flex items-center gap-2 text-sm text-green-800">
          <span class="font-mono">⚡</span>
          <span>Task system is actively monitoring {{ enabledExtensionsCount }} enabled extensions...</span>
        </div>
        <div v-if="stats.total > 0" class="mt-2 text-xs text-green-700 font-mono">
          Total: {{ stats.total }} |
          Processing: {{ stats.processing }} |
          Failed: {{ stats.failed }}
        </div>
      </div>

      <!-- 暂停状态信息 -->
      <div v-if="isTaskSystemRunning && isPaused" class="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <div class="flex items-center gap-2 text-sm text-yellow-800">
          <span class="font-mono">⏸️</span>
          <span>Task system is paused. Click "Resume" to continue processing tasks.</span>
        </div>
        <div v-if="stats.pending > 0" class="mt-2 text-xs text-yellow-700 font-mono">
          {{ stats.pending }} tasks waiting to be processed
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
        <div class="flex items-center gap-2 text-sm text-red-800">
          <span>⚠️</span>
          <span>{{ error }}</span>
        </div>
      </div>
    </div>

    <!-- 扩展卡片网格 -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Extensions</h2>
        <button
          @click="toggleExpandAll"
          class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {{ isAllExpanded ? 'Collapse All' : 'Expand All' }}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-5">
        <div
          v-for="extension in extensions"
          :key="extension.id"
          :class="[
            'bg-white rounded-lg border-2 transition-all cursor-pointer overflow-hidden',
            extension.enabled
              ? 'border-blue-200 shadow-sm hover:shadow-md hover:border-blue-300'
              : 'border-gray-200 hover:border-gray-300',
            isExpanded(extension.id).value ? 'ring-2 ring-blue-500 ring-opacity-20' : ''
          ]"
        >
          <!-- 卡片头部 -->
          <div
            class="p-5 hover:bg-gray-50 transition-colors"
            @click="toggleExpanded(extension.id)"
          >
            <div class="flex items-start gap-4 mb-4">
              <!-- 扩展图标 -->
              <div :class="[
                'w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0',
                extension.enabled ? extension.iconBg : 'bg-gray-100'
              ]">
                {{ extension.icon }}
              </div>

              <div class="flex-1 min-w-0">
                <h3 class="text-base font-semibold text-gray-900 mb-1">
                  {{ extension.name }}
                </h3>
                <p class="text-sm text-gray-600 line-clamp-2">
                  {{ extension.description }}
                </p>
              </div>
            </div>

            <!-- 状态和开关 -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <!-- 状态标签 -->
                <span
                  v-if="extension.status === 'active'"
                  class="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full"
                >
                  ACTIVE
                </span>
                <span
                  v-else-if="extension.status === 'todo'"
                  class="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full"
                >
                  COMING SOON
                </span>

                <!-- 运行指示器 -->
                <span
                  v-if="extension.enabled && isTaskSystemRunning"
                  class="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                >
                  <span class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                  Running
                </span>
              </div>

              <!-- 启用开关 -->
              <button
                @click.stop="toggleExtension(extension.id)"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  extension.enabled ? 'bg-blue-600' : 'bg-gray-300'
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    extension.enabled ? 'translate-x-6' : 'translate-x-1'
                  ]"
                ></span>
              </button>
            </div>
          </div>

          <!-- 展开的详情 -->
          <div
            v-if="isExpanded(extension.id).value"
            class="border-t border-gray-200 p-5 bg-gray-50"
          >
            <component v-if="extension.component" :is="extension.component" />
            <div v-else class="text-sm text-gray-500">
              No configuration available for this extension.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useExtensionConfig } from '@/composables/useExtensionConfig';
import { useLocalTaskQueue } from '../composables/useLocalTaskQueue';
import ApiSettings from './ApiSettings.vue';
import BingDictionary from './extensions/BingDictionary.vue';
import DeepseekChat from './extensions/DeepseekChat.vue';
import LocalTaskQueue from './extensions/LocalTaskQueue.vue';
import LogViewerPanel from './extensions/LogViewerPanel.vue';

// ============================================================
// 使用中心化状态管理
// ============================================================

// 扩展配置管理
const {
  extensions,
  enabledExtensionsCount,
  toggleExtension,
  toggleExpanded,
  toggleExpandAll,
  isExpanded,
  isAllExpanded,
  registerComponent,
  initialize: initExtensions,
} = useExtensionConfig();

// 任务队列管理
const {
  stats,
  isRunning: isTaskSystemRunning,
  isPaused,
  hasProcessingTasks,
  start,
  stop,
  pause,
  resume,
  updateState,
} = useLocalTaskQueue();

// ============================================================
// 本地状态
// ============================================================

const error = ref('');

// ============================================================
// 任务系统控制
// ============================================================

/**
 * 启动任务系统 - 使用真实队列
 */
const startTaskSystem = async () => {
  try {
    error.value = '';
    await start();
    console.log('[ExtensionsPanel] Task system started');
  } catch (err: any) {
    error.value = err.message || 'Failed to start task system';
    console.error('[ExtensionsPanel] Failed to start task system:', err);
  }
};

/**
 * 停止任务系统 - 使用真实队列
 */
const stopTaskSystem = async () => {
  try {
    error.value = '';
    await stop();
    console.log('[ExtensionsPanel] Task system stopped');
  } catch (err: any) {
    error.value = err.message || 'Failed to stop task system';
    console.error('[ExtensionsPanel] Failed to stop task system:', err);
  }
};

/**
 * 暂停任务系统 - 使用真实队列
 */
const pauseTaskSystem = async () => {
  try {
    error.value = '';
    await pause();
    console.log('[ExtensionsPanel] Task system paused');
  } catch (err: any) {
    error.value = err.message || 'Failed to pause task system';
    console.error('[ExtensionsPanel] Failed to pause task system:', err);
  }
};

/**
 * 恢复任务系统 - 使用真实队列
 */
const resumeTaskSystem = async () => {
  try {
    error.value = '';
    await resume();
    console.log('[ExtensionsPanel] Task system resumed');
  } catch (err: any) {
    error.value = err.message || 'Failed to resume task system';
    console.error('[ExtensionsPanel] Failed to resume task system:', err);
  }
};

// ============================================================
// 组件注册
// ============================================================

/**
 * 注册所有扩展组件
 */
const registerAllComponents = () => {
  registerComponent('api-settings', ApiSettings);
  registerComponent('local-task-queue', LocalTaskQueue);
  registerComponent('log-viewer', LogViewerPanel);
  registerComponent('bing-dictionary', BingDictionary);
  registerComponent('deepseek-chat', DeepseekChat);
};

// ============================================================
// 生命周期
// ============================================================

let pollingInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  // 初始化扩展配置
  await initExtensions();

  // 注册组件
  registerAllComponents();

  // 初始状态更新
  await updateState();

  // 定期更新状态（每2秒）
  pollingInterval = setInterval(() => {
    updateState();
  }, 2000);

  console.log('[ExtensionsPanel] Initialized with centralized state');
});

onUnmounted(() => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
});
</script>
