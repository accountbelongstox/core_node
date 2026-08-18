<template>
  <div class="dr-panel">
    <div class="dr-endpoint">
      <span class="dr-label">{{ getMessage('apiConfigurationLabel') }}</span>
      <code class="dr-url">{{ apiBaseUrl || '(resolving…)' }}</code>
    </div>

    <div class="dr-row">
      <label class="dr-field">
        <span>{{ getMessage('myLanguageLabel') }}</span>
        <select v-model="myLang" :disabled="progress.running">
          <option value="zh">zh</option>
          <option value="en">en</option>
        </select>
      </label>
      <label class="dr-field">
        <span>{{ getMessage('learnLanguageLabel') }}</span>
        <select v-model="learnLang" :disabled="progress.running">
          <option value="en">en</option>
          <option value="zh">zh</option>
        </select>
      </label>
      <label class="dr-field">
        <span>{{ getMessage('maximumBooksLabel') }}</span>
        <input v-model.number="maxBooks" type="number" min="0" :disabled="progress.running" />
      </label>
    </div>

    <label class="dr-check">
      <input v-model="enableAudio" type="checkbox" :disabled="progress.running" />
      <span>{{ getMessage('duoreaderFetchAudioHint') }}</span>
    </label>

    <label class="dr-check">
      <input v-model="useCdnApi" type="checkbox" :disabled="progress.running" />
      <span>{{ getMessage('duoreaderCdnHint') }}</span>
    </label>

    <label class="dr-check">
      <input v-model="enrichCoversFromSearch" type="checkbox" :disabled="loadingBooks || progress.running" />
      <span>{{ getMessage('duoreaderCoverSearchHint') }}</span>
    </label>

    <label class="dr-check">
      <input v-model="forceReplaceUpload" type="checkbox" :disabled="progress.running" />
      <span>{{ getMessage('duoreaderForceReplaceHint') }}</span>
    </label>

    <div class="dr-actions">
      <button
        class="dr-btn primary"
        :disabled="progress.running && !progress.paused"
        @click="startOrResumeImport"
      >
        {{ startButtonLabel }}
      </button>
      <button
        class="dr-btn warn"
        :disabled="!progress.running || progress.paused"
        @click="pauseImport"
      >
        Pause
      </button>
      <button
        class="dr-btn danger"
        :disabled="!progress.running && !progress.paused"
        @click="stopImport"
      >
        Stop
      </button>
      <button class="dr-btn" :disabled="loadingBooks || progress.running" @click="loadBooks({ enrichCovers: true })">{{ getMessage('refreshCatalogButton') }}</button>
      <button class="dr-btn accent" :disabled="testingApi || progress.running" @click="testApi">
        {{ testingApi ? 'Testing API…' : 'Test API' }}
      </button>
    </div>

    <div v-if="apiTestResult" class="dr-api-result" :class="{ ok: apiTestResult.ok, fail: !apiTestResult.ok }">
      <div class="dr-api-head">
        {{ apiTestResult.ok ? '✓ CDN API ready' : '✗ CDN API failed' }}
        <span class="dr-api-ms">{{ apiTestResult.elapsedMs }}ms</span>
      </div>
      <div v-if="apiTestResult.ok">
        {{ apiTestResult.bookId }} · {{ apiTestResult.articleCount }} chapters · sample {{ apiTestResult.sampleParagraphs }} paragraphs
      </div>
      <div v-if="apiTestResult.sampleEnPreview" class="dr-api-preview">{{ apiTestResult.sampleEnPreview }}</div>
      <div v-if="apiTestResult.error" class="dr-api-err">{{ apiTestResult.error }}</div>
    </div>

    <div v-if="progress.running || progress.paused || progress.phase" class="dr-activity">
      <span class="dr-dot" :class="{ busy: progress.running, paused: progress.paused }" />
      <div class="dr-activity-text">
        <div class="dr-activity-main">
          <span v-if="progress.step" class="dr-step">{{ stepLabel }}</span>
          {{ progress.phase || 'Idle' }}
        </div>
        <div v-if="progress.detail" class="dr-activity-detail">{{ progress.detail }}</div>
      </div>
    </div>

    <div v-if="error || progress.error" class="dr-error">⚠ {{ error || progress.error }}</div>

    <div class="dr-progress-block">
      <div class="dr-progress-head">
        <span>{{ getMessage('scrapeFetchLabel') }}</span>
        <span>{{ progress.chaptersScraped || 0 }}/{{ progress.chaptersTotal || '—' }} ch</span>
      </div>
      <div class="dr-bar"><div class="dr-fill scrape" :style="{ width: progress.scrapePct + '%' }" /></div>
    </div>

    <div class="dr-progress-block">
      <div class="dr-progress-head">
        <span>{{ getMessage('textUploadLabel') }}</span>
        <span>
          ch {{ progress.chaptersDone || 0 }}/{{ progress.chaptersTotal || '—' }}
          · {{ progress.slotsIngested }} slots
          <template v-if="progress.chapterCurrent"> · current ch {{ progress.chapterCurrent }}
            <template v-if="progress.chapterSlotsExpected"> ({{ progress.chapterSlotsUploaded || 0 }}/{{ progress.chapterSlotsExpected }} slots)</template>
          </template>
          <template v-if="progress.chaptersSkipped"> · {{ progress.chaptersSkipped }} skipped</template>
        </span>
      </div>
      <div class="dr-bar"><div class="dr-fill upload" :style="{ width: progress.uploadPct + '%' }" /></div>
    </div>

    <div v-if="enableAudio" class="dr-progress-block">
      <div class="dr-progress-head">
        <span>Audio fetch{{ progress.audioPending ? ' (background)' : '' }}</span>
        <span>
          <template v-if="progress.audioLang">{{ progress.audioLang }} slot {{ progress.audioSlot }}/{{ progress.audioSlotsTotal || '—' }} · </template>
          {{ progress.audioFetchedLearn || 0 }}+{{ progress.audioFetchedMy || 0 }} mp3
        </span>
      </div>
      <div class="dr-bar"><div class="dr-fill audio" :style="{ width: progress.audioPct + '%' }" /></div>
    </div>

    <div class="dr-progress-block dr-books-row">
      <div class="dr-progress-head">
        <span>{{ getMessage('booksLabel') }}</span>
        <span>{{ progress.booksDone }}/{{ progress.booksTotal || books.length || '—' }}</span>
      </div>
    </div>

    <div v-if="progress.bookTitle" class="dr-current">
      Current: <strong>{{ progress.bookTitle }}</strong>
      <span v-if="progress.bookId" class="dr-id">({{ progress.bookId }})</span>
    </div>

    <div class="dr-list">
      <div v-if="loadingBooks" class="dr-empty">{{ getMessage('loadingCatalog') }}</div>
      <div v-else-if="!books.length" class="dr-empty">{{ getMessage('noBilingualBooks') }}</div>
      <div v-for="book in books" :key="book.id" class="dr-book">
        <div class="dr-book-row">
          <DuoreaderCoverRotator
            :urls="book.coverUrls"
            :cover-url="book.coverUrl"
            :title="book.titleZh || book.titleEn"
          />
          <div>
            <div class="dr-book-title">{{ book.titleZh || book.titleEn }}</div>
            <div class="dr-book-meta">{{ book.titleEn }} · {{ book.authorEn }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useDuoreaderImporter } from '@/entrypoints/popup/composables/useDuoreaderImporter';
