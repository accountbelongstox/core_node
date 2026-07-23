<template>
  <div class="rounded-xl p-3 shadow-sm space-y-3" style="background: var(--surface); border: 1px solid var(--border)">
    <TaskCapabilitySelector
      title="生产任务 · Production tasks"
      description="Laravel queue → MCP shared runtime → result write-back. Extension panels remain single-feature tests."
      compact
    />

    <div class="tk-cap-summary">
      <span>Selections are synchronized with Settings Center.</span>
      <strong>{{ checkedNonStubKeys.length }} selected</strong>
      <span v-if="isRunning">{{ state.activeCapabilities.length }} active</span>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-xs" style="color: var(--text-muted)">选择任务后点击开始 · Select tasks then Start</span>
      <div class="flex items-center gap-3">
        <span
          class="px-3 py-1 text-xs font-bold rounded-full"
          :style="isRunning
            ? 'background: var(--accent-soft); color: var(--success)'
            : 'background: var(--surface-2); color: var(--text-muted)'"
        >
          {{ isRunning ? '● RUNNING' : '○ STOPPED' }}
        </span>
        <button
          class="px-4 py-2 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
          @click="toggleCenter"
          :disabled="!config.apiUrl || (!isRunning && checkedNonStubKeys.length === 0)"
        >
          {{ isRunning ? 'Stop' : 'Start' }}
        </button>
      </div>
    </div>

    <!-- Backend REQUEST status + validity runner progress (from get_status). -->
    <div v-if="state.backend || showValidity" class="tk-status">
      <div v-if="state.backend" class="tk-be" :class="backendOnline ? 'tk-be--on' : 'tk-be--off'">
        <span class="tk-be-dot">{{ backendOnline ? '●' : '○' }}</span>
        <span class="tk-be-label">{{ backendOnline ? 'Backend online' : 'Backend offline' }}</span>
        <span v-if="backendLastRequest" class="tk-be-meta">· {{ backendLastRequest }}</span>
        <span
          v-if="(state.backend.consecutiveFailures || 0) > 0"
          class="tk-be-meta tk-be-fail"
        >· {{ state.backend.consecutiveFailures }} fails</span>
        <span v-if="state.backend.lastError" class="tk-be-err" :title="state.backend.lastError">
          · {{ state.backend.lastError }}
        </span>
      </div>
      <div v-if="showValidity && state.validity" class="tk-validity">
        有效检测 Validity: round {{ state.validity.rounds }}
        · +{{ state.validity.totalValid }} valid
        · +{{ state.validity.totalInvalid }} invalid
        <span v-if="state.validity.running" class="tk-validity-run">· running</span>
        <span v-if="state.validity.lastError" class="tk-be-err" :title="state.validity.lastError">
          · {{ state.validity.lastError }}
        </span>
      </div>
    </div>

    <div v-if="state.stats" class="space-y-3">
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

      <!-- Individual Processors (collapsible — long list; collapsed by default) -->
      <button type="button" class="tk-collapse" @click="showProcessors = !showProcessors">
        <span class="tk-collapse-caret">{{ showProcessors ? '▾' : '▸' }}</span>
        <span>Processors · {{ state.stats.runningProcessors }}/{{ state.stats.totalProcessors }} active</span>
      </button>
      <div v-show="showProcessors" class="space-y-3">
        <div
          v-for="(processor, type) in state.stats.processors"
          :key="type"
          class="rounded-lg p-3 space-y-3"
          style="background: var(--surface-2); border: 1px solid var(--border)"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold" style="color: var(--text)">{{ getProcessorName(type) }}</span>
            <span
              class="px-2.5 py-1 text-xs font-bold rounded-full"
              :style="processor.isRunning
                ? 'background: var(--accent-soft); color: var(--success)'
                : 'background: var(--surface); color: var(--text-muted)'"
            >
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
            <div class="flex flex-wrap gap-3 text-xs" style="color: var(--text-muted)">
              <span class="font-medium">Pending: <span style="color: var(--text)">{{ processor.stats.pending }}</span></span>
              <span class="font-medium">Done: <span style="color: var(--text)">{{ processor.stats.translated }}</span></span>
              <span class="font-medium">Failed: <span style="color: var(--text)">{{ processor.stats.failed }}</span></span>
              <span v-if="processor.stats.lastRun" class="font-medium">
                Last: <span style="color: var(--text)">{{ formatTimestamp(processor.stats.lastRun) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unified Task Center: live + history task rows from the laravel global
         queue, each clickable to open the live SSE drilldown (TaskDetailModal). -->
    <div class="pt-1">
      <UnifiedTaskCenter ref="unifiedRef" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, computed, watch } from 'vue';
import { useTaskCenter } from '../../composables/useTaskCenter';
import { useTaskCapabilities } from '../../composables/useTaskCapabilities';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { CAPABILITIES } from '@/utils/task-capabilities';
import TaskCapabilitySelector from '../TaskCapabilitySelector.vue';
import UnifiedTaskCenter from './UnifiedTaskCenter.vue';

const {
  config,
  state,
  startTaskCenter,
  stopTaskCenter,
  setCapability,
  formatTimestamp,
  initialize,
} = useTaskCenter();

// Template ref to the child so Start can trigger a full lane load immediately.
const unifiedRef = ref<{ loadAll: () => Promise<void> } | null>(null);

// Collapse the long per-processor list by default (persisted). The 4-tile
// summary bento above stays visible; only the 12-row detail folds.
const showProcessors = usePersistedRef('tkShowProcessors', false);

// ── Capability checkboxes ─────────────────────────────────────────────
// Rendered straight from the shared catalog so the popup UI and the background
// scheduler can never drift on which lanes a checkbox turns on. One persisted
// ref per capability (survives popup blur/close), keyed by its catalog storageKey.
const {
  capabilityState: capState,
  enabledKeys: checkedNonStubKeys,
} = useTaskCapabilities();

const isRunning = computed(() => state.value.isRunning);

// Live switches: WHILE running, toggling a (non-stub) checkbox flips that lane
// on/off immediately via set_capability — no full restart. While stopped, the
// persisted ref just remembers the choice for the next Start.
for (const def of CAPABILITIES) {
  if (def.stub) continue;
  watch(capState[def.key], (enabled) => {
    if (state.value.isRunning) {
      void setCapability(def.key, enabled);
    }
  });
}

// Backend REQUEST-layer status strip.
const backendOnline = computed(() => state.value.backend?.online === true);
const backendLastRequest = computed(() =>
  state.value.backend?.lastRequestAt ? formatTimestamp(state.value.backend.lastRequestAt) : '',
);

// Show the validity progress line whenever the runner has run or is running.
const showValidity = computed(() => {
  const v = state.value.validity;
  return !!v && (v.running || v.rounds > 0 || v.done);
});

const onStart = async () => {
  // 1. Immediately populate every lane's pending count, THEN 2. start lanes.
  await unifiedRef.value?.loadAll?.();
  await startTaskCenter(checkedNonStubKeys.value);
};

const onStop = async () => {
  await stopTaskCenter();
};

const toggleCenter = async () => {
  if (isRunning.value) {
    await onStop();
  } else {
    await onStart();
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

<style scoped>
.tk-cap-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 10px;
}
.tk-cap-summary strong {
  color: var(--text);
  white-space: nowrap;
}

/* ── Collapsible section header ── */
.tk-collapse {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.tk-collapse:hover { border-color: var(--accent); background: var(--surface); }
.tk-collapse-caret { font-size: 9px; color: var(--text-faint); }

/* ── Backend status + validity progress strip ── */
.tk-status {
  display: flex; flex-direction: column; gap: 3px;
  padding: 6px 8px; border-radius: 8px;
  background: var(--surface-2); border: 1px solid var(--border);
  font-size: 10px;
}
.tk-be { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.tk-be-dot { font-size: 10px; line-height: 1; }
.tk-be--on .tk-be-dot { color: var(--success, #10b981); }
.tk-be--off .tk-be-dot { color: var(--text-muted); }
.tk-be-label { font-weight: 700; color: var(--text); }
.tk-be--off .tk-be-label { color: var(--text-muted); }
.tk-be-meta { color: var(--text-muted); }
.tk-be-fail { color: #f59e0b; }
.tk-be-err {
  color: #f43f5e; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tk-validity { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.tk-validity-run { color: var(--success, #10b981); font-weight: 700; }

.tk-input {
  background: var(--surface-2);
  border: 2px solid var(--border);
  color: var(--text);
}

.tk-input:focus {
  border-color: var(--accent);
  background: var(--surface);
}

.tk-input::placeholder {
  color: var(--text-faint);
}
</style>
