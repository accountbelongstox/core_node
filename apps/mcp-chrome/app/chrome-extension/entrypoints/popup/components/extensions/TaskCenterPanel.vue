<template>
  <div class="rounded-xl p-3 shadow-sm space-y-3" style="background: var(--surface); border: 1px solid var(--border)">
    <TaskCapabilitySelector
      :title="getMessage('taskCenterProductionTitle')"
      :description="getMessage('taskCenterProductionDescription')"
      compact
    />

    <div class="tk-cap-summary">
      <span>{{ readinessHint }}</span>
      <strong>{{ getMessage('taskCenterSelectedCount', [String(checkedCapabilityKeys.length)]) }}</strong>
      <span v-if="isRunning">{{ getMessage('taskCenterActiveCount', [String(state.activeCapabilities.length)]) }}</span>
    </div>

    <p v-if="error" class="tk-error">{{ error }}</p>

    <div class="flex items-center justify-between">
      <span class="text-xs" style="color: var(--text-muted)">{{ getMessage('taskCenterReadyControlHint') }}</span>
      <div class="flex items-center gap-3">
        <span
          class="px-3 py-1 text-xs font-bold rounded-full"
          :style="isRunning
            ? 'background: var(--accent-soft); color: var(--success)'
            : 'background: var(--surface-2); color: var(--text-muted)'"
        >
          {{ readinessStatus }}
        </span>
        <button
          class="px-4 py-2 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
          @click="toggleCenter"
          :disabled="!isRunning && !config.apiUrl"
        >
          {{ isRunning || isStarting ? getMessage('taskCenterCancelReadyAction') : readinessAction }}
        </button>
      </div>
    </div>

    <!-- Production Laravel request status. Single-feature validity diagnostics
         stay in the Extension test panel. -->
    <div v-if="state.backend" class="tk-status">
      <div v-if="state.backend" class="tk-be" :class="backendOnline ? 'tk-be--on' : 'tk-be--off'">
        <span class="tk-be-dot">{{ backendOnline ? '●' : '○' }}</span>
        <span class="tk-be-label">{{ backendOnline ? getMessage('taskCenterBackendOnline') : getMessage('taskCenterBackendOffline') }}</span>
        <span v-if="backendLastRequest" class="tk-be-meta">· {{ backendLastRequest }}</span>
        <span
          v-if="(state.backend.consecutiveFailures || 0) > 0"
          class="tk-be-meta tk-be-fail"
        >· {{ getMessage('taskCenterBackendFailureCount', [String(state.backend.consecutiveFailures)]) }}</span>
        <span v-if="state.backend.lastError" class="tk-be-err" :title="state.backend.lastError">
          · {{ state.backend.lastError }}
        </span>
      </div>
    </div>

    <div v-if="state.stats" class="space-y-3">
      <!-- Overall Stats -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-purple-50 rounded-lg p-3 text-center space-y-1">
          <span class="block text-xs text-purple-600 font-medium">{{ getMessage('taskCenterProcessorsLabel') }}</span>
          <span class="block text-lg font-bold text-purple-700">{{ state.stats.runningProcessors }}/{{ state.stats.totalProcessors }}</span>
        </div>
        <div class="bg-blue-50 rounded-lg p-3 text-center space-y-1">
          <span class="block text-xs text-blue-600 font-medium">{{ getMessage('taskCenterPendingLabel') }}</span>
          <span class="block text-lg font-bold text-blue-700">{{ state.stats.totalPending }}</span>
        </div>
        <div class="bg-green-50 rounded-lg p-3 text-center space-y-1">
          <span class="block text-xs text-green-600 font-medium">{{ getMessage('taskCenterCompletedLabel') }}</span>
          <span class="block text-lg font-bold text-green-700">{{ state.stats.totalTranslated }}</span>
        </div>
        <div class="bg-red-50 rounded-lg p-3 text-center space-y-1">
          <span class="block text-xs text-red-600 font-medium">{{ getMessage('taskCenterFailedLabel') }}</span>
          <span class="block text-lg font-bold text-red-700">{{ state.stats.totalFailed }}</span>
        </div>
      </div>

      <!-- Individual Processors (collapsible — long list; collapsed by default) -->
      <button type="button" class="tk-collapse" @click="showProcessors = !showProcessors">
        <span class="tk-collapse-caret">{{ showProcessors ? '▾' : '▸' }}</span>
        <span>{{ getMessage('taskCenterProcessorDetails', [String(state.stats.runningProcessors), String(state.stats.totalProcessors)]) }}</span>
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
              {{ processor.isRunning ? `▶ ${getMessage('taskCenterActiveLabel')}` : `⏸ ${getMessage('taskCenterInactiveLabel')}` }}
            </span>
          </div>

          <div v-if="processor.isRunning" class="space-y-3">
            <!-- Bento Queue Stats -->
            <div class="grid grid-cols-3 gap-2">
              <div class="bg-blue-100 rounded-lg p-2 text-center space-y-1">
                <div class="text-xs text-blue-700 font-medium">{{ getMessage('taskCenterQueueLabel') }}</div>
                <div class="text-base font-bold text-blue-800">{{ processor.stats.queueTotal || 0 }}</div>
              </div>
              <div class="bg-green-100 rounded-lg p-2 text-center space-y-1">
                <div class="text-xs text-green-700 font-medium">{{ getMessage('taskCenterNewLabel') }}</div>
                <div class="text-base font-bold text-green-800">{{ processor.stats.newTasks || 0 }}</div>
              </div>
              <div class="bg-orange-100 rounded-lg p-2 text-center space-y-1">
                <div class="text-xs text-orange-700 font-medium">{{ getMessage('taskCenterDuplicateLabel') }}</div>
                <div class="text-base font-bold text-orange-800">{{ processor.stats.duplicateTasks || 0 }}</div>
              </div>
            </div>

            <!-- Traditional Stats -->
            <div class="flex flex-wrap gap-3 text-xs" style="color: var(--text-muted)">
              <span class="font-medium">{{ getMessage('taskCenterPendingLabel') }}: <span style="color: var(--text)">{{ processor.stats.pending }}</span></span>
              <span class="font-medium">{{ getMessage('taskCenterDoneLabel') }}: <span style="color: var(--text)">{{ processor.stats.translated }}</span></span>
              <span class="font-medium">{{ getMessage('taskCenterFailedLabel') }}: <span style="color: var(--text)">{{ processor.stats.failed }}</span></span>
              <span v-if="processor.stats.lastRun" class="font-medium">
                {{ getMessage('taskCenterLastLabel') }}: <span style="color: var(--text)">{{ formatTimestamp(processor.stats.lastRun) }}</span>
              </span>
              <span v-if="processor.stats.currentAssistItem" class="font-medium">
                {{ getMessage('taskCenterCurrentTaskLabel') }}:
                <span style="color: var(--text)">{{ processor.stats.currentAssistItem }}</span>
              </span>
              <span v-if="processor.stats.currentAssistStage" class="font-medium">
                {{ getMessage('taskCenterCurrentStageLabel') }}:
                <span style="color: var(--text)">{{ processor.stats.currentAssistStage }}</span>
              </span>
              <span v-if="processor.stats.lastAssistError" class="font-medium tk-be-fail" :title="processor.stats.lastAssistError">
                {{ processor.stats.lastAssistError }}
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
import { nextTick, onMounted, ref, computed, watch } from 'vue';
import { useTaskCenter } from '../../composables/useTaskCenter';
import { useTaskCapabilities } from '../../composables/useTaskCapabilities';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { CAPABILITIES, type CapabilityKey } from '@/utils/task-capabilities';
import { getMessage } from '@/utils/i18n';
import TaskCapabilitySelector from '../TaskCapabilitySelector.vue';
import UnifiedTaskCenter from './UnifiedTaskCenter.vue';