import DuoreaderCoverRotator from './DuoreaderCoverRotator.vue';
import type { DuoreaderImportStep } from '@/utils/duoreader-importer-core';
import { getMessage } from '@/utils/i18n';

const STEP_LABELS: Record<DuoreaderImportStep, string> = {
  idle: '',
  catalog: 'Catalog',
  scrape: 'Scrape',
  upload: 'Upload',
  audio: 'Audio',
  skip: 'Skip',
  done: 'Done',
};

const {
  myLang,
  learnLang,
  maxBooks,
  enableAudio,
  useCdnApi,
  enrichCoversFromSearch,
  forceReplaceUpload,
  apiBaseUrl,
  books,
  progress,
  loadingBooks,
  testingApi,
  apiTestResult,
  error,
  loadBooks,
  testApi,
  startOrResumeImport,
  pauseImport,
  stopImport,
} = useDuoreaderImporter();

const startButtonLabel = computed(() => {
  if (progress.value.paused) return 'Resume Import';
  if (progress.value.phase === 'Stopped' && progress.value.bookId) return 'Resume Import';
  return 'Start Import';
});

const stepLabel = computed(() => {
  const step = progress.value.step || 'idle';
  const label = STEP_LABELS[step as DuoreaderImportStep];
  return label ? `[${label}]` : '';
});
</script>

