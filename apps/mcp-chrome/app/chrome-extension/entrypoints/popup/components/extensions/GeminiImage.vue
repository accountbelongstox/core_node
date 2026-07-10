<template>
  <div class="gemini-image">
    <label class="gi-label">Prompt</label>
    <textarea
      v-model="prompt"
      class="gi-textarea"
      rows="3"
      placeholder="Describe the image to generate…"
      :disabled="generating"
    ></textarea>

    <div class="gi-controls">
      <label class="gi-checkbox">
        <input type="checkbox" v-model="openInNewTab" :disabled="generating" />
        New tab each run
      </label>
      <button class="gi-generate" :disabled="generating || !prompt.trim()" @click="generate">
        <span class="gi-dot" :class="{ busy: generating }"></span>
        {{ generating ? (phase || 'Working…') : 'Generate image' }}
      </button>
    </div>

    <div class="gi-hint">
      Clicking opens (or reuses) a Gemini tab, submits the prompt, then captures the
      generated image as base64. Requires being signed in to Gemini.
    </div>

    <div v-if="error" class="gi-error">⚠ {{ error }}</div>

    <!-- Result -->
    <div v-if="result && result.dataUrl" class="gi-result">
      <img :src="result.dataUrl" class="gi-img" alt="Generated image" />
      <div class="gi-meta">
        <span class="gi-chip">{{ result.mime || 'image' }}</span>
        <span v-if="result.width" class="gi-chip">{{ result.width }}×{{ result.height }}</span>
        <span class="gi-chip">{{ Math.round((result.dataUrl.length * 3) / 4 / 1024) }} KB</span>
      </div>
      <div class="gi-actions">
        <button class="gi-btn" @click="download">Download</button>
        <button class="gi-btn ghost" @click="copyDataUrl">{{ copied ? 'Copied!' : 'Copy base64' }}</button>
      </div>
      <details class="gi-src">
        <summary>Source URL</summary>
        <code>{{ result.src || '—' }}</code>
      </details>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { useGeminiImage } from '../../composables/useGeminiImage';

const { prompt, generating, phase, error, result, openInNewTab, generate, download } = useGeminiImage();

const copied = ref(false);
const copyDataUrl = async () => {
  if (!result.value?.dataUrl) return;
  try {
    await navigator.clipboard.writeText(result.value.dataUrl);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    /* clipboard may be blocked — ignore */
  }
};
</script>

<style scoped>
.gemini-image {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -16px rgba(0, 0, 0, 0.25);
}
.gi-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.gi-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  background: var(--surface-2);
  color: var(--text);
  resize: vertical;
  font-family: inherit;
}
.gi-textarea:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}
.gi-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.gi-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--text-muted);
}
.gi-generate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  border: none;
  background: #6366f1;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}
.gi-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.gi-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #fff;
}
.gi-dot.busy {
  animation: gi-pulse 1.1s infinite;
}
@keyframes gi-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.gi-hint {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-faint);
  line-height: 1.4;
}
.gi-error {
  margin-top: 8px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3);
  color: var(--danger);
  font-size: 11px;
}
.gi-result {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.gi-img {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--border);
  display: block;
}
.gi-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}
.gi-chip {
  font-size: 9px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
}
.gi-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.gi-btn {
  padding: 5px 12px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.gi-btn.ghost {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
}
.gi-src {
  margin-top: 8px;
  font-size: 9px;
  color: var(--text-faint);
}
.gi-src summary {
  cursor: pointer;
  color: var(--accent-fg);
  font-weight: 700;
}
.gi-src code {
  display: block;
  margin-top: 3px;
  word-break: break-all;
  font-family: ui-monospace, monospace;
}
</style>
