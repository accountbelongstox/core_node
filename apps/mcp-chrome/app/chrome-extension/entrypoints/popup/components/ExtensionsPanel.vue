<template>
  <div class="flex flex-col gap-3 max-h-[400px]">
    <!-- Global Task System (reference) -->
    <div class="flex items-center justify-between p-2 bg-indigo-950/20 border border-indigo-500/30 rounded mb-1">
      <span class="text-[10px] font-bold text-indigo-400 uppercase">Global Task System</span>
      <button
        @click="isTaskSystemRunning ? stopTaskSystem() : startTaskSystem()"
        :class="['w-8 h-4 rounded-full relative transition-colors', isTaskSystemRunning ? 'bg-indigo-600' : 'bg-slate-600']"
      >
        <div :class="['absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', isTaskSystemRunning ? 'left-4.5' : 'left-0.5']" />
      </button>
    </div>
    <div class="flex gap-2">
      <button v-if="!isTaskSystemRunning" @click="startTaskSystem" class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded transition-colors">▶ Start</button>
      <template v-else>
        <button v-if="!isPaused" @click="pauseTaskSystem" class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded transition-colors">⏸ Pause</button>
        <button v-else @click="resumeTaskSystem" class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded transition-colors">▶ Resume</button>
        <button @click="stopTaskSystem" class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded transition-colors">⏹ Stop</button>
      </template>
    </div>
    <div v-if="isTaskSystemRunning && !isPaused" class="p-2 bg-emerald-950/20 border border-emerald-500/30 rounded text-[10px] text-emerald-400">
      {{ enabledExtensionsCount }} extensions enabled · {{ stats.completed }} completed<span v-if="stats.pending > 0"> · {{ stats.pending }} pending</span>
    </div>
    <div v-if="error" class="p-2 bg-rose-950/30 border border-rose-500/40 rounded text-[10px] text-rose-400">{{ error }}</div>

    <!-- Extensions list (reference) -->
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-[10px] font-bold text-slate-400 uppercase">Extensions</h2>
      <button @click="toggleExpandAll" class="text-[10px] text-indigo-400 hover:underline">{{ isAllExpanded ? 'Collapse All' : 'Expand All' }}</button>
    </div>
    <div class="flex-1 overflow-y-auto space-y-1 pr-1 no-scrollbar">
      <div
        v-for="extension in extensions"
        :key="extension.id"
        @click="toggleExpanded(extension.id)"
        :class="[
          'p-2 rounded border cursor-pointer transition-all',
          isExpanded(extension.id).value ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800'
        ]"
      >
        <div class="flex justify-between items-center">
          <span class="text-[11px] font-medium text-slate-200">{{ extension.name }}</span>
          <button @click.stop="toggleExtension(extension.id)" class="relative inline-flex h-4 w-7 items-center rounded-full transition-colors" :class="extension.enabled ? 'bg-indigo-600' : 'bg-slate-600'">
            <span :class="['inline-block h-3 w-3 rounded-full bg-white transition-transform', extension.enabled ? 'translate-x-3.5' : 'translate-x-0.5']" />
          </button>
        </div>
        <p class="text-[9px] text-slate-500">{{ extension.description }}</p>
        <span v-if="extension.enabled && isTaskSystemRunning" class="inline-flex items-center gap-1 mt-1">
          <span class="w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></span>
          <span class="text-[9px] text-indigo-400">Running</span>
        </span>
      </div>
    </div>
    <div v-if="isExpanded(extensions.find(e => isExpanded(e.id).value)?.id).value" class="border-t border-slate-700 pt-3 mt-2">
      <component v-if="extensions.find(e => isExpanded(e.id).value)?.component" :is="extensions.find(e => isExpanded(e.id).value)!.component" />
      <div v-else class="text-[10px] text-slate-500">No configuration for this extension.</div>
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
