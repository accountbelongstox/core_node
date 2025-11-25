<template>
  <div class="text-sorter-tool">
    <div class="tool-header">
      <h3>Text Sorter</h3>
      <p class="tool-description">Sort lines of text alphabetically or numerically</p>
    </div>

    <div class="options-section">
      <div class="option-group">
        <label>Sort Order</label>
        <select v-model="sortOrder" class="select-field">
          <option value="asc">Ascending (A-Z)</option>
          <option value="desc">Descending (Z-A)</option>
        </select>
      </div>
      <div class="option-group">
        <label>Sort Type</label>
        <select v-model="sortType" class="select-field">
          <option value="alphabetic">Alphabetic</option>
          <option value="numeric">Numeric</option>
          <option value="length">By Length</option>
          <option value="natural">Natural Sort</option>
        </select>
      </div>
      <label class="checkbox-label">
        <input type="checkbox" v-model="caseSensitive" />
        Case Sensitive
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="trimLines" />
        Trim Lines
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="removeEmpty" />
        Remove Empty Lines
      </label>
    </div>

    <div class="text-areas">
      <div class="text-group">
        <label>Input Text</label>
        <textarea v-model="inputText" placeholder="Enter text to sort (one item per line)..."></textarea>
      </div>
      <div class="text-group">
        <label>Sorted Output</label>
        <textarea v-model="outputText" readonly></textarea>
      </div>
    </div>

    <div class="actions">
      <button @click="copyOutput" class="btn-primary">Copy Output</button>
      <button @click="shuffleLines" class="btn-secondary">Shuffle</button>
      <button @click="reverseLines" class="btn-secondary">Reverse</button>
      <button @click="clearAll" class="btn-secondary">Clear</button>
    </div>

    <div v-if="copied" class="copy-notification">Copied to clipboard!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const inputText = ref('');
const sortOrder = ref('asc');
const sortType = ref('alphabetic');
const caseSensitive = ref(false);
const trimLines = ref(true);
const removeEmpty = ref(false);
const copied = ref(false);

const naturalSort = (a: string, b: string): number => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

const outputText = computed(() => {
  if (!inputText.value) return '';

  let lines = inputText.value.split('\n');
  
  if (trimLines.value) {
    lines = lines.map(l => l.trim());
  }
  
  if (removeEmpty.value) {
    lines = lines.filter(l => l.length > 0);
  }

  const sortFn = (a: string, b: string): number => {
    let valA = caseSensitive.value ? a : a.toLowerCase();
    let valB = caseSensitive.value ? b : b.toLowerCase();
    let result = 0;

    switch (sortType.value) {
      case 'numeric':
        const numA = parseFloat(valA) || 0;
        const numB = parseFloat(valB) || 0;
        result = numA - numB;
        break;
      case 'length':
        result = valA.length - valB.length;
        break;
      case 'natural':
        result = naturalSort(valA, valB);
        break;
      default:
        result = valA.localeCompare(valB);
    }

    return sortOrder.value === 'desc' ? -result : result;
  };

  return [...lines].sort(sortFn).join('\n');
});

const copyOutput = async () => {
  await navigator.clipboard.writeText(outputText.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

const shuffleLines = () => {
  const lines = inputText.value.split('\n');
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }
  inputText.value = lines.join('\n');
};

const reverseLines = () => {
  inputText.value = inputText.value.split('\n').reverse().join('\n');
};

const clearAll = () => {
  inputText.value = '';
};
</script>

<style scoped>
.text-sorter-tool {
  padding: 20px;
}
.options-section {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  margin: 20px 0;
  flex-wrap: wrap;
}
.option-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.select-field {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
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

