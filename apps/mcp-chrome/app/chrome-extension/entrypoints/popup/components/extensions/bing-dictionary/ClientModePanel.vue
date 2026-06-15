<template>
  <div class="client-mode-section">
    <div class="client-config-card">
      <div class="config-header">
        <span class="config-label">{{ t('bingAssistTitle') }}</span>
        <div class="config-controls">
          <!-- Two-step single button:
               stopped & not prepared -> "Load queue" (fetch + show data, NO start)
               stopped & prepared      -> "Confirm & Start" (begin crawling)
               running                 -> "Stop"
               Colour: blue=load, green=confirm, red=stop. -->
          <button
            class="service-toggle"
            :class="clientService.isRunning ? 'on' : (prepared ? 'ready' : 'off')"
            @click="onToggleService"
            :disabled="!currentEndpoint || !!(queueOverview && queueOverview.loading)"
          >
            <span class="toggle-dot"></span>
            <template v-if="queueOverview && queueOverview.loading">Loading…</template>
            <template v-else-if="clientService.isRunning">Stop</template>
            <template v-else-if="prepared">Confirm &amp; Start{{
              queueOverview && queueOverview.summary ? ' · ' + queueOverview.summary.pending + ' pending' : ''
            }}</template>
            <template v-else>Load queue</template>
          </button>
        </div>
      </div>

      <div v-if="error" class="assist-error">⚠ {{ error }}</div>

      <!-- Backend connection: the endpoint comes from Settings -> API
           Configuration; the dot/message reflect the last queue load. -->
      <div class="backend-line">
        <span
          :class="[
            'be-dot',
            connectionStatus
              ? (connectionStatus.state === 'ok' ? 'ok' : connectionStatus.state === 'fail' ? 'fail' : 'idle')
              : 'idle',
          ]"
        ></span>
        <span class="be-label">Backend</span>
        <span class="be-url" :title="currentEndpoint">
          {{ currentEndpoint || 'not set — configure in Settings → API Configuration' }}
        </span>
        <span v-if="connectionStatus && connectionStatus.message" class="be-msg">
          · {{ connectionStatus.message }}
        </span>
      </div>

      <!-- Two-step hint + empty-queue guard. -->
      <div v-if="!clientService.isRunning && !prepared" class="be-hint">
        Click “Load queue” to review the untranslated data, then Confirm & Start.
      </div>
      <div
        v-else-if="prepared && queueOverview && queueOverview.summary && queueOverview.summary.pending === 0"
        class="be-hint warn"
      >
        No pending words to translate — nothing to crawl.
      </div>

      <!-- Untranslated queue overview: how many entries + the pending task list
           (paginated, each row expandable). Loaded on Start; refresh anytime. -->
      <div v-if="queueOverview" class="queue-overview">
        <div class="qo-head">
          <span class="qo-title">Untranslated queue</span>
          <button
            class="qo-refresh"
            @click="onRefreshQueue"
            :disabled="queueOverview.loading"
            title="Refresh"
          >{{ queueOverview.loading ? '…' : '↻' }}</button>
        </div>
        <div v-if="queueOverview.error" class="qo-error">⚠ {{ queueOverview.error }}</div>
        <div v-if="queueOverview.summary" class="qo-summary">
          <span class="qo-chip pending">pending <b>{{ queueOverview.summary.pending }}</b></span>
          <span class="qo-chip proc">processing <b>{{ queueOverview.summary.processing }}</b></span>
          <span class="qo-chip done">completed <b>{{ queueOverview.summary.completed }}</b></span>
          <span class="qo-chip fail">failed <b>{{ queueOverview.summary.failed }}</b></span>
          <span class="qo-chip total">total <b>{{ queueOverview.summary.total }}</b></span>
        </div>
        <div v-if="queuePageItems.length" class="qo-list">
          <details v-for="(item, i) in queuePageItems" :key="item.task_id || i" class="qo-item">
            <summary class="qo-item-head">
              <span :class="['qo-badge', item.status]">{{ item.status }}</span>
              <span class="qo-words">{{ (item.words || []).slice(0, 6).join(', ')
                }}<span v-if="(item.words || []).length > 6"> …</span></span>
              <span class="qo-count">{{ item.word_count }}w</span>
            </summary>
            <div class="qo-item-body">
              <div>task: <code>{{ item.task_id }}</code></div>
              <div>{{ item.language }} → {{ item.target_language }} · prio {{ item.priority }} · {{ item.age_seconds }}s</div>
              <div v-if="item.assigned_to">assigned: {{ item.assigned_to }}</div>
              <div class="qo-allwords">{{ (item.words || []).join(', ') }}</div>
            </div>
          </details>
        </div>
        <div v-else-if="queueOverview.summary && !queueOverview.loading" class="qo-empty">
          No pending tasks.
        </div>
        <div v-if="queueTotalPages > 1" class="qo-pager">
          <button @click="onSetQueuePage(queueOverview.page - 1)" :disabled="queueOverview.page <= 1">Prev</button>
          <span>{{ queueOverview.page }} / {{ queueTotalPages }}</span>
          <button @click="onSetQueuePage(queueOverview.page + 1)" :disabled="queueOverview.page >= queueTotalPages">Next</button>
        </div>
      </div>

      <!-- Live Bing scrape test (default word: hello) -->
      <div class="scrape-test">
        <label class="form-label">{{ t('bingAssistScrapeLabel') }}</label>
        <div class="url-row">
          <input
            :value="testWords"
            @input="onTestWordsInput"
            type="text"
            placeholder="hello"
            class="form-input"
          />
          <button class="test-button" @click="onRunScrape" :disabled="testing">
            {{ testing ? '…' : t('bingAssistScrape') }}
          </button>
        </div>
        <div class="scrape-results" v-if="testResults && testResults.length">
          <div
            v-for="(r, i) in testResults"
            :key="i"
            :class="['scrape-row', r.ok ? 'ok' : r.invalid ? 'invalid' : 'fail']"
          >
            <div class="scrape-row-head">
              <span class="scrape-word">{{ r.word }}</span>
              <!-- US + UK pronunciations, each with its own play button. -->
              <span v-if="r.ok && (r.usPhonetic || r.usAudioUrl)" class="scrape-pr">
                <button
                  v-if="r.usAudioUrl"
                  class="audio-btn"
                  :class="{ playing: playingUrl === r.usAudioUrl }"
                  @click="playAudio(r.usAudioUrl)"
                  title="US"
                >US ▶</button>
                <em v-if="r.usPhonetic" class="scrape-phonetic">[{{ r.usPhonetic }}]</em>
              </span>
              <span v-if="r.ok && (r.ukPhonetic || r.ukAudioUrl)" class="scrape-pr">
                <button
                  v-if="r.ukAudioUrl"
                  class="audio-btn"
                  :class="{ playing: playingUrl === r.ukAudioUrl }"
                  @click="playAudio(r.ukAudioUrl)"
                  title="UK"
                >UK ▶</button>
                <em v-if="r.ukPhonetic" class="scrape-phonetic">[{{ r.ukPhonetic }}]</em>
              </span>
              <button
                v-if="r.ok && !r.usAudioUrl && !r.ukAudioUrl && r.audioUrl"
                class="audio-btn"
                :class="{ playing: playingUrl === r.audioUrl }"
                @click="playAudio(r.audioUrl)"
                :title="t('bingAssistPlayAudio')"
              >▶</button>
              <span v-if="!r.ok" class="scrape-detail">
                {{ r.invalid ? t('bingAssistInvalidNoEntry') : r.error }}
              </span>
            </div>
            <div v-if="r.ok && r.translation" class="scrape-trans">{{ r.translation }}</div>
            <div v-if="r.ok && r.imageUrls && r.imageUrls.length" class="scrape-thumbs">
              <img
                v-for="(src, j) in r.imageUrls.slice(0, 6)"
                :key="j"
                :src="src"
                class="scrape-thumb"
                loading="lazy"
                referrerpolicy="no-referrer"
                :alt="r.word"
              />
            </div>
            <!-- Cached media (audio + images): the original remote URL is the
                 cache key/"path"; the bytes are stored in the extension cache. -->
            <div v-if="r.ok && r.media && r.media.length" class="scrape-media">
              <div v-for="(m, k) in r.media" :key="k" class="scrape-media-row">
                <span :class="['m-tag', m.kind]">{{ m.kind }}</span>
                <span :class="['m-ok', m.cached ? 'yes' : 'no']">{{ m.cached ? 'cached' : 'miss' }}</span>
                <span class="m-bytes">{{ m.bytes }}B</span>
                <span class="m-url" :title="m.url">{{ m.url }}</span>
              </div>
            </div>
            <!-- Structured result (JSON), data URLs elided for readability. -->
            <details v-if="r.ok" class="scrape-json">
              <summary>JSON</summary>
              <pre>{{ jsonView(r) }}</pre>
            </details>
          </div>
        </div>
        <div v-if="testResults && testResults.length" class="scrape-cache-hint">
          {{ t('bingAssistCachedAt') }} {{ cacheLocation }}
        </div>
      </div>

      <!-- Live activity -->
      <div v-if="clientService.isRunning && clientService.stats?.currentWord" class="assist-activity">
        <span class="activity-dot"></span>
        <span class="activity-text">{{ t('bingAssistTranslatingLabel') }} <strong>{{ clientService.stats.currentWord }}</strong></span>
      </div>

      <div v-if="clientService.stats" class="service-stats">
        <!-- Status strip -->
        <div class="stats-status">
          <span
            :class="['s-dot', clientService.stats.isOnline ? 'online' : 'offline']"
          ></span>
          <span class="s-state">{{ clientService.stats.isOnline ? 'Online' : 'Offline' }}</span>
          <span class="s-meta">
            {{ t('bingAssistLastRun') }} {{ formatTimestamp(clientService.stats.lastRun) }}
          </span>
          <span v-if="clientService.stats.activeTabs !== undefined" class="s-tabs">
            {{ clientService.stats.activeTabs }} · {{ t('bingAssistActiveTabs') }}
          </span>
        </div>

        <!-- Headline metrics -->
        <div class="metric-grid">
          <div class="metric-card mc-primary">
            <span class="metric-value">{{ clientService.stats.queueTotal || 0 }}</span>
            <span class="metric-label">{{ t('bingAssistQueueTotal') }}</span>
          </div>
          <div class="metric-card mc-success">
            <span class="metric-value">{{ clientService.stats.newTasks || 0 }}</span>
            <span class="metric-label">{{ t('bingAssistNewTasks') }}</span>
          </div>
          <div class="metric-card mc-warning">
            <span class="metric-value">{{ clientService.stats.duplicateTasks || 0 }}</span>
            <span class="metric-label">{{ t('bingAssistDuplicates') }}</span>
          </div>
        </div>

        <!-- Secondary stats as chips -->
        <div class="stat-chips">
          <span class="chip"><i class="c-dot pending"></i>{{ t('bingAssistPending') }}<b>{{ clientService.stats.pending }}</b></span>
          <span class="chip"><i class="c-dot done"></i>{{ t('bingAssistTranslated') }}<b>{{ clientService.stats.translated }}</b></span>
          <span class="chip"><i class="c-dot fail"></i>{{ t('bingAssistFailed') }}<b>{{ clientService.stats.failed }}</b></span>
          <span v-if="clientService.stats.invalid !== undefined" class="chip"><i class="c-dot invalid"></i>{{ t('bingAssistInvalid') }}<b>{{ clientService.stats.invalid }}</b></span>
        </div>
      </div>

      <!-- Settings (moved to the bottom). Disabled while the worker is running. -->
      <div class="settings-block">
        <div class="settings-title">Settings</div>
        <div class="config-grid">
          <div class="config-field">
            <label class="form-label">{{ t('bingAssistPollInterval') }}</label>
            <input :value="clientConfig.fetchInterval" @input="onConfigChange('fetchInterval', $event)" type="number" min="1" max="60" class="form-input-small" :disabled="clientService.isRunning" />
          </div>
          <div class="config-field">
            <label class="form-label">{{ t('bingAssistBatchSize') }}</label>
            <input :value="clientConfig.batchSize" @input="onConfigChange('batchSize', $event)" type="number" min="1" max="50" class="form-input-small" :disabled="clientService.isRunning" />
          </div>
          <div v-if="clientConfig.mode === 'worker'" class="config-field">
            <label class="form-label">{{ t('bingAssistParallelTabs') }}</label>
            <input :value="clientConfig.tabCount" @input="onConfigChange('tabCount', $event)" type="number" min="1" max="8" class="form-input-small" :disabled="clientService.isRunning" />
          </div>
          <div v-if="clientConfig.mode === 'worker'" class="config-field">
            <label class="form-label">{{ t('bingAssistTargetLang') }}</label>
            <input :value="clientConfig.targetLanguage" @input="onConfigChange('targetLanguage', $event)" type="text" placeholder="zh" class="form-input-small" :disabled="clientService.isRunning" />
          </div>
        </div>
        <div v-if="clientService.isRunning" class="config-hint">{{ t('bingAssistStopToChange') }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import type { ClientConfig, ClientServiceState } from '../../../composables/useBingDictionaryClient';
import { getMessage as t } from '../../../../../utils/i18n';
import { describeLocation } from '../../../composables/useCacheStore';

// Where scrape-test results are cached (OPFS · cache/dictionary). Shown so the
// user can see the cache path right where the results appear.
const cacheLocation = describeLocation();

interface ConnectionStatus {
  state: 'idle' | 'testing' | 'ok' | 'fail';
  message: string;
}

interface QueueOverview {
  summary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  } | null;
  items: any[]; // current page only (server-paginated)
  page: number;
  pageSize: number;
  total: number; // total filtered rows
  hasMore: boolean;
  loading: boolean;
  error: string;
}