const {
  config,
  state,
  error,
  isStarting,
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
const suppressedCapabilityChanges = new Set<CapabilityKey>();
const capabilityRequestVersions = new Map<CapabilityKey, number>();
const capabilityRequestQueues = new Map<CapabilityKey, Promise<void>>();

// ── Capability checkboxes ─────────────────────────────────────────────
// Rendered straight from the shared catalog so the popup UI and the background
// scheduler can never drift on which lanes a checkbox turns on. One persisted
// ref per capability (survives popup blur/close), keyed by its catalog storageKey.
const {
  capabilityState: capState,
  enabledKeys: checkedCapabilityKeys,
} = useTaskCapabilities();

const isRunning = computed(() => state.value.isRunning);
const hasSelectedCapabilities = computed(() => checkedCapabilityKeys.value.length > 0);
const readinessAction = computed(() =>
  getMessage(hasSelectedCapabilities.value
    ? 'taskCenterReadyAndStartAction'
    : 'taskCenterReadyOnlyAction'),
);
const readinessStatus = computed(() => {
  if (!isRunning.value) return `○ ${getMessage('taskCenterNotReadyStatus')}`;
  return state.value.activeCapabilities.length > 0
    ? `● ${getMessage('taskCenterReadyRunningStatus')}`
    : `● ${getMessage('taskCenterReadyStatus')}`;
});
const readinessHint = computed(() =>
  getMessage(hasSelectedCapabilities.value
    ? 'taskCenterReadyWithTasksHint'
    : 'taskCenterReadyOnlyHint'),
);

// Live switches: WHILE running, toggling a checkbox flips that lane
// on/off immediately via set_capability — no full restart. While stopped, the
// persisted ref just remembers the choice for the next Start.
for (const def of CAPABILITIES) {
  watch(capState[def.key], (enabled) => {
    if (!state.value.isRunning || suppressedCapabilityChanges.has(def.key)) return;
    const version = (capabilityRequestVersions.get(def.key) || 0) + 1;
    capabilityRequestVersions.set(def.key, version);
    const previous = capabilityRequestQueues.get(def.key) || Promise.resolve();
    const request = previous.then(async () => {
      const accepted = await setCapability(def.key, enabled);
      if (accepted || capabilityRequestVersions.get(def.key) !== version) return;

      suppressedCapabilityChanges.add(def.key);
      capState[def.key].value = state.value.activeCapabilities.includes(def.key);
      await nextTick();
      suppressedCapabilityChanges.delete(def.key);
    });
    const cleanup = () => {
      if (capabilityRequestQueues.get(def.key) === request) {
        capabilityRequestQueues.delete(def.key);
      }
    };
    capabilityRequestQueues.set(def.key, request);
    void request.then(cleanup, cleanup);
  });
}

// Backend REQUEST-layer status strip.
const backendOnline = computed(() => state.value.backend?.online === true);
const backendLastRequest = computed(() =>
  state.value.backend?.lastRequestAt ? formatTimestamp(state.value.backend.lastRequestAt) : '',
);

const onStart = async () => {
  await startTaskCenter(checkedCapabilityKeys.value);
  if (state.value.isRunning) await unifiedRef.value?.loadAll?.();
};

const onStop = async () => {
  await stopTaskCenter();
};

const toggleCenter = async () => {
  if (isRunning.value || isStarting.value) {
    await onStop();
  } else {
    await onStart();
  }
};

const getProcessorName = (type: string): string => {
  const names: Record<string, string> = {
    bing_dictionary: 'Bing Dictionary',
    qwen_tts: 'Qwen3 TTS',
    word_validity_web: 'Word Validity',
    web_ai_translate: 'Web-AI Translate',
    deepseek: 'DeepSeek AI',
  };
  return names[type] || type;
};

onMounted(async () => {
  await initialize();
  if (state.value.isRunning) {
    const active = new Set(state.value.activeCapabilities);
    for (const capability of CAPABILITIES) {
      suppressedCapabilityChanges.add(capability.key);
      capState[capability.key].value = active.has(capability.key);
    }
    await nextTick();
    suppressedCapabilityChanges.clear();
  }
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
.tk-error {
  margin: 0;
  padding: 6px 8px;
  border: 1px solid rgb(244 63 94 / 35%);
  border-radius: 8px;
  background: rgb(244 63 94 / 10%);
  color: #fb7185;
  font-size: 10px;
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

/* ── Backend status strip ── */
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
