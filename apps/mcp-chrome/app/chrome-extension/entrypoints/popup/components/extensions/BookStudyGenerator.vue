<template>
  <div class="bsg-panel">
    <!-- Header -->
    <div class="bsg-header">
      <div class="bsg-brand">
        <span class="bsg-logo">📚</span>
        <div class="bsg-brand-text">
          <span class="bsg-title">Book Study Generator</span>
          <span class="bsg-sub">Generate multi-language comparison sentences, explanations, phrases & grammar per ~500-char segment</span>
        </div>
      </div>
    </div>

    <!-- Endpoint hint -->
    <div class="bsg-endpoint">
      <span class="bsg-endpoint-label">Endpoint</span>
      <code class="bsg-endpoint-url">{{ apiBaseUrl || '(resolving…)' }}</code>
      <span class="bsg-endpoint-note">Long auto-runs are best in the header's "open in a tab" window (a tab never blurs, so the popup can't be destroyed mid-run).</span>
    </div>

    <!-- Provider -->
    <label class="bsg-label">Provider</label>
    <div class="bsg-provider-row">
      <button
        v-for="p in PROVIDER_ORDER"
        :key="p"
        class="bsg-provider"
        :class="{ active: provider === p }"
        :disabled="running"
        @click="provider = p"
      >{{ PROVIDER_LABELS[p] }}</button>
    </div>

    <!-- Target languages -->
    <label class="bsg-label">Target languages <span class="bsg-label-hint">(the primary/source language is generated automatically and shown greyed)</span></label>
    <div class="bsg-langs">
      <button
        v-for="code in catalogCodes"
        :key="code"
        class="bsg-lang-chip"
        :class="{ active: isLanguageSelected(code), primary: code === primaryLangHint }"
        :disabled="code === primaryLangHint"
        :title="code === primaryLangHint ? 'Source language of the expanded book — always generated' : languageLabel(code)"
        @click="toggleLanguage(code)"
      >{{ code.toUpperCase() }}<span v-if="code === primaryLangHint" class="bsg-lang-tag">src</span></button>
    </div>

    <!-- Auto-run -->
    <label class="bsg-autorun">
      <input type="checkbox" v-model="autoRun" />
      <span>Auto-run — after each segment, automatically claim and generate the next until the source is complete</span>
    </label>

    <!-- Controls: type filter + search + refresh -->
    <div class="bsg-controls">
      <div class="bsg-typefilter">
        <button
          v-for="opt in TYPE_OPTIONS"
          :key="opt.value"
          class="bsg-type-btn"
          :class="{ active: typeFilter === opt.value }"
          @click="setTypeFilter(opt.value)"
        >{{ opt.label }}</button>
      </div>
      <input
        v-model="search"
        class="bsg-search"
        type="text"
        placeholder="Filter by title…"
        @keyup.enter="loadSources(1)"
      />
      <button class="bsg-refresh" :disabled="loadingSources" title="Refresh" @click="loadSources(1)">
        <span :class="{ spin: loadingSources }">↻</span>
      </button>
    </div>

    <!-- In-flight activity -->
    <div v-if="running || phase" class="bsg-activity">
      <span class="bsg-dot busy" />
      <span class="bsg-activity-text">{{ phase || 'Working…' }}</span>
      <button v-if="running" class="bsg-stop" @click="stop">Stop</button>
    </div>
    <div v-if="error" class="bsg-error">⚠ {{ error }}</div>
    <div v-if="result" class="bsg-result">{{ result }}</div>

    <div v-if="sourcesError" class="bsg-error">⚠ {{ sourcesError }}</div>

    <!-- Source list -->
    <div class="bsg-list">
      <div
        v-if="!loadingSources && sources.length === 0 && !sourcesError"
        class="bsg-empty"
      >No sources found for this filter.</div>

      <div v-for="src in sources" :key="keyOf(src.source_type, src.source_key)" class="bsg-source">
        <div class="bsg-source-head" @click="toggleExpand(src)">
          <span class="bsg-source-icon">{{ src.source_type === 'article' ? '📰' : '📖' }}</span>
          <div class="bsg-source-main">
            <div class="bsg-source-title" :title="src.title">{{ src.title || src.source_key }}</div>
            <div class="bsg-source-meta">
              <span>{{ src.language ? src.language.toUpperCase() : '—' }}</span>
              <span class="bsg-sep">·</span>
              <span>{{ src.sentence_count }} sentences</span>
              <span class="bsg-sep">·</span>
              <span
                class="bsg-status-chip"
                :class="'bsg-status-' + (src.study?.status || 'none')"
              >{{ src.study?.status || 'none' }}</span>
              <span v-if="(src.study?.languages || []).length" class="bsg-langs-done">
                {{ (src.study.languages || []).map((l) => l.toUpperCase()).join(' ') }}
              </span>
            </div>
            <!-- Progress bar -->
            <div class="bsg-progress">
              <div class="bsg-progress-track">
                <div class="bsg-progress-fill" :style="{ width: progressPct(src) + '%' }" />
              </div>
              <span class="bsg-progress-num">{{ src.study?.segments_done || 0 }}/{{ src.study?.segments_total || 0 }}</span>
            </div>
          </div>
          <button
            class="bsg-gen-btn"
            :disabled="running"
            @click.stop="generate(src)"
          >
            <span v-if="running && activeSourceKey === keyOf(src.source_type, src.source_key)" class="bsg-dot busy" />
            {{ autoRun ? 'Generate (auto)' : 'Generate next' }}
          </button>
          <span class="bsg-expand" :class="{ open: expandedKey === keyOf(src.source_type, src.source_key) }">▾</span>
        </div>

        <!-- Expanded: segment strip from GET /status -->
        <div v-if="expandedKey === keyOf(src.source_type, src.source_key)" class="bsg-drill">
          <div v-if="statusFor(src).loading" class="bsg-drill-msg">Loading segments…</div>
          <div v-else-if="statusFor(src).error" class="bsg-error">⚠ {{ statusFor(src).error }}</div>
          <template v-else>
            <div class="bsg-drill-totals">
              <span>{{ statusFor(src).totals.segments_done }}/{{ statusFor(src).totals.segments_total }} done</span>
              <span v-if="statusFor(src).totals.generating > 0" class="bsg-drill-gen">· {{ statusFor(src).totals.generating }} generating</span>
              <span v-if="statusFor(src).totals.failed > 0" class="bsg-drill-fail">· {{ statusFor(src).totals.failed }} failed</span>
              <button class="bsg-drill-refresh" title="Reload segments" @click.stop="loadStatus(src.source_type, src.source_key)">↻</button>
            </div>
            <div v-if="statusFor(src).segments.length === 0" class="bsg-drill-msg">
              No segments planned yet — Generate to plan and start.
            </div>
            <div v-else class="bsg-segstrip">
              <span
                v-for="seg in statusFor(src).segments"
                :key="seg.segment_index"
                class="bsg-seg"
                :class="'bsg-seg-' + seg.status"
                :title="segTitle(seg)"
              >{{ seg.segment_index }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pageCount > 1" class="bsg-pager">
      <button class="bsg-page-btn" :disabled="page <= 1 || loadingSources" @click="setPage(page - 1)">‹ Prev</button>
      <span class="bsg-page-info">Page {{ page }} / {{ pageCount }} · {{ total }} total</span>
      <button class="bsg-page-btn" :disabled="page >= pageCount || loadingSources" @click="setPage(page + 1)">Next ›</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import {
  useBookStudyGenerator,
  type StudySource,
  type StudySegmentRow,
  type StudyStatus,
} from '../../composables/useBookStudyGenerator';
import { PROVIDER_ORDER, PROVIDER_LABELS } from '../../composables/useArticleStudyGuide';
import { GEMINI_TRANSLATE_LANGUAGE_CATALOG } from '../../composables/promptPresets';

const {
  provider,
  targetLanguages,
  autoRun,
  isLanguageSelected,
  toggleLanguage,
  sources,
  total,
  page,
  pageCount,
  typeFilter,
  search,
  loadingSources,
  sourcesError,
  loadSources,
  setPage,
  statusBySource,
  loadStatus,
  keyOf,
  running,
  phase,
  error,
  result,
  activeSourceKey,
  generate,
  stop,
  apiBaseUrl,
  initPanel,
} = useBookStudyGenerator();

const TYPE_OPTIONS: Array<{ value: 'all' | 'book' | 'article'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'book', label: 'Books' },
  { value: 'article', label: 'Articles' },
];

