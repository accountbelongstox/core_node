<template>
  <div class="flex flex-col gap-2.5 h-[420px]">
    <!-- ============================================================ -->
    <!-- Global Task System control block -->
    <!-- ============================================================ -->
    <div class="rounded-lg overflow-hidden" style="background: var(--surface); border: 1px solid var(--border)">
      <div
        class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-600/20 to-purple-600/10"
        style="border-bottom: 1px solid var(--border)"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span
            :class="[
              'relative flex h-2 w-2 shrink-0',
            ]"
          >
            <span
              v-if="isTaskSystemRunning && !isPaused"
              class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"
            ></span>
            <span
              :class="[
                'relative inline-flex h-2 w-2 rounded-full',
                isTaskSystemRunning ? (isPaused ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-500',
              ]"
            ></span>
          </span>
          <div class="min-w-0">
            <div class="text-[10px] font-bold uppercase tracking-wide truncate" style="color: var(--text)">
              {{ getMessage('extTaskQueueTitle') }}
            </div>
            <div class="text-[8px] truncate" style="color: var(--text-faint)">
              {{ getMessage('extTaskQueueSubtitle') }}
            </div>
          </div>
        </div>
        <span
          :class="[
            'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
            isTaskSystemRunning
              ? (isPaused ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300')
              : 'bg-slate-600/40 text-slate-400',
          ]"
        >
          {{ isTaskSystemRunning ? (isPaused ? getMessage('extStatePaused') : getMessage('extStateRunning')) : getMessage('extStateStopped') }}
        </span>
      </div>

      <div class="p-2.5 flex flex-col gap-2">
        <!-- Control buttons -->
        <div class="flex gap-2">
          <button
            v-if="!isTaskSystemRunning"
            @click="startTaskSystem"
            class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-md transition-colors"
          >
            ▶ {{ getMessage('extStartButton') }}
          </button>
          <template v-else>
            <button
              v-if="!isPaused"
              @click="pauseTaskSystem"
              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded-md transition-colors"
            >
              ⏸ {{ getMessage('extPauseButton') }}
            </button>
            <button
              v-else
              @click="resumeTaskSystem"
              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-md transition-colors"
            >
              ▶ {{ getMessage('extResumeButton') }}
            </button>
            <button
              @click="stopTaskSystem"
              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-md transition-colors"
            >
              ⏹ {{ getMessage('extStopButton') }}
            </button>
          </template>
        </div>

        <!-- Stats line -->
        <div
          v-if="isTaskSystemRunning && !isPaused"
          class="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1 rounded-md bg-emerald-950/30 border border-emerald-500/20 text-[9px] text-emerald-300"
        >
          <span>{{ enabledExtensionsCount }} {{ getMessage('extEnabledLabel') }}</span>
          <span class="text-emerald-500/50">·</span>
          <span>{{ stats.completed }} {{ getMessage('extCompletedLabel') }}</span>
          <template v-if="stats.pending > 0">
            <span class="text-emerald-500/50">·</span>
            <span>{{ stats.pending }} {{ getMessage('extPendingLabel') }}</span>
          </template>
        </div>

        <div
          v-if="error"
          class="px-2 py-1 rounded-md bg-rose-950/40 border border-rose-500/40 text-[9px] text-rose-300"
        >
          {{ error }}
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- Horizontal extension tabs -->
    <!-- ============================================================ -->
    <div class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 shrink-0">
      <button
        v-for="extension in extensions"
        :key="extension.id"
        @click="activeExtId = extension.id"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-colors shrink-0"
        :style="
          activeExtId === extension.id
            ? 'background: var(--accent-soft); color: var(--accent-fg); border: 1px solid var(--accent)'
            : 'color: var(--text-muted); border: 1px solid transparent'
        "
      >
        <span class="text-sm leading-none">{{ extension.icon }}</span>
        {{ extension.name }}
        <span
          v-if="extension.enabled && isTaskSystemRunning && !isPaused"
          class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"
        ></span>
      </button>
    </div>

    <!-- ============================================================ -->
    <!-- Active extension panel -->
    <!-- ============================================================ -->
    <div
      v-if="activeExtension"
      class="flex-1 overflow-y-auto no-scrollbar rounded-lg"
      style="background: var(--surface); border: 1px solid var(--border)"
    >
      <!-- Panel header: name + enable toggle -->
      <div
        class="flex items-center justify-between px-3 py-2 sticky top-0 z-10"
        style="background: var(--surface); border-bottom: 1px solid var(--border)"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm leading-none">{{ activeExtension.icon }}</span>
          <div class="min-w-0">
            <div class="text-[11px] font-semibold truncate" style="color: var(--text)">
              {{ activeExtension.name }}
            </div>
            <div class="text-[9px] truncate" style="color: var(--text-faint)">
              {{ activeExtension.description }}
            </div>
          </div>
        </div>
        <button
          @click="toggleExtension(activeExtension.id)"
          :class="[
            'relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0',
            activeExtension.enabled ? 'bg-indigo-600' : 'bg-slate-500',
          ]"
          :aria-pressed="activeExtension.enabled"
        >
          <span
            :class="[
              'inline-block h-3 w-3 rounded-full bg-white transition-transform',
              activeExtension.enabled ? 'translate-x-3.5' : 'translate-x-0.5',
            ]"
          />
        </button>
      </div>

      <!-- Active component -->
      <div class="p-2.5">
        <component v-if="activeExtension.component" :is="activeExtension.component" />
        <div v-else class="text-[10px]" style="color: var(--text-faint)">
          {{ getMessage('extNoConfig') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getMessage } from '@/utils/i18n';
import { useExtensionConfig } from '@/composables/useExtensionConfig';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { useLocalTaskQueue } from '../composables/useLocalTaskQueue';
import BingDictionary from './extensions/BingDictionary.vue';
import QueueCenterPanel from './extensions/QueueCenterPanel.vue';
import NotebookLMPanel from './extensions/NotebookLMPanel.vue';

// ============================================================
// Centralized state management
// ============================================================

// Extension config management
const {
  extensions,
  enabledExtensionsCount,
  toggleExtension,
  registerComponent,
  initialize: initExtensions,
} = useExtensionConfig();

// Horizontal tab selection (replaces the old accordion expand/collapse).
// Persisted so reopening the popup returns to the same extension (e.g. Bing
// Dictionary) instead of resetting to the first one.
const activeExtId = usePersistedRef<string>('activeExtId', '');
const activeExtension = computed(
  () => extensions.value.find((e) => e.id === activeExtId.value) || extensions.value[0],
);

// Task queue management
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
// Local state
// ============================================================

const error = ref('');

// ============================================================
// Task system control
// ============================================================

/**
 * Start the task system using the real queue.
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
 * Stop the task system using the real queue.
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
 * Pause the task system using the real queue.
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
 * Resume the task system using the real queue.
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
// Component registration
// ============================================================

/**
 * Register all extension components.
 */
const registerAllComponents = () => {
  registerComponent('queue-center', QueueCenterPanel);
  registerComponent('bing-dictionary', BingDictionary);
  registerComponent('notebooklm', NotebookLMPanel);
};

// ============================================================
// Lifecycle
// ============================================================

let pollingInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  // Initialize extension config
  await initExtensions();

  // Register components
  registerAllComponents();

  // Default the active tab to the first extension.
  if (!activeExtId.value && extensions.value.length > 0) {
    activeExtId.value = extensions.value[0].id;
  }

  // Initial state update
  await updateState();

  // Periodic state update (every 2 seconds)
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
