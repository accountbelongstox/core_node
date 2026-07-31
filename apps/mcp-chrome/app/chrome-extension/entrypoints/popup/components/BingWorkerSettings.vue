<template>
  <section class="settings-card">
    <div class="settings-card__header">
      <div>
        <h4>{{ getMessage('bingWorkerTitle') }}</h4>
        <p>{{ getMessage('bingWorkerSharedHint') }}</p>
      </div>
      <span class="endpoint" :title="apiBaseUrl">{{ apiBaseUrl || getMessage('apiNone') }}</span>
    </div>

    <div class="settings-grid">
      <label>
        <span>{{ getMessage('bingAssistPollInterval') }}</span>
        <input v-model.number="config.fetchInterval" type="number" min="1" max="3600" @change="save" />
      </label>
      <label>
        <span>{{ getMessage('bingAssistBatchSize') }}</span>
        <input v-model.number="config.batchSize" type="number" min="1" max="50" @change="save" />
      </label>
      <label>
        <span>{{ getMessage('bingAssistParallelTabs') }}</span>
        <input v-model.number="config.tabCount" type="number" min="1" max="8" @change="save" />
      </label>
      <label>
        <span>{{ getMessage('sourceLanguageLabel') }}</span>
        <input v-model.trim="config.sourceLanguage" type="text" placeholder="en" @change="save" />
      </label>
      <label>
        <span>{{ getMessage('bingAssistTargetLang') }}</span>
        <input v-model.trim="config.targetLanguage" type="text" placeholder="zh" @change="save" />
      </label>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { BING_DICT_MSG } from '@/common/message-types';
import { localStorage } from '@/services/ExtensionStorage';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import type { ClientConfig } from '../composables/useBingDictionaryClient';
import { getMessage } from '@/utils/i18n';

const { apiBaseUrl } = useApiEndpoint();
const config = ref<ClientConfig>({
  apiUrl: '',
  fetchInterval: 5,
  batchSize: 10,
  mode: 'worker',
  tabCount: 3,
  sourceLanguage: 'en',
  targetLanguage: 'zh',
});
let unsubscribe: (() => void) | null = null;
let initialized = false;

const normalize = (value: Partial<ClientConfig>): ClientConfig => ({
  apiUrl: apiBaseUrl.value.replace(/\/+$/, ''),
  fetchInterval: Math.max(1, Math.min(3600, Math.round(Number(value.fetchInterval) || 5))),
  batchSize: Math.max(1, Math.min(50, Math.round(Number(value.batchSize) || 10))),
  mode: 'worker',
  tabCount: Math.max(1, Math.min(8, Math.round(Number(value.tabCount) || 3))),
  sourceLanguage: String(value.sourceLanguage || 'en').trim().toLowerCase(),
  targetLanguage: String(value.targetLanguage || 'zh').trim().toLowerCase(),
});

const applyStored = (value?: Partial<ClientConfig>) => {
  config.value = normalize({ ...config.value, ...(value || {}) });
};

const save = async () => {
  config.value = normalize(config.value);
  await localStorage.set(STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG, config.value);
  try {
    await chrome.runtime.sendMessage({
      type: BING_DICT_MSG,
      action: 'update_config',
      config: config.value,
    });
  } catch {
    // The worker may be stopped; persisted settings remain authoritative.
  }
};

watch(apiBaseUrl, (url) => {
  if (!initialized) return;
  const normalized = url.replace(/\/+$/, '');
  if (config.value.apiUrl === normalized) return;
  config.value.apiUrl = normalized;
  void save();
});

onMounted(async () => {
  applyStored(
    await localStorage.getOptional<ClientConfig>(STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG),
  );
  initialized = true;
  if (config.value.apiUrl !== apiBaseUrl.value.replace(/\/+$/, '')) {
    config.value.apiUrl = apiBaseUrl.value.replace(/\/+$/, '');
    await save();
  }
  unsubscribe = localStorage.subscribe<ClientConfig>(
    STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG,
    applyStored,
  );
});

onUnmounted(() => unsubscribe?.());
</script>

<style scoped>
.settings-card {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.settings-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
h4 {
  margin: 0;
  color: var(--text);
  font-size: 11px;
}
p,
.endpoint {
  margin: 2px 0 0;
  color: var(--text-faint);
  font-size: 9px;
}
.endpoint {
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}
label span {
  display: block;
  margin-bottom: 3px;
  color: var(--text-muted);
  font-size: 9px;
}
input {
  width: 100%;
  padding: 5px 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 10px;
}
</style>