interface Props {
  clientConfig: ClientConfig;
  clientService: ClientServiceState;
  formatTimestamp: (timestamp: number | null) => string;
  error?: string;
  connectionStatus?: ConnectionStatus;
  currentEndpoint?: string;
  testWords?: string;
  testResults?: any[];
  testing?: boolean;
  queueOverview?: QueueOverview | null;
}

interface Emits {
  (e: 'toggle-service'): void;
  (e: 'update-config', field: string, value: any): void;
  (e: 'run-scrape-test'): void;
  (e: 'update-test-words', value: string): void;
  (e: 'refresh-queue'): void;
  (e: 'set-queue-page', page: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  currentEndpoint: '',
  testResults: () => [],
  testWords: 'hello',
  testing: false,
  queueOverview: null,
});
const emit = defineEmits<Emits>();

const onToggleService = () => emit('toggle-service');
const onRunScrape = () => emit('run-scrape-test');
const onRefreshQueue = () => emit('refresh-queue');
const onSetQueuePage = (page: number) => emit('set-queue-page', page);

// Server-side pagination: `items` is already the current page; the page count
// comes from the server `total`. The pager emits set-queue-page → server fetch.
const queueTotalPages = computed(() => {
  const q = props.queueOverview;
  if (!q) return 1;
  return Math.max(1, Math.ceil((q.total || q.items.length) / q.pageSize));
});
const queuePageItems = computed(() => props.queueOverview?.items ?? []);

