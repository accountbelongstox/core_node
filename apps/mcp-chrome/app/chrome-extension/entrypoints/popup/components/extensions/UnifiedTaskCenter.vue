<template>
  <div class="utc">
    <!-- Header -->
    <div class="utc-head">
      <h3 class="utc-title">🗂️ Unified Task Center</h3>
      <div class="utc-head-right">
        <span class="utc-total-badge" v-if="totalPending > 0">{{ totalPending }}</span>
        <!-- Load is now driven by the Start button (via exposed loadAll); this is
             the small manual refresh, spinning while a load/refresh is in flight. -->
        <button
          class="utc-refresh"
          :disabled="loading || loadAllBusy"
          @click="refresh"
          :title="loadAllMsg || 'Refresh tasks'"
        >
          <span :class="{ 'spin': loading || loadAllBusy }">↻</span>
        </button>
      </div>
    </div>
    <div v-if="loadAllMsg" class="utc-load-msg">{{ loadAllMsg }}</div>

    <!-- Category summary cards -->
    <div class="utc-grid">
      <div
        v-for="cat in SUMMARY_CATS"
        :key="cat.type"
        class="utc-cat"
        :class="{ 'utc-cat--active': pendingByType[cat.type] > 0 }"
        @click="historyTypeFilter = historyTypeFilter === cat.type ? '' : cat.type"
        :style="{ '--cat-accent': cat.color }"
        :title="cat.label"
      >
        <span class="utc-cat-icon">{{ cat.icon }}</span>
        <div class="utc-cat-body">
          <div class="utc-cat-name">{{ cat.zhLabel }}</div>
          <div class="utc-cat-nums">
            <span class="utc-num-pending" :class="{ 'utc-num--lit': (pendingByType[cat.type] || 0) > 0 }">
              {{ pendingByType[cat.type] || 0 }}
            </span>
            <span class="utc-num-sep">待处理</span>
            <span v-if="(processingByType[cat.type] || 0) > 0" class="utc-num-proc">
              · {{ processingByType[cat.type] }} 处理中
            </span>
          </div>
        </div>
        <div
          v-if="historyTypeFilter === cat.type"
          class="utc-cat-sel"
        />
      </div>
    </div>

    <!-- Controls row -->
    <div class="utc-controls">
      <label class="utc-ctl">
        <span class="utc-ctl-label">Sort</span>
        <select v-model="sortKey" class="utc-select">
          <option value="created_desc">Newest</option>
          <option value="created_asc">Oldest</option>
          <option value="priority_desc">Priority ↓</option>
          <option value="status">Status</option>
        </select>
      </label>
      <label class="utc-ctl">
        <span class="utc-ctl-label">Status</span>
        <select v-model="statusFilter" class="utc-select">
          <option value="">All</option>
          <option value="live">Live</option>
          <option value="history">History</option>
          <option value="failed">Failed</option>
        </select>
      </label>
      <button
        v-if="historyTypeFilter"
        class="utc-clear-filter"
        @click="historyTypeFilter = ''"
        title="Clear type filter"
      >✕ {{ taskTypeLabel(historyTypeFilter) }}</button>
    </div>

    <div v-if="error" class="utc-error">⚠ {{ error }}</div>

    <!-- LIVE section -->
    <section v-if="liveRows.length" class="utc-group">
      <div class="utc-grouphead">
        <span class="utc-groupdot utc-groupdot--live" />
        Live <span class="utc-groupcount">{{ liveRows.length }}</span>
      </div>
      <ul class="utc-list">
        <li
          v-for="row in liveVisible"
          :key="row.task_id"
          class="utc-row"
          @click="openTask(row)"
        >
          <span class="utc-rowicon">{{ taskIcon(row.task_type, row.execution_type) }}</span>
          <div class="utc-rowmain">
            <div class="utc-rowtop">
              <span class="utc-rowlabel">{{ taskTypeLabel(row.task_type, row.execution_type) }}</span>
              <span v-if="rowIsFast(row)" class="utc-fast" title="Fast tier">⚡</span>
            </div>
            <div class="utc-rowsub" :title="row.task_id">{{ row.task_id }}</div>
          </div>
          <div class="utc-rowright">
            <span class="utc-cap" :class="{ 'utc-cap--ai': rowIsAi(row) }">
              {{ capabilityLabel(row.capability) }}<span v-if="rowIsAi(row)">✨</span>
            </span>
            <span class="utc-status-pill" :style="statusStyle(row.status)">
              <span class="utc-statusdot" />{{ row.status }}
            </span>
          </div>
        </li>
      </ul>
      <button v-if="liveHasMore" type="button" class="utc-more" @click="showAllLive = !showAllLive">
        {{ showAllLive ? '收起 Show less' : `展开全部 Show all ${liveRows.length}` }}
      </button>
    </section>

    <!-- HISTORY section -->
    <section v-if="historyRows.length" class="utc-group">
      <div class="utc-grouphead">
        <span class="utc-groupdot utc-groupdot--hist" />
        History <span class="utc-groupcount">{{ historyRows.length }}</span>
      </div>
      <ul class="utc-list">
        <li
          v-for="row in historyVisible"
          :key="row.task_id"
          class="utc-row utc-row--hist"
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
            <span class="utc-cap" :class="{ 'utc-cap--ai': rowIsAi(row) }">
              {{ capabilityLabel(row.capability) }}<span v-if="rowIsAi(row)">✨</span>
            </span>
            <span class="utc-status-pill" :style="statusStyle(row.status)">
              <span class="utc-statusdot" />{{ row.status }}
            </span>
          </div>
        </li>
      </ul>
      <button v-if="historyHasMore" type="button" class="utc-more" @click="showAllHistory = !showAllHistory">
        {{ showAllHistory ? '收起 Show less' : `展开全部 Show all ${historyRows.length}` }}
      </button>
    </section>

    <div v-if="!loading && !liveRows.length && !historyRows.length && !error" class="utc-empty">
      <span class="utc-empty-icon">✓</span>
      No tasks match the current filters
    </div>

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
import { apiManager, getApiBase } from '@/services/ApiManager';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_LIST_PATH } from '@/utils/api-paths';
import type { TaskRow } from '@/utils/task-center-types';
import TaskDetailModal from './TaskDetailModal.vue';
import {
  taskIcon,
  taskTypeLabel,
  capabilityLabel,
  isAiTranslate,
  isFastTier,
  TASK_TYPE_META,
} from './task-center-meta';

