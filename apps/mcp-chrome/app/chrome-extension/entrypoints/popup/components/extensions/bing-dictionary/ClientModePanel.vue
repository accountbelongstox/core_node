<template>
  <div class="client-mode-section">
    <div class="client-config-card">
      <div class="config-header">
        <span class="config-label">{{ t('bingAssistTitle') }}</span>
        <div class="config-controls">
          <button
            class="ghost-test"
            @click="onTestConnection"
            :disabled="connectionStatus?.state === 'testing'"
            :title="t('bingAssistTest')"
          >
            {{ connectionStatus?.state === 'testing' ? '…' : t('bingAssistTest') }}
          </button>
          <span :class="['status-indicator', clientService.isRunning ? 'running' : 'stopped']">
            {{ clientService.isRunning ? 'RUNNING' : 'STOPPED' }}
          </span>
          <button class="service-button" @click="onToggleService" :disabled="!currentEndpoint">
            {{ clientService.isRunning ? '[STOP]' : '[START]' }}
          </button>
        </div>
      </div>

      <div v-if="error" class="assist-error">⚠ {{ error }}</div>
      <div
        v-if="connectionStatus && connectionStatus.state === 'ok'"
        class="conn-status ok"
      >
        ● {{ connectionStatus.message }}
      </div>
      <div
        v-if="connectionStatus && connectionStatus.state === 'fail'"
        class="conn-status fail"
      >
        ○ {{ connectionStatus.message }}
      </div>

      <!-- Config as a compact 2-column grid (not a vertical list). -->
      <div class="config-grid">
        <div class="config-field">
          <label class="form-label">{{ t('bingAssistPollInterval') }}</label>
          <input
            :value="clientConfig.fetchInterval"
            @input="onConfigChange('fetchInterval', $event)"
            type="number"
            min="1"
            max="60"
            class="form-input-small"
            :disabled="clientService.isRunning"
          />
        </div>
        <div class="config-field">
          <label class="form-label">{{ t('bingAssistBatchSize') }}</label>
          <input
            :value="clientConfig.batchSize"
            @input="onConfigChange('batchSize', $event)"
            type="number"
            min="1"
            max="50"
            class="form-input-small"
            :disabled="clientService.isRunning"
          />
        </div>
        <div v-if="clientConfig.mode === 'worker'" class="config-field">
          <label class="form-label">{{ t('bingAssistParallelTabs') }}</label>
          <input
            :value="clientConfig.tabCount"
            @input="onConfigChange('tabCount', $event)"
            type="number"
            min="1"
            max="8"
            class="form-input-small"
            :disabled="clientService.isRunning"
          />
        </div>
        <div v-if="clientConfig.mode === 'worker'" class="config-field">
          <label class="form-label">{{ t('bingAssistTargetLang') }}</label>
          <input
            :value="clientConfig.targetLanguage"
            @input="onConfigChange('targetLanguage', $event)"
            type="text"
            placeholder="zh"
            class="form-input-small"
            :disabled="clientService.isRunning"
          />
        </div>
      </div>
      <div v-if="clientService.isRunning" class="config-hint">{{ t('bingAssistStopToChange') }}</div>

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
              <button
                v-if="r.ok && r.audioUrl"
                class="audio-btn"
                :class="{ playing: playingUrl === r.audioUrl }"
                @click="playAudio(r.audioUrl)"
                :title="t('bingAssistPlayAudio')"
              >▶</button>
              <em v-if="r.ok && r.phonetic" class="scrape-phonetic">[{{ r.phonetic }}]</em>
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
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
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
}

interface Emits {
  (e: 'toggle-service'): void;
  (e: 'update-config', field: string, value: any): void;
  (e: 'test-connection'): void;
  (e: 'run-scrape-test'): void;
  (e: 'update-test-words', value: string): void;
}

withDefaults(defineProps<Props>(), {
  currentEndpoint: '',
  testResults: () => [],
  testWords: 'hello',
  testing: false,
});
const emit = defineEmits<Emits>();

const onToggleService = () => emit('toggle-service');
const onTestConnection = () => emit('test-connection');
const onRunScrape = () => emit('run-scrape-test');

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
</style>