<style scoped>
.dr-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 10px;
  color: var(--text, #e2e8f0);
}
.dr-endpoint {
  padding: 8px;
  border-radius: 8px;
  background: var(--surface, rgba(30, 41, 59, 0.5));
  border: 1px solid var(--border, #334155);
}
.dr-label { display: block; font-size: 8px; text-transform: uppercase; color: var(--text-faint); margin-bottom: 2px; }
.dr-url { font-family: monospace; font-size: 9px; color: #93c5fd; word-break: break-all; }
.dr-row { display: flex; gap: 8px; flex-wrap: wrap; }
.dr-field { display: flex; flex-direction: column; gap: 2px; font-size: 8px; }
.dr-field select, .dr-field input {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #e2e8f0;
  padding: 2px 4px;
  font-size: 10px;
  width: 88px;
}
.dr-check { display: flex; align-items: center; gap: 6px; font-size: 9px; }
.dr-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.dr-btn {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 700;
  border: 1px solid #475569;
  background: #1e293b;
  color: #e2e8f0;
  cursor: pointer;
}
.dr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.dr-btn.primary { background: #4f46e5; border-color: #6366f1; }
.dr-btn.accent { background: #0d9488; border-color: #14b8a6; }
.dr-btn.danger { background: #be123c; border-color: #f43f5e; }
.dr-api-result {
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 9px;
  line-height: 1.35;
}
.dr-api-result.ok {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.35);
  color: #a7f3d0;
}
.dr-api-result.fail {
  background: rgba(190, 18, 60, 0.12);
  border: 1px solid rgba(244, 63, 94, 0.35);
  color: #fda4af;
}
.dr-api-head { font-weight: 700; display: flex; justify-content: space-between; }
.dr-api-ms { color: #64748b; font-weight: 400; }
.dr-api-preview { margin-top: 4px; color: #cbd5e1; font-style: italic; }
.dr-api-err { margin-top: 4px; color: #fecdd3; }
.dr-activity {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
}
.dr-activity-text { flex: 1; min-width: 0; }
.dr-activity-main { font-size: 9px; line-height: 1.35; }
.dr-activity-detail { font-size: 8px; color: #94a3b8; margin-top: 2px; line-height: 1.3; word-break: break-word; }
.dr-step {
  display: inline-block;
  margin-right: 4px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(99, 102, 241, 0.25);
  color: #c7d2fe;
  font-weight: 700;
  font-size: 8px;
}
.dr-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}
.dr-btn.warn {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.45);
  color: #fcd34d;
}
.dr-dot.busy {
  background: #22c55e;
  animation: pulse 1.2s infinite;
}
.dr-dot.paused {
  background: #f59e0b;
  animation: pulse 1.6s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.dr-error {
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(190, 18, 60, 0.15);
  border: 1px solid rgba(244, 63, 94, 0.4);
  color: #fda4af;
}
.dr-progress-block { display: flex; flex-direction: column; gap: 3px; }
.dr-progress-head {
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: var(--text-faint);
}
.dr-bar {
  height: 6px;
  border-radius: 999px;
  background: #1e293b;
  overflow: hidden;
}
.dr-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}
.dr-fill.scrape { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.dr-fill.upload { background: linear-gradient(90deg, #10b981, #34d399); }
.dr-fill.audio { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.dr-books-row { margin-bottom: 2px; }
.dr-current { font-size: 9px; color: #cbd5e1; }
.dr-id { color: #64748b; margin-left: 4px; }
.dr-list {
  flex: 1;
  min-height: 120px;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--border, #334155);
  border-radius: 8px;
  padding: 6px;
}
.dr-empty { color: var(--text-faint); padding: 8px; text-align: center; }
.dr-book {
  padding: 4px 0;
  border-bottom: 1px solid rgba(51, 65, 85, 0.5);
}
.dr-book-row { display: flex; gap: 6px; align-items: flex-start; }
.dr-book:last-child { border-bottom: none; }
.dr-book-title { font-weight: 700; font-size: 10px; }
.dr-book-meta { font-size: 8px; color: var(--text-faint); }
</style>