const catalogCodes = Object.keys(GEMINI_TRANSLATE_LANGUAGE_CATALOG);
const languageLabel = (code: string): string => GEMINI_TRANSLATE_LANGUAGE_CATALOG[code] || code.toUpperCase();

// Which source's segment strip is open.
const expandedKey = ref('');

// The primary/source language to grey out in the target picker — taken from the
// currently expanded source (server always excludes the primary from targets).
const primaryLangHint = computed(() => {
  const src = sources.value.find((s) => keyOf(s.source_type, s.source_key) === expandedKey.value);
  return (src?.language || '').toLowerCase();
});

const setTypeFilter = (value: 'all' | 'book' | 'article') => {
  if (typeFilter.value === value) return;
  typeFilter.value = value;
  loadSources(1);
};

const toggleExpand = (src: StudySource) => {
  const k = keyOf(src.source_type, src.source_key);
  if (expandedKey.value === k) {
    expandedKey.value = '';
    return;
  }
  expandedKey.value = k;
  loadStatus(src.source_type, src.source_key);
};

const emptyStatus: StudyStatus = {
  totals: { segments_total: 0, segments_done: 0, generating: 0, failed: 0, status: 'none' },
  segments: [],
  loading: false,
  error: '',
};
const statusFor = (src: StudySource): StudyStatus =>
  statusBySource.value[keyOf(src.source_type, src.source_key)] || emptyStatus;