// TaskRow is the canonical task-summary shape from utils/task-center-types.ts.

interface SummaryCat {
  type: string;
  icon: string;
  label: string;
  zhLabel: string;
  color: string;
}

// Ordered summary categories. label/zhLabel/color come from the shared
// TASK_TYPE_META single source; gemini_chat keeps a distinct summary glyph
// (🗨️) to differentiate it from subtitle_search (💬) in the strip, so it
// carries an explicit icon override — the only one that diverges from meta.
const SUMMARY_ORDER: Array<{ type: string; iconOverride?: string }> = [
  { type: 'word_translation' },
  { type: 'word_audio' },
  { type: 'word_media' },
  { type: 'gemini_image' },
  { type: 'gemini_chat', iconOverride: '🗨️' },
  { type: 'poster' },
  { type: 'subtitle_search' },
  { type: 'notebooklm' },
  { type: 'sentence_audio' },
];

const SUMMARY_CATS: SummaryCat[] = SUMMARY_ORDER.map(({ type, iconOverride }) => {
  const meta = TASK_TYPE_META[type];
  return {
    type,
    icon: iconOverride || meta.icon,
    label: meta.label,
    zhLabel: meta.zhLabel ?? '',
    color: meta.color ?? '',
  };
});

const LIVE_STATUSES = new Set(['pending', 'assigned', 'processing']);

const rows = ref<TaskRow[]>([]);
const loading = ref(false);
const error = ref('');
const loadAllBusy = ref(false);
const loadAllMsg = ref('');

const sortKey = usePersistedRef<'created_desc' | 'created_asc' | 'priority_desc' | 'status'>('utcSort', 'created_desc');
const statusFilter = usePersistedRef<'' | 'live' | 'history' | 'failed'>('utcStatusFilter', '');
const historyTypeFilter = usePersistedRef<string>('historyTypeFilter', '');