// Render the structured scrape result as JSON, eliding huge base64 data URLs
// (images/audio) to "[dataURL N bytes]" so the JSON stays readable.
const jsonView = (r: any): string => {
  const elide = (v: any): any => {
    if (typeof v === 'string' && v.startsWith('data:')) return `[dataURL ${v.length}b]`;
    if (Array.isArray(v)) return v.map(elide);
    if (v && typeof v === 'object') {
      const out: any = {};
      for (const k of Object.keys(v)) out[k] = elide(v[k]);
      return out;
    }
    return v;
  };
  try {
    return JSON.stringify(elide(r), null, 2);
  } catch {
    return String(r);
  }
};

const onTestWordsInput = (event: Event) => {
  emit('update-test-words', (event.target as HTMLInputElement).value);
};

const STRING_FIELDS = ['apiUrl', 'targetLanguage'];

const onConfigChange = (field: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = STRING_FIELDS.includes(field) ? target.value : Number(target.value);
  emit('update-config', field, value);
};

// Play a pronunciation audio URL inline (the test surfaces real Bing audio).
const playingUrl = ref<string | null>(null);
let currentAudio: HTMLAudioElement | null = null;
const playAudio = (url?: string) => {
  if (!url) return;
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const audio = new Audio(url);
    currentAudio = audio;
    playingUrl.value = url;
    const clear = () => {
      if (playingUrl.value === url) playingUrl.value = null;
    };
    audio.addEventListener('ended', clear);
    audio.addEventListener('error', clear);
    audio.play().catch(clear);
  } catch {
    playingUrl.value = null;
  }
};
</script>

