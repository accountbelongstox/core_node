<template>
  <div class="utc">
    <!-- Header -->
    <div class="utc-head">
      <h3 class="utc-title">🗂️ {{ getMessage('taskCenterUnifiedTitle') }}</h3>
      <div class="utc-head-right">
        <span class="utc-total-badge" v-if="totalPending > 0">{{ totalPending }}</span>
        <!-- Load is now driven by the Start button (via exposed loadAll); this is
             the small manual refresh, spinning while a load/refresh is in flight. -->
        <button
          class="utc-refresh"
          :disabled="loading || loadAllBusy"
          @click="refresh"
          :title="loadAllMsg || getMessage('taskCenterRefresh')"
        >
          <span :class="{ 'spin': loading || loadAllBusy }">↻</span>
        </button>
      </div>
    </div>
    <div v-if="loadAllMsg" class="utc-load-msg">{{ loadAllMsg }}</div>

    <!-- Category summary cards -->
    <div v-if="visibleSummaryCats.length" class="utc-grid">
      <div
        v-for="cat in visibleSummaryCats"
        :key="cat.type"
        class="utc-cat"
        :class="{ 'utc-cat--active': pendingByType[cat.type] > 0 }"
        @click="openCategory(cat)"
        :style="{ '--cat-accent': cat.color }"
        :title="cat.label"
      >
        <span class="utc-cat-icon">{{ cat.icon }}</span>
        <div class="utc-cat-body">
          <div class="utc-cat-name">{{ categoryLabel(cat) }}</div>
          <div class="utc-cat-nums">
            <span class="utc-num-pending" :class="{ 'utc-num--lit': (pendingByType[cat.type] || 0) > 0 }">
              {{ pendingByType[cat.type] || 0 }}
            </span>
            <span class="utc-num-sep utc-num-action" @click.stop="openCategoryWithStatus(cat, 'pending')">
              {{ getMessage('taskCenterPendingLabel') }}
            </span>
            <span v-if="(processingByType[cat.type] || 0) > 0" class="utc-num-proc">
              · {{ processingByType[cat.type] }} {{ getMessage('taskCenterProcessingLabel') }}
            </span>
            <span v-if="(completedByType[cat.type] || 0) > 0" class="utc-num-completed utc-num-action" @click.stop="openCategoryWithStatus(cat, 'completed')">
              · {{ completedByType[cat.type] }} {{ getMessage('taskCenterCompletedLabel') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Controls row -->
    <div class="utc-controls">
      <label class="utc-ctl">
        <span class="utc-ctl-label">{{ getMessage('taskCenterSortLabel') }}</span>
        <select v-model="sortKey" class="utc-select">
          <option value="created_desc">{{ getMessage('taskCenterSortNewest') }}</option>
          <option value="created_asc">{{ getMessage('taskCenterSortOldest') }}</option>
          <option value="priority_desc">{{ getMessage('taskCenterSortOrder') }} ↓</option>
          <option value="status">{{ getMessage('taskCenterStatusLabel') }}</option>
        </select>
      </label>
      <label class="utc-ctl">
        <span class="utc-ctl-label">{{ getMessage('taskCenterStatusLabel') }}</span>
        <select v-model="statusFilter" class="utc-select">
          <option value="">{{ getMessage('taskCenterAllLabel') }}</option>
          <option value="live">{{ getMessage('taskCenterLiveLabel') }}</option>
          <option value="history">{{ getMessage('taskCenterHistoryLabel') }}</option>
          <option value="failed">{{ getMessage('taskCenterFailedLabel') }}</option>
        </select>
      </label>
    </div>

    <div v-if="error" class="utc-error">⚠ {{ error }}</div>

    <!-- LIVE section -->
    <section v-if="liveRows.length" class="utc-group">
      <div class="utc-grouphead">
        <span class="utc-groupdot utc-groupdot--live" />
        {{ getMessage('taskCenterLiveLabel') }} <span class="utc-groupcount">{{ liveRows.length }}</span>
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
              <span class="utc-rowlabel">{{ localizedTaskTypeLabel(row.task_type, row.execution_type) }}</span>
              <span v-if="rowIsFast(row)" class="utc-fast" :title="getMessage('fastTierLabel')">⚡</span>
            </div>
            <div class="utc-rowsub" :title="row.task_id">{{ row.task_id }}</div>
          </div>
          <div class="utc-rowright">
            <span class="utc-cap" :class="{ 'utc-cap--ai': rowIsAi(row) }">
              {{ capabilityLabel(row.capability) }}<span v-if="rowIsAi(row)">✨</span>
            </span>
            <span class="utc-status-pill" :style="statusStyle(row.status)">
              <span class="utc-statusdot" />{{ localizedStatus(row.status) }}
            </span>
          </div>
        </li>
      </ul>
      <button v-if="liveHasMore" type="button" class="utc-more" @click="showAllLive = !showAllLive">
        {{ showAllLive ? getMessage('taskCenterShowLess') : getMessage('taskCenterShowAll', [String(liveRows.length)]) }}
      </button>
    </section>

    <!-- HISTORY section -->
    <section v-if="historyRows.length" class="utc-group">
      <div class="utc-grouphead">
        <span class="utc-groupdot utc-groupdot--hist" />
        {{ getMessage('taskCenterHistoryLabel') }} <span class="utc-groupcount">{{ historyRows.length }}</span>
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
              <span class="utc-rowlabel">{{ localizedTaskTypeLabel(row.task_type, row.execution_type) }}</span>
              <span v-if="rowIsFast(row)" class="utc-fast">⚡</span>
            </div>
            <div class="utc-rowsub" :title="row.task_id">{{ row.task_id }}</div>
          </div>
          <div class="utc-rowright">
            <span class="utc-cap" :class="{ 'utc-cap--ai': rowIsAi(row) }">
              {{ capabilityLabel(row.capability) }}<span v-if="rowIsAi(row)">✨</span>
            </span>
            <span class="utc-status-pill" :style="statusStyle(row.status)">
              <span class="utc-statusdot" />{{ localizedStatus(row.status) }}
            </span>
          </div>
        </li>
      </ul>
      <button v-if="historyHasMore" type="button" class="utc-more" @click="showAllHistory = !showAllHistory">
        {{ showAllHistory ? getMessage('taskCenterShowLess') : getMessage('taskCenterShowAll', [String(historyRows.length)]) }}
      </button>
    </section>

    <div v-if="!loading && !liveRows.length && !historyRows.length && !error" class="utc-empty">
      <span class="utc-empty-icon">✓</span>
      {{ getMessage('taskCenterNoMatchingTasks') }}
    </div>

    <div v-if="selectedCategory" class="utc-modal-backdrop" @click.self="closeCategory">
      <section class="utc-modal" role="dialog" aria-modal="true" :aria-label="selectedCategory.label">
        <header class="utc-modal-head">
          <div>
            <h4 class="utc-modal-title">
              <span>{{ selectedCategory.icon }}</span>
              {{ categoryLabel(selectedCategory) }}
            </h4>
            <div class="utc-modal-subtitle">{{ getMessage('taskCenterTaskCount', [categoryTotal.toLocaleString()]) }}</div>
          </div>
          <button type="button" class="utc-modal-close" :title="getMessage('closeButton')" @click="closeCategory">×</button>
        </header>

        <form class="utc-modal-tools" @submit.prevent="applyCategorySearch">
          <input
            v-model="categorySearchInput"
            class="utc-modal-search"
            type="search"
            maxlength="120"
            :placeholder="getMessage('taskCenterSearchPlaceholder')"
          />
          <select v-model="categoryStatus" class="utc-select" @change="resetCategoryPage">
            <option value="all">{{ getMessage('taskCenterAllTasks') }}</option>
            <option value="pending">{{ getMessage('taskCenterPendingLabel') }}</option>
            <option value="processing">{{ getMessage('taskCenterProcessingLabel') }}</option>
            <option value="leased">{{ getMessage('taskCenterLeasedLabel') }}</option>
            <option value="completed">{{ getMessage('taskCenterCompletedLabel') }}</option>
            <option value="failed">{{ getMessage('taskCenterFailedLabel') }}</option>
          </select>
          <button type="submit" class="utc-modal-search-btn">{{ getMessage('taskCenterSearchAction') }}</button>
        </form>

        <div v-if="categoryError" class="utc-error">⚠ {{ categoryError }}</div>
        <div v-else-if="categoryLoading" class="utc-modal-loading"><span class="spin">↻</span> {{ getMessage('loadingStatus') }}</div>
        <ul
          v-else-if="categoryItems.length"
          class="utc-modal-list"
          :class="{ 'utc-modal-list--words': isWordValidityCategory }"
        >
          <li
            v-for="item in categoryItems"
            :key="`${item.media_type || item.language || item.task_type}:${item.task_id || item.id}`"
            class="utc-modal-row"
            :class="{ 'utc-modal-row--word': isWordValidityCategory }"
          >
            <div class="utc-modal-row-main">
              <strong :title="item.content_text || String(item.task_id || item.id)">
                {{ item.content_text || item.task_id || `#${item.id}` }}
              </strong>
              <span v-if="!isWordValidityCategory">
                {{ item.language || item.media_type || item.task_type }} · ID {{ item.task_id || item.id }}
              </span>
            </div>
            <div v-if="!isWordValidityCategory" class="utc-modal-row-meta">
              <span class="utc-status-pill" :style="statusStyle(item.status)">
                <span class="utc-statusdot" />{{ localizedStatus(item.status) }}
              </span>
              <span v-if="isQueuePositionOrderedTask(item.task_type)" class="utc-modal-priority">
                {{ getMessage('taskCenterQueuePosition') }} #{{ item.queue_position ?? 0 }}
              </span>
              <span v-else-if="item.priority" class="utc-modal-priority">P{{ item.priority }}</span>
            </div>
          </li>
        </ul>
        <div v-else class="utc-empty">{{ getMessage('taskCenterNoTasksFound') }}</div>

        <footer class="utc-modal-page">
          <span>{{ categoryPageRange }}</span>
          <div class="utc-modal-page-actions">
            <button type="button" :disabled="categoryLoading || categoryStart === 0" @click="previousCategoryPage">{{ getMessage('taskCenterPreviousPage') }}</button>
            <label class="utc-modal-page-jump">
              <span>{{ getMessage('taskCenterPageLabel') }}</span>
              <select
                class="utc-select"
                :value="categoryCurrentPage"
                :disabled="categoryLoading || categoryPageCount <= 1"
                @change="goToCategoryPage"
              >
                <option v-for="page in categoryPageCount" :key="page" :value="page">{{ page }}</option>
              </select>
            </label>
            <button type="button" :disabled="categoryLoading || categoryStart + categoryPageSize >= categoryTotal" @click="nextCategoryPage">{{ getMessage('taskCenterNextPage') }}</button>
          </div>
        </footer>
      </section>
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
import { TaskCenterApiClient } from '@/services/TaskCenterApiClient';
import type {
  AssistCategoryItem,
  ValidityQueuePage,
} from '@/services/TaskCenterApiClient';
import { queueCenterWakeService } from '@/entrypoints/background/services/task-center/QueueCenterWakeService';
import { getValidityLanguages } from '@/services/AiProviderSettings';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { getMessage } from '@/utils/i18n';
import type { QueueLiveCounts, TaskRow } from '@/utils/queue-center-contract';
import {
  CHROME_TASK_TYPES,
  LIVE_TASK_STATUSES,
  TASK_LIMITS,
  TASK_STATUS_BY_ROLE,
  TASK_TYPE_CATALOG,
  WORD_VALIDITY_CONFIG,
  compareTasksByContract,
  isQueuePositionOrderedTask,
} from '@/utils/queue-center-contract';
import TaskDetailModal from './TaskDetailModal.vue';
import {
  taskIcon,
  taskTypeLabel,
  capabilityLabel,
  isAiTranslate,
  isFastTier,
} from './task-center-meta';

// TaskRow is the canonical task-summary shape from utils/queue-center-contract.ts.

interface SummaryCat {
  type: string;
  icon: string;
  label: string;
  labelKey: string;
  color: string;
}

// The popup renders the central Laravel task catalog in contract order. Adding
// or changing a task type starts in config/queue_center_contract.json and is
// immediately reflected by Laravel, Pycore, mcp-chrome, and both task UIs.
const CHROME_TASK_TYPE_KEYS = new Set(CHROME_TASK_TYPES.map((definition) => definition.key));
const PYCORE_ONLY_SUMMARY_TYPES = new Set(
  TASK_TYPE_CATALOG
    .filter((definition) => isQueuePositionOrderedTask(definition.key)
      && !CHROME_TASK_TYPE_KEYS.has(definition.key))
    .map((definition) => definition.key),
);

const SUMMARY_CATS: SummaryCat[] = TASK_TYPE_CATALOG
  // Keep contract definitions available to the runtime while omitting queue-
  // position task types that the Chrome claimant does not own.
  .filter((definition) => Boolean(definition.ui.summary_label)
    && !PYCORE_ONLY_SUMMARY_TYPES.has(definition.key))
  .map((definition) => ({
    type: definition.key,
    icon: definition.ui.icon,
    label: definition.label,
    labelKey: `taskCenterCategory_${definition.key}`,
    color: definition.ui.color,
  }));

const LIVE_STATUSES = new Set(LIVE_TASK_STATUSES);

const categoryLabel = (category: SummaryCat): string => getMessage(category.labelKey);
const localizedTaskTypeLabel = (taskType: string, executionType?: string | null): string => {
  const category = SUMMARY_CATS.find((item) => item.type === taskType);
  return category ? categoryLabel(category) : taskTypeLabel(taskType, executionType);
};
const localizedStatus = (status: string): string => {
  const normalized = String(status || '').toLowerCase();
  const key = `taskCenterStatus_${normalized.replace(/[^a-z0-9_]/g, '_')}`;
  const localized = getMessage(key);
  return localized === key ? status : localized;
};

const rows = ref<TaskRow[]>([]);
const loading = ref(false);
const error = ref('');
const loadAllBusy = ref(false);
const loadAllMsg = ref('');

// Server-side live aggregates (task_center/overview.queue.by_type). When
// present, the summary strip uses these EXACT counts instead of recomputing
// from the centrally limited list window (which diverged from Laravel's Task
// Center — the "data doesn't match" bug).
const serverByType = ref<Record<string, QueueLiveCounts> | null>(null);

const sortKey = usePersistedRef<'created_desc' | 'created_asc' | 'priority_desc' | 'status'>('utcSort', 'created_desc');
const statusFilter = usePersistedRef<'' | 'live' | 'history' | 'failed'>('utcStatusFilter', '');

const selectedTaskId = ref<string | null>(null);
const selectedProcessorType = ref<string | null>(null);
const selectedCategory = ref<SummaryCat | null>(null);
const categoryItems = ref<AssistCategoryItem[]>([]);
const categoryTotal = ref(0);
const categoryStart = ref(0);
const categorySearchInput = ref('');
const categorySearch = ref('');
const categoryStatus = ref('pending');
const categoryLoading = ref(false);
const categoryError = ref('');
const validityLanguages = ref<string[]>(['en']);
const CATEGORY_PAGE_SIZE = 20;
const WORD_VALIDITY_PAGE_SIZE = WORD_VALIDITY_CONFIG.view_page_size;
const validityPageCache = new Map<string, ValidityQueuePage>();
const validityPageRequests = new Map<string, Promise<ValidityQueuePage>>();

let taskCenterApi: TaskCenterApiClient | null = null;
let realtimeRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeRealtime: (() => void) | null = null;
let componentMounted = false;
let validityRevision: number | null = null;

const apiBase = getApiBase;
const apiClient = (): TaskCenterApiClient => {
  const baseUrl = apiBase();
  if (!taskCenterApi || taskCenterApi.getBaseUrl() !== baseUrl) {
    taskCenterApi = new TaskCenterApiClient(baseUrl);
  }
  return taskCenterApi;
};

const liveCountsForTaskType = (taskType: string): QueueLiveCounts | null => {
  return serverByType.value?.[taskType] || null;
};

const pendingByType = computed(() => {
  if (serverByType.value) {
    const m: Record<string, number> = {};
    for (const category of SUMMARY_CATS) {
      const counts = liveCountsForTaskType(category.type);
      if (counts && counts.pending > 0) m[category.type] = counts.pending;
    }
    return m;
  }
  const m: Record<string, number> = {};
  for (const r of rows.value) {
    const s = (r.status || '').toLowerCase();
    if (s === TASK_STATUS_BY_ROLE.pending) m[r.task_type] = (m[r.task_type] || 0) + 1;
  }
  return m;
});

const processingByType = computed(() => {
  if (serverByType.value) {
    const m: Record<string, number> = {};
    for (const category of SUMMARY_CATS) {
      const counts = liveCountsForTaskType(category.type);
      if (!counts) continue;
      const active = (counts.leased || 0) + (counts.processing || 0);
      if (active > 0) m[category.type] = active;
    }
    return m;
  }
  const m: Record<string, number> = {};
  for (const r of rows.value) {
    const s = (r.status || '').toLowerCase();
    if (s === TASK_STATUS_BY_ROLE.processing || s === TASK_STATUS_BY_ROLE.assigned) {
      m[r.task_type] = (m[r.task_type] || 0) + 1;
    }
  }
  return m;
});

const completedByType = computed(() => {
  const result: Record<string, number> = {};
  for (const row of rows.value) {
    if (String(row.status || '').toLowerCase() !== TASK_STATUS_BY_ROLE.completed) continue;
    result[row.task_type] = (result[row.task_type] || 0) + 1;
  }
  return result;
});

const visibleSummaryCats = computed(() => SUMMARY_CATS.filter((category) => {
  const pending = pendingByType.value[category.type] || 0;
  const processing = processingByType.value[category.type] || 0;
  return pending + processing > 0;
}));

const totalPending = computed(() => {
  if (serverByType.value) {
    return Object.values(pendingByType.value).reduce((sum, pending) => sum + pending, 0);
  }
  return rows.value.filter(
    (r) => (r.status || '').toLowerCase() === TASK_STATUS_BY_ROLE.pending,
  ).length;
});

const rowIsFast = (row: TaskRow): boolean =>
  isFastTier({
    task_type: row.task_type,
    is_fast_tier: row.is_fast_tier,
    priority: row.priority,
    execution_type: row.execution_type,
  });

const rowIsAi = (row: TaskRow): boolean => isAiTranslate(row.capability);

const statusStyle = (status: string): Record<string, string> => {
  const s = (status || '').toLowerCase();
  if (s === TASK_STATUS_BY_ROLE.completed || s === TASK_STATUS_BY_ROLE.completed_demo)
    return { '--dot': '#10b981', '--pill-bg': 'rgba(16,185,129,.12)', '--pill-fg': '#10b981' };
  if (s === TASK_STATUS_BY_ROLE.failed || s === TASK_STATUS_BY_ROLE.cancelled)
    return { '--dot': '#f43f5e', '--pill-bg': 'rgba(244,63,94,.12)', '--pill-fg': '#f43f5e' };
  if (s === TASK_STATUS_BY_ROLE.processing)
    return { '--dot': '#38bdf8', '--pill-bg': 'rgba(56,189,248,.12)', '--pill-fg': '#38bdf8' };
  if (s === TASK_STATUS_BY_ROLE.assigned)
    return { '--dot': '#818cf8', '--pill-bg': 'rgba(129,140,248,.12)', '--pill-fg': '#818cf8' };
  return { '--dot': 'var(--text-muted)', '--pill-bg': 'rgba(148,163,184,.1)', '--pill-fg': 'var(--text-muted)' };
};

const sortRows = (list: TaskRow[]): TaskRow[] => {
  const arr = [...list];
  arr.sort((a, b) => {
    switch (sortKey.value) {
      case 'created_asc':   return (a.created_at || '').localeCompare(b.created_at || '');
      case 'priority_desc': return compareTasksByContract(a, b);
      case 'status':        return (a.status || '').localeCompare(b.status || '');
      default:              return (b.created_at || '').localeCompare(a.created_at || '');
    }
  });
  return arr;
};

const filtered = computed(() => rows.value);

const liveRows = computed(() => {
  if (statusFilter.value === 'history' || statusFilter.value === 'failed') return [];
  return sortRows(filtered.value.filter((r) => LIVE_STATUSES.has((r.status || '').toLowerCase())));
});

const historyRows = computed(() => {
  if (statusFilter.value === 'live') return [];
  return sortRows(filtered.value.filter((r) => {
    const s = (r.status || '').toLowerCase();
    if (LIVE_STATUSES.has(s)) return false;
    if (statusFilter.value === 'failed') {
      return s === TASK_STATUS_BY_ROLE.failed || s === TASK_STATUS_BY_ROLE.cancelled;
    }
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

const isWordValidityCategory = computed(() => selectedCategory.value?.type === 'word_validity');
const categoryPageSize = computed(() =>
  isWordValidityCategory.value ? WORD_VALIDITY_PAGE_SIZE : CATEGORY_PAGE_SIZE,
);
const categoryPageCount = computed(() =>
  Math.max(1, Math.ceil(categoryTotal.value / categoryPageSize.value)),
);
const categoryCurrentPage = computed(() =>
  Math.floor(categoryStart.value / categoryPageSize.value) + 1,
);

const validityPageCacheKey = (start: number, search: string): string =>
  JSON.stringify([validityLanguages.value, start, search]);

const updateValidityRevision = (revision: number): void => {
  if (validityRevision !== null && validityRevision !== revision) validityPageCache.clear();
  validityRevision = revision;
};

const getValidityPage = async (start: number, search: string): Promise<ValidityQueuePage> => {
  const cacheKey = validityPageCacheKey(start, search);
  const cached = validityPageCache.get(cacheKey);
  if (cached) return cached;
  const pending = validityPageRequests.get(cacheKey);
  if (pending) return pending;

  const request = apiClient().listValidityQueue(
    validityLanguages.value,
    start,
    WORD_VALIDITY_PAGE_SIZE,
    search,
  ).then((page) => {
    updateValidityRevision(page.revision);
    validityPageCache.set(cacheKey, page);
    return page;
  }).finally(() => validityPageRequests.delete(cacheKey));
  validityPageRequests.set(cacheKey, request);
  return request;
};

const categoryPageRange = computed(() => {
  if (categoryTotal.value === 0) return getMessage('taskCenterPageRange', ['0', '0', '0']);
  const end = Math.min(categoryStart.value + categoryItems.value.length, categoryTotal.value);
  return getMessage('taskCenterPageRange', [
    String(categoryStart.value + 1),
    String(end),
    categoryTotal.value.toLocaleString(),
  ]);
});

const loadCategoryPage = async (): Promise<void> => {
  if (!selectedCategory.value) return;
  categoryLoading.value = true;
  categoryError.value = '';
  try {
    if (selectedCategory.value.type === 'word_validity'
      && (categoryStatus.value === 'pending' || categoryStatus.value === 'all')) {
      const page = await getValidityPage(categoryStart.value, categorySearch.value);
      categoryItems.value = page.words.map((word) => ({
        id: word.id,
        category: 'word_validity',
        task_type: 'word_validity',
        status: 'pending',
        priority: 0,
        content_text: word.word,
        language: word.language,
      }));
      categoryTotal.value = page.total;
      return;
    }
    if (selectedCategory.value.type === 'word_validity') {
      categoryItems.value = [];
      categoryTotal.value = 0;
      return;
    }
    const page = await apiClient().listCategoryItems(
      selectedCategory.value.type,
      categoryStatus.value,
      categoryStart.value,
      CATEGORY_PAGE_SIZE,
      categorySearch.value,
    );
    categoryItems.value = page.items;
    categoryTotal.value = page.total;
  } catch (e: any) {
    categoryItems.value = [];
    categoryTotal.value = 0;
    categoryError.value = e?.message || getMessage('taskCenterCategoryLoadError');
  } finally {
    categoryLoading.value = false;
  }
};

const openCategoryWithStatus = async (category: SummaryCat, status: string): Promise<void> => {
  selectedCategory.value = category;
  categoryStatus.value = status;
  categoryStart.value = 0;
  categorySearchInput.value = '';
  categorySearch.value = '';
  await loadCategoryPage();
};

const openCategory = (category: SummaryCat): Promise<void> =>
  openCategoryWithStatus(category, 'pending');

const closeCategory = (): void => {
  selectedCategory.value = null;
  categoryItems.value = [];
  categoryError.value = '';
};

const applyCategorySearch = async (): Promise<void> => {
  categorySearch.value = categorySearchInput.value.trim();
  categoryStart.value = 0;
  await loadCategoryPage();
};

const resetCategoryPage = async (): Promise<void> => {
  categoryStart.value = 0;
  await loadCategoryPage();
};

const previousCategoryPage = async (): Promise<void> => {
  categoryStart.value = Math.max(0, categoryStart.value - categoryPageSize.value);
  await loadCategoryPage();
};

const nextCategoryPage = async (): Promise<void> => {
  if (categoryStart.value + categoryPageSize.value >= categoryTotal.value) return;
  categoryStart.value += categoryPageSize.value;
  await loadCategoryPage();
};

const goToCategoryPage = async (event: Event): Promise<void> => {
  const page = Number((event.target as HTMLSelectElement).value);
  if (!Number.isInteger(page) || page < 1 || page > categoryPageCount.value) return;
  const nextStart = (page - 1) * categoryPageSize.value;
  if (nextStart === categoryStart.value) return;
  categoryStart.value = nextStart;
  await loadCategoryPage();
};

const refresh = async (): Promise<void> => {
  loading.value = true;
  error.value = '';
  try {
    validityLanguages.value = await getValidityLanguages();
    const [snapshot, validityPage] = await Promise.all([
      apiClient().snapshot(TASK_LIMITS.list),
      apiClient().listValidityQueue(validityLanguages.value, 0, 1, ''),
    ]);
    const summaryByType = { ...(snapshot.summaryByType || {}) };
    const existingValidity = summaryByType.word_validity;
    summaryByType.word_validity = {
      pending: validityPage.total,
      leased: existingValidity?.leased || 0,
      processing: existingValidity?.processing || 0,
    };
    rows.value = snapshot.tasks;
    serverByType.value = summaryByType;
    updateValidityRevision(validityPage.revision);
    if (snapshot.realtime?.transport === 'mercure') connectRealtime();
    if (selectedCategory.value?.type === 'word_validity') {
      await loadCategoryPage();
    }
  } catch (e: any) {
    error.value = e?.message || getMessage('taskCenterLoadError');
  } finally {
    loading.value = false;
  }
};


const loadAll = async (): Promise<void> => {
  if (loadAllBusy.value) return;
  loadAllBusy.value = true;
  loadAllMsg.value = '';
  error.value = '';
  try {
    const all = await apiClient().listTasks(TASK_LIMITS.list, TASK_STATUS_BY_ROLE.pending);
    const chromeHandled = all.filter((task) => CHROME_TASK_TYPE_KEYS.has(task.task_type));
    const existing = new Map(rows.value.map((r) => [r.task_id, r]));
    for (const t of all) existing.set(t.task_id, t);
    rows.value = [...existing.values()];
    await refresh();
    loadAllMsg.value = getMessage('taskCenterLoadSummary', [
      String(all.length),
      String(chromeHandled.length),
    ]);
    setTimeout(() => { loadAllMsg.value = ''; }, 4000);
  } catch (e: any) {
    error.value = e?.message || getMessage('taskCenterLoadError');
  } finally {
    loadAllBusy.value = false;
  }
};

const scheduleRealtimeRefresh = (): void => {
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = setTimeout(() => {
    realtimeRefreshTimer = null;
    void refresh();
  }, 250);
};

const connectRealtime = (): void => {
  if (unsubscribeRealtime) return;
  unsubscribeRealtime = queueCenterWakeService.subscribe(apiBase(), () => {
    if (componentMounted) scheduleRealtimeRefresh();
  });
};

onMounted(async () => {
  componentMounted = true;
  await apiManager.initialize({ autoDetect: false }).catch(() => {});
  await refresh();
});

onUnmounted(() => {
  componentMounted = false;
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = null;
  unsubscribeRealtime?.();
  unsubscribeRealtime = null;
});

// Let the parent (TaskCenterPanel Start button) trigger a full lane load so
// every lane's pending count populates immediately on start.
defineExpose({ loadAll });
</script>

<style scoped src="./unified-task-center.css"></style>
