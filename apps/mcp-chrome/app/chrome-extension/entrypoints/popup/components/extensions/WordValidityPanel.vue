<template>
  <div class="wv-panel">
    <p>
      Single-feature test only. Production batches are pulled from Laravel in the Task tab.
    </p>

    <label>
      <span>{{ getMessage('validityWordsLabel') }}</span>
      <textarea v-model="input" rows="5" placeholder="example&#10;asdfgh&#10;browser" />
    </label>

    <button :disabled="running || words.length === 0" @click="runTest">
      {{ running ? 'Checking…' : 'Run validity test' }}
    </button>

    <div v-if="error" class="wv-error">{{ error }}</div>
    <div v-if="result" class="wv-result">
      <strong>{{ result.provider }}</strong>
      <span>{{ getMessage('validLabel') }}: {{ result.valid.map((item) => item.word).join(', ') || '—' }}</span>
      <span>{{ getMessage('invalidLabel') }}: {{ result.invalid.map((item) => item.word).join(', ') || '—' }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { sendWithWake } from '@/utils/sendWithWake';
import { VALIDITY_RUNNER_MSG } from '@/utils/task-center-types';
import { getMessage } from '@/utils/i18n';

interface ValidityTestResult {
  provider: string;
  valid: Array<{ word: string }>;
  invalid: Array<{ word: string }>;
}

const input = usePersistedRef('wordValidityTestInput', 'example\nasdfgh\nbrowser');
const running = ref(false);
const error = ref('');
const result = ref<ValidityTestResult | null>(null);
const words = computed(() =>
  input.value
    .split(/[\n,]+/)
    .map((word) => word.trim())
    .filter(Boolean),
);

const runTest = async () => {
  running.value = true;
  error.value = '';
  result.value = null;
  try {
    const response = await sendWithWake(
      () => chrome.runtime.sendMessage({
        type: VALIDITY_RUNNER_MSG,
        action: 'test',
        words: words.value,
      }),
      'Word Validity UI',
    );
    if (!response?.success || !response.result) {
      error.value = response?.error || getMessage('validityTestFailed');
      return;
    }
    result.value = response.result as ValidityTestResult;
  } catch (reason: unknown) {
    error.value = reason instanceof Error ? reason.message : getMessage('validityTestFailed');
  } finally {
    running.value = false;
  }
};
</script>

<style scoped>
.wv-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text-muted);
  font-size: 10px;
}
.wv-panel p {
  margin: 0;
  color: var(--text-faint);
}
.wv-panel label,
.wv-result {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.wv-panel textarea {
  padding: 7px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-2);
  color: var(--text);
  resize: vertical;
}
.wv-panel button {
  padding: 7px;
  border-radius: 7px;
  background: var(--accent);
  color: white;
}
.wv-panel button:disabled {
  opacity: 0.5;
}
.wv-result {
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-2);
}
.wv-error {
  color: #fb7185;
}
</style>