<style scoped>
/* Error keeps semantic danger color (red). */
.assist-error {
  margin: 8px 0;
  padding: 8px 10px;
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3);
  border-radius: 6px;
  color: var(--danger);
  font-size: 12px;
}

.url-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.url-row .form-input {
  flex: 1;
  min-width: 0;
}

.endpoint-readonly {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 11px;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.endpoint-hint {
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-faint);
}

.endpoint-edit {
  margin-top: 6px;
}

.test-button {
  padding: 0 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.test-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mini-button {
  padding: 0 10px;
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  height: 28px;
}

/* Delete keeps semantic danger color (red). */
.mini-button.danger {
  background: rgba(244, 63, 94, 0.12);
  color: var(--danger);
  border-color: rgba(244, 63, 94, 0.3);
}

.mini-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.conn-status {
  margin-top: 4px;
  font-size: 11px;
}

/* Connection status keeps semantic success/danger/muted colors. */
.conn-status.ok {
  color: var(--success);
}

.conn-status.fail {
  color: var(--danger);
}

.conn-status.testing {
  color: var(--text-muted);
}

.config-hint {
  font-size: 11px;
  color: var(--text-faint);
  font-style: italic;
}

/* Compact 2-column config grid (replaces the old vertical list of fields). */
.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.config-field .form-label {
  margin: 0;
}

.config-field .form-input-small {
  width: 100%;
}

.ghost-test {
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.ghost-test:hover {
  color: var(--accent-fg);
  border-color: var(--accent);
}

.ghost-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Worker stats dashboard ---- */
.service-stats {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stats-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--text-muted);
}

.stats-status .s-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stats-status .s-dot.online {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 20%, transparent);
}

