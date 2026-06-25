<template>
  <div class="client-mode-section">
    <div class="client-config-card">
      <!-- Header: brand + the two-step primary action. -->
      <div class="ba-header">
        <div class="ba-brand">
          <span class="ba-logo">📖</span>
          <div class="ba-brand-text">
            <span class="ba-title">{{ t('bingAssistTitle') }}</span>
            <span class="ba-subtitle">
              <span :class="['ba-live-dot', clientService.isRunning ? 'on' : 'off']"></span>
              {{ clientService.isRunning ? 'Crawling translations' : 'Idle — not crawling' }}
            </span>
          </div>
        </div>
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

      <!-- Two-step flow stepper: makes it explicit that "Load queue" only PULLS
           and displays the pending data, and crawling starts only on the second
           "Confirm & Start" click. Hidden once crawling is underway. -->
      <div v-if="!clientService.isRunning" class="ba-steps">
        <div class="ba-step" :class="{ active: stepIndex === 0, done: stepIndex >= 1 }">
          <span class="ba-step-dot">1</span>
          <div class="ba-step-meta">
            <span class="ba-step-name">Load queue</span>
            <span class="ba-step-desc">Pull pending words from the server &amp; preview</span>
          </div>
        </div>
        <span class="ba-step-line" :class="{ done: stepIndex >= 1 }"></span>
        <div class="ba-step" :class="{ active: stepIndex === 1 }">
          <span class="ba-step-dot">2</span>
          <div class="ba-step-meta">
            <span class="ba-step-name">Confirm &amp; Start</span>
            <span class="ba-step-desc">Open Bing tabs &amp; begin crawling</span>
          </div>
        </div>
      </div>

      <!-- Empty-queue guard. -->
      <div
        v-if="prepared && queueOverview && queueOverview.summary && queueOverview.summary.pending === 0"
        class="ba-note warn"
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

      <!-- Live activity: one row per parallel Bing tab, showing the word each is
           translating right now (falls back to the single overall word). -->
      <div
        v-if="clientService.isRunning && clientService.stats?.tabActivity && clientService.stats.tabActivity.length"
        class="tab-activity"
      >
        <div
          v-for="(slot, i) in clientService.stats.tabActivity"
          :key="slot.tabId ?? i"
          class="ta-row"
          :class="{ idle: !slot.word }"
        >
          <span class="ta-dot"></span>
          <span class="ta-tab">Tab {{ i + 1 }}</span>
          <span class="ta-word">
            <template v-if="slot.word">{{ t('bingAssistTranslatingLabel') }} <strong>{{ slot.word }}</strong></template>
            <template v-else>idle</template>
          </span>
        </div>
      </div>
      <div
        v-else-if="clientService.isRunning && clientService.stats?.currentWord"
        class="assist-activity"
      >
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

      <!-- Settings (collapsible). Editable live — changes apply while running. -->
      <div class="settings-block">
        <button class="settings-toggle" @click="showSettings = !showSettings">
          <span class="settings-title">Settings</span>
          <span class="settings-caret" :class="{ open: showSettings }">▸</span>
        </button>
        <div v-show="showSettings">
        <div class="config-grid">
          <div class="config-field">
            <label class="form-label">{{ t('bingAssistPollInterval') }}</label>
            <input :value="clientConfig.fetchInterval" @input="onConfigChange('fetchInterval', $event)" type="number" min="1" max="60" class="form-input-small" />
          </div>
          <div class="config-field">
            <label class="form-label">{{ t('bingAssistBatchSize') }}</label>
            <input :value="clientConfig.batchSize" @input="onConfigChange('batchSize', $event)" type="number" min="1" max="50" class="form-input-small" />
          </div>
          <div v-if="clientConfig.mode === 'worker'" class="config-field">
            <label class="form-label">{{ t('bingAssistParallelTabs') }}</label>
            <input :value="clientConfig.tabCount" @input="onConfigChange('tabCount', $event)" type="number" min="1" max="8" class="form-input-small" />
          </div>
          <div v-if="clientConfig.mode === 'worker'" class="config-field">
            <label class="form-label">Source Language</label>
            <input :value="clientConfig.sourceLanguage" @input="onConfigChange('sourceLanguage', $event)" type="text" placeholder="en" class="form-input-small" />
          </div>
          <div v-if="clientConfig.mode === 'worker'" class="config-field">
            <label class="form-label">{{ t('bingAssistTargetLang') }}</label>
            <input :value="clientConfig.targetLanguage" @input="onConfigChange('targetLanguage', $event)" type="text" placeholder="zh" class="form-input-small" />
          </div>
        </div>
        <div v-if="clientService.isRunning" class="config-hint">{{ t('bingAssistSettingsLive') }}</div>
        </div>
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
  prepared?: boolean;
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
  prepared: false,
});
const emit = defineEmits<Emits>();

const onToggleService = () => emit('toggle-service');
const onRunScrape = () => emit('run-scrape-test');
const onRefreshQueue = () => emit('refresh-queue');
const onSetQueuePage = (page: number) => emit('set-queue-page', page);

// Two-step flow position for the stepper UI:
//   0 = idle (next click = Load queue)
//   1 = prepared (queue shown; next click = Confirm & Start)
//   2 = running (crawling)
const stepIndex = computed(() => {
  if (props.clientService.isRunning) return 2;
  return props.prepared ? 1 : 0;
});

// Advanced settings are collapsed by default to keep the panel compact.
const showSettings = ref(false);

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

const STRING_FIELDS = ['apiUrl', 'sourceLanguage', 'targetLanguage'];

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

<style scoped src="./client-mode-styles.css"></style>
