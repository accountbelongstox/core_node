<template>
  <div class="dr-panel">
    <div class="dr-endpoint">
      <span class="dr-label">API Endpoint</span>
      <code class="dr-url">{{ apiBaseUrl || '(resolving…)' }}</code>
    </div>

    <div class="dr-row">
      <label class="dr-field">
        <span>My language</span>
        <select v-model="myLang" :disabled="progress.running">
          <option value="zh">zh</option>
          <option value="en">en</option>
        </select>
      </label>
      <label class="dr-field">
        <span>Learn language</span>
        <select v-model="learnLang" :disabled="progress.running">
          <option value="en">en</option>
          <option value="zh">zh</option>
        </select>
      </label>
      <label class="dr-field">
        <span>Max books (0=all)</span>
        <input v-model.number="maxBooks" type="number" min="0" :disabled="progress.running" />
      </label>
    </div>

    <label class="dr-check">
      <input v-model="enableTts" type="checkbox" :disabled="progress.running" />
      <span>Request Laravel TTS after each chapter (server generates mp3)</span>
    </label>

    <label class="dr-check">
      <input v-model="useCdnApi" type="checkbox" :disabled="progress.running" />
      <span>Use CDN API (fast) — tab inject + .pz decode, skip DOM scrape</span>
    </label>

    <div class="dr-actions">
      <button class="dr-btn primary" :disabled="progress.running" @click="startImport">Start Import</button>
      <button class="dr-btn danger" :disabled="!progress.running" @click="stopImport">Stop</button>
      <button class="dr-btn" :disabled="loadingBooks || progress.running" @click="loadBooks">Refresh Catalog</button>
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

    <div v-if="progress.running || progress.phase" class="dr-activity">
      <span class="dr-dot" :class="{ busy: progress.running }" />
      <span>{{ progress.phase || 'Idle' }}</span>
    </div>

    <div v-if="error || progress.error" class="dr-error">⚠ {{ error || progress.error }}</div>

    <div class="dr-progress-block">
      <div class="dr-progress-head">
        <span>Scrape progress</span>
        <span>{{ progress.chaptersDone }}/{{ progress.chaptersTotal || '—' }} ch</span>
      </div>
      <div class="dr-bar"><div class="dr-fill scrape" :style="{ width: progress.scrapePct + '%' }" /></div>
    </div>

    <div class="dr-progress-block">
      <div class="dr-progress-head">
        <span>Upload progress</span>
        <span>
          {{ progress.slotsIngested }} slots · {{ progress.booksDone }}/{{ progress.booksTotal || '—' }} books
          <template v-if="progress.chaptersSkipped"> · {{ progress.chaptersSkipped }} skipped</template>
        </span>
      </div>
      <div class="dr-bar"><div class="dr-fill upload" :style="{ width: progress.uploadPct + '%' }" /></div>
    </div>

    <div v-if="progress.bookTitle" class="dr-current">
      Current: <strong>{{ progress.bookTitle }}</strong>
      <span v-if="progress.bookId" class="dr-id">({{ progress.bookId }})</span>
    </div>

    <div class="dr-list">
      <div v-if="loadingBooks" class="dr-empty">Loading catalog…</div>
      <div v-else-if="!books.length" class="dr-empty">No bilingual books found.</div>
      <div v-for="book in books" :key="book.id" class="dr-book">
        <div class="dr-book-title">{{ book.titleZh || book.titleEn }}</div>
        <div class="dr-book-meta">{{ book.titleEn }} · {{ book.authorEn }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useDuoreaderImporter } from '@/entrypoints/popup/composables/useDuoreaderImporter';

const {
  myLang,
  learnLang,
  maxBooks,
  enableTts,
  useCdnApi,
  apiBaseUrl,
  books,
  progress,
  loadingBooks,
  testingApi,
  apiTestResult,
  error,
  loadBooks,
  testApi,
  startImport,
  stopImport,
} = useDuoreaderImporter();
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
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
}
.dr-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}
.dr-dot.busy {
  background: #22c55e;
  animation: pulse 1.2s infinite;
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
.dr-book:last-child { border-bottom: none; }
.dr-book-title { font-weight: 700; font-size: 10px; }
.dr-book-meta { font-size: 8px; color: var(--text-faint); }
</style>
