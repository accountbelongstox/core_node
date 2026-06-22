<template>
  <div class="utc">
    <!-- Header + refresh -->
    <div class="utc-head">
      <h3 class="utc-title">🗂️ Unified Task Center</h3>
      <button class="utc-refresh" :disabled="loading" @click="refresh">
        {{ loading ? '…' : '↻' }}
      </button>
    </div>

    <!-- Sort + status filter -->
    <div class="utc-controls">
      <label class="utc-ctl">
        Sort
        <select v-model="sortKey" class="utc-select">
          <option value="created_desc">Newest</option>
          <option value="created_asc">Oldest</option>
          <option value="priority_desc">Priority ↓</option>
          <option value="status">Status</option>
        </select>
      </label>
      <label class="utc-ctl">
        Status
        <select v-model="statusFilter" class="utc-select">
          <option value="">All</option>
          <option value="live">Live</option>
          <option value="history">History</option>
          <option value="failed">Failed</option>
        </select>
      </label>
    </div>

    <!-- task_type filter chip row (persisted historyTypeFilter) -->
    <div class="utc-chips">
      <button
        class="utc-typechip"
        :class="{ active: historyTypeFilter === '' }"
        @click="historyTypeFilter = ''"
      >All types</button>
      <button
        v-for="tt in availableTypes"
        :key="tt"
        class="utc-typechip"
        :class="{ active: historyTypeFilter === tt }"
        @click="historyTypeFilter = tt"
      >
        <span>{{ taskIcon(tt) }}</span> {{ taskTypeLabel(tt) }}
      </button>
    </div>

    <div v-if="error" class="utc-error">{{ error }}</div>

    <!-- LIVE rows -->
    <section v-if="liveRows.length" class="utc-group">
      <div class="utc-grouphead">Live ({{ liveRows.length }})</div>
      <ul class="utc-list">
        <li
          v-for="row in liveRows"
          :key="row.task_id"
          class="utc-row"
          @click="openTask(row)"
        >
          <span class="utc-rowicon">{{ taskIcon(row.task_type, row.execution_type) }}</span>
          <div class="utc-rowmain">
            <div class="utc-rowtop">
              <span class="utc-rowlabel">{{ taskTypeLabel(row.task_type, row.execution_type) }}</span>
              <span v-if="rowIsFast(row)" class="utc-fast">⚡</span>
            </div>
            <div class="utc-rowsub" :title="row.task_id">{{ row.task_id }}</div>
          </div>
          <div class="utc-rowright">
            <span class="utc-cap" :class="{ ai: rowIsAi(row) }">
              {{ capabilityLabel(row.capability) }}<span v-if="rowIsAi(row)"> ✨</span>
            </span>
            <span class="utc-status" :style="{ '--dot': statusColor(row.status) }">
              <span class="utc-statusdot" />{{ row.status }}
            </span>
          </div>
        </li>
      </ul>
    </section>

    <!-- HISTORY rows -->
    <section v-if="historyRows.length" class="utc-group">
      <div class="utc-grouphead">History ({{ historyRows.length }})</div>
      <ul class="utc-list">
        <li
          v-for="row in historyRows"
          :key="row.task_id"
          class="utc-row"
          @click="openTask(row)"
        >
          <span class="utc-rowicon">{{ taskIcon(row.task_type, row.execution_type) }}</span>
          <div class="utc-rowmain">
            <div class="utc-rowtop">
              <span class="utc-rowlabel">{{ taskTypeLabel(row.task_type, row.execution_type) }}</span>
              <span v-if="rowIsFast(row)" class="utc-fast">⚡</span>
            </div>
            <div class="utc-rowsub" :title="row.task_id">{{ row.task_id }}</div>
          </div>
          <div class="utc-rowright">
            <span class="utc-cap" :class="{ ai: rowIsAi(row) }">
              {{ capabilityLabel(row.capability) }}<span v-if="rowIsAi(row)"> ✨</span>
            </span>
            <span class="utc-status" :style="{ '--dot': statusColor(row.status) }">
              <span class="utc-statusdot" />{{ row.status }}
            </span>
          </div>
        </li>
      </ul>
    </section>

    <div v-if="!loading && !liveRows.length && !historyRows.length && !error" class="utc-empty">
      No tasks match the current filters.
    </div>

    <!-- Drilldown modal -->
    <TaskDetailModal
      v-if="selectedTaskId"
      :task-id="selectedTaskId"
      :processor-type="selectedProcessorType"
      @close="selectedTaskId = null"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { apiManager } from '@/services/ApiManager';
import { usePersistedRef } from '@/composables/usePersistedRef';
import TaskDetailModal from './TaskDetailModal.vue';
import {
  taskIcon,
  taskTypeLabel,
  capabilityLabel,
  isAiTranslate,
  isFastTier,
} from './task-center-meta';

/**
 * One task row. The lean GET /api/task/list shape only carries
 * task_id/app_name/task_type/execution_type/status/progress/assigned_to/created_at;
 * capability / priority / is_fast_tier are filled by the per-task /detail (modal)
 * and are optional here so the list still renders without them.
 */
interface TaskRow {
  task_id: string;
  app_name: string;
  task_type: string;
  execution_type: string;
  status: string;
  progress: number;
  assigned_to: string | null;
  created_at: string | null;
  capability?: string | null;
  priority?: number | null;
  is_fast_tier?: boolean | null;
}

const LIVE_STATUSES = new Set(['pending', 'assigned', 'processing']);