.stats-status .s-dot.offline {
  background: var(--text-faint);
}

.stats-status .s-state {
  font-weight: 700;
  color: var(--text);
}

.stats-status .s-meta {
  color: var(--text-faint);
}

.stats-status .s-tabs {
  margin-left: auto;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-fg);
  font-weight: 600;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.metric-card .metric-value {
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  color: var(--text);
}

.metric-card .metric-label {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-faint);
}

.metric-card.mc-primary {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}
.metric-card.mc-primary .metric-value {
  color: var(--accent-fg);
}
.metric-card.mc-success .metric-value {
  color: var(--success);
}
.metric-card.mc-warning .metric-value {
  color: var(--warning);
}

.stat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.stat-chips .chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 10px;
  color: var(--text-muted);
}

.stat-chips .chip b {
  color: var(--text);
  font-weight: 700;
}

.stat-chips .c-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.stat-chips .c-dot.pending {
  background: var(--accent);
}
.stat-chips .c-dot.done {
  background: var(--success);
}
.stat-chips .c-dot.fail {
  background: var(--danger);
}
.stat-chips .c-dot.invalid {
  background: var(--warning);
}

.scrape-cache-hint {
  margin-top: 6px;
  font-size: 9px;
  font-family: ui-monospace, monospace;
  color: var(--text-faint);
  word-break: break-all;
}

.scrape-test {
  margin: 10px 0;
  padding: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.scrape-results {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 160px;
  overflow-y: auto;
}

.scrape-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
}

.scrape-row-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scrape-phonetic {
  color: var(--accent-fg);
  font-style: normal;
  font-size: 10px;
}

