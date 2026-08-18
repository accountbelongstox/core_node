<template>
  <div class="qt-panel">
    <p class="qt-meta">
      Space: <a :href="spaceUrl" target="_blank" rel="noopener">{{ spaceUrl }}</a>
      · MCP: <code>chrome_qwen_tts</code>
      · Mode: <strong>{{ mode }}</strong> (Settings Center)
    </p>

    <label class="qt-field">
      <span>{{ getMessage('textToSynthesizeLabel') }}</span>
      <textarea v-model="text" rows="3" :disabled="loading" :placeholder="getMessage('qwenTextPlaceholder')" />
    </label>


    <div class="qt-actions">
      <button class="qt-btn primary" :disabled="loading || !text.trim()" @click="generate">
        {{ loading ? 'Generating…' : 'Generate Qwen TTS' }}
      </button>
      <button
        class="qt-btn"
        :disabled="!result?.audio?.bytes?.length"
        @click="downloadLocal"
      >
        Save Again
      </button>
    </div>

    <div v-if="progress.running" class="qt-status warn">
      <strong>{{ progress.phase }}</strong>
      <span>{{ progress.detail }}</span>
      <span>{{ getMessage('qwenGpuWaitingHint') }}</span>
    </div>

    <div v-if="error" class="qt-status fail">{{ error }}</div>

    <div v-if="result?.ok" class="qt-result">
      <div class="qt-result-head">
        {{ result.status }} · {{ result.mode }} · {{ result.elapsedMs }}ms
      </div>
      <p class="qt-message">{{ result.message }}</p>
      <p v-if="result.downloadFilename" class="qt-download">
        Downloaded: <code>{{ result.downloadFilename }}</code>
        <span v-if="result.downloadId"> (id {{ result.downloadId }})</span>
      </p>
      <audio
        v-if="result.audio?.bytes?.length"
        class="qt-player"
        controls
        :src="audioDataUrl"
      />
    </div>

    <p v-if="mode === 'voice_clone'" class="qt-note">
      Voice Clone needs a reference audio upload in the tab — automation fills target text only.
    </p>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useQwenTts } from '@/entrypoints/popup/composables/useQwenTts';
import { bytesToBase64 } from '@/utils/binary';
import { QWEN_TTS_SPACE_URL } from '@/utils/qwen-tts-core';
import { getMessage } from '@/utils/i18n';

const spaceUrl = QWEN_TTS_SPACE_URL;

const {
  text,
  mode,
  loading,
  error,
  result,
  progress,
  lastVerified,
  generate,
  downloadLocal,
} = useQwenTts();

function bytesToDataUrl(bytes: number[], mime: string): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

const audioDataUrl = computed(() => {
  const audio = result.value?.audio;
  if (!audio?.bytes?.length) return '';
  return bytesToDataUrl(audio.bytes, audio.mime || 'audio/wav');
});
</script>

<style scoped>
.qt-panel { display: flex; flex-direction: column; gap: 8px; font-size: 10px; }
.qt-meta { margin: 0; color: var(--text-faint); }
.qt-meta code { font-size: 9px; }
.qt-row { display: flex; gap: 6px; }
.qt-field { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.qt-field.narrow { max-width: 72px; }
.qt-field span { font-size: 8px; font-weight: 700; text-transform: uppercase; color: var(--text-faint); }
.qt-field input, .qt-field select, .qt-field textarea {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 6px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 10px;
  resize: vertical;
}
.qt-check { display: flex; align-items: center; gap: 6px; font-size: 9px; }
.qt-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.qt-btn {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 10px;
  font-weight: 700;
  background: var(--surface-2);
  color: var(--text);
}
.qt-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.qt-status {
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 9px;
}
.qt-status.warn { background: #fff7ed; color: #9a3412; border: 1px solid #fdba74; }
.qt-status.fail { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.qt-result { border: 1px solid var(--border); border-radius: 8px; padding: 8px; }
.qt-result-head { font-weight: 700; margin-bottom: 4px; }
.qt-message { margin: 0 0 6px; color: var(--text-muted); }
.qt-download { margin: 0 0 6px; font-size: 9px; }
.qt-player { width: 100%; margin-top: 4px; }
.qt-note { margin: 0; font-size: 9px; color: var(--text-faint); }
</style>
