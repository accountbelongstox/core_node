<template>
  <div class="gt-panel">
    <label class="gt-label">{{ getMessage('taskCenterProviderLabel') }}</label>
    <div class="gt-provider-row">
      <button
        v-for="p in PROVIDER_ORDER"
        :key="p"
        class="gt-provider"
        :class="{ active: provider === p }"
        :disabled="testing"
        @click="provider = p"
      >{{ PROVIDER_LABELS[p] }}</button>
    </div>

    <label class="gt-label">{{ getMessage('languagesLabel') }}</label>
    <div class="gt-langs">
      <div v-for="lang in languages" :key="lang.code" class="gt-lang-card">
        <div class="gt-lang-head">
          <span class="gt-lang-name">{{ lang.code.toUpperCase() }} · {{ lang.label }}</span>
          <button
            v-if="languages.length > 1"
            class="gt-lang-remove"
            :title="getMessage('removeLanguageTitle')"
            @click="removeLanguage(lang.code)"
          >×</button>
        </div>
        <div class="gt-toggle-row">
          <button class="gt-toggle" :class="{ active: lang.phonetics }" @click="lang.phonetics = !lang.phonetics">IPA</button>
          <button class="gt-toggle" :class="{ active: lang.sentencePattern }" @click="lang.sentencePattern = !lang.sentencePattern" :title="getMessage('sentencePatternHint')">{{ getMessage('patternLabel') }}</button>
          <button class="gt-toggle" :class="{ active: lang.shortPhrases }" @click="lang.shortPhrases = !lang.shortPhrases">{{ getMessage('phrasesLabel') }}</button>
          <button class="gt-toggle" :class="{ active: lang.words }" @click="lang.words = !lang.words">{{ getMessage('wordsLabel') }}</button>
          <button class="gt-toggle" :class="{ active: lang.grammarPoints }" @click="lang.grammarPoints = !lang.grammarPoints">{{ getMessage('grammarLabel') }}</button>
          <button class="gt-toggle" :class="{ active: lang.expressions }" @click="lang.expressions = !lang.expressions">{{ getMessage('alternateExpressionsLabel') }}</button>
          <input
            v-if="lang.expressions"
            type="number"
            min="2"
            max="6"
            class="gt-count-input"
            v-model.number="lang.expressionsCount"
          />
        </div>
      </div>
    </div>

    <div v-if="addableLanguages.length" class="gt-add-row">
      <span class="gt-add-label">{{ getMessage('addLabel') }}:</span>
      <button
        v-for="code in addableLanguages"
        :key="code"
        class="gt-add-chip"
        @click="addLanguage(code)"
      >{{ code.toUpperCase() }}</button>
    </div>

    <label class="gt-global-row">
      <input type="checkbox" v-model="sourceLanguageSkipExpressions" />
      <span>{{ getMessage('sourceLanguageExpressionsHint') }}</span>
    </label>

    <label class="gt-label">{{ getMessage('articleTextLabel') }}</label>
    <textarea
      v-model="article"
      class="gt-textarea"
      rows="5"
      :placeholder="getMessage('articleTextPlaceholder')"
      :disabled="testing"
    ></textarea>

    <div class="gt-controls">
      <span class="gt-hint">{{ getMessage('articlePromptHint') }}</span>
      <button class="gt-test" :disabled="testing || !article.trim()" @click="runTest">
        <span class="gt-dot" :class="{ busy: testing }"></span>
        {{ testing ? (phase || 'Working…') : 'Test' }}
      </button>
    </div>

    <div v-if="error" class="gt-error">⚠ {{ error }}</div>

    <div v-if="result" class="gt-result">
      <div class="gt-result-label">{{ getMessage('extractedResultLabel') }}</div>
      <div class="gt-result-text">{{ result }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useArticleStudyGuide, PROVIDER_ORDER, PROVIDER_LABELS } from '../../composables/useArticleStudyGuide';
import { GEMINI_TRANSLATE_LANGUAGE_CATALOG, makeGeminiTranslateLangOption } from '../../composables/promptPresets';
import { getMessage } from '@/utils/i18n';

const { provider, article, languages, sourceLanguageSkipExpressions, testing, phase, error, result, runTest } =
  useArticleStudyGuide();

const addableLanguages = computed(() => {
  const used = new Set(languages.value.map((l) => l.code));
  return Object.keys(GEMINI_TRANSLATE_LANGUAGE_CATALOG).filter((code) => !used.has(code));
});

const addLanguage = (code: string) => {
  if (languages.value.some((l) => l.code === code)) return;
  languages.value = [...languages.value, makeGeminiTranslateLangOption(code)];
};

const removeLanguage = (code: string) => {
  if (languages.value.length <= 1) return;
  languages.value = languages.value.filter((l) => l.code !== code);
};
</script>

<style scoped>
.gt-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -16px rgba(0, 0, 0, 0.25);
}
.gt-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.gt-provider-row {
  display: flex;
  gap: 5px;
  margin-bottom: 10px;
}
.gt-provider {
  flex: 1;
  font-size: 10px;
  font-weight: 700;
  padding: 6px 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: pointer;
}
.gt-provider.active {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}
.gt-provider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.gt-langs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}
.gt-lang-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 7px 9px;
  background: var(--surface-2);
}
.gt-lang-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}
.gt-lang-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
}
.gt-lang-remove {
  border: none;
  background: transparent;
  color: var(--text-faint);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
.gt-lang-remove:hover {
  color: var(--danger);
}
.gt-toggle-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}
.gt-toggle {
  font-size: 9px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
}
.gt-toggle.active {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}
.gt-count-input {
  width: 34px;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.gt-add-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  margin-bottom: 10px;
}
.gt-add-label {
  font-size: 10px;
  color: var(--text-faint);
}
.gt-add-chip {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.gt-add-chip:hover {
  border-color: var(--accent);
  color: var(--accent-fg, var(--accent));
}
.gt-global-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 10px;
  cursor: pointer;
}
.gt-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  background: var(--surface-2);
  color: var(--text);
  resize: vertical;
  font-family: inherit;
}
.gt-textarea:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}
.gt-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.gt-hint {
  font-size: 10px;
  color: var(--text-faint);
  line-height: 1.4;
}
.gt-test {
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
  white-space: nowrap;
  flex-shrink: 0;
}
.gt-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.gt-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #fff;
}
.gt-dot.busy {
  animation: gt-pulse 1.1s infinite;
}
@keyframes gt-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.gt-error {
  margin-top: 8px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3);
  color: var(--danger);
  font-size: 11px;
}
.gt-result {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.gt-result-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--success);
  margin-bottom: 4px;
}
.gt-result-text {
  font-size: 12px;
  color: var(--text);
  white-space: pre-wrap;
  max-height: 260px;
  overflow-y: auto;
}
</style>
