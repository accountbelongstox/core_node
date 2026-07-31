<template>
  <div class="ws-panel">
    <p class="ws-meta">{{ getMessage('lastVerifiedLabel') }}: {{ lastVerified }} · {{ getMessage('mcpToolLabel') }}: <code>chrome_web_search</code></p>

    <label class="ws-field">
      <span>{{ getMessage('queryLabel') }}</span>
      <input v-model="query" type="text" :disabled="loading" :placeholder="getMessage('webSearchPlaceholder')" />
    </label>

    <div class="ws-row">
      <label class="ws-field">
        <span>{{ getMessage('searchEngineLabel') }}</span>
        <select v-model="engine" :disabled="loading">
          <option value="google">Google</option>
          <option value="bing">Bing</option>
        </select>
      </label>
      <label class="ws-field">
        <span>{{ getMessage('modeLabel') }}</span>
        <select v-model="mode" :disabled="loading">
          <option value="web">{{ getMessage('webMode') }}</option>
          <option value="images">{{ getMessage('imagesMode') }}</option>
          <option value="news">{{ getMessage('newsMode') }}</option>
        </select>
      </label>
      <label class="ws-field narrow">
        <span>{{ getMessage('maximumLabel') }}</span>
        <input v-model.number="maxResults" type="number" min="1" max="30" :disabled="loading" />
      </label>
    </div>

    <label class="ws-check">
      <input v-model="waitForVerification" type="checkbox" :disabled="loading" />
      <span>{{ getMessage('waitForCaptchaHint') }}</span>
    </label>

    <div class="ws-actions">
      <button class="ws-btn primary" :disabled="loading || !query.trim()" @click="runSearch">
        {{ loading ? 'Searching…' : 'Search' }}
      </button>
    </div>

    <div v-if="progress.running || progress.status === 'verification_required'" class="ws-status warn">
      <strong>{{ progress.phase }}</strong>
      <span>{{ progress.detail }}</span>
      <span v-if="progress.status === 'verification_required'">{{ getMessage('solveSearchVerification') }}</span>
    </div>

    <div v-if="error" class="ws-status fail">{{ error }}</div>

    <div v-if="result" class="ws-result">
      <div class="ws-result-head">
        {{ result.status }} · {{ result.engine }}/{{ result.mode }} · {{ result.elapsedMs }}ms
      </div>
      <p class="ws-message">{{ result.message }}</p>

      <div v-if="result.imageResults.length" class="ws-images">
        <a
          v-for="(img, idx) in result.imageResults"
          :key="idx"
          class="ws-image-card"
          :href="img.imageUrl"
          target="_blank"
          rel="noopener"
        >
          <img :src="img.thumbnailUrl || img.imageUrl" :alt="img.title || getMessage('imageAlt')" loading="lazy" />
          <span>{{ img.title || img.imageUrl }}</span>
        </a>
      </div>

      <ul v-if="result.textResults.length" class="ws-text-list">
        <li v-for="(hit, idx) in result.textResults" :key="idx">
          <a :href="hit.url" target="_blank" rel="noopener">{{ hit.title }}</a>
          <p>{{ hit.snippet }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useWebSearch } from '@/entrypoints/popup/composables/useWebSearch';
import { getMessage } from '@/utils/i18n';

const {
  query,
  engine,
  mode,
  waitForVerification,
  maxResults,
  loading,
  error,
  result,
  progress,
  lastVerified,
  runSearch,
} = useWebSearch();
</script>

<style scoped>
.ws-panel { display: flex; flex-direction: column; gap: 8px; font-size: 10px; }
.ws-meta { margin: 0; color: var(--text-faint); }
.ws-meta code { font-size: 9px; }
.ws-row { display: flex; gap: 6px; }
.ws-field { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.ws-field.narrow { max-width: 56px; }
.ws-field span { font-size: 8px; font-weight: 700; text-transform: uppercase; color: var(--text-faint); }
.ws-field input, .ws-field select {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 6px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 10px;
}
.ws-check { display: flex; align-items: center; gap: 6px; font-size: 9px; }
.ws-actions { display: flex; gap: 6px; }
.ws-btn {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 10px;
  font-weight: 700;
  background: var(--surface-2);
  color: var(--text);
}
.ws-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.ws-status {
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 9px;
}
.ws-status.warn { background: #fff7ed; color: #9a3412; border: 1px solid #fdba74; }
.ws-status.fail { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.ws-result { border: 1px solid var(--border); border-radius: 8px; padding: 8px; }
.ws-result-head { font-weight: 700; margin-bottom: 4px; }
.ws-message { margin: 0 0 6px; color: var(--text-muted); }
.ws-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.ws-image-card {
  display: flex; flex-direction: column; gap: 4px;
  text-decoration: none; color: inherit; font-size: 8px;
}
.ws-image-card img {
  width: 100%; aspect-ratio: 3/4; object-fit: cover;
  border-radius: 4px; border: 1px solid var(--border);
}
.ws-text-list { margin: 0; padding-left: 14px; }
.ws-text-list li { margin-bottom: 6px; }
.ws-text-list a { font-weight: 700; color: var(--accent-fg); }
.ws-text-list p { margin: 2px 0 0; color: var(--text-muted); }
</style>
