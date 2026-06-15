<template>
  <div class="client-mode-section">
    <div class="client-config-card">
      <div class="config-header">
        <span class="config-label">{{ t('bingAssistTitle') }}</span>
        <div class="config-controls">
          <span :class="['status-indicator', clientService.isRunning ? 'running' : 'stopped']">
            {{ clientService.isRunning ? 'RUNNING' : 'STOPPED' }}
          </span>
          <button class="service-button" @click="onToggleService" :disabled="!clientConfig.apiUrl">
            {{ clientService.isRunning ? '[STOP]' : '[START]' }}
          </button>
        </div>
      </div>

      <div v-if="error" class="assist-error">⚠ {{ error }}</div>

      <div class="config-form">
        <!-- Endpoint comes from Settings → API (single source). Read-only here. -->
        <div class="form-group">
          <label class="form-label">{{ t('bingAssistEndpointLabel') }}</label>
          <div class="url-row">
            <div class="endpoint-readonly" :title="currentEndpoint">
              {{ currentEndpoint || t('bingAssistEndpointFromSettings') }}
            </div>
            <button
              class="test-button"
              @click="onTestConnection"
              :disabled="!currentEndpoint || connectionStatus?.state === 'testing'"
            >
              {{ connectionStatus?.state === 'testing' ? '…' : t('bingAssistTest') }}
            </button>
          </div>
          <div class="endpoint-hint">{{ t('bingAssistEndpointFromSettings') }}</div>
          <div
            v-if="connectionStatus && connectionStatus.state !== 'idle'"
            :class="['conn-status', connectionStatus.state]"
          >
            {{ connectionStatus.state === 'ok' ? '● ' : connectionStatus.state === 'fail' ? '○ ' : '' }}
            {{ connectionStatus.message }}
          </div>
        </div>

        <div class="form-group">
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

        <div class="form-group">
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

        <div v-if="clientConfig.mode === 'worker'" class="form-group">
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

        <div v-if="clientConfig.mode === 'worker'" class="form-group">
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

        <div v-if="clientService.isRunning" class="config-hint">{{ t('bingAssistStopToChange') }}</div>
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
      </div>

      <!-- Live activity -->
      <div v-if="clientService.isRunning && clientService.stats?.currentWord" class="assist-activity">
        <span class="activity-dot"></span>
        <span class="activity-text">{{ t('bingAssistTranslatingLabel') }} <strong>{{ clientService.stats.currentWord }}</strong></span>
      </div>

      <div v-if="clientService.stats" class="service-stats">
        <div class="stats-bento-grid">
          <div class="bento-card bento-primary">
            <div class="bento-label">{{ t('bingAssistQueueTotal') }}</div>
            <div class="bento-value">{{ clientService.stats.queueTotal || 0 }}</div>
          </div>
          <div class="bento-card bento-success">
            <div class="bento-label">{{ t('bingAssistNewTasks') }}</div>
            <div class="bento-value bento-highlight">{{ clientService.stats.newTasks || 0 }}</div>
          </div>
          <div class="bento-card bento-warning">
            <div class="bento-label">{{ t('bingAssistDuplicates') }}</div>
            <div class="bento-value">{{ clientService.stats.duplicateTasks || 0 }}</div>
          </div>
        </div>

        <div class="stats-traditional">
          <div class="stat-item">
            <span class="stat-label">{{ t('bingAssistPending') }}</span>
            <span class="stat-value">{{ clientService.stats.pending }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('bingAssistTranslated') }}</span>
            <span class="stat-value">{{ clientService.stats.translated }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('bingAssistFailed') }}</span>
            <span class="stat-value">{{ clientService.stats.failed }}</span>
          </div>
          <div v-if="clientService.stats.invalid !== undefined" class="stat-item">
            <span class="stat-label">{{ t('bingAssistInvalid') }}</span>
            <span class="stat-value">{{ clientService.stats.invalid }}</span>
          </div>
          <div v-if="clientService.stats.activeTabs !== undefined" class="stat-item">
            <span class="stat-label">{{ t('bingAssistActiveTabs') }}</span>
            <span class="stat-value">{{ clientService.stats.activeTabs }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('bingAssistLastRun') }}</span>
            <span class="stat-value">{{ formatTimestamp(clientService.stats.lastRun) }}</span>
          </div>
          <div v-if="clientService.stats.workerId" class="stat-item">
            <span class="stat-label">{{ t('bingAssistWorkerId') }}</span>
            <span class="stat-value stat-worker-id">{{ clientService.stats.workerId }}</span>
          </div>
          <div v-if="clientService.stats.isOnline !== undefined" class="stat-item">
            <span class="stat-label">{{ t('bingAssistStatusLabel') }}</span>
            <span
              :class="['stat-value', 'stat-online', clientService.stats.isOnline ? 'online' : 'offline']"
            >
              {{ clientService.stats.isOnline ? '● Online' : '○ Offline' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import type { ClientConfig, ClientServiceState } from '../../../composables/useBingDictionaryClient';
import { getMessage as t } from '../../../../../utils/i18n';

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