const selectedTaskId = ref<string | null>(null);
const selectedProcessorType = ref<string | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

const apiBase = getApiBase;

const pendingByType = computed(() => {
  const m: Record<string, number> = {};
  for (const r of rows.value) {
    const s = (r.status || '').toLowerCase();
    if (s === 'pending') m[r.task_type] = (m[r.task_type] || 0) + 1;
  }
  return m;
});

const processingByType = computed(() => {
  const m: Record<string, number> = {};
  for (const r of rows.value) {
    const s = (r.status || '').toLowerCase();
    if (s === 'processing' || s === 'assigned') m[r.task_type] = (m[r.task_type] || 0) + 1;
  }
  return m;
});

const totalPending = computed(() =>
  rows.value.filter((r) => (r.status || '').toLowerCase() === 'pending').length,
);

const rowIsFast = (row: TaskRow): boolean =>
  isFastTier({ is_fast_tier: row.is_fast_tier, priority: row.priority, execution_type: row.execution_type });

const rowIsAi = (row: TaskRow): boolean => isAiTranslate(row.capability);

const statusStyle = (status: string): Record<string, string> => {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'completed_demo')
    return { '--dot': '#10b981', '--pill-bg': 'rgba(16,185,129,.12)', '--pill-fg': '#10b981' };
  if (s === 'failed' || s === 'cancelled')
    return { '--dot': '#f43f5e', '--pill-bg': 'rgba(244,63,94,.12)', '--pill-fg': '#f43f5e' };
  if (s === 'timeout' || s === 'reclaimed')
    return { '--dot': '#f59e0b', '--pill-bg': 'rgba(245,158,11,.12)', '--pill-fg': '#f59e0b' };
  if (s === 'processing')
    return { '--dot': '#38bdf8', '--pill-bg': 'rgba(56,189,248,.12)', '--pill-fg': '#38bdf8' };
  if (s === 'assigned')
    return { '--dot': '#818cf8', '--pill-bg': 'rgba(129,140,248,.12)', '--pill-fg': '#818cf8' };
  return { '--dot': 'var(--text-muted)', '--pill-bg': 'rgba(148,163,184,.1)', '--pill-fg': 'var(--text-muted)' };
};

const sortRows = (list: TaskRow[]): TaskRow[] => {
  const arr = [...list];
  arr.sort((a, b) => {
    switch (sortKey.value) {
      case 'created_asc':   return (a.created_at || '').localeCompare(b.created_at || '');
      case 'priority_desc': return (b.priority ?? 0) - (a.priority ?? 0);
      case 'status':        return (a.status || '').localeCompare(b.status || '');
      default:              return (b.created_at || '').localeCompare(a.created_at || '');
    }
  });
  return arr;
};

const passesFilter = (row: TaskRow): boolean =>
  !historyTypeFilter.value || row.task_type === historyTypeFilter.value;

const filtered = computed(() => rows.value.filter(passesFilter));

const liveRows = computed(() => {
  if (statusFilter.value === 'history' || statusFilter.value === 'failed') return [];
  return sortRows(filtered.value.filter((r) => LIVE_STATUSES.has((r.status || '').toLowerCase())));
});

const historyRows = computed(() => {
  if (statusFilter.value === 'live') return [];
  return sortRows(filtered.value.filter((r) => {
    const s = (r.status || '').toLowerCase();
    if (LIVE_STATUSES.has(s)) return false;
    if (statusFilter.value === 'failed') return s === 'failed' || s === 'cancelled' || s === 'timeout';
    return true;
  }));
});

// Cap each list to keep the popup short; a "show all" toggle expands it.
const LIST_CAP = 8;
const showAllLive = ref(false);
const showAllHistory = ref(false);
const liveVisible = computed(() =>
  showAllLive.value ? liveRows.value : liveRows.value.slice(0, LIST_CAP),
);
const historyVisible = computed(() =>
  showAllHistory.value ? historyRows.value : historyRows.value.slice(0, LIST_CAP),
);
const liveHasMore = computed(() => liveRows.value.length > LIST_CAP);
const historyHasMore = computed(() => historyRows.value.length > LIST_CAP);

