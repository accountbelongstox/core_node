<template>
  <div class="flex flex-col gap-2.5">
    <!-- Internal sub-tab switcher: Queue / Logs -->
    <div
      class="flex items-center gap-1 p-0.5 rounded-lg"
      style="background: var(--surface-2); border: 1px solid var(--border)"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold transition-colors"
        :style="
          activeTab === tab.id
            ? 'background: var(--accent-soft); color: var(--accent-fg); border: 1px solid var(--accent)'
            : 'color: var(--text-muted); border: 1px solid transparent'
        "
      >
        <span class="text-sm leading-none">{{ tab.icon }}</span>
        {{ tab.label }}
      </button>
    </div>

    <!-- Sub-view: keep both mounted so their listeners / state persist while
         switching tabs; only visibility toggles. -->
    <div v-show="activeTab === 'queue'">
      <LocalTaskQueue />
    </div>
    <div v-show="activeTab === 'logs'">
      <LogViewerPanel />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { getMessage as t } from '../../../../utils/i18n';
import { usePersistedRef } from '@/composables/usePersistedRef';
import LocalTaskQueue from './LocalTaskQueue.vue';
import LogViewerPanel from './LogViewerPanel.vue';

// Persisted so the Queue/Logs choice survives a popup close/reopen.
const activeTab = usePersistedRef<'queue' | 'logs'>('queueCenterTab', 'queue');

const tabs = computed(() => [
  { id: 'queue' as const, icon: '🎯', label: t('queueCenterTabQueue') },
  { id: 'logs' as const, icon: '📊', label: t('queueCenterTabLogs') },
]);
</script>
