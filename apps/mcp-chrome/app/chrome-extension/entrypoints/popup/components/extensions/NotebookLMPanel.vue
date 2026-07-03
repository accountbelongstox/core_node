<template>
  <div class="nblm-panel">
    <div class="nblm-header">
      <span class="nblm-title">{{ t('notebooklmTitle') }}</span>
    </div>

    <div class="nblm-form">
      <label class="nblm-label">{{ t('notebooklmNotebookUrl') }}</label>
      <input
        v-model="notebookUrl"
        type="text"
        class="nblm-input"
        placeholder="https://notebooklm.google.com/notebook/…"
      />

      <label class="nblm-label">{{ t('notebooklmQuestionLabel') }}</label>
      <div class="nblm-row">
        <input
          v-model="question"
          type="text"
          class="nblm-input"
          placeholder="What is this notebook about?"
          @keyup.enter="onAsk"
        />
        <button class="nblm-button" @click="onAsk" :disabled="asking || !question.trim()">
          {{ asking ? t('notebooklmAsking') : t('notebooklmAsk') }}
        </button>
      </div>

      <div class="nblm-hint">{{ t('notebooklmHint') }}</div>
      <div v-if="error" class="nblm-error">⚠ {{ error }}</div>

      <div v-if="answer" class="nblm-answer">
        <div class="nblm-answer-label">{{ t('notebooklmAnswerLabel') }}</div>
        <div class="nblm-answer-text">{{ answer }}</div>
      </div>
    </div>

    <div class="nblm-divider" />

    <div class="nblm-form">
      <label class="nblm-label">Dialogue test — words/sentences → dialogue</label>
      <textarea
        v-model="dialogueInput"
        class="nblm-textarea"
        rows="3"
        placeholder="Paste a few words or sentences to weave into a dialogue…"
        :disabled="dialogueAsking"
      ></textarea>
      <div class="nblm-row">
        <span class="nblm-row-hint">Built-in prompt: generates a short two-speaker dialogue using every item</span>
        <button
          class="nblm-button"
          @click="onDialogueTest"
          :disabled="dialogueAsking || !dialogueInput.trim()"
        >
          {{ dialogueAsking ? 'Testing…' : 'Test' }}
        </button>
      </div>

      <div v-if="dialogueError" class="nblm-error">⚠ {{ dialogueError }}</div>

      <div v-if="dialogueAnswer" class="nblm-answer">
        <div class="nblm-answer-label">Extracted result</div>
        <div class="nblm-answer-text">{{ dialogueAnswer }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { getMessage as t } from '../../../../utils/i18n';
import { buildNotebookLmDialoguePrompt } from '../../composables/promptPresets';

const question = ref('');
const notebookUrl = ref('');
const answer = ref('');
const error = ref('');
const asking = ref(false);

const dialogueInput = ref('');
const dialogueAnswer = ref('');
const dialogueError = ref('');
const dialogueAsking = ref(false);

const onAsk = async () => {
  if (!question.value.trim() || asking.value) return;
  asking.value = true;
  error.value = '';
  answer.value = '';
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'notebooklm_service',
      action: 'ask',
      question: question.value.trim(),
      notebookUrl: notebookUrl.value.trim() || undefined,
      timeoutMs: 90000,
    });
    if (response && response.success) {
      const r = response.result || {};
      answer.value = r.answer || '';
      if (!answer.value) error.value = r.error || 'No answer returned';
    } else {
      error.value = (response && response.error) || 'NotebookLM request failed';
    }
  } catch (err: any) {
    error.value = err?.message || 'NotebookLM request failed';
  } finally {
    asking.value = false;
  }
};

const onDialogueTest = async () => {
  if (!dialogueInput.value.trim() || dialogueAsking.value) return;
  dialogueAsking.value = true;
  dialogueError.value = '';
  dialogueAnswer.value = '';
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'notebooklm_service',
      action: 'ask',
      question: buildNotebookLmDialoguePrompt(dialogueInput.value),
      notebookUrl: notebookUrl.value.trim() || undefined,
      timeoutMs: 90000,
    });
    if (response && response.success) {
      const r = response.result || {};
      dialogueAnswer.value = r.answer || '';
      if (!dialogueAnswer.value) dialogueError.value = r.error || 'No answer returned';
    } else {
      dialogueError.value = (response && response.error) || 'NotebookLM request failed';
    }
  } catch (err: any) {
    dialogueError.value = err?.message || 'NotebookLM request failed';
  } finally {
    dialogueAsking.value = false;
  }
};
</script>

<style scoped>
.nblm-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  margin-bottom: 12px;
}

.nblm-header {
  margin-bottom: 10px;
}

.nblm-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.nblm-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nblm-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-faint);
}

.nblm-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  background: var(--surface-2);
  color: var(--text);
}

.nblm-divider {
  height: 1px;
  background: var(--border);
  margin: 12px 0;
}

.nblm-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  background: var(--surface-2);
  color: var(--text);
  resize: vertical;
  font-family: inherit;
}

.nblm-textarea::placeholder {
  color: var(--text-faint);
}

.nblm-textarea:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}

.nblm-row-hint {
  font-size: 10px;
  color: var(--text-faint);
  line-height: 1.4;
  flex: 1;
}

.nblm-input::placeholder {
  color: var(--text-faint);
}

.nblm-input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}

.nblm-row {
  display: flex;
  gap: 6px;
}

.nblm-row .nblm-input {
  flex: 1;
}

.nblm-button {
  padding: 0 14px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.nblm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nblm-hint {
  font-size: 10px;
  color: var(--text-faint);
  font-style: italic;
}

/* Error keeps semantic danger color (red). */
.nblm-error {
  font-size: 12px;
  color: var(--danger);
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3);
  border-radius: 6px;
  padding: 6px 8px;
}

/* Answer keeps semantic success accent (green). */
.nblm-answer {
  margin-top: 4px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px;
  padding: 8px 10px;
}

.nblm-answer-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--success);
  margin-bottom: 4px;
}

.nblm-answer-text {
  font-size: 12px;
  color: var(--text);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}
</style>