const openTask = (row: TaskRow): void => {
  selectedProcessorType.value = row.execution_type || null;
  selectedTaskId.value = row.task_id;
};

const refresh = async (): Promise<void> => {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`${apiBase()}${TASK_LIST_PATH}?limit=50`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) { error.value = `Failed to load tasks (${res.status})`; return; }
    const json = await res.json();
    const data = json?.data ?? json;
    rows.value = Array.isArray(data?.tasks) ? (data.tasks as TaskRow[]) : [];
  } catch (e: any) {
    error.value = e?.message || 'Failed to load tasks';
  } finally {
    loading.value = false;
  }
};

const CHROME_EXECUTION_TYPES = new Set<string>([
  LANES.REMOTE_CLIENT, LANES.REMOTE_TRANSLATION, LANES.REMOTE_GEMINI,
  LANES.REMOTE_NOTEBOOKLM, LANES.REMOTE_GEMINI_TEXT, LANES.REMOTE_FAST,
]);

const loadAll = async (): Promise<void> => {
  if (loadAllBusy.value) return;
  loadAllBusy.value = true;
  loadAllMsg.value = '';
  error.value = '';
  try {
    const url = `${apiBase()}${TASK_LIST_PATH}?limit=500&status=pending`;
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) { error.value = `Load failed (${res.status})`; return; }
    const json = await res.json();
    const data = json?.data ?? json;
    const all: TaskRow[] = Array.isArray(data?.tasks) ? (data.tasks as TaskRow[]) : [];
    const chromeHandled = all.filter((t) => CHROME_EXECUTION_TYPES.has(t.execution_type));
    const existing = new Map(rows.value.map((r) => [r.task_id, r]));
    for (const t of all) existing.set(t.task_id, t);
    rows.value = [...existing.values()];
    loadAllMsg.value = `Loaded ${all.length} pending (${chromeHandled.length} chrome-processable)`;
    setTimeout(() => { loadAllMsg.value = ''; }, 4000);
  } catch (e: any) {
    error.value = e?.message || 'Load failed';
  } finally {
    loadAllBusy.value = false;
  }
};

onMounted(async () => {
  await apiManager.initialize({ autoDetect: false }).catch(() => {});
  await refresh();
  pollTimer = setInterval(refresh, 5000);
});

onUnmounted(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
});

// Let the parent (TaskCenterPanel Start button) trigger a full lane load so
// every lane's pending count populates immediately on start.
defineExpose({ loadAll });
</script>

<style scoped>
.utc { display: flex; flex-direction: column; gap: 10px; }