.audio-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.audio-btn:hover {
  background: var(--accent-fg);
}

.audio-btn.playing {
  animation: audio-pulse 0.8s ease-in-out infinite;
}

@keyframes audio-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.18);
  }
}

.scrape-trans {
  color: var(--text);
  line-height: 1.4;
  word-break: break-word;
}

.scrape-thumbs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.scrape-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.scrape-pr {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-right: 4px;
}

.scrape-media {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.scrape-media-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
  font-family: ui-monospace, monospace;
  color: var(--text-muted);
}

.m-tag {
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 700;
  text-transform: uppercase;
  background: var(--accent-soft);
  color: var(--accent-fg);
}
.m-tag.audio { background: rgba(99, 102, 241, 0.15); }
.m-ok.yes { color: #10b981; }
.m-ok.no { color: #f43f5e; }
.m-bytes { color: var(--text-faint); }
.m-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scrape-json {
  margin-top: 4px;
  font-size: 9px;
}
.scrape-json summary {
  cursor: pointer;
  color: var(--accent-fg);
  font-weight: 700;
}
.scrape-json pre {
  margin-top: 3px;
  max-height: 180px;
  overflow: auto;
  padding: 6px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-family: ui-monospace, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Result row left borders keep semantic success/warning/danger colors. */
.scrape-row.ok {
  border-left-color: var(--success);
}

.scrape-row.invalid {
  border-left-color: var(--warning);
}

.scrape-row.fail {
  border-left-color: var(--danger);
}

.scrape-word {
  font-weight: 700;
  color: var(--text);
  min-width: 64px;
}

.scrape-detail {
  color: var(--text-muted);
  word-break: break-word;
}

/* Live activity keeps a semantic cyan info accent. */
.assist-activity {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  padding: 8px 10px;
  background: rgba(6, 182, 212, 0.12);
  border: 1px solid rgba(6, 182, 212, 0.35);
  border-radius: 6px;
  font-size: 12px;
  color: #0891b2;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #06b6d4;
  animation: assist-pulse 1s ease-in-out infinite;
}

@keyframes assist-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Single auto-toggle button (replaces Test / STOPPED / START). */
.service-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.service-toggle .toggle-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
}
.service-toggle.off {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}
.service-toggle.on {
  background: #f43f5e;
  border-color: #f43f5e;
  color: #fff;
}
.service-toggle.on .toggle-dot {
  animation: pulse 1.2s infinite;
}
.service-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Untranslated queue overview. */
.queue-overview {
  margin-top: 8px;
  padding: 8px;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.qo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}
.qo-title {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-faint);
}
.qo-refresh {
  border: none;
  background: transparent;
  color: var(--accent-fg);
  cursor: pointer;
  font-size: 13px;
}
.qo-error {
  font-size: 10px;
  color: #f43f5e;
  margin-bottom: 4px;
}
.qo-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.qo-chip {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-muted);
}
.qo-chip b {
  margin-left: 3px;
  color: var(--text);
}
.qo-chip.pending b {
  color: #f59e0b;
}
.qo-chip.fail b {
  color: #f43f5e;
}
.qo-chip.done b {
  color: #10b981;
}
.qo-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 180px;
  overflow-y: auto;
}
.qo-item {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  padding: 3px 6px;
}
.qo-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 10px;
}
.qo-badge {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--accent-soft);
  color: var(--accent-fg);
}
.qo-words {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.qo-count {
  color: var(--text-faint);
  font-size: 9px;
}
.qo-item-body {
  margin-top: 4px;
  font-size: 9px;
  line-height: 1.5;
  color: var(--text-muted);
  font-family: ui-monospace, monospace;
  word-break: break-word;
}
.qo-allwords {
  margin-top: 2px;
  color: var(--text);
}
.qo-empty {
  font-size: 10px;
  color: var(--text-faint);
  padding: 4px 0;
}
.qo-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-muted);
}
.qo-pager button {
  padding: 2px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.qo-pager button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Settings block moved to the bottom. */
.settings-block {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.settings-title {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-faint);
  margin-bottom: 6px;
}
</style>
