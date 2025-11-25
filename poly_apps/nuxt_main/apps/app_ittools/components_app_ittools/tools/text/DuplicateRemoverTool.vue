<template>
  <div class="duplicate-remover-tool">
    <div class="tool-header">
      <h3>Remove Duplicate Lines</h3>
      <p class="tool-description">Remove duplicate lines from text</p>
    </div>

    <div class="options-section">
      <label class="checkbox-label">
        <input type="checkbox" v-model="caseSensitive" />
        Case Sensitive
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="trimWhitespace" />
        Trim Whitespace
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="removeEmptyLines" />
        Remove Empty Lines
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="sortOutput" />
        Sort Output
      </label>
    </div>

    <div class="text-areas">
      <div class="text-group">
        <label>Input Text</label>
        <textarea v-model="inputText" placeholder="Paste your text here..."></textarea>
        <div class="stats">{{ inputLines }} lines</div>
      </div>
      <div class="text-group">
        <label>Output (Duplicates Removed)</label>
        <textarea v-model="outputText" readonly></textarea>
        <div class="stats">
          {{ outputLines }} lines ({{ removedCount }} duplicates removed)
        </div>
      </div>
    </div>

    <div class="actions">
      <button @click="copyOutput" class="btn-primary">Copy Output</button>
      <button @click="clearAll" class="btn-secondary">Clear</button>
    </div>

    <div v-if="copied" class="copy-notification">Copied to clipboard!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const inputText = ref('');
const caseSensitive = ref(true);
const trimWhitespace = ref(true);
const removeEmptyLines = ref(false);
const sortOutput = ref(false);
const copied = ref(false);

const inputLines = computed(() => {
  if (!inputText.value) return 0;
  return inputText.value.split('\n').length;
});

const outputText = computed(() => {
  if (!inputText.value) return '';

  let lines = inputText.value.split('\n');
  
  if (trimWhitespace.value) {
    lines = lines.map(l => l.trim());
  }
  
  if (removeEmptyLines.value) {
    lines = lines.filter(l => l.length > 0);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const line of lines) {
    const key = caseSensitive.value ? line : line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(line);
    }
  }

  if (sortOutput.value) {
    unique.sort((a, b) => a.localeCompare(b));
  }

  return unique.join('\n');
});

const outputLines = computed(() => {
  if (!outputText.value) return 0;
  return outputText.value.split('\n').filter(l => l || !removeEmptyLines.value).length;
});

const removedCount = computed(() => inputLines.value - outputLines.value);

const copyOutput = async () => {
  await navigator.clipboard.writeText(outputText.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

const clearAll = () => {
  inputText.value = '';
};
</script>

<style scoped>
.duplicate-remover-tool {
  padding: 20px;
}
.options-section {
  display: flex;
  gap: 20px;
  margin: 20px 0;
  flex-wrap: wrap;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.text-areas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.text-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.text-group textarea {
  height: 300px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: monospace;
  resize: vertical;
}
.stats {
  font-size: 12px;
  color: #64748b;
}
.actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.btn-primary {
  padding: 10px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-secondary {
  padding: 10px 24px;
  background: #e2e8f0;
  color: #334155;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.copy-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #22c55e;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
}
</style>