/* ── Header ── */
.utc-head { display: flex; align-items: center; justify-content: space-between; }
.utc-title { font-size: 13px; font-weight: 700; color: var(--text); margin: 0; }
.utc-head-right { display: flex; align-items: center; gap: 6px; }
.utc-total-badge {
  font-size: 10px; font-weight: 700;
  padding: 1px 6px; border-radius: 999px;
  background: rgba(56,189,248,.18); color: #38bdf8;
}
.utc-load-msg {
  font-size: 9px; color: var(--text-muted);
  padding: 2px 4px; border-radius: 4px;
  background: var(--surface-2);
}
.utc-refresh {
  border: 1px solid var(--border); background: var(--surface-2);
  color: var(--text); border-radius: 8px;
  width: 28px; height: 28px; cursor: pointer; font-size: 15px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s;
}
.utc-refresh:disabled { opacity: 0.5; cursor: default; }
.utc-refresh:not(:disabled):hover { background: var(--surface); }
.spin { display: inline-block; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Summary grid ── */
.utc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.utc-cat {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 9px; border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
  position: relative; overflow: hidden;
}
.utc-cat:hover { border-color: var(--cat-accent, var(--accent)); background: var(--surface); }
.utc-cat--active { border-color: var(--cat-accent, var(--accent)); }
.utc-cat--active::before {
  content: '';
  position: absolute; inset: 0;
  background: var(--cat-accent, var(--accent));
  opacity: 0.06;
  pointer-events: none;
}
.utc-cat-sel {
  position: absolute; right: 6px; top: 6px;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--cat-accent, var(--accent));
}
.utc-cat-icon { font-size: 18px; line-height: 1; flex-shrink: 0; }
.utc-cat-body { flex: 1; min-width: 0; }
.utc-cat-name { font-size: 10px; font-weight: 600; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.utc-cat-nums { display: flex; align-items: baseline; gap: 3px; flex-wrap: wrap; }
.utc-num-pending {
  font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums;
  color: var(--text-muted); line-height: 1;
}
.utc-num-pending.utc-num--lit { color: var(--cat-accent, #38bdf8); }
.utc-num-sep { font-size: 9px; color: var(--text-muted); }
.utc-num-proc { font-size: 9px; color: #f59e0b; white-space: nowrap; }

/* ── Controls ── */
.utc-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.utc-ctl { display: flex; flex-direction: column; gap: 2px; }
.utc-ctl-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.utc-select {
  background: var(--surface-2); border: 1px solid var(--border);
  color: var(--text); border-radius: 6px; padding: 3px 6px; font-size: 11px;
}
.utc-clear-filter {
  margin-top: auto; font-size: 10px; padding: 3px 8px;
  border-radius: 999px; border: 1px solid var(--accent);
  background: rgba(var(--accent-rgb, 99,102,241),.1);
  color: var(--accent-fg, var(--accent)); cursor: pointer;
  white-space: nowrap; transition: background 0.12s;
}
.utc-clear-filter:hover { background: rgba(var(--accent-rgb, 99,102,241),.2); }

/* ── Error / empty ── */
.utc-error { font-size: 11px; color: #f59e0b; padding: 6px 8px; border-radius: 8px; background: rgba(245,158,11,.1); }
.utc-empty { font-size: 12px; color: var(--text-muted); padding: 14px 0; text-align: center; }
.utc-empty-icon { font-size: 16px; display: block; margin-bottom: 4px; opacity: 0.5; }

/* ── Groups ── */
.utc-group { display: flex; flex-direction: column; gap: 5px; }
.utc-grouphead {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
}
.utc-groupcount {
  padding: 0 5px; border-radius: 999px;
  background: var(--surface-2); font-size: 10px; color: var(--text-muted);
}
.utc-groupdot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.utc-groupdot--live { background: #38bdf8; box-shadow: 0 0 6px #38bdf880; }
.utc-groupdot--hist { background: var(--text-muted); }

/* ── Task rows ── */
.utc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.utc-more {
  align-self: flex-start;
  margin-top: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.utc-more:hover { border-color: var(--accent); color: var(--text); }
.utc-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 9px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--surface-2); cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.utc-row:hover { border-color: var(--accent); background: var(--surface); }
.utc-row--hist { opacity: 0.8; }
.utc-row--hist:hover { opacity: 1; }
.utc-rowicon { font-size: 17px; line-height: 1; flex-shrink: 0; }
.utc-rowmain { flex: 1; min-width: 0; }
.utc-rowtop { display: flex; align-items: center; gap: 5px; }
.utc-rowlabel { font-size: 11px; font-weight: 600; color: var(--text); }
.utc-fast { font-size: 11px; }
.utc-rowsub {
  font-size: 9px; color: var(--text-muted);
  font-family: ui-monospace, monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-top: 1px;
}
.utc-rowright { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.utc-cap {
  font-size: 9px; padding: 1px 5px; border-radius: 999px;
  background: var(--surface); border: 1px solid var(--border); color: var(--text-muted);
}
.utc-cap--ai { border-color: #818cf8; color: #818cf8; background: rgba(129,140,248,.1); }
.utc-status-pill {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9px; padding: 2px 6px; border-radius: 999px;
  background: var(--pill-bg, rgba(148,163,184,.1));
  color: var(--pill-fg, var(--text-muted));
  font-weight: 600; text-transform: lowercase;
}
.utc-statusdot { width: 5px; height: 5px; border-radius: 50%; background: var(--dot, var(--text-muted)); flex-shrink: 0; }
</style>