const progressPct = (src: StudySource): number => {
  const t = src.study?.segments_total || 0;
  const d = src.study?.segments_done || 0;
  if (t <= 0) return 0;
  return Math.min(100, Math.round((d / t) * 100));
};

const segTitle = (seg: StudySegmentRow): string => {
  const langs = (seg.languages_done || []).map((l) => l.toUpperCase()).join(' ');
  const parts = [
    `Segment ${seg.segment_index}: ${seg.status}`,
    `seq ${seg.seq_start}-${seg.seq_end}`,
    `${seg.char_count} chars`,
  ];
  if (langs) parts.push(langs);
  if (seg.error) parts.push(`error: ${seg.error}`);
  return parts.join(' · ');
};

onMounted(async () => {
  await initPanel();
});
</script>

<style scoped>
.bsg-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -16px rgba(0, 0, 0, 0.25);
}
.bsg-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.bsg-brand {
  display: flex;
  align-items: center;
  gap: 9px;
}
.bsg-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--accent-soft);
  font-size: 16px;
}
.bsg-brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.bsg-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.bsg-sub {
  font-size: 10px;
  color: var(--text-muted);
}
.bsg-endpoint {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  padding: 7px 9px;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  margin-bottom: 10px;
}
.bsg-endpoint-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-faint);
  text-transform: uppercase;
}
.bsg-endpoint-url {
  font-size: 10px;
  color: var(--text);
  word-break: break-all;
}
.bsg-endpoint-note {
  font-size: 9px;
  color: var(--text-faint);
  line-height: 1.4;
  flex-basis: 100%;
}
.bsg-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.bsg-label-hint {
  font-weight: 400;
  color: var(--text-faint);
}
.bsg-provider-row {
  display: flex;
  gap: 5px;
  margin-bottom: 10px;
}
.bsg-provider {
  flex: 1;
  font-size: 10px;
  font-weight: 700;
  padding: 6px 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: pointer;
}
.bsg-provider.active {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}
.bsg-provider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bsg-langs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
}
.bsg-lang-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: pointer;
}
.bsg-lang-chip.active {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}
.bsg-lang-chip.primary {
  opacity: 0.5;
  cursor: not-allowed;
  border-style: dashed;
}
.bsg-lang-tag {
  font-size: 7px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-faint);
}
.bsg-autorun {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 10px;
  cursor: pointer;
}
.bsg-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.bsg-typefilter {
  display: flex;
  gap: 3px;
}
.bsg-type-btn {
  font-size: 10px;
  font-weight: 700;
  padding: 5px 9px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: pointer;
}
.bsg-type-btn.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-fg, var(--accent));
}
.bsg-search {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
}
.bsg-search:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}
.bsg-refresh {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: 8px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}
.bsg-refresh:disabled {
  opacity: 0.5;
  cursor: default;
}
.spin {
  display: inline-block;
  animation: bsg-spin 0.7s linear infinite;
}
@keyframes bsg-spin {
  to {
    transform: rotate(360deg);
  }
}
.bsg-activity {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  margin-bottom: 8px;
}
.bsg-activity-text {
  flex: 1;
  font-size: 11px;
  color: var(--text);
}
.bsg-stop {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(244, 63, 94, 0.4);
  background: rgba(244, 63, 94, 0.1);
  color: var(--danger);
  cursor: pointer;
}
.bsg-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #10b981;
  flex-shrink: 0;
}
.bsg-dot.busy {
  animation: bsg-pulse 1.1s infinite;
}
@keyframes bsg-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.bsg-error {
  margin-bottom: 8px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3);
  color: var(--danger);
  font-size: 11px;
}
.bsg-result {
  margin-bottom: 8px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: var(--text);
  font-size: 11px;
  white-space: pre-wrap;
}
.bsg-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bsg-empty {
  font-size: 11px;
  color: var(--text-faint);
  text-align: center;
  padding: 16px 0;
}
.bsg-source {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  overflow: hidden;
}
.bsg-source-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
  cursor: pointer;
}
.bsg-source-icon {
  font-size: 16px;
  flex-shrink: 0;
}
.bsg-source-main {
  flex: 1;
  min-width: 0;
}
.bsg-source-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bsg-source-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  color: var(--text-muted);
  margin-top: 2px;
}
.bsg-sep {
  color: var(--text-faint);
}
.bsg-status-chip {
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 999px;
}
.bsg-status-none {
  background: var(--surface);
  color: var(--text-faint);
  border: 1px solid var(--border);
}
.bsg-status-partial {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}
.bsg-status-complete {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}
.bsg-langs-done {
  font-size: 8px;
  font-weight: 700;
  color: var(--text-faint);
}
.bsg-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}
.bsg-progress-track {
  flex: 1;
  height: 5px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.bsg-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: #10b981;
  transition: width 0.3s;
}
.bsg-progress-num {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.bsg-gen-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 999px;
  border: none;
  background: #10b981;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.bsg-gen-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bsg-expand {
  font-size: 12px;
  color: var(--text-faint);
  transition: transform 0.15s;
  flex-shrink: 0;
}
.bsg-expand.open {
  transform: rotate(180deg);
}
.bsg-drill {
  padding: 8px 9px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.bsg-drill-msg {
  font-size: 10px;
  color: var(--text-faint);
}
.bsg-drill-totals {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.bsg-drill-gen {
  color: #f59e0b;
}
.bsg-drill-fail {
  color: var(--danger);
}
.bsg-drill-refresh {
  margin-left: auto;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: 6px;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 11px;
}
.bsg-segstrip {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.bsg-seg {
  min-width: 18px;
  height: 18px;
  padding: 0 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 8px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
.bsg-seg-pending {
  background: var(--border);
  color: var(--text-muted);
}
.bsg-seg-generating {
  background: #f59e0b;
}
.bsg-seg-done {
  background: #10b981;
}
.bsg-seg-failed {
  background: #f43f5e;
}
.bsg-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}
.bsg-page-btn {
  font-size: 10px;
  font-weight: 700;
  padding: 5px 11px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
}
.bsg-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.bsg-page-info {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
