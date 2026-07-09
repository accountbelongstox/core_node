<template>
  <div class="ai-translate-hub flex flex-col gap-2.5">
    <!-- ═══ Puter AI Worker Section ═══ -->
    <div class="ba-header" style="padding: 8px 10px;">
      <div class="ba-brand">
        <span class="ba-logo">🤖</span>
        <div class="ba-brand-text">
          <span class="ba-title">Puter AI Translate</span>
          <span class="ba-subtitle">
            <span :class="['ba-live-dot', workerState.isRunning ? 'on' : 'off']"></span>
            {{ workerState.isRunning ? 'Translating via Puter AI' : 'Idle — not translating' }}
          </span>
        </div>
      </div>
      <button
        class="service-toggle"
        :class="workerState.isRunning ? 'on' : (prepared ? 'ready' : 'off')"
        @click="onToggleWorker"
        :disabled="!currentEndpoint || queueOverview.loading"
      >
        <span class="toggle-dot"></span>
        <template v-if="queueOverview.loading">Loading…</template>
        <template v-else-if="workerState.isRunning">Stop</template>
        <template v-else-if="prepared">
          Confirm &amp; Start{{
            queueOverview.summary ? ' · ' + queueOverview.summary.pending + ' pending' : ''
          }}
        </template>
        <template v-else>Load queue</template>
      </button>
    </div>

    <div v-if="error" class="text-[10px] px-1" style="color: #f87171;">⚠ {{ error }}</div>

    <!-- Backend line -->
    <div class="backend-line">
      <span :class="['be-dot', connectionStatus.state === 'ok' ? 'ok' : connectionStatus.state === 'fail' ? 'fail' : 'idle']"></span>
      <span class="be-label">Backend</span>
      <span class="be-url" :title="currentEndpoint">
        {{ currentEndpoint || 'not set — configure in Settings' }}
      </span>
    </div>

    <!-- Stats row -->
    <div v-if="workerState.stats" class="flex items-center gap-3 text-[9px] px-1" style="color: var(--text-muted)">
      <span>✓ {{ workerState.stats.translated || 0 }}</span>
      <span>✗ {{ workerState.stats.failed || 0 }}</span>
      <span v-if="workerState.stats.pendingFast">⚡ {{ workerState.stats.pendingFast }} fast</span>
      <span v-if="workerState.stats.workerId" class="truncate" :title="workerState.stats.workerId">
        ID: {{ workerState.stats.workerId.slice(0, 8) }}
      </span>
    </div>

    <!-- ═══ Free Dictionary Section ═══ -->
    <div class="dict-section" style="border-top: 1px solid var(--border); padding-top: 8px;">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-sm">🔊</span>
        <span class="text-[11px] font-semibold" style="color: var(--text)">Free Dictionary</span>
        <span class="text-[8px]" style="color: var(--text-faint)">pronunciation + definitions</span>
      </div>

      <!-- Search box -->
      <div class="flex gap-1.5 mb-2">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Type a word…"
          class="flex-1 px-2 py-1 rounded text-[11px] outline-none"
          style="background: var(--surface-2); color: var(--text); border: 1px solid var(--border)"
          @keydown.enter="lookupDictionary"
        />
        <button
          @click="lookupDictionary"
          :disabled="dictionaryLoading || !searchQuery.trim()"
          class="px-2.5 py-1 rounded text-[10px] font-bold transition-colors"
          style="background: var(--accent-soft); color: var(--accent-fg)"
        >
          {{ dictionaryLoading ? '…' : 'Look up' }}
        </button>
      </div>

      <div v-if="dictionaryError" class="text-[10px] mb-1" style="color: #f87171;">{{ dictionaryError }}</div>

      <!-- Dictionary result -->
      <div v-if="dictionaryResult" class="dict-result">
        <!-- Word + phonetic + audio -->
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-[13px] font-bold" style="color: var(--text)">{{ dictionaryResult.word }}</span>
          <span v-if="dictionaryResult.phonetic" class="text-[10px]" style="color: var(--text-muted)">
            {{ dictionaryResult.phonetic }}
          </span>
          <button
            v-if="getBestAudioUrl(dictionaryResult)"
            @click="playAudio(getBestAudioUrl(dictionaryResult))"
            class="text-[10px] px-1.5 py-0.5 rounded transition-colors"
            style="background: var(--accent-soft); color: var(--accent-fg)"
            title="Play pronunciation"
          >
            🔊 Play
          </button>
        </div>

        <!-- Meanings -->
        <div v-for="(meaning, mi) in dictionaryResult.meanings.slice(0, 3)" :key="mi" class="mb-1.5">
          <div class="text-[9px] font-bold uppercase tracking-wide mb-0.5" style="color: var(--accent)">
            {{ meaning.partOfSpeech }}
          </div>
          <div
            v-for="(def, di) in meaning.definitions.slice(0, 2)"
            :key="di"
            class="text-[10px] ml-2"
            style="color: var(--text)"
          >
            <span>{{ di + 1 }}. {{ def.definition }}</span>
            <div v-if="def.example" class="text-[9px] italic ml-2" style="color: var(--text-muted)">
              "{{ def.example }}"
            </div>
          </div>
        </div>

        <!-- Additional phonetics with audio -->
        <div v-if="dictionaryResult.phonetics.length > 1" class="flex flex-wrap gap-1 mt-1">
          <template v-for="(p, pi) in dictionaryResult.phonetics" :key="pi">
            <button
              v-if="p.audio"
              @click="playAudio(p.audio!)"
              class="text-[9px] px-1.5 py-0.5 rounded"
              style="background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border)"
            >
              {{ p.text || '🔊' }} {{ p.audio.includes('-us') ? 'US' : p.audio.includes('-uk') ? 'UK' : '' }}
            </button>
          </template>
        </div>

        <!-- External pronunciation sources -->
        <div class="flex flex-wrap gap-1.5 mt-2 pt-1.5" style="border-top: 1px solid var(--border)">
          <a
            :href="'https://youglish.com/pronounce/' + encodeURIComponent(dictionaryResult.word) + '/english'"
            target="_blank"
            rel="noopener"
            class="text-[9px] px-2 py-0.5 rounded no-underline"
            style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5"
            title="Real-context video pronunciation (YouGlish)"
          >▶ YouGlish</a>
          <a
            :href="'https://forvo.com/word/' + encodeURIComponent(dictionaryResult.word) + '/'"
            target="_blank"
            rel="noopener"
            class="text-[9px] px-2 py-0.5 rounded no-underline"
            style="background: #e0f2fe; color: #0284c7; border: 1px solid #7dd3fc"
            title="Native-speaker audio from around the world (Forvo)"
          >🌍 Forvo</a>
          <a
            :href="'https://dictionary.cambridge.org/dictionary/english-chinese-traditional/' + encodeURIComponent(dictionaryResult.word)"
            target="_blank"
            rel="noopener"
            class="text-[9px] px-2 py-0.5 rounded no-underline"
            style="background: #ecfdf5; color: #059669; border: 1px solid #6ee7b7"
            title="Standard UK/US pronunciation (Cambridge)"
          >📖 Cambridge</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useAiTranslateHub } from '../../composables/useAiTranslateHub';

const {
  workerState,
  currentEndpoint,
  connectionStatus,
  error,
  toggleWorker,
  searchQuery,
  dictionaryResult,
  dictionaryLoading,
  dictionaryError,
  lookupDictionary,
  playAudio,
  getBestAudioUrl,
  queueOverview,
  prepared,
  loadQueueOverview,
  initPanel,
} = useAiTranslateHub();

const onToggleWorker = async () => {
  error.value = '';
  if (!prepared.value) {
    await loadQueueOverview();
    return;
  }
  await toggleWorker();
};

onMounted(async () => {
  await initPanel();
});
</script>
