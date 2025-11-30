<template>
  <div class="text-reverser-tool">
    <div class="tool-header">
      <h3>Text Reverser</h3>
      <p class="tool-description">Reverse text in various ways</p>
    </div>

    <div class="options-section">
      <div class="option-group">
        <label>Reverse Mode</label>
        <select v-model="reverseMode" class="select-field">
          <option value="characters">Reverse Characters</option>
          <option value="words">Reverse Words</option>
          <option value="lines">Reverse Lines</option>
          <option value="sentences">Reverse Sentences</option>
        </select>
      </div>
      <label class="checkbox-label">
        <input type="checkbox" v-model="preserveCase" />
        Preserve Case Pattern
      </label>
    </div>

    <div class="text-areas">
      <div class="text-group">
        <label>Input Text</label>
        <textarea v-model="inputText" placeholder="Enter text to reverse..."></textarea>
      </div>
      <div class="text-group">
        <label>Reversed Output</label>
        <textarea v-model="outputText" readonly></textarea>
      </div>
    </div>

    <div class="actions">
      <button @click="copyOutput" class="btn-primary">Copy Output</button>
      <button @click="swapTexts" class="btn-secondary">Swap</button>
      <button @click="clearAll" class="btn-secondary">Clear</button>
    </div>

    <div class="examples-section">
      <h4>Examples</h4>
      <div class="examples-grid">
        <div class="example" @click="loadExample('Hello World')">Hello World</div>
        <div class="example" @click="loadExample('The quick brown fox')">The quick brown fox</div>
        <div class="example" @click="loadExample('Line 1\nLine 2\nLine 3')">Multi-line text</div>
      </div>
    </div>

    <div v-if="copied" class="copy-notification">Copied to clipboard!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const inputText = ref('');
const reverseMode = ref('characters');
const preserveCase = ref(false);
const copied = ref(false);

const reverseString = (str: string): string => str.split('').reverse().join('');

const applyCasePattern = (original: string, reversed: string): string => {
  if (!preserveCase.value) return reversed;
  
  return reversed.split('').map((char, i) => {
    if (i >= original.length) return char;
    const origChar = original[i];
    if (origChar === origChar.toUpperCase()) {
      return char.toUpperCase();
    }
    return char.toLowerCase();
  }).join('');
};

const outputText = computed(() => {
  if (!inputText.value) return '';

  let result = '';
  
  switch (reverseMode.value) {
    case 'characters':
      result = reverseString(inputText.value);
      break;
    case 'words':
      result = inputText.value.split(' ').reverse().join(' ');
      break;
    case 'lines':
      result = inputText.value.split('\n').reverse().join('\n');
      break;
    case 'sentences':
      result = inputText.value.split(/([.!?]+\s*)/).reduce((acc, part, i, arr) => {
        if (i % 2 === 0 && i < arr.length - 1) {
          return [part + arr[i + 1], ...acc];
        }
        return acc;
      }, [] as string[]).join('');
      break;
  }

  return applyCasePattern(inputText.value, result);
});

const copyOutput = async () => {
  await navigator.clipboard.writeText(outputText.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

const swapTexts = () => {
  inputText.value = outputText.value;
};

const clearAll = () => {
  inputText.value = '';
};

const loadExample = (text: string) => {
  inputText.value = text;
};
</script>

<style scoped>
.text-reverser-tool {
  padding: 20px;
}
.options-section {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  margin: 20px 0;
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
  height: 200px;
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
.examples-section {
  margin-top: 30px;
}
.examples-grid {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}
.example {
  padding: 8px 16px;
  background: #f1f5f9;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.example:hover {
  background: #e2e8f0;
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