const rows = ref<TaskRow[]>([]);
const loading = ref(false);
const error = ref('');

const sortKey = usePersistedRef<'created_desc' | 'created_asc' | 'priority_desc' | 'status'>(
  'utcSort',
  'created_desc',
);
const statusFilter = usePersistedRef<'' | 'live' | 'history' | 'failed'>('utcStatusFilter', '');
const historyTypeFilter = usePersistedRef<string>('historyTypeFilter', '');

const selectedTaskId = ref<string | null>(null);
const selectedProcessorType = ref<string | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

const apiBase = (): string => apiManager.getCurrentBaseUrl().replace(/\/+$/, '');

// task_type values present in the current data (drives the chip row).
const availableTypes = computed(() => {
  const set = new Set<string>();
  for (const r of rows.value) if (r.task_type) set.add(r.task_type);
  return [...set].sort();
});

const rowIsFast = (row: TaskRow): boolean =>
  isFastTier({ is_fast_tier: row.is_fast_tier, priority: row.priority, execution_type: row.execution_type });
const rowIsAi = (row: TaskRow): boolean => isAiTranslate(row.capability);

const statusColor = (status: string): string => {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'completed_demo') return 'var(--success)';
  if (s === 'failed' || s === 'cancelled') return 'var(--danger, #e5484d)';
  if (s === 'timeout' || s === 'reclaimed') return 'var(--warning)';
  if (s === 'processing' || s === 'assigned') return 'var(--accent)';
  return 'var(--text-muted)';
};

// Shared sort + task_type filter, applied to each group.
const sortRows = (list: TaskRow[]): TaskRow[] => {
  const arr = [...list];
  arr.sort((a, b) => {
    switch (sortKey.value) {
      case 'created_asc':
        return (a.created_at || '').localeCompare(b.created_at || '');
      case 'priority_desc':
        return (b.priority ?? 0) - (a.priority ?? 0);
      case 'status':
        return (a.status || '').localeCompare(b.status || '');
      case 'created_desc':
      default:
        return (b.created_at || '').localeCompare(a.created_at || '');
    }
  });
  return arr;
};

const passesTypeFilter = (row: TaskRow): boolean =>
  !historyTypeFilter.value || row.task_type === historyTypeFilter.value;

const filteredRecords = computed(() => rows.value.filter(passesTypeFilter));

const liveRows = computed(() => {
  if (statusFilter.value === 'history' || statusFilter.value === 'failed') return [];
  return sortRows(filteredRecords.value.filter((r) => LIVE_STATUSES.has((r.status || '').toLowerCase())));
});

const historyRows = computed(() => {
  if (statusFilter.value === 'live') return [];
  return sortRows(
    filteredRecords.value.filter((r) => {
      const s = (r.status || '').toLowerCase();
      if (LIVE_STATUSES.has(s)) return false;
      if (statusFilter.value === 'failed') return s === 'failed' || s === 'cancelled' || s === 'timeout';
      return true;
    }),
  );
});

const openTask = (row: TaskRow): void => {
  selectedProcessorType.value = row.execution_type || null;
  selectedTaskId.value = row.task_id;
};

const refresh = async (): Promise<void> => {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`${apiBase()}/api/task/list?limit=50`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) {
      error.value = `Failed to load tasks (${res.status})`;
      return;
    }
    const json = await res.json();
    const data = json?.data ?? json;
    rows.value = Array.isArray(data?.tasks) ? (data.tasks as TaskRow[]) : [];
  } catch (e: any) {
    error.value = e?.message || 'Failed to load tasks';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await apiManager.initialize({ autoDetect: false }).catch(() => {});
  await refresh();
  pollTimer = setInterval(refresh, 5000);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<style scoped>
.utc { display: flex; flex-direction: column; gap: 10px; }
.utc-head { display: flex; align-items: center; justify-content: space-between; }
.utc-title { font-size: 14px; font-weight: 700; color: var(--text); margin: 0; }
.utc-refresh {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: 8px;
  width: 30px;
  height: 30px;
  cursor: pointer;
}
.utc-refresh:disabled { opacity: 0.5; cursor: default; }
.utc-controls { display: flex; gap: 10px; }
.utc-ctl { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: var(--text-muted); }
.utc-select {
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 12px;
}
.utc-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.utc-typechip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: pointer;
}
.utc-typechip.active { background: var(--accent-soft); color: var(--accent-fg, var(--accent)); border-color: var(--accent); }
.utc-error { font-size: 12px; color: var(--warning); }
.utc-empty { font-size: 12px; color: var(--text-muted); padding: 12px 0; text-align: center; }
.utc-group { display: flex; flex-direction: column; gap: 6px; }
.utc-grouphead { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.utc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.utc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.utc-row:hover { border-color: var(--accent); background: var(--surface); }
.utc-rowicon { font-size: 18px; line-height: 1; flex-shrink: 0; }
.utc-rowmain { flex: 1; min-width: 0; }
.utc-rowtop { display: flex; align-items: center; gap: 6px; }
.utc-rowlabel { font-size: 12px; font-weight: 600; color: var(--text); }
.utc-fast { font-size: 12px; }
.utc-rowsub {
  font-size: 10px;
  color: var(--text-muted);
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.utc-rowright { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.utc-cap {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-muted);
}
.utc-cap.ai { border-color: var(--accent); color: var(--accent); }
.utc-status { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text); }
.utc-statusdot { width: 7px; height: 7px; border-radius: 50%; background: var(--dot, var(--text-muted)); }
</style>
